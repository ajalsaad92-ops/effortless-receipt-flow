import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  Loader2,
  Play,
  Radar,
  RefreshCw,
  Search,
  Square,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Bar, Button, EmptyState, Lamp, Panel, PanelTitle, Readout, StatusChip, Tabs } from "@/components/kit";
import { analyzeTrend } from "@/lib/diagnostics";
import { useI18n } from "@/lib/i18n";
import { EMPTY_READING, LIVE_PIDS, decodePid, demoReading, type LiveReading } from "@/lib/obd";
import { useObd } from "@/lib/obd-context";
import { GROUP_LABELS, PIDS, PID_MAP, SUPPORT_QUERIES, type PidGroup } from "@/lib/pids";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "البيانات الحية — قراءات المحرك والحساسات لحظياً" },
      {
        name: "description",
        content:
          "تابع دوران المحرك والسرعة والحرارة والحمل لحظياً، واكتشف كل الحساسات التي تدعمها سيارتك مع تشخيص تلقائي وتصدير CSV.",
      },
      { property: "og:title", content: "البيانات الحية عبر OBD2" },
      { property: "og:description", content: "قراءات لحظية وتشخيص تلقائي وتصدير CSV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

const GAUGES: Array<{ key: keyof LiveReading; ar: string; en: string; unit: string; max: number }> = [
  { key: "rpm", ar: "دوران المحرك", en: "Engine RPM", unit: "rpm", max: 7000 },
  { key: "speed", ar: "السرعة", en: "Speed", unit: "km/h", max: 220 },
  { key: "coolant", ar: "حرارة الماء", en: "Coolant", unit: "°C", max: 130 },
  { key: "load", ar: "حمل المحرك", en: "Load", unit: "%", max: 100 },
  { key: "intake", ar: "حرارة الهواء", en: "Intake", unit: "°C", max: 90 },
  { key: "throttle", ar: "فتحة الخانق", en: "Throttle", unit: "%", max: 100 },
];

type Tab = "gauges" | "sensors";

function LivePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("gauges");

  return (
    <AppShell>
      <PageHeader title={t("live_title")} description={t("live_hint")} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "gauges", label: t("tab_gauges") },
          { value: "sensors", label: t("tab_all_sensors") },
        ]}
      />
      <div className="mt-4">{tab === "gauges" ? <Gauges /> : <SensorExplorer />}</div>
    </AppShell>
  );
}

/* ── Gauges + auto diagnosis ────────────────────────────────────────────── */

function Gauges() {
  const { t, lang } = useI18n();
  const { status, connection, owner, acquire, release } = useObd();
  const [running, setRunning] = useState(false);
  const [demo, setDemo] = useState(false);
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [samples, setSamples] = useState<Array<LiveReading & { at: string }>>([]);
  const tick = useRef(0);
  const findings = useMemo(() => analyzeTrend(samples), [samples]);

  // The assistant's live-diagnostic mode takes the adapter exclusively; queueing
  // behind its commands would make these gauges crawl, so we stand down.
  const blocked = owner !== null && owner !== "live";

  useEffect(() => {
    if (!running || blocked) return;
    if (!acquire("live")) return;
    let cancelled = false;
    let timer = 0;
    // One object mutated in place so gauges update value-by-value rather than
    // waiting for a full slow round-trip of every PID. Fields start null —
    // "not read" must never look like a real zero.
    const current: LiveReading = { ...EMPTY_READING };

    const loop = async () => {
      while (!cancelled) {
        const started = Date.now();
        if (demo || status !== "connected") {
          Object.assign(current, demoReading(tick.current++));
          if (cancelled) return;
          setReading({ ...current });
        } else {
          // ELM327 is single-threaded: one PID at a time, never in parallel.
          for (const key of Object.keys(LIVE_PIDS) as Array<keyof typeof LIVE_PIDS>) {
            if (cancelled) return;
            try {
              const data = await connection.readPid(LIVE_PIDS[key]);
              if (data && data.length) current[key] = decodePid(key, data);
            } catch {
              /* keep the previous value rather than blanking the gauge */
            }
            if (cancelled) return;
            setReading({ ...current });
          }
          if (tick.current % 10 === 0) {
            try {
              const raw = await connection.send("ATRV", 3000);
              const parsed = parseFloat(raw.replace(/[^0-9.]/g, ""));
              if (!Number.isNaN(parsed) && parsed > 5 && parsed < 20) current.voltage = parsed;
            } catch {
              /* not all clones answer ATRV */
            }
          }
          tick.current++;
          if (cancelled) return;
          setReading({ ...current });
        }

        setSamples((prev) => [...prev.slice(-299), { ...current, at: new Date().toISOString() }]);
        const wait = Math.max(200, 1000 - (Date.now() - started));
        await new Promise<void>((resolve) => {
          timer = window.setTimeout(resolve, wait);
        });
      }
    };

    void loop();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      release("live");
    };
  }, [running, blocked, demo, status, connection, acquire, release]);

  const exportCsv = () => {
    if (samples.length === 0) {
      toast.error(t("live_hint"));
      return;
    }
    // Unread sensors export as empty cells, not zeroes — a spreadsheet full of
    // fake zeroes is worse than an obvious gap.
    const cell = (v: number | null) => (v === null ? "" : String(v));
    const header = ["timestamp", ...GAUGES.map((g) => g.key), "voltage"].join(",");
    const rows = samples.map((s) => [s.at, ...GAUGES.map((g) => cell(s[g.key])), cell(s.voltage)].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `obd-live-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={running ? "ghost" : "primary"} onClick={() => setRunning((r) => !r)} disabled={blocked}>
          {running ? <Square className="size-4" /> : <Play className="size-4" />}
          {running ? t("stop_stream") : t("start_stream")}
        </Button>
        <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={demo}
            onChange={(e) => setDemo(e.target.checked)}
            className="size-4 accent-[oklch(0.78_0.155_68)]"
          />
          {t("demo_mode")}
        </label>
        <Button onClick={exportCsv}>
          <Download className="size-4" />
          {t("export_report")}
        </Button>
        {running ? (
          <StatusChip tone="accent" live>
            {samples.length}
          </StatusChip>
        ) : null}
      </div>

      {blocked ? (
        <p className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
          {t("live_mode_on")}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GAUGES.map((gauge) => {
          const value = reading ? reading[gauge.key] : null;
          const pct = value === null ? 0 : (value / gauge.max) * 100;
          return (
            <Panel key={gauge.key}>
              <Readout
                label={lang === "ar" ? gauge.ar : gauge.en}
                value={value}
                unit={gauge.unit}
                size="lg"
                tone="accent"
              />
              <div
                className="mt-3"
                role="progressbar"
                aria-valuenow={value ?? undefined}
                aria-valuemin={0}
                aria-valuemax={gauge.max}
                aria-label={lang === "ar" ? gauge.ar : gauge.en}
              >
                <Bar pct={pct} />
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <PanelTitle icon={Activity}>{t("auto_diag")}</PanelTitle>
        <p className="-mt-2 mb-4 text-xs leading-relaxed text-muted-foreground">{t("auto_diag_d")}</p>

        {samples.length === 0 ? (
          <EmptyState>{t("diag_waiting")}</EmptyState>
        ) : findings.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
            <Lamp tone="ok" />
            {t("all_good")}
          </div>
        ) : (
          <ul className="space-y-2">
            {findings.map((finding) => {
              const Icon =
                finding.level === "bad" ? AlertTriangle : finding.level === "warn" ? TriangleAlert : CheckCircle2;
              const tone =
                finding.level === "bad"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : finding.level === "warn"
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-success/40 bg-success/10 text-success";
              return (
                <li key={finding.id} className={`rounded-lg border p-3 ${tone}`}>
                  <p className="flex gap-2 text-sm font-medium leading-relaxed">
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    {lang === "ar" ? finding.ar : finding.en}
                  </p>
                  <p className="mt-1.5 ps-6 text-xs text-muted-foreground">
                    {t("expected_val")}: {lang === "ar" ? finding.expectedAr : finding.expectedEn}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ── Sensor explorer (previously its own page) ──────────────────────────── */

const ECU_ADDRESSES = [
  { header: "7E0", ar: "كمبيوتر المحرك ECM", en: "Engine control (ECM)" },
  { header: "7E1", ar: "ناقل الحركة TCM", en: "Transmission (TCM)" },
  { header: "760", ar: "نظام الفرامل ABS / EBCM", en: "Brakes / ABS (EBCM)" },
  { header: "761", ar: "نظام الثبات ESC", en: "Stability control (ESC)" },
  { header: "7A0", ar: "وسائد الهواء SRS", en: "Airbags (SRS)" },
  { header: "740", ar: "لوحة العدادات IPC", en: "Instrument cluster (IPC)" },
  { header: "744", ar: "التكييف HVAC", en: "Climate (HVAC)" },
  { header: "750", ar: "وحدة الجسم BCM", en: "Body control (BCM)" },
  { header: "720", ar: "الدركسون الكهربائي EPS", en: "Power steering (EPS)" },
  { header: "730", ar: "نظام الترفيه / الراديو", en: "Radio / infotainment" },
  { header: "770", ar: "وحدة الاتصالات / OnStar", en: "Telematics / OnStar" },
  { header: "780", ar: "وحدة الوقود / المضخة", en: "Fuel pump module" },
];

type EcuRow = { header: string; ar: string; en: string; online: boolean };

function SensorExplorer() {
  const { t, lang } = useI18n();
  const { status, connection } = useObd();
  const connected = status === "connected";

  const [supported, setSupported] = useState<string[] | null>(null);
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [busy, setBusy] = useState<"scan" | "read" | "ecu" | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<PidGroup | "all">("all");
  const [ecus, setEcus] = useState<EcuRow[]>([]);

  const list = useMemo(() => {
    const base = supported ? supported.filter((p) => PID_MAP.has(p)).map((p) => PID_MAP.get(p)!) : PIDS;
    const q = query.trim().toLowerCase();
    return base.filter(
      (p) =>
        (group === "all" || p.group === group) &&
        (q === "" || p.pid.toLowerCase().includes(q) || p.ar.includes(query.trim()) || p.en.toLowerCase().includes(q)),
    );
  }, [supported, query, group]);

  const requireLink = () => {
    if (!connected) {
      toast.error(t("need_connection"));
      return false;
    }
    return true;
  };

  const discover = async () => {
    if (!requireLink()) return;
    setBusy("scan");
    try {
      const found = await connection.readSupportedPids(SUPPORT_QUERIES);
      setSupported(found);
      toast.success(`${found.filter((p) => PID_MAP.has(p)).length} ${t("sensors_found")}`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const readAll = async () => {
    if (!requireLink()) return;
    setBusy("read");
    try {
      const next: Record<string, number | null> = {};
      for (const def of list) {
        try {
          const bytes = await connection.readPid(def.pid);
          next[def.pid] = bytes ? def.decode(bytes) : null;
        } catch {
          next[def.pid] = null;
        }
      }
      setValues((prev) => ({ ...prev, ...next }));
    } finally {
      setBusy(null);
    }
  };

  const scanEcus = async () => {
    if (!requireLink()) return;
    setBusy("ecu");
    try {
      setEcus(await connection.discoverEcus(ECU_ADDRESSES));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={discover} disabled={busy !== null}>
          {busy === "scan" ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
          {t("discover_sensors")}
        </Button>
        <Button onClick={readAll} disabled={busy !== null}>
          {busy === "read" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {t("read_all_values")}
        </Button>
        <Button onClick={scanEcus} disabled={busy !== null}>
          {busy === "ecu" ? <Loader2 className="size-4 animate-spin" /> : <Cpu className="size-4" />}
          {t("scan_modules")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_sensors")}
            className="h-10 w-full rounded-lg border border-border bg-background ps-9 pe-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as PidGroup | "all")}
          aria-label={t("all_groups")}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        >
          <option value="all">{t("all_groups")}</option>
          {(Object.keys(GROUP_LABELS) as PidGroup[]).map((key) => (
            <option key={key} value={key}>
              {lang === "ar" ? GROUP_LABELS[key].ar : GROUP_LABELS[key].en}
            </option>
          ))}
        </select>
        <span className="label-micro">
          {supported ? t("showing_supported") : t("showing_all")} · {list.length}
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((def) => {
          const value = values[def.pid];
          const span = (def.max ?? 100) - (def.min ?? 0);
          const pct = value == null ? 0 : ((value - (def.min ?? 0)) / (span || 1)) * 100;
          return (
            <Panel key={def.pid} className="!p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium leading-snug">{lang === "ar" ? def.ar : def.en}</p>
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  01{def.pid}
                </span>
              </div>
              <p className="mt-2 flex items-baseline gap-1">
                <span className={`font-mono text-xl font-semibold ${value == null ? "text-muted-foreground" : ""}`}>
                  {value == null ? "—" : value}
                </span>
                <span className="text-[11px] text-muted-foreground">{def.unit}</span>
              </p>
              <div className="mt-2.5">
                <Bar pct={pct} tone={value == null ? "idle" : "accent"} />
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <PanelTitle icon={Cpu}>{t("modules_on_bus")}</PanelTitle>
        <p className="-mt-2 mb-4 text-xs leading-relaxed text-muted-foreground">{t("modules_d")}</p>
        {ecus.length === 0 ? (
          <EmptyState>{t("modules_empty")}</EmptyState>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {ecus.map((ecu) => (
              <div
                key={ecu.header}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{lang === "ar" ? ecu.ar : ecu.en}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{ecu.header}</p>
                </div>
                <StatusChip tone={ecu.online ? "ok" : "idle"}>
                  {ecu.online ? t("module_online") : t("module_offline")}
                </StatusChip>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
