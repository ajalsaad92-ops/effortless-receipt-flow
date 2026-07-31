import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState, Panel, Tabs } from "@/components/kit";
import { SeverityPill } from "@/components/SeverityPill";
import { DTCS, SYSTEM_LABEL, type SystemKey } from "@/lib/dtc-data";
import { DIAGRAMS } from "@/lib/gm-diagrams";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "المرجع — أكواد أعطال GM ومخططات مواقع القطع" },
      {
        name: "description",
        content:
          "ابحث في أكواد أعطال OBD2 لسيارات جنرال موتورز واعرف معناها وأسبابها وحلولها، واستعرض مخططات مواقع الحساسات والقطع.",
      },
      { property: "og:title", content: "مرجع أكواد ومخططات GM" },
      { property: "og:description", content: "قاعدة أكواد الأعطال ومخططات مواقع القطع في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

type Tab = "codes" | "diagrams";

function LibraryPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("codes");

  return (
    <AppShell>
      <PageHeader title={t("library_title")} description={t("library_d")} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "codes", label: t("tab_codes"), badge: DTCS.length },
          { value: "diagrams", label: t("tab_diagrams"), badge: DIAGRAMS.length },
        ]}
      />
      <div className="mt-4">{tab === "codes" ? <CodeBrowser /> : <DiagramBrowser />}</div>
    </AppShell>
  );
}

function CodeBrowser() {
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
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_codes")}
          className="h-11 w-full rounded-lg border border-border bg-card ps-10 pe-4 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={system === "all"} onClick={() => setSystem("all")} label={t("all_systems")} />
        {systems.map((key) => (
          <Chip
            key={key}
            active={system === key}
            onClick={() => setSystem(key)}
            label={SYSTEM_LABEL[key][lang]}
          />
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState>{t("no_results")}</EmptyState>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {results.map((dtc) => (
            <li key={dtc.code}>
              <Link
                to="/codes/$code"
                params={{ code: dtc.code }}
                className="panel flex h-full flex-col p-4 transition-colors hover:border-primary/40 hover:bg-elevated"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-semibold text-primary">{dtc.code}</span>
                  <SeverityPill severity={dtc.severity} />
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed">{dtc.title[lang]}</p>
                <p className="label-micro mt-2">{SYSTEM_LABEL[dtc.system][lang]}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiagramBrowser() {
  const { t, lang } = useI18n();
  const [activeId, setActiveId] = useState(DIAGRAMS[0].id);
  const [partId, setPartId] = useState<string | null>(null);
  const diagram = DIAGRAMS.find((d) => d.id === activeId) ?? DIAGRAMS[0];
  const part = diagram.parts.find((p) => p.id === partId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {DIAGRAMS.map((d) => (
          <Chip
            key={d.id}
            active={d.id === activeId}
            onClick={() => {
              setActiveId(d.id);
              setPartId(null);
            }}
            label={lang === "ar" ? d.ar : d.en}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{lang === "ar" ? diagram.descAr : diagram.descEn}</p>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Panel className="!p-3">
          <svg
            viewBox="0 0 100 100"
            className="aspect-[4/3] w-full"
            role="img"
            aria-label={lang === "ar" ? diagram.ar : diagram.en}
          >
            {diagram.shapes.map((s, i) => (
              <rect
                key={i}
                x={s.x}
                y={s.y}
                width={s.w}
                height={s.h}
                rx={s.r ?? 2}
                className="fill-secondary stroke-border"
                strokeWidth={0.4}
              />
            ))}
            {diagram.parts.map((p, i) => {
              const active = p.id === partId;
              return (
                <g key={p.id} onClick={() => setPartId(p.id)} className="cursor-pointer">
                  <circle cx={p.x} cy={p.y} r={5.5} className="fill-primary/15" />
                  <circle cx={p.x} cy={p.y} r={3.6} className={active ? "fill-primary" : "fill-foreground/60"} />
                  <text
                    x={p.x}
                    y={p.y + 1.3}
                    textAnchor="middle"
                    className="pointer-events-none fill-background font-semibold"
                    style={{ fontSize: 3.4 }}
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {diagram.parts.map((p, i) => (
              <Chip
                key={p.id}
                active={p.id === partId}
                onClick={() => setPartId(p.id)}
                label={`${i + 1}. ${lang === "ar" ? p.ar : p.en}`}
              />
            ))}
          </div>
        </Panel>

        <Panel>
          {part ? (
            <>
              <h2 className="text-sm font-semibold">{lang === "ar" ? part.ar : part.en}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {lang === "ar" ? part.noteAr : part.noteEn}
              </p>
              <p className="label-micro mt-4">{t("diagram_related_codes")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {part.codes.map((code) => (
                  <Link
                    key={code}
                    to="/codes/$code"
                    params={{ code }}
                    className="rounded border border-border bg-elevated px-2 py-1 font-mono text-xs hover:bg-secondary"
                  >
                    {code}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("diagram_pick_part")}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground font-medium"
          : "border-border bg-elevated text-muted-foreground hover:bg-secondary",
      )}
    >
      {label}
    </button>
  );
}
