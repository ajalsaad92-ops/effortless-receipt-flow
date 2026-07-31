import { Link } from "@tanstack/react-router";
import { Activity, BookOpen, Bot, Car, Gauge, Home, Languages, Plug, Stethoscope } from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";
import { cn } from "@/lib/utils";
import { Lamp } from "./kit";

/**
 * Six destinations instead of ten. The old nav listed scan, report, codes,
 * live, sensors, controls, diagrams, garage and assistant separately, so a
 * single fault-finding session bounced across four tabs; related work now
 * lives on one screen behind a tab strip.
 */
const NAV: Array<{ to: string; key: TKey; icon: typeof Home }> = [
  { to: "/", key: "nav_home", icon: Home },
  { to: "/diagnose", key: "nav_diagnose", icon: Stethoscope },
  { to: "/live", key: "nav_live", icon: Gauge },
  { to: "/library", key: "nav_library", icon: BookOpen },
  { to: "/garage", key: "nav_garage", icon: Car },
  { to: "/assistant", key: "nav_assistant", icon: Bot },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, toggleLang } = useI18n();
  const { status, deviceName, owner } = useObd();
  const online = status === "connected";

  return (
    <div className="min-h-app">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md border border-primary/40 bg-primary/10">
              <Activity className="size-4 text-primary" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[13px] font-semibold tracking-tight">{t("appName")}</span>
              <span className="label-micro mt-1 hidden sm:block">OBD2 · General Motors</span>
            </span>
          </Link>

          <nav className="mx-auto hidden items-center gap-0.5 lg:flex">
            {NAV.map(({ to, key, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground font-medium" }}
              >
                <Icon className="size-4" />
                {t(key)}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <Link
              to="/diagnose"
              className={cn(
                "hidden items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-medium sm:flex",
                online ? "border-success/30 bg-success/10 text-success" : "border-border text-muted-foreground",
              )}
              title={deviceName ?? undefined}
            >
              <Lamp tone={online ? "ok" : "idle"} live={online} />
              {online ? t("connected") : t("disconnected")}
              {owner === "assistant" ? <span className="label-micro">AI</span> : null}
            </Link>
            <button
              onClick={toggleLang}
              aria-label={t("lang_switch")}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <Languages className="size-3.5" />
              {t("lang_switch")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 lg:pb-14">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {NAV.map(({ to, key, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground"
              activeProps={{ className: "text-primary font-medium" }}
            >
              <Icon className="size-5" />
              <span className="truncate px-0.5">{t(key)}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Shown wherever a screen needs the adapter and it is not connected. */
export function NeedsAdapter({ message, cta }: { message: string; cta: string }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-lg border border-border bg-elevated">
        <Plug className="size-4 text-muted-foreground" />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <Link to="/diagnose" className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">
        {cta}
      </Link>
    </div>
  );
}
