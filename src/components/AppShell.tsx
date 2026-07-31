import { Link } from "@tanstack/react-router";
import { Bot, Car, Gauge, Home, Radar, ScanLine, SlidersHorizontal, Wrench, Languages, Bluetooth, BluetoothConnected } from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";
import { cn } from "@/lib/utils";

const NAV: Array<{ to: string; key: TKey; icon: typeof Home }> = [
  { to: "/", key: "nav_home", icon: Home },
  { to: "/scan", key: "nav_scan", icon: ScanLine },
  { to: "/codes", key: "nav_codes", icon: Wrench },
  { to: "/live", key: "nav_live", icon: Gauge },
  { to: "/sensors", key: "nav_sensors", icon: Radar },
  { to: "/controls", key: "nav_controls", icon: SlidersHorizontal },
  { to: "/garage", key: "nav_garage", icon: Car },
  { to: "/assistant", key: "nav_assistant", icon: Bot },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, toggleLang } = useI18n();
  const { status, deviceName } = useObd();
  const online = status === "connected";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Wrench className="size-4.5" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight">{t("appName")}</span>
              <span className="mt-1 hidden text-[11px] text-muted-foreground sm:block">OBD2 · General Motors</span>
            </span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 md:flex">
            {NAV.map(({ to, key, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground font-medium" }}
              >
                <Icon className="size-4" />
                {t(key)}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2 md:ms-0">
            <span
              className={cn(
                "hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium sm:flex",
                online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}
              title={deviceName ?? undefined}
            >
              {online ? <BluetoothConnected className="size-3.5" /> : <Bluetooth className="size-3.5" />}
              {online ? t("connected") : t("disconnected")}
            </span>
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <Languages className="size-3.5" />
              {t("lang_switch")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:pb-16">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-8">
          {NAV.map(({ to, key, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground"
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

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
