import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { listMyExpenses } from "@/lib/expenses.functions";
import { formatMoney } from "@/lib/format";
import { Receipt, ChevronDown, Check, UtensilsCrossed, Plane, Hotel, Car, Briefcase, Laptop, Film, Coffee, Fuel, ShoppingBag, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Expense It" }] }),
  component: ExpensesPage,
});

const FILTERS = ["all", "draft", "submitted", "approved", "reimbursed", "rejected"] as const;
type Status = (typeof FILTERS)[number];

type Expense = {
  id: string;
  amount: string | number;
  currency: string;
  merchant: string | null;
  expense_date: string;
  status: string;
  categories?: { name: string | null } | null;
};

const STATUS_STYLES: Record<string, { dot: string; chip: string; tile: string; ring: string }> = {
  approved:   { dot: "bg-emerald-400 shadow-[0_0_8px_#34d399]", chip: "text-emerald-300/90 bg-emerald-400/10", tile: "bg-emerald-500/10", ring: "border-emerald-500/20" },
  submitted:  { dot: "bg-sky-400",                              chip: "text-sky-300/90 bg-sky-400/10",         tile: "bg-sky-500/10",     ring: "border-sky-500/20" },
  reimbursed: { dot: "bg-violet-400",                           chip: "text-violet-300/90 bg-violet-400/10",   tile: "bg-violet-500/10",  ring: "border-violet-500/20" },
  rejected:   { dot: "bg-rose-400",                             chip: "text-rose-300/90 bg-rose-400/10",       tile: "bg-rose-500/10",    ring: "border-rose-500/20" },
  draft:      { dot: "bg-slate-400",                            chip: "text-slate-400 bg-white/5",             tile: "bg-white/5",        ring: "border-white/10" },
};

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; tile: string; ring: string; fg: string }> = {
  meals:         { icon: UtensilsCrossed, tile: "bg-amber-500/12",  ring: "border-amber-400/25",  fg: "text-amber-300" },
  food:          { icon: UtensilsCrossed, tile: "bg-amber-500/12",  ring: "border-amber-400/25",  fg: "text-amber-300" },
  coffee:        { icon: Coffee,          tile: "bg-orange-500/12", ring: "border-orange-400/25", fg: "text-orange-300" },
  travel:        { icon: Plane,           tile: "bg-sky-500/12",    ring: "border-sky-400/25",    fg: "text-sky-300" },
  flights:       { icon: Plane,           tile: "bg-sky-500/12",    ring: "border-sky-400/25",    fg: "text-sky-300" },
  lodging:       { icon: Hotel,           tile: "bg-violet-500/12", ring: "border-violet-400/25", fg: "text-violet-300" },
  hotel:         { icon: Hotel,           tile: "bg-violet-500/12", ring: "border-violet-400/25", fg: "text-violet-300" },
  transport:     { icon: Car,             tile: "bg-teal-500/12",   ring: "border-teal-400/25",   fg: "text-teal-300" },
  fuel:          { icon: Fuel,            tile: "bg-rose-500/12",   ring: "border-rose-400/25",   fg: "text-rose-300" },
  office:        { icon: Briefcase,       tile: "bg-indigo-500/12", ring: "border-indigo-400/25", fg: "text-indigo-300" },
  software:      { icon: Laptop,          tile: "bg-emerald-500/12",ring: "border-emerald-400/25",fg: "text-emerald-300" },
  entertainment: { icon: Film,            tile: "bg-fuchsia-500/12",ring: "border-fuchsia-400/25",fg: "text-fuchsia-300" },
  shopping:      { icon: ShoppingBag,     tile: "bg-pink-500/12",   ring: "border-pink-400/25",   fg: "text-pink-300" },
};

function categoryStyle(name?: string | null) {
  const key = (name ?? "").trim().toLowerCase();
  return (
    CATEGORY_ICONS[key] ?? {
      icon: Tag,
      tile: "bg-white/[0.06]",
      ring: "border-white/10",
      fg: "text-muted-foreground",
    }
  );
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function groupLabel(dateStr: string): string {
  const d = startOfDay(new Date(dateStr));
  const today = startOfDay(new Date());
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7 && diff > 0) return "This week";
  if (d.getFullYear() === today.getFullYear()) return d.toLocaleDateString(undefined, { month: "long" });
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function ExpensesPage() {
  const location = useLocation();

  if (location.pathname !== "/expenses") {
    return <Outlet />;
  }

  return <ExpensesIndex />;
}

function ExpensesIndex() {
  const fetchMine = useServerFn(listMyExpenses);
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["my-expenses"],
    queryFn: () => fetchMine(),
  });
  const [filter, setFilter] = useState<Status>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const list = (filter === "all" ? expenses : expenses.filter((e) => e.status === filter)) as Expense[];

  const groups = useMemo(() => {
    const sorted = [...list].sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
    const map = new Map<string, Expense[]>();
    for (const e of sorted) {
      const k = groupLabel(e.expense_date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries());
  }, [list]);

  const totalsByGroup = useMemo(() => {
    const m = new Map<string, { total: number; currency: string }>();
    for (const [label, items] of groups) {
      const total = items.reduce((s, e) => s + Number(e.amount || 0), 0);
      m.set(label, { total, currency: items[0]?.currency ?? "USD" });
    }
    return m;
  }, [groups]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Expenses</h1>

        {/* Filter — dropdown on mobile, pills on larger screens */}
        <div className="mt-5">
          {/* Mobile: single pill that opens a sheet */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            >
              <span className="capitalize">{filter === "all" ? "All expenses" : filter}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>

            {filterOpen && (
              <>
                <button
                  aria-label="Close filter"
                  onClick={() => setFilterOpen(false)}
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                />
                <div className="absolute z-50 mt-2 left-0 min-w-[14rem] rounded-2xl border border-white/10 bg-[#0f0e16]/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1.5">
                  {FILTERS.map((f) => {
                    const active = filter === f;
                    return (
                      <button
                        key={f}
                        onClick={() => { setFilter(f); setFilterOpen(false); }}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm capitalize transition-colors ${
                          active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-white/5"
                        }`}
                      >
                        <span>{f === "all" ? "All expenses" : f}</span>
                        {active && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Desktop / tablet: pill row */}
          <div className="hidden sm:flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-white/[0.04] border border-white/10 text-muted-foreground backdrop-blur-md hover:bg-white/[0.07]"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 px-5 pb-32 space-y-8">
        {isLoading && (
          <div className="space-y-3 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-3xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && list.length === 0 && (
          <div className="mt-8 border-2 border-dashed border-white/[0.06] rounded-[32px] p-10 flex flex-col items-center justify-center text-center bg-white/[0.01]">
            <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-4">
              <Receipt className="w-6 h-6 text-primary/50" />
            </div>
            <p className="text-sm font-medium text-foreground/80">Nothing here yet</p>
            <p className="text-xs text-muted-foreground mt-1">Snap a receipt to get started.</p>
          </div>
        )}

        {!isLoading && groups.map(([label, items], gi) => {
          const totals = totalsByGroup.get(label);
          return (
            <section key={label}>
              <div className="flex justify-between items-end mb-3 px-2">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{label}</h2>
                {totals && (
                  <span className="text-xs text-muted-foreground/60 tabular-nums">
                    {formatMoney(totals.total, totals.currency)}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {items.map((e, i) => {
                  const styles = STATUS_STYLES[e.status] ?? STATUS_STYLES.draft;
                  const time = new Date(e.expense_date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  const cat = categoryStyle(e.categories?.name);
                  const CatIcon = cat.icon;
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (gi * 0.04) + (i * 0.02) }}
                    >
                      {e.status === "draft" ? (
                        <Link
                          to="/expenses/new"
                          search={{ expenseId: e.id }}
                          className="group block bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl p-4 rounded-3xl transition-all hover:bg-white/[0.06] hover:border-white/20 active:scale-[0.99]"
                        >
                          <ExpenseRow e={e} cat={cat} CatIcon={CatIcon} styles={styles} time={time} />
                        </Link>
                      ) : (
                        <Link
                          to="/expenses/$id"
                          params={{ id: e.id }}
                          className="group block bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl p-4 rounded-3xl transition-all hover:bg-white/[0.06] hover:border-white/20 active:scale-[0.99]"
                        >
                          <ExpenseRow e={e} cat={cat} CatIcon={CatIcon} styles={styles} time={time} />
                        </Link>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ExpenseRow({
  e,
  cat,
  CatIcon,
  styles,
  time,
}: {
  e: Expense;
  cat: { tile: string; ring: string; fg: string };
  CatIcon: LucideIcon;
  styles: { chip: string };
  time: string;
}) {
  return (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${cat.tile} ${cat.ring}`}>
                              <CatIcon className={`w-5 h-5 ${cat.fg}`} strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-foreground truncate">{e.merchant ?? "Untitled"}</h3>
                              <p className="text-xs text-foreground/70 mt-0.5 truncate">
                                {(e.categories?.name ?? "Uncategorized")} · {time}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-foreground tracking-tight tabular-nums">
                              {formatMoney(Number(e.amount), e.currency)}
                            </p>
                            <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-md capitalize ${styles.chip}`}>
                              {e.status}
                            </span>
                          </div>
                        </div>
  );
}