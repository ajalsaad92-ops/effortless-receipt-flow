import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Car, Gauge, ScanLine, Wrench, Trash2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { useScans, useVehicles } from "@/lib/garage";
import { DTCS } from "@/lib/dtc-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GM OBD — تشخيص وصيانة سيارات جنرال موتورز" },
      {
        name: "description",
        content:
          "اقرأ أكواد أعطال OBD2 لسيارات شفروليه وجي إم سي وكاديلاك، تابع البيانات الحية وجدول الصيانة، واسأل المساعد الذكي عن أي عطل.",
      },
      { property: "og:title", content: "GM OBD — تشخيص وصيانة سيارات جنرال موتورز" },
      {
        property: "og:description",
        content: "أكواد أعطال GM، قراءة حية من جهاز ELM327، جدول صيانة ومساعد ذكي للتشخيص.",
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

  const cards = [
    { to: "/scan", icon: ScanLine, title: t("home_start_scan"), desc: t("home_start_scan_d"), accent: true },
    { to: "/codes", icon: Wrench, title: t("home_browse"), desc: t("home_browse_d") },
    { to: "/live", icon: Gauge, title: t("nav_live"), desc: t("home_live_d") },
    { to: "/garage", icon: Car, title: t("nav_garage"), desc: t("home_garage_d") },
    { to: "/assistant", icon: Bot, title: t("nav_assistant"), desc: t("home_ai_d") },
  ];

  return (
    <AppShell>
      <PageHeader title={t("home_title")} description={t("tagline")} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ to, icon: Icon, title, desc, accent }) => (
          <Link
            key={to}
            to={to}
            className={`group rounded-3xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
              accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"
            }`}
          >
            <span
              className={`grid size-11 place-items-center rounded-2xl ${
                accent ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}
            >
              <Icon className="size-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat value={String(DTCS.length)} label={t("nav_codes")} />
        <Stat value={String(vehicles.length)} label={t("nav_garage")} />
        <Stat value={String(scans.length)} label={t("recent_scans")} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("recent_scans")}</h2>
          {scans.length > 0 ? (
            <button
              onClick={clearScans}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              {t("clear_history")}
            </button>
          ) : null}
        </div>

        {scans.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("no_scans")}
          </p>
        ) : (
          <ul className="space-y-2">
            {scans.slice(0, 8).map((scan) => (
              <li key={scan.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(scan.date).toLocaleString(lang === "ar" ? "ar" : "en-GB")}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                    {scan.source === "bluetooth" ? t("bluetooth") : t("manual_entry")}
                  </span>
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
                        className="rounded-lg bg-secondary px-2 py-1 font-mono text-xs font-medium hover:bg-accent"
                      >
                        {code}
                      </Link>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
