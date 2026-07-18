import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Shield, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { listAllExpenses, decideExpense } from "@/lib/expenses.functions";
import { useRoles } from "@/hooks/use-roles";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — Expense It" }] }),
  component: FinancePage,
});

const FILTERS = ["all", "submitted", "approved", "reimbursed", "rejected"] as const;

function FinancePage() {
  const { isFinance, isLoading: rolesLoading } = useRoles();
  const qc = useQueryClient();
  const list = useServerFn(listAllExpenses);
  const decide = useServerFn(decideExpense);
  const { data: rows = [], isPending: rowsPending } = useQuery({ queryKey: ["all-expenses"], queryFn: () => list(), enabled: isFinance });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("approved");

  const visible = useMemo(() => filter === "all" ? rows : rows.filter((r) => r.status === filter), [rows, filter]);
  const totalApproved = useMemo(() => rows.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.amount), 0), [rows]);
  const totalReimbursed = useMemo(() => rows.filter((r) => r.status === "reimbursed").reduce((s, r) => s + Number(r.amount), 0), [rows]);

  if (rolesLoading) return <div className="px-5 pt-12"><div className="h-32 rounded-3xl bg-muted animate-pulse" /></div>;
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

  return (
    <div className="px-5 pt-12 pb-32">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">All expenses across the company.</p>
        </div>
        <Link to="/finance/reports" className="rounded-full bg-card ring-1 ring-border px-3 py-2 text-xs font-medium inline-flex items-center gap-1">
          <BarChart3 className="size-3.5" /> Builder
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-accent p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Awaiting payout</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(totalApproved)}</p>
        </div>
        <div className="rounded-3xl bg-card ring-1 ring-border p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Reimbursed</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(totalReimbursed)}</p>
        </div>
      </div>

      <div className="mt-5 -mx-5 px-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize ${
                filter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              }`}>{f}</button>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {visible.map((e, i) => (
          <motion.li key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
            className="rounded-2xl bg-card ring-1 ring-border p-4">
            <div className="flex items-start justify-between gap-3">
              <Link to="/expenses/$id" params={{ id: e.id }} className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{e.merchant ?? "Untitled"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(e.expense_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {e.categories?.name ?? "Uncategorized"}
                </p>
              </Link>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums">{formatMoney(Number(e.amount), e.currency)}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground capitalize">{e.status}</span>
              </div>
            </div>
            {e.status === "approved" && (
              <button onClick={() => reimburse(e.id)} className="mt-3 w-full rounded-xl bg-primary/10 text-primary py-2 text-xs font-semibold">
                Mark as reimbursed
              </button>
            )}
          </motion.li>
        ))}
        {!rowsPending && visible.length === 0 && <li className="text-sm text-muted-foreground py-12 text-center">Nothing matches.</li>}
      </ul>
    </div>
  );
}
