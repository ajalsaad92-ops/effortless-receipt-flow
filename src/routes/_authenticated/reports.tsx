import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listMyExpenses, listMyReports } from "@/lib/expenses.functions";
import { formatMoney } from "@/lib/format";
import { Download, Plus, FolderOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Expense It" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const fetchMine = useServerFn(listMyExpenses);
  const fetchReports = useServerFn(listMyReports);
  const { data: expenses = [] } = useQuery({ queryKey: ["my-expenses"], queryFn: () => fetchMine() });
  const { data: bundles = [], isPending: bundlesPending } = useQuery({ queryKey: ["my-reports"], queryFn: () => fetchReports() });
  const [range, setRange] = useState<"30" | "90" | "all">("30");

  const filtered = useMemo(() => {
    if (range === "all") return expenses;
    const cutoff = Date.now() - Number(range) * 86400000;
    return expenses.filter((e) => new Date(e.expense_date).getTime() >= cutoff);
  }, [expenses, range]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) {
      const k = e.categories?.name ?? "Uncategorized";
      m.set(k, (m.get(k) ?? 0) + Number(e.amount));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const max = Math.max(1, ...byCategory.map(([, v]) => v));

  function exportCsv() {
    const rows = [
      ["Date", "Merchant", "Category", "Amount", "Currency", "Status"],
      ...filtered.map((e) => [
        e.expense_date,
        e.merchant ?? "",
        e.categories?.name ?? "",
        String(e.amount),
        e.currency,
        e.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="px-5 pt-10 pb-32">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-extrabold tracking-tight">Reports</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Bundle related expenses (a trip, a project) into one approval.</p>
        </div>
        <Link
          to="/reports/new"
          className="shrink-0 rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5 shadow-[0_4px_14px_-2px_hsla(152,55%,45%,0.5)]"
        >
          <Plus className="size-4" /> New report
        </Link>
      </div>

      {/* Bundles — the primary thing on this page */}
      <ul className="mt-6 space-y-2">
        {bundles.map((b) => (
          <li key={b.id}>
            <Link to="/reports/$id" params={{ id: b.id }} className="block rounded-2xl bg-card ring-1 ring-border px-4 py-3.5 hover:bg-accent/40 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{b.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{b.type} · {b.status}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          </li>
        ))}
        {!bundlesPending && bundles.length === 0 && (
          <li className="rounded-3xl border border-dashed border-border p-8 text-center">
            <FolderOpen className="size-7 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No reports yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
              Group expenses for a trip or project, then submit them together for approval.
            </p>
            <Link
              to="/reports/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold"
            >
              <Plus className="size-4" /> Create your first report
            </Link>
          </li>
        )}
      </ul>

      {/* Secondary: spend analytics */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-base font-semibold">Spending overview</h2>
      </div>
      <div className="mt-3 flex gap-2">
        {(["30", "90", "all"] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${
              range === r ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            }`}>
            {r === "all" ? "All time" : `Last ${r} days`}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-3xl bg-accent p-5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total spend</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums">{formatMoney(total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{filtered.length} expense{filtered.length === 1 ? "" : "s"}</p>
      </div>

      <h3 className="mt-7 text-sm font-semibold text-muted-foreground uppercase tracking-wider">By category</h3>
      <ul className="mt-3 space-y-2">
        {byCategory.map(([name, value]) => (
          <li key={name} className="rounded-2xl bg-card ring-1 ring-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-sm font-semibold tabular-nums">{formatMoney(value)}</p>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </li>
        ))}
        {byCategory.length === 0 && <li className="text-sm text-muted-foreground">No data in this range.</li>}
      </ul>

      <button onClick={exportCsv}
        className="mt-4 w-full rounded-2xl bg-card ring-1 ring-border py-3.5 text-sm font-medium inline-flex items-center justify-center gap-2">
        <Download className="size-4" /> Export CSV
      </button>
      </div>
    </div>
  );
}