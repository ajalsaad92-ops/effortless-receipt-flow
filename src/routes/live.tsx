import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Download, Play, Square, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";
import { LIVE_PIDS, decodePid, demoReading, type LiveReading } from "@/lib/obd";
import { analyzeTrend } from "@/lib/diagnostics";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "البيانات الحية — قراءات المحرك اللحظية عبر OBD2" },
      {
        name: "description",
        content: "تابع دوران المحرك والسرعة وحرارة الماء والحمل وفتحة الخانق لحظياً من جهاز OBD2، وصدّر تقريراً بالقراءات.",
      },
      { property: "og:title", content: "البيانات الحية عبر OBD2" },
      { property: "og:description", content: "قراءات لحظية للمحرك مع إمكانية تصدير تقرير CSV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

const GAUGES: Array<{ key: keyof LiveReading; ar: string; en: string; unit: string; max: number }> = [
  { key: "rpm", ar: "دوران المحرك", en: "Engine RPM", unit: "rpm", max: 7000 },
  { key: "speed", ar: "السرعة", en: "Speed", unit: "km/h", max: 220 },
  { key: "coolant", ar: "حرارة الماء", en: "Coolant temp", unit: "°C", max: 130 },
  { key: "load", ar: "حمل المحرك", en: "Engine load", unit: "%", max: 100 },
  { key: "intake", ar: "حرارة الهواء", en: "Intake temp", unit: "°C", max: 90 },
  { key: "throttle", ar: "فتحة الخانق", en: "Throttle", unit: "%", max: 100 },
];

function LivePage() {
  const { t, lang } = useI18n();
  const { status, connection } = useObd();
  const [running, setRunning] = useState(false);
  const [demo, setDemo] = useState(false);
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [samples, setSamples] = useState<Array<LiveReading & { at: string }>>([]);
  const tick = useRef(0);
  const findings = analyzeTrend(samples);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;

    const poll = async () => {
      let next: LiveReading;
      if (demo || status !== "connected") {
        next = demoReading(tick.current++);
      } else {
        const entries = await Promise.all(
          (Object.keys(LIVE_PIDS) as Array<keyof typeof LIVE_PIDS>).map(async (key) => {
            try {
              const data = await connection.readPid(LIVE_PIDS[key]);
              return [key, data ? decodePid(key, data) : 0] as const;
            } catch {
              return [key, 0] as const;
            }
          }),
        );
        next = { ...(Object.fromEntries(entries) as Omit<LiveReading, "voltage">), voltage: 14 };
      }
      if (cancelled) return;
      setReading(next);
      setSamples((prev) => [...prev.slice(-299), { ...next, at: new Date().toISOString() }]);
    };

    poll();
    const id = window.setInterval(poll, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [running, demo, status, connection]);

  const exportCsv = () => {
    if (samples.length === 0) {
      toast.error(t("live_hint"));
      return;
    }
    const header = ["timestamp", ...GAUGES.map((g) => g.key), "voltage"].join(",");
    const rows = samples.map((s) => [s.at, ...GAUGES.map((g) => s[g.key]), s.voltage].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `obd-live-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <PageHeader title={t("live_title")} description={t("live_hint")} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {running ? <Square className="size-4" /> : <Play className="size-4" />}
          {running ? t("stop_stream") : t("start_stream")}
        </button>
        <label className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="size-4 accent-primary" />
          {t("demo_mode")}
        </label>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm hover:bg-secondary"
        >
          <Download className="size-4" />
          {t("export_report")}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GAUGES.map((gauge) => {
          const value = reading ? Number(reading[gauge.key]) : 0;
          const pct = Math.min(100, Math.max(0, (value / gauge.max) * 100));
          return (
            <div key={gauge.key} className="rounded-3xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">{lang === "ar" ? gauge.ar : gauge.en}</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tabular-nums">{reading ? value : "—"}</span>
                <span className="text-xs text-muted-foreground">{gauge.unit}</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {samples.length} {lang === "ar" ? "عينة مسجلة" : "samples recorded"}
      </p>

      <section className="mt-6 rounded-3xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">{t("auto_diag")}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("auto_diag_d")}</p>

        {samples.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("diag_waiting")}</p>
        ) : findings.length === 0 ? (
          <p className="mt-4 text-sm text-success">{t("all_good")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {findings.map((finding) => {
              const Icon = finding.level === "bad" ? AlertTriangle : finding.level === "warn" ? TriangleAlert : CheckCircle2;
              const tone =
                finding.level === "bad"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : finding.level === "warn"
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-success/40 bg-success/10 text-success";
              return (
                <li key={finding.id} className={`rounded-2xl border p-3.5 ${tone}`}>
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
      </section>
    </AppShell>
  );
}
