import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { DIAGRAMS } from "@/lib/gm-diagrams";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/diagrams")({
  head: () => ({
    meta: [
      { title: "مخططات أنظمة GM — مواقع الحساسات والقطع" },
      {
        name: "description",
        content: "مخططات تفاعلية لمواقع الحساسات والملفات وناقل الحركة والدائرة الكهربائية في سيارات GM مع أكواد الأعطال المرتبطة.",
      },
      { property: "og:title", content: "مخططات أنظمة سيارات GM" },
      { property: "og:description", content: "اعرف مكان كل قطعة والأكواد المرتبطة بها على سيارتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiagramsPage,
});

function DiagramsPage() {
  const { t, lang } = useI18n();
  const [activeId, setActiveId] = useState(DIAGRAMS[0].id);
  const [partId, setPartId] = useState<string | null>(null);
  const diagram = DIAGRAMS.find((d) => d.id === activeId) ?? DIAGRAMS[0];
  const part = diagram.parts.find((p) => p.id === partId) ?? null;

  return (
    <AppShell>
      <PageHeader title={t("diagrams_title")} description={t("diagrams_d")} />

      <div className="flex flex-wrap gap-2">
        {DIAGRAMS.map((d) => (
          <button
            key={d.id}
            onClick={() => {
              setActiveId(d.id);
              setPartId(null);
            }}
            className={cn(
              "rounded-full border px-4 py-2 text-xs transition-colors",
              d.id === activeId ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary",
            )}
          >
            {lang === "ar" ? d.ar : d.en}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{lang === "ar" ? diagram.descAr : diagram.descEn}</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-border bg-card p-3">
          <svg viewBox="0 0 100 100" className="aspect-[4/3] w-full" role="img" aria-label={lang === "ar" ? diagram.ar : diagram.en}>
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
                  <circle cx={p.x} cy={p.y} r={5.5} className="fill-primary/10" />
                  <circle cx={p.x} cy={p.y} r={3.6} className={active ? "fill-primary" : "fill-foreground/70"} />
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
              <button
                key={p.id}
                onClick={() => setPartId(p.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px]",
                  p.id === partId ? "border-primary text-primary" : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {i + 1}. {lang === "ar" ? p.ar : p.en}
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-3xl border border-border bg-card p-5">
          {part ? (
            <>
              <h2 className="text-sm font-semibold">{lang === "ar" ? part.ar : part.en}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{lang === "ar" ? part.noteAr : part.noteEn}</p>
              <p className="mt-4 text-xs font-medium text-muted-foreground">{t("diagram_related_codes")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {part.codes.map((code) => (
                  <Link
                    key={code}
                    to="/codes/$code"
                    params={{ code }}
                    className="rounded-full border border-border px-3 py-1.5 font-mono text-xs hover:bg-secondary"
                  >
                    {code}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("diagram_pick_part")}</p>
          )}
        </aside>
      </div>
    </AppShell>
  );
}