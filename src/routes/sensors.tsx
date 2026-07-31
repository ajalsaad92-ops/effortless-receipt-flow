import { createFileRoute } from "@tanstack/react-router";
import { Activity, ChevronLeft, Cpu, Loader2, Radar, RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";
import { GROUP_LABELS, PIDS, PID_MAP, SUPPORT_QUERIES, type PidGroup } from "@/lib/pids";

export const Route = createFileRoute("/sensors")({
  head: () => ({
    meta: [
      { title: "مستكشف الحساسات ووحدات التحكم — كل قيم OBD2 الحية" },
      {
        name: "description",
        content: "اكتشف تلقائياً كل الحساسات التي تدعمها سيارتك، اقرأ قيمها الحية بالوحدات الصحيحة، وافحص وحدات التحكم المتصلة على الشبكة.",
      },
      { property: "og:title", content: "مستكشف حساسات ووحدات OBD2" },
      { property: "og:description", content: "اكتشاف تلقائي للحساسات المدعومة وقراءة قيمها الحية وفحص وحدات التحكم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SensorsPage,
});

const ECU_ADDRESSES = [
  { header: "7E0", ar: "كمبيوتر المحرك ECM", en: "Engine control (ECM)" },
  { header: "7E1", ar: "ناقل الحركة TCM", en: "Transmission (TCM)" },
  { header: "7E2", ar: "وحدة إضافية 1", en: "Auxiliary module 1" },
  { header: "7E3", ar: "وحدة إضافية 2", en: "Auxiliary module 2" },
  { header: "7E4", ar: "وحدة إضافية 3", en: "Auxiliary module 3" },
  { header: "7E5", ar: "وحدة إضافية 4", en: "Auxiliary module 4" },
  { header: "7E6", ar: "وحدة إضافية 5", en: "Auxiliary module 5" },
  { header: "7E7", ar: "وحدة إضافية 6", en: "Auxiliary module 6" },
  { header: "760", ar: "نظام الفرامل ABS / EBCM", en: "Brakes / ABS (EBCM)" },
  { header: "761", ar: "نظام الثبات ESC", en: "Stability control (ESC)" },
  { header: "7A0", ar: "وسائد الهواء SRS", en: "Airbags (SRS)" },
  { header: "740", ar: "لوحة العدادات IPC", en: "Instrument cluster (IPC)" },
  { header: "744", ar: "التكييف HVAC", en: "Climate (HVAC)" },
  { header: "746", ar: "مروحة/تبريد إضافي", en: "Cooling / fan module" },
  { header: "750", ar: "وحدة الجسم BCM", en: "Body control (BCM)" },
  { header: "751", ar: "وحدة الأبواب / النوافذ", en: "Door / window module" },
  { header: "720", ar: "الدركسون الكهربائي EPS", en: "Power steering (EPS)" },
  { header: "730", ar: "نظام الترفيه / الراديو", en: "Radio / infotainment" },
  { header: "731", ar: "وحدة الشاشة HMI", en: "Display / HMI module" },
  { header: "732", ar: "الكاميرا الأمامية", en: "Front camera module" },
  { header: "733", ar: "رادار / مساعدات القيادة", en: "Radar / ADAS" },
  { header: "764", ar: "مستشعرات الركن", en: "Parking sensors" },
  { header: "770", ar: "وحدة الاتصالات / OnStar", en: "Telematics / OnStar" },
  { header: "771", ar: "مفتاح الإشعال / الإمّوبيلايزر", en: "Immobilizer / ignition" },
  { header: "780", ar: "وحدة الوقود / المضخة", en: "Fuel pump module" },
  { header: "7B0", ar: "حزام الأمان / التصادم", en: "Restraints / crash sensor" },
  { header: "7C0", ar: "إضاءة / مصابيح أمامية", en: "Lighting / headlamp module" },
  { header: "7D0", ar: "وحدة السقف / الفتحة", en: "Roof / sunroof module" },
];

type EcuRow = { header: string; ar: string; en: string; online: boolean };
type EcuDetail = { pids: string[]; dtcs: string[]; vin: string | null; raw: string };

function SensorsPage() {
  const { t, lang } = useI18n();
  const { status, connection } = useObd();
  const connected = status === "connected";

  const [supported, setSupported] = useState<string[] | null>(null);
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [busy, setBusy] = useState<"scan" | "read" | "ecu" | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<PidGroup | "all">("all");
  const [ecus, setEcus] = useState<EcuRow[]>([]);
  const [openEcu, setOpenEcu] = useState<EcuRow | null>(null);
  const [ecuDetail, setEcuDetail] = useState<EcuDetail | null>(null);
  const [probing, setProbing] = useState(false);
  const [vin, setVin] = useState<string | null>(null);

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
      const foundVin = await connection.readVin().catch(() => null);
      setVin(foundVin);
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

  const openModule = async (ecu: EcuRow) => {
    if (!ecu.online || !requireLink()) return;
    setOpenEcu(ecu);
    setEcuDetail(null);
    setProbing(true);
    try {
      setEcuDetail(await connection.probeEcu(ecu.header));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setProbing(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title={t("sensors_title")} description={t("sensors_d")} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={discover}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy === "scan" ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
          {t("discover_sensors")}
        </button>
        <button
          onClick={readAll}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm hover:bg-secondary disabled:opacity-60"
        >
          {busy === "read" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {t("read_all_values")}
        </button>
        <button
          onClick={scanEcus}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm hover:bg-secondary disabled:opacity-60"
        >
          {busy === "ecu" ? <Loader2 className="size-4 animate-spin" /> : <Cpu className="size-4" />}
          {t("scan_modules")}
        </button>
      </div>

      {vin ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground" dir="ltr">
          VIN: {vin}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56">
          <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_sensors")}
            className="h-11 w-full rounded-2xl border border-border bg-background ps-10 pe-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as PidGroup | "all")}
          className="h-11 rounded-2xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        >
          <option value="all">{t("all_groups")}</option>
          {(Object.keys(GROUP_LABELS) as PidGroup[]).map((key) => (
            <option key={key} value={key}>
              {lang === "ar" ? GROUP_LABELS[key].ar : GROUP_LABELS[key].en}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {supported ? t("showing_supported") : t("showing_all")} · {list.length}
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((def) => {
          const value = values[def.pid];
          const span = (def.max ?? 100) - (def.min ?? 0);
          const filled = value == null ? 0 : Math.min(100, Math.max(0, (((value as number) - (def.min ?? 0)) / (span || 1)) * 100));
          return (
            <div key={def.pid} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-relaxed">{lang === "ar" ? def.ar : def.en}</p>
                <span className="shrink-0 rounded-lg bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">01{def.pid}</span>
              </div>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tabular-nums">{value == null ? "—" : value}</span>
                <span className="text-xs text-muted-foreground">{def.unit}</span>
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${filled}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="size-4 text-primary" />
          {t("modules_on_bus")}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("modules_d")}</p>

        {ecus.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("modules_empty")}</p>
        ) : (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {ecus.map((ecu) => {
                const Tag = ecu.online ? "button" : "div";
                return (
                  <Tag
                    key={ecu.header}
                    {...(ecu.online ? { onClick: () => openModule(ecu), type: "button" as const } : {})}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-start ${
                      ecu.online
                        ? "border-success/40 bg-success/10 transition-colors hover:bg-success/20"
                        : "border-border opacity-70"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{lang === "ar" ? ecu.ar : ecu.en}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{ecu.header}</p>
                    </div>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                          ecu.online ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {ecu.online ? t("module_online") : t("module_offline")}
                      </span>
                      {ecu.online ? <ChevronLeft className="size-4 text-success rtl:rotate-0 ltr:rotate-180" /> : null}
                    </span>
                  </Tag>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("module_hint_offline")}</p>
          </>
        )}

        {openEcu ? (
          <div className="mt-5 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{lang === "ar" ? openEcu.ar : openEcu.en}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{openEcu.header}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenEcu(null);
                  setEcuDetail(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary"
              >
                <X className="size-3.5" />
                {t("module_close")}
              </button>
            </div>

            {probing ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("module_probe")}
              </p>
            ) : ecuDetail ? (
              <div className="mt-4 space-y-4">
                {ecuDetail.vin ? (
                  <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                    VIN: {ecuDetail.vin}
                  </p>
                ) : null}

                <div>
                  <p className="text-xs font-semibold">{t("module_dtcs")}</p>
                  {ecuDetail.dtcs.length === 0 ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">{t("module_no_dtcs")}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ecuDetail.dtcs.map((code) => (
                        <span key={code} className="rounded-lg bg-destructive/10 px-2 py-1 font-mono text-[11px] text-destructive">
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold">
                    {t("module_pids")} · {ecuDetail.pids.length}
                  </p>
                  {ecuDetail.pids.length === 0 ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">{t("module_none_pids")}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ecuDetail.pids.map((pid) => (
                        <span
                          key={pid}
                          className="rounded-lg bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground"
                          title={PID_MAP.get(pid) ? (lang === "ar" ? PID_MAP.get(pid)!.ar : PID_MAP.get(pid)!.en) : undefined}
                        >
                          {PID_MAP.has(pid) ? `${pid} · ${lang === "ar" ? PID_MAP.get(pid)!.ar : PID_MAP.get(pid)!.en}` : pid}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {ecuDetail.raw ? (
                  <div>
                    <p className="text-xs font-semibold">{t("module_raw")}</p>
                    <pre className="mt-2 overflow-x-auto rounded-xl bg-secondary p-3 font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {ecuDetail.raw}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
