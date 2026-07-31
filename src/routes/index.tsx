import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Bot, Car, Gauge, Loader2, RefreshCw, Stethoscope, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button, EmptyState, Lamp, Panel, Readout, StatusChip } from "@/components/kit";
import { DTCS } from "@/lib/dtc-data";
import { useScans, useVehicles } from "@/lib/garage";
import { useI18n } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";
import { useVehicleReport } from "@/lib/vehicle-report";
import { IGNITION_LABEL, UNKNOWN_STATE, readVehicleState, type VehicleState } from "@/lib/vehicle-state";
import { describeVin } from "@/lib/vin";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GM OBD — تشخيص وصيانة سيارات جنرال موتورز" },
      {
        name: "description",
        content:
          "اقرأ أكواد أعطال OBD2 لسيارات شفروليه وجي إم سي وكاديلاك، تابع البيانات الحية وجدول الصيانة، ودع المساعد الذكي يفحص سيارتك بنفسه.",
      },
      { property: "og:title", content: "GM OBD — تشخيص وصيانة سيارات جنرال موتورز" },
      {
        property: "og:description",
        content: "أكواد أعطال GM، قراءة حية من ELM327، جدول صيانة، ومساعد يفحص السيارة مباشرة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t, lang } = useI18n();
  const { scans, clearScans } = useScans();
  const { vehicles } = useVehicles();
  const { report } = useVehicleReport();
  const { status, connection } = useObd();
  const connected = status === "connected";

  const [state, setState] = useState<VehicleState>(UNKNOWN_STATE);
  const [reading, setReading] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== "connected") return;
    setReading(true);
    try {
      setState(await readVehicleState(connection));
    } catch {
      setState(UNKNOWN_STATE);
    } finally {
      setReading(false);
    }
  }, [connection, status]);

  // One cheap read on arrival, so the dashboard is never stale by default.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeCodes = report ? report.stored.length + report.pending.length : null;
  const info = report?.vinInfo ?? null;
  const running = state.ignition === "driving" || state.ignition === "idling";

  return (
    <AppShell>
      <PageHeader title={t("home_title")} description={t("tagline")} />

      <Panel className={connected ? "border-primary/30" : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-micro">{t("vehicle_state")}</p>
            <p className="mt-2 flex items-center gap-2.5 text-lg font-semibold">
              <Lamp tone={running ? "ok" : state.ignition === "ignition-on" ? "warn" : "idle"} live={running} />
              {connected ? IGNITION_LABEL[state.ignition][lang] : t("state_stale")}
            </p>
            {info ? <p className="mt-1.5 text-sm text-muted-foreground">{describeVin(info, lang)}</p> : null}
          </div>
          <Button onClick={() => void refresh()} disabled={!connected || reading}>
            {reading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("refresh_state")}
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Readout label="RPM" value={state.rpm} unit="rpm" tone="accent" />
          <Readout label={lang === "ar" ? "السرعة" : "Speed"} value={state.speed} unit="km/h" />
          <Readout
            label={lang === "ar" ? "حرارة الماء" : "Coolant"}
            value={state.coolant}
            unit="°C"
            tone={state.coolant !== null && state.coolant >= 105 ? "bad" : "default"}
            hint={
              state.engineWarm === null
                ? undefined
                : state.engineWarm
                  ? lang === "ar"
                    ? "بلغ حرارة التشغيل"
                    : "at operating temp"
                  : lang === "ar"
                    ? "لم يسخن بعد"
                    : "not warm yet"
            }
          />
          <Readout label={t("battery_v")} value={state.voltage} unit="V" />
        </div>
      </Panel>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label={t("nav_codes")} value={DTCS.length} />
        <Stat label={t("dtc_stored")} value={activeCodes} tone={activeCodes ? "bad" : activeCodes === 0 ? "ok" : undefined} />
        <Stat label={t("nav_garage")} value={vehicles.length} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Shortcut to="/assistant" icon={Bot} title={t("nav_assistant")} desc={t("live_mode_d")} accent />
        <Shortcut to="/diagnose" icon={Stethoscope} title={t("nav_diagnose")} desc={t("diagnose_d")} />
        <Shortcut to="/live" icon={Gauge} title={t("nav_live")} desc={t("home_live_d")} />
        <Shortcut to="/garage" icon={Car} title={t("nav_garage")} desc={t("home_garage_d")} />
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4 text-primary" />
            {t("recent_scans")}
          </h2>
          {scans.length > 0 ? (
            <button
              onClick={clearScans}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              {t("clear_history")}
            </button>
          ) : null}
        </div>

        {scans.length === 0 ? (
          <EmptyState>{t("no_scans")}</EmptyState>
        ) : (
          <ul className="space-y-2">
            {scans.slice(0, 8).map((scan) => (
              <li key={scan.id}>
                <Panel className="!p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(scan.date).toLocaleString(lang === "ar" ? "ar" : "en-GB")}
                    </span>
                    <StatusChip tone="idle">
                      {scan.source === "bluetooth" ? t("bluetooth") : t("manual_entry")}
                    </StatusChip>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {scan.codes.length === 0 ? (
                      <span className="text-sm text-success">{t("no_codes_found")}</span>
                    ) : (
                      scan.codes.map((code) => (
                        <Link
                          key={code}
                          to="/codes/$code"
                          params={{ code }}
                          className="rounded border border-border bg-elevated px-2 py-1 font-mono text-xs font-medium hover:bg-secondary"
                        >
                          {code}
                        </Link>
                      ))
                    )}
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | null; tone?: "ok" | "bad" }) {
  return (
    <Panel className="!p-4">
      <Readout label={label} value={value} tone={tone ?? "default"} />
    </Panel>
  );
}

function Shortcut({
  to,
  icon: Icon,
  title,
  desc,
  accent,
}: {
  to: string;
  icon: typeof Bot;
  title: string;
  desc: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`panel p-4 transition-colors hover:border-primary/40 ${accent ? "border-primary/30 bg-primary/5" : ""}`}
    >
      <span
        className={`grid size-9 place-items-center rounded-lg border ${
          accent ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-elevated text-muted-foreground"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </Link>
  );
}
