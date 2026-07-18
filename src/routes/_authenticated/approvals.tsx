import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { listPendingApprovals, listDecidedApprovals, decideExpense, bulkDecideExpenses, revertExpenseDecision } from "@/lib/expenses.functions";
import { formatMoney } from "@/lib/format";
import { Check, X, Inbox, ShieldCheck, Plane, ChevronDown, FileText, Undo2, FileDown, Search, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "Approvals — Expense It" }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const fetchPending = useServerFn(listPendingApprovals);
  const fetchDecided = useServerFn(listDecidedApprovals);
  const decide = useServerFn(decideExpense);
  const bulk = useServerFn(bulkDecideExpenses);
  const revert = useServerFn(revertExpenseDecision);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["pending"], queryFn: () => fetchPending() });
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const { data: decided = [], isLoading: decidedLoading } = useQuery({
    queryKey: ["decided"],
    queryFn: () => fetchDecided(),
    enabled: tab === "decided",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"expense" | "trip">("expense");

  // Decided tab: search + sort
  const [decidedQuery, setDecidedQuery] = useState("");
  const [decidedSort, setDecidedSort] = useState<
    "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "submitter_asc" | "merchant_asc"
  >("date_desc");
  const [decidedStatus, setDecidedStatus] = useState<"all" | "approved" | "rejected" | "reimbursed">("all");

  const decidedCounts = useMemo(() => ({
    all: decided.length,
    approved: decided.filter((e) => e.status === "approved").length,
    rejected: decided.filter((e) => e.status === "rejected").length,
    reimbursed: decided.filter((e) => e.status === "reimbursed").length,
  }), [decided]);

  const filteredDecided = useMemo(() => {
    const q = decidedQuery.trim().toLowerCase();
    const byStatus = decidedStatus === "all"
      ? decided
      : decided.filter((e) => e.status === decidedStatus);
    const base = q
      ? byStatus.filter((e) => {
          const profile = (e as any).profile as { full_name: string | null } | null;
          const submitter = (profile?.full_name ?? "").toLowerCase();
          const merchant = (e.merchant ?? "").toLowerCase();
          const category = ((e as any).categories?.name ?? "").toLowerCase();
          return submitter.includes(q) || merchant.includes(q) || category.includes(q);
        })
      : byStatus;
    const sorted = [...base];
    const submitterOf = (e: any) =>
      (e.profile?.full_name ?? "").toLowerCase();
    sorted.sort((a, b) => {
      switch (decidedSort) {
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
    return sorted;
  }, [decided, decidedQuery, decidedSort, decidedStatus]);

  const allIds = useMemo(() => data.map((d) => d.id), [data]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const totalSelected = useMemo(
    () => data.filter((d) => selected.has(d.id))
      .reduce((acc, d) => acc + Number(d.amount), 0),
    [data, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  async function act(id: string, decision: "approved" | "rejected") {
    try {
      await decide({ data: { id, decision } });
      toast.success(decision === "approved" ? "Approved" : "Rejected");
      qc.invalidateQueries({ queryKey: ["pending"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  async function actBulk(decision: "approved" | "rejected") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const res = await bulk({ data: { ids, decision } });
      toast.success(`${decision === "approved" ? "Approved" : "Rejected"} ${res.count} expense${res.count > 1 ? "s" : ""}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["pending"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  async function undoDecision(id: string) {
    try {
      await revert({ data: { id } });
      toast.success("Moved back to pending");
      qc.invalidateQueries({ queryKey: ["pending"] });
      qc.invalidateQueries({ queryKey: ["decided"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  // ---------------- Decided exports (includes Approved, Rejected, Reimbursed) ----------------
  function buildDecidedRows() {
    const headers = ["Date", "Status", "Employee", "Merchant", "Category", "Amount", "Currency"];
    const rows = filteredDecided.map((e) => {
      const profile = (e as any).profile as { full_name: string | null } | null;
      const status =
        e.status === "reimbursed" ? "Reimbursed" : e.status === "approved" ? "Approved" : "Rejected";
      return [
        new Date(e.expense_date).toISOString().slice(0, 10),
        status,
        profile?.full_name ?? "Teammate",
        e.merchant ?? "",
        (e as any).categories?.name ?? "",
        Number(e.amount).toFixed(2),
        e.currency ?? "USD",
      ];
    });
    return { headers, rows };
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportDecidedCSV() {
    if (filteredDecided.length === 0) return toast.error("Nothing to export");
    const { headers, rows } = buildDecidedRows();
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `decided-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function exportDecidedPDF() {
    if (filteredDecided.length === 0) return toast.error("Nothing to export");
    const [{ jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const { headers, rows } = buildDecidedRows();
    doc.setFontSize(14);
    doc.text("Decided expenses", 40, 40);
    doc.setFontSize(10);
    doc.text(`Approved · Rejected · Reimbursed — ${filteredDecided.length} item${filteredDecided.length === 1 ? "" : "s"}`, 40, 58);
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 76,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 36] },
    });
    doc.save(`decided-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function actTrip(ids: string[], decision: "approved" | "rejected", label: string) {
    if (ids.length === 0) return;
    try {
      const res = await bulk({ data: { ids, decision } });
      toast.success(`${decision === "approved" ? "Approved" : "Rejected"} ${res.count} expense${res.count > 1 ? "s" : ""} from ${label}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["pending"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  // Group pending expenses by report/trip
  const groups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      report: { id: string; title: string; type?: string; start_date?: string | null; end_date?: string | null } | null;
      submitter: string;
      items: any[];
      total: number;
    }>();
    for (const e of data) {
      const report = (e as any).expense_reports ?? null;
      const profile = (e as any).profile as { full_name: string | null } | null;
      const submitter = profile?.full_name ?? "Teammate";
      const key = report?.id ? `r:${report.id}` : `u:${e.user_id}`;
      const cur = map.get(key) ?? { key, report, submitter, items: [] as any[], total: 0 };
      cur.items.push(e);
      cur.total += Number(e.amount);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [data]);

  return (
    <div className="px-5 md:px-8 pt-10 pb-16 max-w-4xl">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <ShieldCheck className="size-3.5" /> Admin
      </div>
      <div className="flex items-end justify-between gap-4 mt-2">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Approvals</h1>
          <p className="text-sm text-white/75 mt-1">
            {tab === "pending"
              ? `${data.length} pending ${data.length === 1 ? "expense" : "expenses"} from your team.`
              : "Recently approved or rejected. Undo if needed."}
          </p>
        </div>
        {tab === "pending" && data.length > 0 && view === "expense" && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-semibold text-white/70 hover:text-white"
          >
            {allSelected ? "Clear" : "Select all"}
          </button>
        )}
      </div>

      {/* Status tab */}
      <div className="mt-5 inline-flex rounded-full bg-white/[0.04] ring-1 ring-white/10 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => { setTab("pending"); setSelected(new Set()); }}
          className={`px-3.5 py-1.5 rounded-full transition-colors ${tab === "pending" ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={() => { setTab("decided"); setSelected(new Set()); }}
          className={`px-3.5 py-1.5 rounded-full transition-colors ${tab === "decided" ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`}
        >
          Decided
        </button>
      </div>

      {tab === "pending" && (
      <>
      {/* View toggle */}
      <div className="mt-3 inline-flex rounded-full bg-white/[0.04] ring-1 ring-white/10 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => { setView("expense"); setSelected(new Set()); }}
          className={`px-3.5 py-1.5 rounded-full transition-colors ${view === "expense" ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`}
        >
          By expense
        </button>
        <button
          type="button"
          onClick={() => { setView("trip"); setSelected(new Set()); }}
          className={`px-3.5 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5 ${view === "trip" ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`}
        >
          <Plane className="size-3.5" /> By trip
        </button>
      </div>
      </>
      )}

      {/* Bulk action bar */}
      {tab === "pending" && view === "expense" && selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-3 z-20 mt-5 rounded-2xl bg-[#15141c]/90 ring-1 ring-white/10 backdrop-blur shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)] p-3 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              {selected.size} selected
            </p>
            <p className="text-xs text-white/65 tabular-nums">{formatMoney(totalSelected)} total</p>
          </div>
          <button
            type="button"
            onClick={() => actBulk("rejected")}
            className="rounded-xl bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/25 hover:text-white text-white/85 text-xs font-semibold px-3 h-9 inline-flex items-center gap-1.5 transition-colors"
          >
            <X className="size-3.5" /> Reject
          </button>
          <button
            type="button"
            onClick={() => actBulk("approved")}
            className="rounded-xl bg-primary hover:bg-primary/90 hover:shadow-[0_6px_20px_-2px_hsla(152,55%,45%,0.7)] text-primary-foreground text-xs font-semibold px-3 h-9 inline-flex items-center gap-1.5 shadow-[0_4px_14px_-2px_hsla(152,55%,45%,0.5)] transition-all"
          >
            <Check className="size-3.5" /> Approve
          </button>
        </motion.div>
      )}

      {tab === "pending" && view === "trip" ? (
        <ul className="mt-6 space-y-3">
          {isLoading && Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="h-32 rounded-3xl bg-muted animate-pulse" />
          ))}
          {!isLoading && groups.length === 0 && (
            <li className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
              <Inbox className="size-8 mx-auto text-white/40" />
              <p className="mt-3 text-sm font-semibold text-white">All clear</p>
              <p className="mt-1 text-xs text-white/60">Nothing to review right now.</p>
            </li>
          )}
          {groups.map((g, i) => (
            <TripGroup
              key={g.key}
              index={i}
              group={g}
              onApprove={() => actTrip(g.items.map((x) => x.id), "approved", g.report?.title ?? g.submitter)}
              onReject={() => actTrip(g.items.map((x) => x.id), "rejected", g.report?.title ?? g.submitter)}
              onItem={(id, dec) => act(id, dec)}
            />
          ))}
        </ul>
      ) : tab === "pending" ? (
      <ul className="mt-6 space-y-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="h-32 rounded-3xl bg-muted animate-pulse" />
        ))}
        {!isLoading && data.length === 0 && (
          <li className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <Inbox className="size-8 mx-auto text-white/40" />
            <p className="mt-3 text-sm font-semibold text-white">All clear</p>
            <p className="mt-1 text-xs text-white/60">Nothing to review right now.</p>
          </li>
        )}
        {data.map((e, i) => {
          const flags = Array.isArray(e.policy_flags) ? e.policy_flags : [];
          const profile = (e as any).profile as { full_name: string | null; avatar_url: string | null } | null;
          const submitter = profile?.full_name ?? "Teammate";
          const initials = submitter.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
          const isSelected = selected.has(e.id);
          return (
            <SwipeCard key={e.id} index={i} onApprove={() => act(e.id, "approved")} onReject={() => act(e.id, "rejected")}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); toggle(e.id); }}
                  aria-label={isSelected ? "Deselect" : "Select"}
                  className={`mt-0.5 size-5 rounded-md grid place-items-center ring-1 transition-colors shrink-0 ${
                    isSelected
                      ? "bg-primary ring-primary text-primary-foreground"
                      : "bg-transparent ring-white/30 hover:ring-white/60"
                  }`}
                >
                  {isSelected && <Check className="size-3.5" strokeWidth={3} />}
                </button>
                <div className="size-9 rounded-full bg-white/10 ring-1 ring-white/15 grid place-items-center text-[11px] font-semibold text-white/85 shrink-0">
                  {initials || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/60">{submitter}</p>
                  <Link
                    to="/expenses/$id"
                    params={{ id: e.id }}
                    onClick={(ev) => ev.stopPropagation()}
                    className="block text-base font-semibold mt-0.5 truncate text-white hover:text-primary transition-colors"
                  >
                    {e.merchant ?? "Untitled"}
                  </Link>
                  <p className="text-xs text-white/60 mt-0.5">
                    {new Date(e.expense_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {e.categories?.name ?? "Uncategorized"}
                  </p>
                </div>
                <p className="text-xl font-semibold tabular-nums shrink-0 text-white">
                  {formatMoney(Number(e.amount), e.currency)}
                </p>
              </div>

              {e.notes && (
                <p className="mt-3 text-sm text-white/75 border-l-2 border-white/15 pl-3">"{e.notes}"</p>
              )}

              {flags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {flags.map((f: any, j: number) => (
                    <span key={j} className="text-[10px] font-medium bg-warning/15 text-warning px-2 py-1 rounded-full">
                      ⚠ {typeof f === "string" ? f : f?.message ?? "Policy flag"}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => act(e.id, "rejected")}
                  className="rounded-2xl bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/25 text-white py-3 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors">
                  <X className="size-4" /> Reject
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => act(e.id, "approved")}
                  className="rounded-2xl bg-primary hover:bg-primary/90 hover:shadow-[0_6px_20px_-2px_hsla(152,55%,45%,0.7)] text-primary-foreground py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-[0_4px_14px_-2px_hsla(152,55%,45%,0.5)] transition-all">
                  <Check className="size-4" /> Approve
                </motion.button>
              </div>
              <p className="mt-3 text-[10px] text-white/50 text-center select-none md:hidden">Swipe right to approve · left to reject</p>
            </SwipeCard>
          );
        })}
      </ul>
      ) : (
        <>
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-white/55">
            {filteredDecided.length === decided.length
              ? `${decided.length} item${decided.length === 1 ? "" : "s"} · includes reimbursed`
              : `${filteredDecided.length} of ${decided.length} shown`}
          </p>
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={exportDecidedCSV}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] ring-1 ring-white/10 hover:bg-white/10 text-xs font-semibold text-white/85 px-2.5 h-8"
              title="Export visible decisions as CSV"
            >
              <FileDown className="size-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={exportDecidedPDF}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] ring-1 ring-white/10 hover:bg-white/10 text-xs font-semibold text-white/85 px-2.5 h-8"
              title="Export visible decisions as PDF"
            >
              <FileText className="size-3.5" /> PDF
            </button>
          </div>
        </div>
        {/* Status filter chips */}
        <div className="mt-3 inline-flex flex-wrap gap-1 rounded-full bg-white/[0.04] ring-1 ring-white/10 p-1 text-xs font-semibold">
          {([
            { id: "all", label: "All" },
            { id: "approved", label: "Approved" },
            { id: "rejected", label: "Rejected" },
            { id: "reimbursed", label: "Reimbursed" },
          ] as const).map((s) => {
            const active = decidedStatus === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setDecidedStatus(s.id)}
                className={`px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"
                }`}
              >
                {s.label}
                <span className={`text-[10px] tabular-nums rounded-full px-1.5 py-0.5 ${
                  active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-white/[0.06] text-white/60"
                }`}>
                  {decidedCounts[s.id]}
                </span>
              </button>
            );
          })}
        </div>
        {/* Search + sort */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="relative flex-1">
            <Search className="size-3.5 text-white/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={decidedQuery}
              onChange={(e) => setDecidedQuery(e.target.value)}
              placeholder="Search submitter, merchant, or category"
              className="w-full h-9 rounded-lg bg-white/[0.04] ring-1 ring-white/10 focus:ring-primary/50 outline-none text-sm text-white placeholder:text-white/40 pl-9 pr-3"
            />
          </label>
          <label className="relative inline-flex items-center">
            <ArrowUpDown className="size-3.5 text-white/55 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={decidedSort}
              onChange={(e) => setDecidedSort(e.target.value as typeof decidedSort)}
              className="appearance-none h-9 rounded-lg bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.06] focus:ring-primary/50 outline-none text-xs font-semibold text-white/85 pl-8 pr-8"
              aria-label="Sort decided expenses"
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
          {decidedLoading && (
            <li className="px-4 py-6 text-center text-sm text-white/60">Loading…</li>
          )}
          {!decidedLoading && filteredDecided.length === 0 && (
            <li className="px-4 py-12 text-center text-sm text-white/60">
              {decided.length === 0 ? "No decisions yet." : "No matches for your search."}
            </li>
          )}
          {filteredDecided.map((e) => {
            const profile = (e as any).profile as { full_name: string | null } | null;
            const submitter = profile?.full_name ?? "Teammate";
            const isRejected = e.status === "rejected";
            const label = e.status === "reimbursed" ? "Reimbursed" : e.status === "approved" ? "Approved" : "Rejected";
            return (
              <li key={e.id} className="px-4 py-3 flex items-center gap-3">
                <span
                  className={`shrink-0 size-6 rounded-full grid place-items-center ring-1 ${
                    isRejected
                      ? "bg-white/[0.06] ring-white/15 text-white/70"
                      : "bg-primary/15 ring-primary/30 text-primary"
                  }`}
                  title={label}
                >
                  {isRejected ? <X className="size-3.5" /> : <Check className="size-3.5" />}
                </span>
                <Link to="/expenses/$id" params={{ id: e.id }} className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-white">{e.merchant ?? "Untitled"}</p>
                  <p className="text-xs text-white/55 mt-0.5 truncate">
                    {label} · {submitter} ·{" "}
                    {new Date(e.expense_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {e.categories?.name ? ` · ${e.categories.name}` : ""}
                  </p>
                </Link>
                <p className="text-sm font-semibold tabular-nums shrink-0 text-white">
                  {formatMoney(Number(e.amount), e.currency)}
                </p>
                <button
                  onClick={() => undoDecision(e.id)}
                  className="text-[11px] font-semibold text-white/70 hover:text-white inline-flex items-center gap-1 shrink-0 rounded-lg px-2 py-1.5 hover:bg-white/5"
                  title={e.status === "reimbursed" ? "Revert to Approved" : "Move back to pending"}
                >
                  <Undo2 className="size-3.5" /> Undo
                </button>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </div>
  );
}

function TripGroup({
  index, group, onApprove, onReject, onItem,
}: {
  index: number;
  group: {
    key: string;
    report: { id: string; title: string; type?: string; start_date?: string | null; end_date?: string | null } | null;
    submitter: string;
    items: any[];
    total: number;
  };
  onApprove: () => void;
  onReject: () => void;
  onItem: (id: string, decision: "approved" | "rejected") => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const flagged = group.items.reduce((acc, e) => acc + (Array.isArray(e.policy_flags) ? e.policy_flags.length : 0), 0);
  const dateRange = group.report?.start_date && group.report?.end_date
    ? `${new Date(group.report.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(group.report.end_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : null;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-3xl bg-card ring-1 ring-border overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-5 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <span className={`size-10 rounded-2xl grid place-items-center shrink-0 ${group.report ? "bg-sky-500/12 text-sky-300 ring-1 ring-sky-400/25" : "bg-white/5 text-white/60 ring-1 ring-white/10"}`}>
          {group.report ? <Plane className="size-5" /> : <FileText className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/60">{group.submitter}</p>
          <p className="text-base font-semibold text-white truncate mt-0.5">
            {group.report?.title ?? "Unassigned expenses"}
          </p>
          <p className="text-xs text-white/60 mt-0.5">
            {group.items.length} item{group.items.length === 1 ? "" : "s"}
            {dateRange && ` · ${dateRange}`}
            {flagged > 0 && ` · ${flagged} flag${flagged === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-semibold tabular-nums text-white">{formatMoney(group.total)}</p>
          <ChevronDown className={`size-4 text-white/50 ml-auto mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 -mt-1">
          <ul className="space-y-1.5 mb-4">
            {group.items.map((e) => {
              const flags = Array.isArray(e.policy_flags) ? e.policy_flags : [];
              return (
                <li key={e.id} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3 flex items-center gap-3">
                  <Link to="/expenses/$id" params={{ id: e.id }} className="min-w-0 flex-1 hover:text-primary transition-colors">
                    <p className="text-sm font-medium truncate text-white">{e.merchant ?? "Untitled"}</p>
                    <p className="text-[11px] text-white/55">
                      {new Date(e.expense_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {e.categories?.name ?? "Uncategorized"}
                      {flags.length > 0 && <span className="text-warning"> · ⚠ {flags.length}</span>}
                    </p>
                  </Link>
                  <p className="text-sm font-semibold tabular-nums text-white shrink-0">{formatMoney(Number(e.amount), e.currency)}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onItem(e.id, "rejected")}
                      aria-label="Reject"
                      className="size-8 rounded-lg bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/25 hover:text-white text-white/80 grid place-items-center transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onItem(e.id, "approved")}
                      aria-label="Approve"
                      className="size-8 rounded-lg bg-primary/15 ring-1 ring-primary/30 hover:bg-primary/35 hover:ring-primary/50 text-primary grid place-items-center transition-colors"
                    >
                      <Check className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onReject}
              className="rounded-2xl bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/25 text-white py-3 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
            >
              <X className="size-4" /> Reject all
            </button>
            <button
              type="button"
              onClick={onApprove}
              className="rounded-2xl bg-primary hover:bg-primary/90 hover:shadow-[0_6px_20px_-2px_hsla(152,55%,45%,0.7)] text-primary-foreground py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-[0_4px_14px_-2px_hsla(152,55%,45%,0.5)] transition-all"
            >
              <Check className="size-4" /> Approve all
            </button>
          </div>
        </div>
      )}
    </motion.li>
  );
}

function SwipeCard({
  index,
  onApprove,
  onReject,
  children,
}: {
  index: number;
  onApprove: () => void;
  onReject: () => void;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const bg = useTransform(
    x,
    [-180, -40, 0, 40, 180],
    [
      "color-mix(in oklab, var(--destructive) 22%, transparent)",
      "color-mix(in oklab, var(--destructive) 8%, transparent)",
      "transparent",
      "color-mix(in oklab, var(--success) 8%, transparent)",
      "color-mix(in oklab, var(--success) 22%, transparent)",
    ],
  );
  const approveOpacity = useTransform(x, [10, 100], [0, 1]);
  const rejectOpacity = useTransform(x, [-100, -10], [1, 0]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120 || info.velocity.x > 700) onApprove();
    else if (info.offset.x < -120 || info.velocity.x < -700) onReject();
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative rounded-3xl"
      style={{ background: bg }}
    >
      <motion.div
        aria-hidden
        style={{ opacity: rejectOpacity }}
        className="absolute inset-y-0 left-4 flex items-center text-destructive font-semibold text-sm pointer-events-none"
      >
        <X className="size-5 mr-1" /> Reject
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: approveOpacity }}
        className="absolute inset-y-0 right-4 flex items-center text-success font-semibold text-sm pointer-events-none"
      >
        Approve <Check className="size-5 ml-1" />
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        style={{ x }}
        onDragEnd={onDragEnd}
        className="rounded-3xl bg-card ring-1 ring-border p-5 cursor-grab active:cursor-grabbing touch-pan-y"
      >
        {children}
      </motion.div>
    </motion.li>
  );
}