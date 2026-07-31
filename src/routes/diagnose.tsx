import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bluetooth,
  Bot,
  Car,
  Copy,
  Cpu,
  Download,
  Eraser,
  Info,
  Keyboard,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Terminal,
  Usb,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button, EmptyState, Field, Lamp, Panel, PanelTitle, Readout, StatusChip, Tabs } from "@/components/kit";
import { SeverityPill } from "@/components/SeverityPill";
import { BRAND_LIST, useBrand, type ActuatorTest } from "@/lib/brands";
import { findDtc } from "@/lib/dtc-data";
import { useScans, useVehicles } from "@/lib/garage";
import { useI18n } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";
import { describeVin } from "@/lib/vin";
import { SCAN_STEPS, reportToText, runFullScan, useVehicleReport } from "@/lib/vehicle-report";

export const Route = createFileRoute("/diagnose")({
  head: () => ({
    meta: [
      { title: "الفحص — قراءة أعطال OBD2 وتقرير شامل لسيارات GM" },
      {
        name: "description",
        content:
          "اتصل بجهاز ELM327، اقرأ أكواد الأعطال وامسحها، ونفّذ فحصاً شاملاً يشمل رقم الهيكل والحساسات ووحدات التحكم.",
      },
      { property: "og:title", content: "فحص السيارة عبر OBD2" },
      { property: "og:description", content: "قراءة الأعطال والفحص الشامل ووحدات التحكم في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiagnosePage,
});

type Tab = "quick" | "report" | "advanced";

function DiagnosePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("quick");
  const { report } = useVehicleReport();

  const activeCodes = report ? report.stored.length + report.pending.length : 0;

  return (
    <AppShell>
      <PageHeader title={t("diagnose_title")} description={t("diagnose_d")} />
      <ConnectionPanel />

      <div className="mt-4">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "quick", label: t("tab_quick_scan") },
            { value: "report", label: t("tab_full_report"), badge: activeCodes || undefined },
            { value: "advanced", label: t("tab_advanced") },
          ]}
        />
      </div>

      <div className="mt-4">
        {tab === "quick" ? <QuickScan /> : tab === "report" ? <FullReport /> : <Advanced />}
      </div>
    </AppShell>
  );
}

/* ── Connection ─────────────────────────────────────────────────────────── */

function ConnectionPanel() {
  const { t } = useI18n();
  const { status, supported, serialSupported, transport, connect, disconnect, deviceName } = useObd();
  const [baud, setBaud] = useState(38400);
  const [showHelp, setShowHelp] = useState(false);

  const handleConnect = async (kind: "ble" | "serial") => {
    try {
      await connect(kind, baud);
      toast.success(t("connected"));
    } catch (error) {
      const message = (error as Error).message;
      toast.error(
        message === "bluetooth-unsupported"
          ? t("bt_unsupported")
          : message === "serial-unsupported"
            ? t("serial_unsupported")
            : message,
      );
      setShowHelp(true);
    }
  };

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg border border-border bg-elevated">
            <Bluetooth className="size-4 text-primary" />
          </span>
          <div>
            <p className="text-sm font-semibold">{t("bluetooth")}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {status === "connected"
                ? `${deviceName} · ${transport === "serial" ? "SPP/COM" : "BLE"}`
                : t("disconnected")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === "connected" ? (
            <>
              <StatusChip tone="ok" live>
                {t("connected")}
              </StatusChip>
              <Button onClick={disconnect}>{t("disconnect")}</Button>
            </>
          ) : (
            <>
              <select
                value={baud}
                onChange={(e) => setBaud(Number(e.target.value))}
                aria-label={t("baud_rate")}
                className="h-9 rounded-lg border border-border bg-background px-2 font-mono text-xs"
              >
                {[9600, 38400, 115200, 500000].map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <Button onClick={() => handleConnect("serial")} disabled={status === "connecting"}>
                <Usb className="size-4" />
                {t("connect_serial")}
              </Button>
              <Button variant="primary" onClick={() => handleConnect("ble")} disabled={status === "connecting"}>
                {status === "connecting" ? <Loader2 className="size-4 animate-spin" /> : <Bluetooth className="size-4" />}
                {status === "connecting" ? t("connecting") : t("connect_ble")}
              </Button>
            </>
          )}
        </div>
      </div>

      {!supported && !serialSupported ? (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
          {t("bt_unsupported")}
        </p>
      ) : null}

      <button
        onClick={() => setShowHelp((v) => !v)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary"
      >
        <Info className="size-3.5" />
        {t("laptop_help_title")}
      </button>
      {showHelp ? (
        <p className="mt-2 rounded-lg bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
          {t("laptop_help_body")}
        </p>
      ) : null}
    </Panel>
  );
}

/* ── Quick scan ─────────────────────────────────────────────────────────── */

function QuickScan() {
  const { t, lang } = useI18n();
  const { status, connection } = useObd();
  const { addScan } = useScans();
  const { vehicles } = useVehicles();

  const [codes, setCodes] = useState<string[] | null>(null);
  const [source, setSource] = useState<"bluetooth" | "manual">("manual");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const handleRead = async () => {
    setBusy(true);
    try {
      setCodes(await connection.readTroubleCodes());
      setSource("bluetooth");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      await connection.clearTroubleCodes();
      setCodes([]);
      toast.success(t("cleared_ok"));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  };

  const handleManual = () => {
    const entered = manual
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((c) => /^[PBCU][0-9A-F]{4}$/.test(c));
    if (entered.length === 0) {
      toast.error(t("manual_hint"));
      return;
    }
    setCodes(entered);
    setSource("manual");
  };

  const save = () => {
    if (!codes) return;
    addScan({ date: new Date().toISOString(), source, vehicleId: vehicleId || null, codes });
    toast.success(t("saved"));
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel>
        <PanelTitle icon={RefreshCw}>{t("read_codes")}</PanelTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={handleRead} disabled={busy || status !== "connected"}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("read_codes")}
          </Button>
          <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={busy || status !== "connected"}>
            <Eraser className="size-4" />
            {t("clear_codes")}
          </Button>
        </div>

        {confirmClear ? (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p className="text-sm font-medium text-warning">{t("confirm_clear_title")}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("confirm_clear_body")}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" onClick={handleClear} disabled={busy}>
                {t("confirm")}
              </Button>
              <Button onClick={() => setConfirmClear(false)}>{t("cancel")}</Button>
            </div>
          </div>
        ) : null}

        <div className="rule-fade my-4" />

        <PanelTitle icon={Keyboard}>{t("manual_entry")}</PanelTitle>
        <Field
          value={manual}
          onChange={setManual}
          placeholder={t("manual_hint")}
          mono
          onKeyDown={(e) => e.key === "Enter" && handleManual()}
        />
        <Button className="mt-3 w-full" onClick={handleManual}>
          {t("lookup")}
        </Button>
      </Panel>

      <Panel>
        <PanelTitle icon={AlertTriangle}>
          {t("codes_summary")}
          {codes ? <span className="ms-2 font-mono text-muted-foreground">{codes.length}</span> : null}
        </PanelTitle>

        {codes === null ? (
          <EmptyState>{t("manual_hint")}</EmptyState>
        ) : codes.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            <Lamp tone="ok" />
            {t("no_codes_found")}
          </div>
        ) : (
          <ul className="space-y-2">
            {codes.map((code) => {
              const dtc = findDtc(code);
              return (
                <li key={code}>
                  <Link
                    to="/codes/$code"
                    params={{ code }}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated p-3 transition-colors hover:bg-secondary"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-semibold text-primary">{code}</span>
                      {dtc ? <p className="mt-1 truncate text-xs text-muted-foreground">{dtc.title[lang]}</p> : null}
                    </div>
                    {dtc ? <SeverityPill severity={dtc.severity} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {codes && codes.length >= 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {vehicles.length > 0 ? (
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                aria-label={t("nav_garage")}
                className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value="">—</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nickname || v.model}
                  </option>
                ))}
              </select>
            ) : null}
            <Button onClick={save}>
              <Save className="size-4" />
              {t("saved")}
            </Button>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

/* ── Full report ────────────────────────────────────────────────────────── */

function FullReport() {
  const { t, lang } = useI18n();
  const { status, connection } = useObd();
  const { report, store } = useVehicleReport();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);

  const run = async () => {
    if (status !== "connected") {
      toast.error(t("need_connection"));
      return;
    }
    setBusy(true);
    try {
      store(await runFullScan(connection, setStep));
      toast.success(t("scan_done"));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob([reportToText(report, lang)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vehicle-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const info = report?.vinInfo ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {t("run_full_scan")}
        </Button>
        {report ? (
          <>
            <Button onClick={download}>
              <Download className="size-4" />
              {t("export_report")}
            </Button>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(reportToText(report, lang));
                toast.success(t("copied"));
              }}
            >
              <Copy className="size-4" />
              {t("copy_report")}
            </Button>
            <Link
              to="/assistant"
              search={{ q: undefined }}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary"
            >
              <Bot className="size-4" />
              {t("ask_ai_with_report")}
            </Link>
          </>
        ) : null}
      </div>

      {busy ? (
        <Panel>
          <ol className="space-y-2">
            {SCAN_STEPS.map((s) => {
              const done = SCAN_STEPS.findIndex((x) => x.id === step) > SCAN_STEPS.findIndex((x) => x.id === s.id);
              const active = step === s.id;
              return (
                <li key={s.id} className="flex items-center gap-2.5 text-sm">
                  {done ? (
                    <Lamp tone="ok" />
                  ) : active ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <Lamp tone="idle" />
                  )}
                  <span className={active ? "font-medium" : "text-muted-foreground"}>
                    {lang === "ar" ? s.ar : s.en}
                  </span>
                </li>
              );
            })}
          </ol>
        </Panel>
      ) : null}

      {!report && !busy ? <EmptyState>{t("report_empty")}</EmptyState> : null}

      {report ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel>
            <PanelTitle icon={Car}>{t("vehicle_identity")}</PanelTitle>
            <p className="font-mono text-sm text-primary" dir="ltr">
              {report.vin ?? "—"}
            </p>
            {info ? <p className="mt-1 text-sm">{describeVin(info, lang)}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Readout label={t("make")} value={info?.make} size="sm" />
              <Readout label={t("year")} value={info?.year} size="sm" />
              <Readout label={t("battery_v")} value={report.voltage} unit="V" size="sm" />
              <Readout label={t("protocol")} value={report.protocol} size="sm" />
              <Readout label={t("cal_id")} value={report.calId} size="sm" />
              <Readout label={t("ecu_name")} value={report.ecuName} size="sm" />
            </div>
          </Panel>

          <Panel>
            <PanelTitle icon={AlertTriangle}>{t("codes_summary")}</PanelTitle>
            <div className="mb-3 flex items-center gap-2">
              <span className="label-micro">{t("mil_lamp")}</span>
              {report.mil === null ? (
                <StatusChip tone="idle">—</StatusChip>
              ) : report.mil ? (
                <StatusChip tone="bad">{t("mil_on")}</StatusChip>
              ) : (
                <StatusChip tone="ok">{t("mil_off")}</StatusChip>
              )}
            </div>
            {(["stored", "pending", "permanent"] as const).map((kind) => (
              <div key={kind} className="mt-3">
                <p className="label-micro">{t(`dtc_${kind}` as const)}</p>
                {report[kind].length === 0 ? (
                  <p className="mt-1.5 text-sm text-success">{t("no_codes_found")}</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {report[kind].map((code) => (
                      <Link
                        key={`${kind}-${code}`}
                        to="/codes/$code"
                        params={{ code }}
                        className="rounded border border-border bg-elevated px-2 py-1 font-mono text-xs hover:bg-secondary"
                      >
                        {code}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Panel>

          <Panel>
            <PanelTitle icon={RefreshCw}>
              {t("sensor_snapshot")} <span className="font-mono text-muted-foreground">{report.sensors.length}</span>
            </PanelTitle>
            {report.sensors.length === 0 ? (
              <EmptyState>—</EmptyState>
            ) : (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {report.sensors.map((s) => (
                  <li
                    key={s.pid}
                    className="flex items-center justify-between gap-3 rounded border border-border bg-elevated px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate">{lang === "ar" ? s.ar : s.en}</span>
                    <span className="shrink-0 font-mono font-medium">
                      {s.value} {s.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelTitle icon={Cpu}>{t("modules_on_bus")}</PanelTitle>
            <ul className="space-y-1.5">
              {report.modules.map((m) => (
                <li
                  key={m.header}
                  className="flex items-center justify-between gap-3 rounded border border-border bg-elevated px-2.5 py-1.5 text-xs"
                >
                  <span>{lang === "ar" ? m.ar : m.en}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{m.header}</span>
                    <Lamp tone={m.online ? "ok" : "idle"} />
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

/* ── Advanced: brand profiles, actuator tests, raw console ──────────────── */

function Advanced() {
  const { t, lang } = useI18n();
  const { brand, profile, setBrand } = useBrand();
  const { status, connection } = useObd();
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<Array<{ command: string; response: string }>>([]);
  const [manual, setManual] = useState("");
  const connected = status === "connected";

  const run = async (id: string, commands: string[]) => {
    if (!connected) {
      toast.error(t("need_connection"));
      return;
    }
    setBusy(id);
    try {
      const entries = await connection.runCommands(commands);
      setLog((prev) => [...entries.reverse(), ...prev].slice(0, 60));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <Panel>
        <PanelTitle icon={Cpu}>{t("select_brand")}</PanelTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {BRAND_LIST.map((b) => (
            <button
              key={b.key}
              onClick={() => {
                setBrand(b.key);
                toast.success(t("brand_saved"));
              }}
              className={`rounded-lg border p-3 text-start transition-colors ${
                brand === b.key ? "border-primary bg-primary/10" : "border-border bg-elevated hover:bg-secondary"
              }`}
            >
              <p className="text-sm font-medium">{lang === "ar" ? b.ar : b.en}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {lang === "ar" ? b.protocolAr : b.protocolEn}
              </p>
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          className="mt-4"
          onClick={() => void run("profile", profile.init)}
          disabled={busy === "profile"}
        >
          {busy === "profile" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {t("apply_profile")}
        </Button>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground" dir="ltr">
          {profile.init.join(" · ")}
        </p>
      </Panel>

      <div className="grid gap-2.5 md:grid-cols-2">
        {profile.tests.map((test) => (
          <TestCard key={test.id} test={test} busy={busy === test.id} onRun={() => void run(test.id, test.commands)} />
        ))}
      </div>

      <Panel>
        <PanelTitle icon={Terminal}>{t("raw_console")}</PanelTitle>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-48 flex-1">
            <Field
              value={manual}
              onChange={setManual}
              placeholder="ATRV / 0105 / 03"
              mono
              onKeyDown={(e) => {
                if (e.key === "Enter" && manual.trim()) void run("manual", [manual.trim().toUpperCase()]);
              }}
            />
          </div>
          <Button
            className="self-end"
            onClick={() => manual.trim() && void run("manual", [manual.trim().toUpperCase()])}
          >
            {t("send_command")}
          </Button>
        </div>

        {log.length > 0 ? (
          <div className="mt-4 max-h-72 space-y-1 overflow-auto rounded-lg border border-border bg-background p-3" dir="ltr">
            {log.map((entry, i) => (
              <p key={`${entry.command}-${i}`} className="font-mono text-[11px] leading-relaxed">
                <span className="text-primary">&gt; {entry.command}</span>
                <span className="text-muted-foreground"> {entry.response || "…"}</span>
              </p>
            ))}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function TestCard({ test, busy, onRun }: { test: ActuatorTest; busy: boolean; onRun: () => void }) {
  const { t, lang } = useI18n();
  return (
    <Panel className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-relaxed">{lang === "ar" ? test.ar : test.en}</p>
        <StatusChip tone={test.bidirectional ? "warn" : "idle"}>
          {test.bidirectional ? t("bidir") : t("read_only")}
        </StatusChip>
      </div>
      <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
        {test.bidirectional ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" /> : null}
        {lang === "ar" ? test.noteAr : test.noteEn}
      </p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground" dir="ltr">
        {test.commands.join(" · ")}
      </p>
      <Button className="mt-3 self-start" onClick={onRun} disabled={busy}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
        {t("run_test")}
      </Button>
    </Panel>
  );
}
