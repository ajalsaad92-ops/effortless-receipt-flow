import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Cpu, Loader2, Play, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { BRAND_LIST, useBrand, type ActuatorTest } from "@/lib/brands";
import { useI18n } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";

export const Route = createFileRoute("/controls")({
  head: () => ({
    meta: [
      { title: "الفحوصات والتحكم — تهيئة OBD2 لـ GM وكيا ونيسان" },
      {
        name: "description",
        content: "اختر نوع سيارتك لتهيئة جهاز ELM327 تلقائياً، ونفّذ فحوصات الوحدات وأوامر التحكم المتاحة عبر OBD2.",
      },
      { property: "og:title", content: "الفحوصات وأوامر التحكم عبر OBD2" },
      { property: "og:description", content: "تهيئة الجهاز حسب نوع السيارة وتنفيذ فحوصات ABS وناقل الحركة ومسح الأعطال." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ControlsPage,
});

function ControlsPage() {
  const { t, lang } = useI18n();
  const { brand, profile, setBrand } = useBrand();
  const { status, connection } = useObd();
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<Array<{ command: string; response: string }>>([]);
  const [manual, setManual] = useState("");
  const connected = status === "connected";

  const push = (entries: Array<{ command: string; response: string }>) => setLog((prev) => [...entries.reverse(), ...prev].slice(0, 60));

  const run = async (id: string, commands: string[]) => {
    if (!connected) {
      toast.error(t("need_connection"));
      return;
    }
    setBusy(id);
    try {
      push(await connection.runCommands(commands));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const applyProfile = async () => {
    await run("profile", profile.init);
    if (connected) toast.success(t("profile_applied"));
  };

  return (
    <AppShell>
      <PageHeader title={t("controls_title")} description={t("controls_d")} />

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="size-4 text-primary" />
          {t("select_brand")}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {BRAND_LIST.map((b) => (
            <button
              key={b.key}
              onClick={() => {
                setBrand(b.key);
                toast.success(t("brand_saved"));
              }}
              className={`rounded-2xl border p-4 text-start transition-colors ${
                brand === b.key ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
              }`}
            >
              <p className="text-sm font-medium">{lang === "ar" ? b.ar : b.en}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{lang === "ar" ? b.protocolAr : b.protocolEn}</p>
            </button>
          ))}
        </div>

        {profile.models.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{t("supported_models")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.models.map((m) => (
                <span key={m} className="rounded-lg bg-secondary px-2.5 py-1 text-xs">
                  {m}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <button
          onClick={applyProfile}
          disabled={busy === "profile"}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy === "profile" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {t("apply_profile")}
        </button>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{profile.init.join(" · ")}</p>
      </section>

      <h2 className="mb-3 mt-6 text-lg font-semibold">{t("available_tests")}</h2>
      <div className="grid gap-2.5 md:grid-cols-2">
        {profile.tests.map((test) => (
          <TestCard key={test.id} test={test} busy={busy === test.id} onRun={() => run(test.id, test.commands)} />
        ))}
      </div>

      <section className="mt-6 rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Terminal className="size-4 text-primary" />
          {t("raw_console")}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && manual.trim() && run("manual", [manual.trim().toUpperCase()])}
            placeholder="ATRV / 0105 / 03"
            className="h-11 flex-1 rounded-2xl border border-border bg-background px-4 font-mono text-sm uppercase outline-none focus:border-primary"
          />
          <button
            onClick={() => manual.trim() && run("manual", [manual.trim().toUpperCase()])}
            className="rounded-full bg-secondary px-4 py-2.5 text-sm font-medium hover:bg-accent"
          >
            {t("send_command")}
          </button>
        </div>

        {log.length > 0 ? (
          <div className="mt-4 max-h-72 space-y-1.5 overflow-auto rounded-2xl bg-secondary/60 p-3" dir="ltr">
            {log.map((entry, i) => (
              <p key={`${entry.command}-${i}`} className="font-mono text-[11px] leading-relaxed">
                <span className="text-primary">&gt; {entry.command}</span>
                <span className="text-muted-foreground"> — {entry.response || "…"}</span>
              </p>
            ))}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function TestCard({ test, busy, onRun }: { test: ActuatorTest; busy: boolean; onRun: () => void }) {
  const { t, lang } = useI18n();
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-relaxed">{lang === "ar" ? test.ar : test.en}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${
            test.bidirectional ? "bg-warning/15 text-warning-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          {test.bidirectional ? t("bidir") : t("read_only")}
        </span>
      </div>
      <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
        {test.bidirectional ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" /> : null}
        {lang === "ar" ? test.noteAr : test.noteEn}
      </p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground" dir="ltr">
        {test.commands.join(" · ")}
      </p>
      <button
        onClick={onRun}
        disabled={busy}
        className="mt-3 inline-flex items-center justify-center gap-2 self-start rounded-full border border-border px-3.5 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
        {t("run_test")}
      </button>
    </div>
  );
}
