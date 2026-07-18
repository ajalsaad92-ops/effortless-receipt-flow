import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";

const ITEMS = [
  { to: "/expenses", label: "Expenses" },
  { to: "/trips", label: "Trips" },
  { to: "/reports", label: "Reports" },
] as const;

export function SubTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Only show on the three top-level tab pages — not detail/new screens.
  const onTabPage = ITEMS.some((it) => path === it.to);
  if (!onTabPage) return null;

  return (
    <div className="px-5 pt-6">
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur">
        {ITEMS.map((it) => {
          const active = path === it.to;
          return (
            <Link
              key={it.to}
              to={it.to}
              preload="intent"
              className="relative px-4 py-1.5 rounded-full text-xs font-semibold"
            >
              {active && (
                <motion.span
                  layoutId="subtab-active-pill"
                  className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_18px_-2px_hsla(152,55%,45%,0.45)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 transition-colors ${
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}