import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Inbox, Wallet, FileText, Users, ScrollText, BarChart3, ArrowRight, ShieldCheck, Settings } from "lucide-react";
import { adminStats } from "@/lib/expenses.functions";
import { useRoles } from "@/hooks/use-roles";
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Expense It" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const { isManager, isAdmin, isFinance, isLoading } = useRoles();
  const fetchStats = useServerFn(adminStats);
  const { data, isLoading: loading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 30_000,
  });

  if (isLoading) return null;
  if (!isManager && !isAdmin && !isFinance) {
    return (
      <div className="px-5 pt-12">
        <p className="text-sm text-muted-foreground">You don't have access to admin tools.</p>
      </div>
    );
  }

  return (
    <div className="px-5 md:px-8 pt-10 pb-16 max-w-5xl">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <ShieldCheck className="size-3.5" /> Admin view
      </div>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">Admin overview</h1>
      <p className="text-sm text-white mt-2 opacity-80">
        Approve expenses, review submitted reports, and keep reimbursements moving.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-7">
        <StatCard
          to="/approvals"
          icon={Inbox}
          label="Pending approvals"
          value={data?.pendingExpenses ?? 0}
          sub={loading ? "…" : fmtMoney(data?.pendingExpensesTotal ?? 0)}
          accent
        />
        <StatCard
          to="/admin/reports"
          icon={FileText}
          label="Reports to review"
          value={data?.pendingReports ?? 0}
          sub="Submitted"
        />
        <StatCard
          to="/admin/reimburse"
          icon={Wallet}
          label="Awaiting reimbursement"
          value={data?.approvedAwaitingReimbursement ?? 0}
          sub={loading ? "…" : fmtMoney(data?.approvedAwaitingReimbursementTotal ?? 0)}
        />
      </div>

      <h2 className="text-xs uppercase tracking-wider text-white/55 font-semibold mt-10">Manage</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        <NavTile to="/approvals" icon={Inbox} title="Approvals queue" sub="Approve or reject expenses" />
        <NavTile to="/admin/reports" icon={FileText} title="Reports" sub="Queue & custom report builder" />
        <NavTile to="/admin/reimburse" icon={Wallet} title="Reimburse" sub="Mark approved expenses paid" />
        {(isAdmin || isFinance) && (
          <>
            <NavTile to="/admin/users" icon={Users} title="Users & roles" sub="Manage team access" />
            <NavTile to="/policies" icon={ScrollText} title="Policies" sub="Spending rules & limits" />
            <NavTile to="/finance/reports" icon={BarChart3} title="Analytics" sub="Saved finance reports" />
            <NavTile to="/admin/settings" icon={Settings} title="Settings" sub="Workspace-wide configuration" />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  to, icon: Icon, label, value, sub, accent = false,
}: { to: string; icon: typeof Inbox; label: string; value: number; sub: string; accent?: boolean }) {
  return (
    <Link to={to} preload="intent" className="group">
      <motion.div
        whileHover={{ y: -2 }}
        className={`relative rounded-3xl p-5 ring-1 transition-colors overflow-hidden ${
          accent
            ? "bg-primary/[0.12] ring-primary/30 hover:ring-primary/50"
            : "bg-white/[0.04] ring-white/10 hover:ring-white/20"
        }`}
      >
        <div className="flex items-start justify-between">
          <span className={`size-10 grid place-items-center rounded-2xl ${accent ? "bg-primary/20 text-primary" : "bg-white/5 text-white/70"}`}>
            <Icon className="size-5" />
          </span>
          <ArrowRight className="size-4 text-white/40 group-hover:text-white/80 transition-colors" />
        </div>
        <p className="mt-4 text-xs uppercase tracking-wider text-white/60 font-semibold">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-white">{value}</p>
        <p className="mt-1 text-xs text-white/65 tabular-nums">{sub}</p>
      </motion.div>
    </Link>
  );
}

function NavTile({
  to, icon: Icon, title, sub,
}: { to: string; icon: typeof Inbox; title: string; sub: string }) {
  return (
    <Link to={to} preload="intent" className="group">
      <div className="rounded-2xl p-4 bg-white/[0.03] ring-1 ring-white/10 hover:ring-white/20 hover:bg-white/[0.06] transition-colors flex items-center gap-3">
        <span className="size-9 grid place-items-center rounded-xl bg-white/5 text-white/75">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-white/60 truncate">{sub}</p>
        </div>
        <ArrowRight className="size-4 text-white/40 group-hover:text-white/80 transition-colors" />
      </div>
    </Link>
  );
}
