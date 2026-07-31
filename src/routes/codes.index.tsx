import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { DTCS, SYSTEM_LABEL, type SystemKey } from "@/lib/dtc-data";
import { useI18n } from "@/lib/i18n";
import { SeverityPill } from "@/components/SeverityPill";

export const Route = createFileRoute("/codes/")({
  head: () => ({
    meta: [
      { title: "قاعدة أكواد أعطال GM — المعنى والأسباب والحلول" },
      {
        name: "description",
        content: "ابحث في أكواد أعطال OBD2 لسيارات جنرال موتورز واعرف معناها وأسبابها المحتملة وخطوات إصلاحها.",
      },
      { property: "og:title", content: "قاعدة أكواد أعطال GM" },
      { property: "og:description", content: "معاني أكواد OBD2 لسيارات شفروليه وجي إم سي وكاديلاك مع خطوات الإصلاح." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CodesPage,
});

function CodesPage() {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState<SystemKey | "all">("all");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DTCS.filter((d) => {
      if (system !== "all" && d.system !== system) return false;
      if (!q) return true;
      return (
        d.code.toLowerCase().includes(q) ||
        d.title.ar.toLowerCase().includes(q) ||
        d.title.en.toLowerCase().includes(q) ||
        d.models.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [query, system]);

  const systems = Object.keys(SYSTEM_LABEL) as SystemKey[];

  return (
    <AppShell>
      <PageHeader title={t("nav_codes")} description={`${DTCS.length} ${t("codes_count")}`} />

      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-4 my-auto size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_codes")}
          className="h-12 w-full rounded-2xl border border-border bg-card ps-11 pe-4 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <FilterChip active={system === "all"} onClick={() => setSystem("all")} label={t("all_systems")} />
        {systems.map((key) => (
          <FilterChip
            key={key}
            active={system === key}
            onClick={() => setSystem(key)}
            label={SYSTEM_LABEL[key][lang]}
          />
        ))}
      </div>

      {results.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t("no_results")}
        </p>
      ) : (
        <ul className="mt-5 grid gap-2.5 md:grid-cols-2">
          {results.map((dtc) => (
            <li key={dtc.code}>
              <Link
                to="/codes/$code"
                params={{ code: dtc.code }}
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-semibold text-primary">{dtc.code}</span>
                  <SeverityPill severity={dtc.severity} />
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed">{dtc.title[lang]}</p>
                <p className="mt-2 text-xs text-muted-foreground">{SYSTEM_LABEL[dtc.system][lang]}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}
