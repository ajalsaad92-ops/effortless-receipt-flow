import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Receipt,
  Plane,
  FileText,
  Inbox,
  HelpCircle,
  User,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Wallet,
  Users,
  BarChart3,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRoles } from "@/hooks/use-roles";
import { usePersona, setPersona as writePersona, type Persona } from "@/hooks/use-persona";

type Item = { to: string; label: string; icon: LucideIcon };

const PERSONAL: Item[] = [
  { to: "/dashboard", label: "Home", icon: LayoutGrid },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/trips", label: "Trips", icon: Plane },
  { to: "/reports", label: "Reports", icon: FileText },
];

const ADMIN: Item[] = [
  { to: "/admin", label: "Overview", icon: ShieldCheck },
  { to: "/approvals", label: "Approvals", icon: Inbox },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/reimburse", label: "Reimburse", icon: Wallet },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/policies", label: "Policies", icon: ScrollText },
  { to: "/finance/reports", label: "Finance", icon: BarChart3 },
];

const STORAGE_KEY = "sidenav-collapsed";

export function SideNav({ onAddClick }: { onAddClick: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isManager, isAdmin, isFinance, isLoading: rolesLoading } = useRoles();
  const canSwitch = isManager || isAdmin || isFinance;
  // While we don't yet know the user's roles, reserve the toggle's space so
  // the nav items below don't jump up and back when the toggle appears.
  const reserveToggleSpace = rolesLoading && !canSwitch;
  const [collapsed, setCollapsed] = useState(false);
  const persona = usePersona();
  const [autoSwitched, setAutoSwitched] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {/* ignore */}
  }, []);

  // If the user lands on an admin URL directly, auto-switch persona.
  useEffect(() => {
    if (!canSwitch) return;
    if (autoSwitched) return;
    const onAdminPath =
      path === "/approvals" ||
      path.startsWith("/admin") ||
      path.startsWith("/policies") ||
      path.startsWith("/finance");
    if (onAdminPath && persona !== "admin") {
      writePersona("admin");
    }
    setAutoSwitched(true);
  }, [path, canSwitch, persona, autoSwitched]);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {/* ignore */}
      return next;
    });
  };

  const setPersonaPersisted = (p: Persona) => {
    setAutoSwitched(true);
    writePersona(p);
  };

  // Expose width as a CSS variable so the layout can match its left padding.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--sidenav-width",
      collapsed ? "5rem" : "15rem",
    );
  }, [collapsed]);

  const showAdmin = canSwitch && persona === "admin";
  const items: Item[] = showAdmin
    ? [
        ...ADMIN.filter((it) =>
          // Only admins/finance see Users + Finance
          (it.to === "/admin/users" || it.to === "/finance/reports")
            ? (isAdmin || isFinance)
            : true,
        ),
        { to: "/profile", label: "Profile", icon: User },
      ]
    : [
        ...PERSONAL,
        { to: "/ask-ai", label: "Ask", icon: HelpCircle },
        { to: "/profile", label: "Profile", icon: User },
      ];

  const width = collapsed ? "5rem" : "15rem";

  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="hidden md:flex fixed left-3 top-3 bottom-3 z-30 flex-col rounded-3xl"
      style={{
        background: "hsla(0, 0%, 8%, 0.62)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid hsla(0, 0%, 100%, 0.10)",
        boxShadow:
          "0 12px 40px hsla(0, 0%, 0%, 0.45), 0 1px 0 hsla(0, 0%, 100%, 0.06) inset",
      }}
    >
      {/* Brand + collapse */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        {!collapsed && (
          <span className="text-sm font-bold uppercase tracking-wide text-white">EXPENSE&nbsp;IT</span>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`grid place-items-center size-8 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors ${
            collapsed ? "mx-auto" : ""
          }`}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      {/* Persona toggle — only for users with elevated roles */}
      {canSwitch && !collapsed && (
        <div className="px-3 pb-3">
          <div
            role="tablist"
            aria-label="Switch view"
            className="relative flex p-1 rounded-2xl bg-white/[0.05] ring-1 ring-white/10"
          >
            {(["personal", "admin"] as const).map((p) => {
              const active = persona === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPersonaPersisted(p)}
                  className="relative flex-1 h-8 text-[11px] font-semibold uppercase tracking-wider"
                >
                  {active && (
                    <motion.span
                      layoutId="persona-pill"
                      className="absolute inset-0 rounded-xl bg-primary shadow-[0_4px_14px_-2px_hsla(152,55%,45%,0.5)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${active ? "text-primary-foreground" : "text-white/65"}`}>
                    {p === "personal" ? "Personal" : "Admin"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {canSwitch && collapsed && (
        <div className="px-3 pb-3 flex justify-center">
          <button
            type="button"
            onClick={() => setPersonaPersisted(persona === "admin" ? "personal" : "admin")}
            aria-label={`Switch to ${persona === "admin" ? "personal" : "admin"} view`}
            className={`grid place-items-center size-9 rounded-xl ring-1 transition-colors ${
              persona === "admin"
                ? "bg-primary text-primary-foreground ring-white/15 shadow-[0_4px_14px_-2px_hsla(152,55%,45%,0.5)]"
                : "bg-white/[0.05] text-white/70 ring-white/10 hover:text-white"
            }`}
          >
            <ShieldCheck className="size-4" />
          </button>
        </div>
      )}
      {reserveToggleSpace && !collapsed && (
        <div className="px-3 pb-3" aria-hidden>
          <div className="h-10 rounded-2xl bg-white/[0.03] ring-1 ring-white/5" />
        </div>
      )}
      {reserveToggleSpace && collapsed && (
        <div className="px-3 pb-3 flex justify-center" aria-hidden>
          <div className="size-9 rounded-xl bg-white/[0.03] ring-1 ring-white/5" />
        </div>
      )}

      {/* Add expense */}
      <div className="px-2 pb-3">
        <button
          type="button"
          onClick={onAddClick}
          className={`flex items-center gap-3 w-full rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[0_8px_24px_-6px_hsla(152,55%,45%,0.55)] ring-1 ring-white/15 transition-transform active:scale-[0.98] ${
            collapsed ? "justify-center h-11" : "justify-center px-4 h-11 text-sm"
          }`}
        >
          <Plus className="size-5" strokeWidth={2.6} />
          {!collapsed && <span>New expense</span>}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-3 space-y-1">
        {items.map((it) => {
          const active = path === it.to || path.startsWith(it.to + "/");
          const isOverview = it.label === "Overview";
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              preload="intent"
              className={`relative flex items-center gap-3 rounded-2xl h-11 px-3 text-sm font-medium transition-colors ${
                collapsed ? "justify-center" : ""
              }`}
            >
              {active && (
                <motion.span
                  layoutId="sidenav-active-bg"
                  className="absolute inset-0 rounded-2xl bg-primary shadow-[0_4px_18px_-2px_hsla(152,55%,45%,0.45)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon
                className={`relative z-10 size-[18px] shrink-0 ${
                  active ? "text-white" : "text-white/65"
                }`}
                strokeWidth={active ? 2.4 : 2}
              />
              {!collapsed && (
                <span
                  className={`relative z-10 truncate ${
                    active ? "text-primary-foreground text-slate-50" : "text-white/80"
                  } ${
                    isOverview ? "text-base" : "text-sm"
                  }`}
                >
                  {it.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </motion.aside>
  );
}