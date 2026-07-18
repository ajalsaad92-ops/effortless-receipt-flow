import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Shield, Wallet, ChevronDown, Undo2, Search, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { listAllExpenses, decideExpense } from "@/lib/expenses.functions";
import { useRoles } from "@/hooks/use-roles";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/reimburse")({
  head: () => ({ meta: [{ title: "Reimburse — Expense It" }] }),
  component: ReimbursePage,
});

function ReimbursePage() {
  const { isFinance, isLoading: rolesLoading } = useRoles();
  const qc = useQueryClient();
  const list = useServerFn(listAllExpenses);
  const decide = useServerFn(decideExpense);
  const { data: rows = [], isPending: rowsPending } = useQuery({
    queryKey: ["all-expenses"],
    queryFn: () => list(),
    enabled: isFinance,
  });

  const [tab, setTab] = useState<"awaiting" | "paid">("awaiting");
  const [paidQuery, setPaidQuery] = useState("");
  const [paidSort, setPaidSort] = useState<
    "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "submitter_asc" | "merchant_asc"
  >("date_desc");
  const approved = useMemo(() => rows.filter((r) => r.status === "approved"), [rows]);
  const reimbursedRows = useMemo(
    () => rows.filter((r) => r.status === "reimbursed"),
    [rows],
  );
  const filteredReimbursed = useMemo(() => {
    const q = paidQuery.trim().toLowerCase();
    const base = q
      ? reimbursedRows.filter((e) => {
          const submitter = (e.profile?.full_name ?? "").toLowerCase();
          const merchant = (e.merchant ?? "").toLowerCase();
          const category = (e.categories?.name ?? "").toLowerCase();
          return submitter.includes(q) || merchant.includes(q) || category.includes(q);
        })
      : reimbursedRows;
    const submitterOf = (e: typeof reimbursedRows[number]) =>
      (e.profile?.full_name ?? "").toLowerCase();
    return [...base].sort((a, b) => {
      switch (paidSort) {
        case "date_asc":
          return +new Date(a.expense_date) - +new Date(b.expense_date);
        case "date_desc":
          return +new Date(b.expense_date) - +new Date(a.expense_date);
        case "amount_asc":
          return Number(a.amount) - Number(b.amount);
        case "amount_desc":
          return Number(b.amount) - Number(a.amount);
        case "submitter_asc":
          return submitterOf(a).localeCompare(submitterOf(b));
        case "merchant_asc":
          return (a.merchant ?? "").localeCompare(b.merchant ?? "");
      }
    });
  }, [reimbursedRows, paidQuery, paidSort]);
  const total = useMemo(
    () => approved.reduce((s, r) => s + Number(r.amount), 0),
    [approved],
  );

  const groups = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      name: string;
      avatar: string | null;
      items: typeof approved;
      total: number;
    }>();
    for (const e of approved) {
      const key = e.user_id ?? "unknown";
      const existing = map.get(key);
      if (existing) {
        existing.items.push(e);
        existing.total += Number(e.amount);
      } else {
        map.set(key, {
          userId: key,
          name: e.profile?.full_name ?? "Unknown",
          avatar: e.profile?.avatar_url ?? null,
          items: [e],
          total: Number(e.amount),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [approved]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (rolesLoading) {
    return (
      <div className="px-5 pt-12">
        <div className="h-32 rounded-3xl bg-muted animate-pulse" />
      </div>
    );
  }
  if (!isFinance) {
    return (
      <div className="px-5 pt-16 text-center">
        <Shield className="size-7 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Finance access required.</p>
      </div>
    );
  }

  async function reimburse(id: string) {
    try {
      await decide({ data: { id, decision: "reimbursed" } });
      toast.success("Marked reimbursed");
      qc.invalidateQueries({ queryKey: ["all-expenses"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  async function undoReimburse(id: string) {
    try {
      await decide({ data: { id, decision: "approved" } });
      toast.success("Moved back to awaiting payout");
      qc.invalidateQueries({ queryKey: ["all-expenses"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  async function reimburseUser(group: (typeof groups)[number]) {
    if (group.items.length === 0) return;
    try {
      await Promise.all(
        group.items.map((r) => decide({ data: { id: r.id, decision: "reimbursed" } })),
      );
      toast.success(`Reimbursed ${group.items.length} for ${group.name}`);
      qc.invalidateQueries({ queryKey: ["all-expenses"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  return (
    <div className="px-5 pt-12 pb-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reimburse</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved expenses grouped by employee.
          </p>
        </div>
      </div>

      <div className="mt-5 inline-flex rounded-full bg-white/[0.04] ring-1 ring-white/10 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("awaiting")}
          className={`px-3.5 py-1.5 rounded-full transition-colors ${tab === "awaiting" ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`}
        >
          Awaiting payout
        </button>
        <button
          type="button"
          onClick={() => setTab("paid")}
          className={`px-3.5 py-1.5 rounded-full transition-colors ${tab === "paid" ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`}
        >
          Reimbursed
        </button>
      </div>

      {tab === "awaiting" ? (
      <>
      <div className="mt-5 rounded-3xl bg-accent p-4">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Awaiting payout
        </p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{formatMoney(total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {approved.length} expense{approved.length === 1 ? "" : "s"} · {groups.length} {groups.length === 1 ? "person" : "people"}
        </p>
      </div>

      <ul className="mt-5 space-y-3">
        {groups.map((g, i) => {
          const isOpen = expanded[g.userId] ?? false;
          return (
            <motion.li
              key={g.userId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl bg-card ring-1 ring-border overflow-hidden"
            >
              <div className="p-4 flex items-center gap-3">
                <div className="size-10 rounded-full bg-accent flex items-center justify-center overflow-hidden shrink-0">
                  {g.avatar ? (
                    <img src={g.avatar} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold">
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setExpanded((s) => ({ ...s, [g.userId]: !isOpen }))}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-semibold truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    {g.items.length} expense{g.items.length === 1 ? "" : "s"}
                    <ChevronDown
                      className={`size-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </p>
                </button>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatMoney(g.total)}</p>
                </div>
              </div>
              <div className="px-4 pb-4">
                <button
                  onClick={() => reimburseUser(g)}
                  className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-[0_8px_24px_-6px_hsla(152,55%,45%,0.55)]"
                >
                  <Wallet className="size-3.5" /> Reimburse all ({formatMoney(g.total)})
                </button>
              </div>
              {isOpen && (
                <ul className="border-t border-border divide-y divide-border">
                  {g.items.map((e) => (
                    <li key={e.id} className="px-4 py-3 flex items-center gap-3">
                      <Link
                        to="/expenses/$id"
                        params={{ id: e.id }}
                        className="min-w-0 flex-1"
                      >
                        <p className="text-sm font-medium truncate">{e.merchant ?? "Untitled"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(e.expense_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          · {e.categories?.name ?? "Uncategorized"}
                        </p>
                      </Link>
                      <p className="text-sm font-semibold tabular-nums shrink-0">
                        {formatMoney(Number(e.amount), e.currency)}
                      </p>
                      <button
                        onClick={() => reimburse(e.id)}
                        className="text-[11px] font-semibold text-primary hover:underline shrink-0"
                      >
                        Pay
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.li>
          );
        })}
        {!rowsPending && groups.length === 0 && (
          <li className="text-sm text-muted-foreground py-12 text-center">
            Nothing awaiting reimbursement.
          </li>
        )}
      </ul>
      </>
      ) : (
        <>
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="relative flex-1">
            <Search className="size-3.5 text-white/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={paidQuery}
              onChange={(e) => setPaidQuery(e.target.value)}
              placeholder="Search submitter, merchant, or category"
              className="w-full h-9 rounded-lg bg-white/[0.04] ring-1 ring-white/10 focus:ring-primary/50 outline-none text-sm text-white placeholder:text-white/40 pl-9 pr-3"
            />
          </label>
          <label className="relative inline-flex items-center">
            <ArrowUpDown className="size-3.5 text-white/55 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={paidSort}
              onChange={(e) => setPaidSort(e.target.value as typeof paidSort)}
              className="appearance-none h-9 rounded-lg bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.06] focus:ring-primary/50 outline-none text-xs font-semibold text-white/85 pl-8 pr-8"
              aria-label="Sort reimbursed expenses"
            >
              <option value="date_desc">Date · newest</option>
              <option value="date_asc">Date · oldest</option>
              <option value="amount_desc">Amount · high to low</option>
              <option value="amount_asc">Amount · low to high</option>
              <option value="submitter_asc">Submitter · A–Z</option>
              <option value="merchant_asc">Merchant · A–Z</option>
            </select>
            <ChevronDown className="size-3.5 text-white/55 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </label>
        </div>
        <ul className="mt-3 rounded-2xl bg-card ring-1 ring-border divide-y divide-border overflow-hidden">
          {filteredReimbursed.map((e) => (
            <li key={e.id} className="px-4 py-3 flex items-center gap-3">
              <div className="size-9 rounded-full bg-accent flex items-center justify-center overflow-hidden shrink-0">
                {e.profile?.avatar_url ? (
                  <img src={e.profile.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold">
                    {(e.profile?.full_name ?? "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <Link to="/expenses/$id" params={{ id: e.id }} className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{e.merchant ?? "Untitled"}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {e.profile?.full_name ?? "Unknown"} ·{" "}
                  {new Date(e.expense_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {e.categories?.name ? ` · ${e.categories.name}` : ""}
                </p>
              </Link>
              <p className="text-sm font-semibold tabular-nums shrink-0">
                {formatMoney(Number(e.amount), e.currency)}
              </p>
              <button
                onClick={() => undoReimburse(e.id)}
                className="text-[11px] font-semibold text-white/70 hover:text-white inline-flex items-center gap-1 shrink-0 rounded-lg px-2 py-1.5 hover:bg-white/5"
                title="Move back to awaiting payout"
              >
                <Undo2 className="size-3.5" /> Undo
              </button>
            </li>
          ))}
          {!rowsPending && filteredReimbursed.length === 0 && (
            <li className="text-sm text-muted-foreground py-12 text-center">
              {reimbursedRows.length === 0 ? "No reimbursed expenses yet." : "No matches for your search."}
            </li>
          )}
        </ul>
        </>
      )}
    </div>
  );
}
