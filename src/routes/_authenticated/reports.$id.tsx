import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { getReport, listMyExpenses, setExpenseReport, submitReport, decideReport } from "@/lib/expenses.functions";
import { useRoles } from "@/hooks/use-roles";
import { formatMoney } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({ meta: [{ title: "Report — Expense It" }] }),
  component: ReportDetail,
});

function ReportDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fetchOne = useServerFn(getReport);
  const fetchMine = useServerFn(listMyExpenses);
  const setRep = useServerFn(setExpenseReport);
  const submit = useServerFn(submitReport);
  const decide = useServerFn(decideReport);
  const { isManager, isFinance } = useRoles();
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["report", id], queryFn: () => fetchOne({ data: { id } }) });
  const { data: mine = [] } = useQuery({ queryKey: ["my-expenses"], queryFn: () => fetchMine() });

  if (isLoading || !data) {
    return <div className="px-5 pt-12"><div className="h-72 rounded-3xl bg-muted animate-pulse" /></div>;
  }
  const r = data.report;
  const items = data.items;
  const total = items.reduce((s, e) => s + Number(e.amount), 0);
  const status = r.status as string;
  const isDraft = status === "draft";

  async function attach(expense_id: string) {
    try { await setRep({ data: { expense_id, report_id: id } }); qc.invalidateQueries({ queryKey: ["report", id] }); qc.invalidateQueries({ queryKey: ["my-expenses"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't add"); }
  }
  async function detach(expense_id: string) {
    try { await setRep({ data: { expense_id, report_id: null } }); qc.invalidateQueries({ queryKey: ["report", id] }); qc.invalidateQueries({ queryKey: ["my-expenses"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't remove"); }
  }
  async function send() {
    if (items.length === 0) return toast.error("Add at least one expense first");
    setBusy(true);
    try {
      await submit({ data: { id } });
      toast.success("Submitted");
      qc.invalidateQueries({ queryKey: ["report", id] });
      qc.invalidateQueries({ queryKey: ["my-reports"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't submit"); }
    finally { setBusy(false); }
  }
  async function act(decision: "approved" | "rejected" | "reimbursed") {
    try {
      await decide({ data: { id, decision } });
      toast.success(`Marked ${decision}`);
      qc.invalidateQueries({ queryKey: ["report", id] });
      qc.invalidateQueries({ queryKey: ["pending-reports"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update"); }
  }

  const attachable = mine.filter((m) => !items.find((i) => i.id === m.id) && (m.status === "draft"));

  return (
    <div className="px-5 pt-6 pb-32">
      <button onClick={() => nav({ to: "/reports" })} className="size-10 rounded-full bg-card ring-1 ring-border grid place-items-center">
        <ArrowLeft className="size-5" />
      </button>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{r.type}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{r.title}</h1>
        {r.description && <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>}
        <div className="mt-3 flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[11px] font-medium capitalize bg-muted text-muted-foreground">{status}</span>
          <span className="text-2xl font-semibold tabular-nums ml-auto">{formatMoney(total)}</span>
        </div>
      </motion.div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-semibold">{items.length} line items</h2>
        {isDraft && (
          <button onClick={() => setPicker((v) => !v)} className="text-xs font-medium text-primary inline-flex items-center gap-1">
            <Plus className="size-3.5" /> Add expenses
          </button>
        )}
      </div>

      {picker && (
        <div className="mt-3 rounded-2xl bg-accent p-3 space-y-1.5 max-h-72 overflow-y-auto">
          {attachable.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">No draft expenses available. Snap a few first.</p>}
          {attachable.map((m) => (
            <button key={m.id} onClick={() => attach(m.id)}
              className="w-full text-left flex items-center justify-between bg-card ring-1 ring-border rounded-xl px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.merchant ?? "Untitled"}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(m.expense_date).toLocaleDateString()}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatMoney(Number(m.amount), m.currency)}</p>
            </button>
          ))}
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {items.map((e) => (
          <li key={e.id} className="rounded-2xl bg-card ring-1 ring-border p-3 flex items-center gap-3">
            <Link to="/expenses/$id" params={{ id: e.id }} className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{e.merchant ?? "Untitled"}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(e.expense_date).toLocaleDateString()} · {e.categories?.name ?? "—"}</p>
            </Link>
            <p className="text-sm font-semibold tabular-nums">{formatMoney(Number(e.amount), e.currency)}</p>
            {isDraft && (
              <button onClick={() => detach(e.id)} className="text-[11px] text-muted-foreground hover:text-destructive">Remove</button>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No items yet.</li>}
      </ul>

      {isDraft && (
        <button onClick={send} disabled={busy}
          className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit report
        </button>
      )}
      {(isManager || isFinance) && status === "submitted" && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button onClick={() => act("rejected")} className="rounded-2xl bg-card ring-1 ring-border py-3 text-sm font-medium">Reject</button>
          <button onClick={() => act("approved")} className="rounded-2xl bg-success text-success-foreground py-3 text-sm font-semibold">Approve all</button>
        </div>
      )}
      {isFinance && status === "approved" && (
        <button onClick={() => act("reimbursed")} className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-semibold">
          Reimburse entire report
        </button>
      )}
    </div>
  );
}
