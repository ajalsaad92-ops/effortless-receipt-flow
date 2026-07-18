import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { listMyExpenses } from "@/lib/expenses.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { formatMoney, statusTone } from "@/lib/format";
import { ArrowUpRight, Camera, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Home — Expense It" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const fetchMine = useServerFn(listMyExpenses);
  const { data: expenses = [], isPending } = useQuery({
    queryKey: ["my-expenses"],
    queryFn: () => fetchMine(),
  });
  // Only show skeletons when we genuinely have no data yet (first ever load).
  // On tab re-entry React Query returns cached data immediately, so isPending
  // is false and content renders without a flash.
  const showSkeleton = isPending && expenses.length === 0;

  const drafts = expenses.filter((e) => e.status === "draft");
  const pending = expenses.filter((e) => e.status === "submitted");
  const reimbursing = expenses.filter((e) => e.status === "approved");
  const totalPending = pending.reduce((s, e) => s + Number(e.amount), 0);
  const totalReimbursing = reimbursing.reduce((s, e) => s + Number(e.amount), 0);

  const firstName = (user?.user_metadata?.full_name || user?.email || "there").split(" ")[0].split("@")[0];

  return (
    <div className="px-5 pt-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.18em] inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" />
            {greeting()} · {firstName}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Let's get you reimbursed.</h1>
        </div>
        {isAdmin && (
          <Link
            to="/admin/users"
            aria-label="Manage team"
            className="size-10 rounded-full bg-card ring-1 ring-border grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <Users className="size-4" />
          </Link>
        )}
      </motion.div>

      <div className="mt-7 grid grid-cols-2 gap-3">
        {showSkeleton ? (
          <>
            <StatCardSkeleton tint="warm" />
            <StatCardSkeleton tint="cool" />
          </>
        ) : (
          <>
            <StatCard label="Awaiting approval" value={formatMoney(totalPending)} sub={`${pending.length} item${pending.length === 1 ? "" : "s"}`} tint="warm" />
            <StatCard label="Coming back to you" value={formatMoney(totalReimbursing)} sub={`${reimbursing.length} approved`} tint="cool" />
          </>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent</h2>
        <Link to="/expenses" className="text-xs font-medium text-primary inline-flex items-center gap-1">
          See all <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <ul className="mt-3 space-y-2">
        {showSkeleton && Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="rounded-2xl bg-card/60 ring-1 ring-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-1/2 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-muted/70 animate-pulse" />
              </div>
              <div className="space-y-2 text-right">
                <div className="h-3.5 w-16 rounded bg-muted animate-pulse ml-auto" />
                <div className="h-3 w-12 rounded bg-muted/70 animate-pulse ml-auto" />
              </div>
            </div>
          </li>
        ))}
        {!showSkeleton && expenses.slice(0, 6).map((e) => (
          <li key={e.id}>
            <Link to="/expenses/$id" params={{ id: e.id }} className="block rounded-2xl bg-card ring-1 ring-border px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{e.merchant ?? "Untitled"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(e.expense_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {e.categories?.name ?? "Uncategorized"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatMoney(Number(e.amount), e.currency)}</p>
                  <StatusPill status={e.status} />
                </div>
              </div>
            </Link>
          </li>
        ))}
        {!showSkeleton && expenses.length === 0 && (
          <li className="rounded-3xl border border-dashed border-border p-8 text-center">
            <Camera className="size-7 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No expenses yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Tap the camera to snap your first receipt.</p>
          </li>
        )}
      </ul>

      {drafts.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground text-center">
          You have {drafts.length} draft{drafts.length === 1 ? "" : "s"} waiting to be submitted.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tint }: { label: string; value: string; sub: string; tint: "warm" | "cool" }) {
  return (
    <div className={`rounded-3xl p-4 ${tint === "warm" ? "bg-accent" : "bg-card ring-1 ring-border"}`}>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function StatCardSkeleton({ tint }: { tint: "warm" | "cool" }) {
  return (
    <div className={`rounded-3xl p-4 ${tint === "warm" ? "bg-accent" : "bg-card ring-1 ring-border"}`}>
      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      <div className="mt-3 h-7 w-20 rounded bg-muted animate-pulse" />
      <div className="mt-2 h-3 w-16 rounded bg-muted/70 animate-pulse" />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const t = statusTone(status);
  return (
    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${t.bg} ${t.fg}`}>
      {t.label.toLowerCase()}
    </span>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}