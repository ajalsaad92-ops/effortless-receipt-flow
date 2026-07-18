import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, MessageSquare, Send, AlertTriangle, Trash2, Copy, Clock, Check, X, Wallet, Undo2, FileEdit, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { getExpense, addComment, decideExpense, deleteExpense, findDuplicateExpenses, getExpenseTimeline } from "@/lib/expenses.functions";
import { useRoles } from "@/hooks/use-roles";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/expenses/$id")({
  head: () => ({ meta: [{ title: "Expense — Expense It" }] }),
  component: ExpenseDetail,
});

function describeEvent(
  action: string,
  diff: Record<string, unknown> | null,
): { icon: typeof Check; tone: string; verb: string; detail: string | null } {
  const from = (diff?.from as string | undefined) ?? null;
  const to = (diff?.to as string | undefined) ?? null;
  const notes = (diff?.notes as string | undefined) ?? null;
  const fmt = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const detail = notes ? `"${notes}"` : from && to ? `${fmt(from)} → ${fmt(to)}` : null;
  if (action === "status:approved") {
    return { icon: Check, tone: "bg-success text-success-foreground", verb: "approved this expense", detail };
  }
  if (action === "status:rejected") {
    return { icon: X, tone: "bg-muted text-foreground", verb: "rejected this expense", detail };
  }
  if (action === "status:reimbursed") {
    return { icon: Wallet, tone: "bg-primary text-primary-foreground", verb: "marked reimbursed", detail };
  }
  if (action === "status:reverted") {
    return { icon: Undo2, tone: "bg-muted text-foreground", verb: "moved back to pending", detail };
  }
  if (action === "submitted") {
    return { icon: Send, tone: "bg-primary/80 text-primary-foreground", verb: "submitted for approval", detail: null };
  }
  if (action === "created") {
    return { icon: FilePlus, tone: "bg-muted text-foreground", verb: "created this expense", detail: null };
  }
  return { icon: FileEdit, tone: "bg-muted text-foreground", verb: action, detail };
}

function ExpenseDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fetchOne = useServerFn(getExpense);
  const comment = useServerFn(addComment);
  const decide = useServerFn(decideExpense);
  const remove = useServerFn(deleteExpense);
  const findDupes = useServerFn(findDuplicateExpenses);
  const fetchTimeline = useServerFn(getExpenseTimeline);
  const { isManager, isFinance } = useRoles();
  const [body, setBody] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["expense", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

  const { data: duplicates = [] } = useQuery({
    queryKey: ["expense-duplicates", id, data?.expense?.amount, data?.expense?.expense_date, data?.expense?.merchant],
    enabled: !!data?.expense,
    queryFn: () => findDupes({
      data: {
        amount: Number(data!.expense.amount),
        currency: data!.expense.currency,
        merchant: data!.expense.merchant,
        expense_date: data!.expense.expense_date,
        exclude_id: id,
      },
    }),
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["expense-timeline", id],
    queryFn: () => fetchTimeline({ data: { id } }),
  });

  async function send() {
    if (!body.trim()) return;
    try {
      await comment({ data: { expense_id: id, body } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["expense", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't post");
    }
  }

  async function act(decision: "approved" | "rejected" | "reimbursed") {
    try {
      await decide({ data: { id, decision } });
      toast.success(`Marked ${decision}`);
      qc.invalidateQueries({ queryKey: ["expense", id] });
      qc.invalidateQueries({ queryKey: ["expense-timeline", id] });
      qc.invalidateQueries({ queryKey: ["pending"] });
      qc.invalidateQueries({ queryKey: ["my-expenses"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  if (isLoading || !data) {
    return <div className="px-5 pt-12"><div className="h-72 rounded-3xl bg-muted animate-pulse" /></div>;
  }
  const e = data.expense;
  const status = e.status as string;
  const canDelete = status === "draft" || status === "rejected";

  async function handleDelete() {
    if (!confirm("Delete this expense and its receipt? This can't be undone.")) return;
    try {
      await remove({ data: { id } });
      qc.invalidateQueries({ queryKey: ["my-expenses"] });
      qc.invalidateQueries({ queryKey: ["receipt-jobs-active"] });
      toast.success("Deleted");
      nav({ to: "/expenses" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  return (
    <div className="px-5 pt-6 pb-32">
      <button onClick={() => nav({ to: "/expenses" })} className="size-10 rounded-full bg-card ring-1 ring-border grid place-items-center">
        <ArrowLeft className="size-5" />
      </button>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        {data.receipt_url && (
          <div className="receipt-frame mx-auto rounded-sm w-44 aspect-[3/4] overflow-hidden -rotate-2 mb-6">
            <img src={data.receipt_url} alt="Receipt" className="size-full object-cover" />
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">{e.categories?.name ?? "Uncategorized"}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-center">{e.merchant ?? "Untitled"}</h1>
        <p className="mt-3 text-center text-4xl font-semibold tabular-nums">{formatMoney(Number(e.amount), e.currency)}</p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {new Date(e.expense_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </p>
        <div className="mt-3 flex justify-center">
          <span className="px-3 py-1 rounded-full text-[11px] font-medium capitalize bg-muted text-muted-foreground">{status}</span>
        </div>
      </motion.div>

      {data.violations.length > 0 && (
        <div className="mt-5 rounded-2xl bg-warning/10 border border-warning/30 p-4 space-y-2">
          {data.violations.map((v) => (
            <div key={v.id} className="flex gap-2 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <p><span className="font-semibold">{v.policy_name}:</span> {v.message}</p>
            </div>
          ))}
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="mt-5 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-center gap-2">
            <Copy className="size-4 text-warning" />
            <p className="text-sm font-semibold">Possible duplicate</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            We found {duplicates.length} similar expense{duplicates.length > 1 ? "s" : ""} on your account.
          </p>
          <ul className="mt-3 space-y-2">
            {duplicates.slice(0, 3).map((d) => (
              <li key={d.id}>
                <Link
                  to="/expenses/$id"
                  params={{ id: d.id }}
                  className="flex items-center justify-between gap-3 rounded-xl bg-background/60 ring-1 ring-border px-3 py-2 hover:bg-background/80"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.merchant ?? "Untitled"}</p>
                    <p className="text-[11px] text-muted-foreground">{d.expense_date} · {d.status}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(Number(d.amount), d.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {e.notes && (
        <div className="mt-5 rounded-2xl bg-card ring-1 ring-border p-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
          <p className="mt-1 text-sm">{e.notes}</p>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Comments</h2>
        </div>
        <ul className="space-y-2">
          {data.comments.length === 0 && <li className="text-xs text-muted-foreground">No comments yet.</li>}
          {data.comments.map((c) => (
            <li key={c.id} className="rounded-2xl bg-card ring-1 ring-border p-3">
              <p className="text-sm">{c.body}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input value={body} onChange={(ev) => setBody(ev.target.value)} placeholder="Add a comment…"
            className="flex-1 rounded-2xl bg-card ring-1 ring-border px-4 py-3 text-sm outline-none" />
          <button onClick={send} className="size-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center">
            <Send className="size-4" />
          </button>
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">History</h2>
          </div>
          <ol className="relative pl-5 before:absolute before:top-1 before:bottom-1 before:left-[7px] before:w-px before:bg-border space-y-3">
            {timeline.map((ev) => {
              const meta = describeEvent(ev.action, ev.diff as Record<string, unknown> | null);
              const Icon = meta.icon;
              const actorName = ev.actor?.full_name ?? "System";
              return (
                <li key={ev.id} className="relative">
                  <span className={`absolute -left-5 top-0.5 size-4 rounded-full grid place-items-center ring-2 ring-background ${meta.tone}`}>
                    <Icon className="size-2.5" strokeWidth={3} />
                  </span>
                  <div className="rounded-2xl bg-card ring-1 ring-border p-3">
                    <p className="text-sm">
                      <span className="font-semibold">{actorName}</span>{" "}
                      <span className="text-muted-foreground">{meta.verb}</span>
                    </p>
                    {meta.detail && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{meta.detail}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                      {new Date(ev.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {(isManager || isFinance) && status === "submitted" && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button onClick={() => act("rejected")} className="rounded-2xl bg-card ring-1 ring-border py-3 text-sm font-medium">Reject</button>
          <button onClick={() => act("approved")} className="rounded-2xl bg-success text-success-foreground py-3 text-sm font-semibold">Approve</button>
        </div>
      )}
      {isFinance && status === "approved" && (
        <button onClick={() => act("reimbursed")} className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-semibold">
          Mark as reimbursed
        </button>
      )}
      <Link to="/expenses" className="mt-4 block text-center text-xs text-muted-foreground underline underline-offset-4">Back to expenses</Link>

      {canDelete && (
        <button
          onClick={handleDelete}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-destructive/15 text-destructive ring-1 ring-destructive/30 py-3 text-sm font-semibold"
        >
          <Trash2 className="size-4" /> Delete expense
        </button>
      )}
    </div>
  );
}
