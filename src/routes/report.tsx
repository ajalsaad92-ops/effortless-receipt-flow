import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Bot,
  Car,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  Loader2,
  Play,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";
import { describeVin } from "@/lib/vin";
import { SCAN_STEPS, reportToText, runFullScan, useVehicleReport } from "@/lib/vehicle-report";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "الفحص الكامل — تعريف السيارة وتقرير OBD2 شامل" },
      {
        name: "description",
        content: "فحص شامل يتعرف على السيارة من رقم الهيكل ويقرأ الأعطال والحساسات ووحدات التحكم في تقرير واحد.",
      },
      { property: "og:title", content: "الفحص الكامل للسيارة عبر OBD2" },
      { property: "og:description", content: "تعريف السيارة، الأعطال، الحساسات ووحدات التحكم في تقرير واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
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
      const result = await runFullScan(connection, setStep);
      store(result);
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
    <AppShell>
      <PageHeader title={t("report_title")} description={t("report_d")} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {t("run_full_scan")}
        </button>
        {report ? (
          <>
            <button
              onClick={download}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm hover:bg-secondary"
            >
              <Download className="size-4" />
              {t("export_report")}
            </button>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(reportToText(report, lang));
                toast.success(t("copied"));
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm hover:bg-secondary"
            >
              <Copy className="size-4" />
              {t("copy_report")}
            </button>
            <Link
              to="/assistant"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm hover:bg-secondary"
            >
              <Bot className="size-4" />
              {t("ask_ai_with_report")}
            </Link>
          </>
        ) : null}
      </div>

      {busy ? (
        <ol className="mt-5 space-y-2 rounded-3xl border border-border bg-card p-5">
          {SCAN_STEPS.map((s) => {
            const done = SCAN_STEPS.findIndex((x) => x.id === step) > SCAN_STEPS.findIndex((x) => x.id === s.id);
            const active = step === s.id;
            return (
              <li key={s.id} className="flex items-center gap-2.5 text-sm">
                {done ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : active ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <span className="size-4 rounded-full border border-border" />
                )}
                <span className={active ? "font-medium" : "text-muted-foreground"}>{lang === "ar" ? s.ar : s.en}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {!report && !busy ? <p className="mt-6 text-sm text-muted-foreground">{t("report_empty")}</p> : null}

      {report ? (
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Car className="size-4 text-primary" />
              {t("vehicle_identity")}
            </h2>
            <p className="mt-3 font-mono text-sm text-primary">{report.vin ?? "—"}</p>
            {info ? <p className="mt-1 text-sm">{describeVin(info, lang)}</p> : null}
            <dl className="mt-4 grid gap-2 text-xs">
              <Row label={t("make")} value={info?.make ?? "—"} />
              <Row label={t("year")} value={info?.year ? String(info.year) : "—"} />
              <Row label={t("engine")} value={info?.engine ?? "—"} />
              <Row label={t("built_in")} value={info?.country ?? "—"} />
              <Row label={t("ecu_name")} value={report.ecuName ?? "—"} />
              <Row label={t("cal_id")} value={report.calId ?? "—"} />
              <Row label={t("protocol")} value={report.protocol ?? "—"} />
              <Row label={t("battery_v")} value={report.voltage !== null ? `${report.voltage} V` : "—"} />
            </dl>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-primary" />
              {t("codes_summary")}
            </h2>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("mil_lamp")}: {report.mil === null ? "—" : report.mil ? t("mil_on") : t("mil_off")}
            </p>
            {(["stored", "pending", "permanent"] as const).map((kind) => (
              <div key={kind} className="mt-4">
                <p className="text-xs font-medium text-muted-foreground">{t(`dtc_${kind}` as const)}</p>
                {report[kind].length === 0 ? (
                  <p className="mt-1 text-sm text-success">{t("no_codes_found")}</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {report[kind].map((code) => (
                      <Link
                        key={`${kind}-${code}`}
                        to="/codes/$code"
                        params={{ code }}
                        className="rounded-full border border-border px-3 py-1.5 font-mono text-xs hover:bg-secondary"
                      >
                        {code}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-primary" />
              {t("sensor_snapshot")} ({report.sensors.length})
            </h2>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {report.sensors.map((s) => (
                <li key={s.pid} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-3 py-2 text-xs">
                  <span className="truncate">{lang === "ar" ? s.ar : s.en}</span>
                  <span className="shrink-0 font-mono font-medium tabular-nums">
                    {s.value} {s.unit}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Cpu className="size-4 text-primary" />
              {t("modules_on_bus")}
            </h2>
            <ul className="mt-3 space-y-1.5">
              {report.modules.map((m) => (
                <li key={m.header} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-3 py-2 text-xs">
                  <span>{lang === "ar" ? m.ar : m.en}</span>
                  <span className={m.online ? "text-success" : "text-muted-foreground"}>
                    {m.online ? t("module_online") : t("module_offline")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value}</dd>
    </div>
  );
}