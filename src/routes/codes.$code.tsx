import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Bot, Youtube } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SeverityPill } from "@/components/SeverityPill";
import { SYSTEM_LABEL, findDtc, guessSystem, youtubeSearchUrl } from "@/lib/dtc-data";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/codes/$code")({
  head: ({ params }) => {
    const code = params.code.toUpperCase();
    const dtc = findDtc(code);
    const title = dtc ? `${code} — ${dtc.title.ar}` : `${code} — كود عطل OBD2`;
    const description = dtc
      ? dtc.meaning.ar.slice(0, 155)
      : `معلومات عن كود العطل ${code} في سيارات جنرال موتورز.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: CodeDetail,
});

function CodeDetail() {
  const { code: raw } = Route.useParams();
  const { t, lang, dir } = useI18n();
  const code = raw.toUpperCase();
  const dtc = findDtc(code);
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <AppShell>
      <Link
        to="/codes"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <BackIcon className="size-4" />
        {t("back")}
      </Link>

      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-3xl font-semibold text-primary">{code}</h1>
          {dtc ? <SeverityPill severity={dtc.severity} /> : null}
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            {SYSTEM_LABEL[dtc?.system ?? guessSystem(code)][lang]}
          </span>
        </div>

        {dtc ? (
          <p className="mt-3 text-lg font-medium leading-relaxed">{dtc.title[lang]}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("not_found")}</p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/assistant"
            search={{ q: `${code}` }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Bot className="size-4" />
            {t("ask_ai_about")}
          </Link>
          <a
            href={youtubeSearchUrl(code, lang, dtc?.models ?? [])}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Youtube className="size-4 text-destructive" />
            {t("watch_fix")}
          </a>
        </div>
      </div>

      {dtc ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Block title={t("meaning")}>
            <p className="text-sm leading-relaxed text-muted-foreground">{dtc.meaning[lang]}</p>
          </Block>
          <Block title={t("symptoms")}>
            <List items={dtc.symptoms[lang]} />
          </Block>
          <Block title={t("causes")}>
            <List items={dtc.causes[lang]} ordered />
          </Block>
          <Block title={t("fixes")}>
            <List items={dtc.fixes[lang]} ordered />
          </Block>
          <Block title={t("affected")} className="md:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {dtc.models.map((m) => (
                <span key={m} className="rounded-lg bg-secondary px-2.5 py-1 text-xs">
                  {m}
                </span>
              ))}
            </div>
          </Block>
        </div>
      ) : null}
    </AppShell>
  );
}

function Block({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-border bg-card p-5 ${className}`}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-medium">
            {ordered ? i + 1 : "•"}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
