import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { BarChart3, Bookmark, Download, FileText, Shield, Sheet, Trash2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { deleteSavedReport, listAllExpenses, listSavedReports, upsertSavedReport } from "@/lib/expenses.functions";
import { useRoles } from "@/hooks/use-roles";
import { formatMoney } from "@/lib/format";
import { createXlsxBlob } from "@/lib/xlsx-export";

export const Route = createFileRoute("/_authenticated/finance/reports")({
  head: () => ({ meta: [{ title: "Report builder — Expense It" }] }),
  ssr: false,
  component: BuilderPage,
});

const DIMS = [
  { v: "category", label: "Category" },
  { v: "user_id", label: "Person" },
  { v: "status", label: "Status" },
  { v: "month", label: "Month" },
] as const;
const MEASURES = [
  { v: "sum", label: "Sum" },
  { v: "count", label: "Count" },
  { v: "avg", label: "Average" },
] as const;

type Row = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof listAllExpenses>>>>[number];

function BuilderPage() {
  const { isFinance, isLoading } = useRoles();
  const qc = useQueryClient();
  const list = useServerFn(listAllExpenses);
  const loadSaved = useServerFn(listSavedReports);
  const saveReport = useServerFn(upsertSavedReport);
  const removeSaved = useServerFn(deleteSavedReport);
  const { data: rows = [], isPending: rowsPending } = useQuery({ queryKey: ["all-expenses"], queryFn: () => list(), enabled: isFinance });
  const { data: savedViews = [], isPending: savedPending } = useQuery({ queryKey: ["saved-reports"], queryFn: () => loadSaved(), enabled: isFinance });
  const [dim, setDim] = useState<(typeof DIMS)[number]["v"]>("category");
  const [measure, setMeasure] = useState<(typeof MEASURES)[number]["v"]>("sum");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [days, setDays] = useState<"30" | "90" | "365" | "all">("90");
  const [saveName, setSaveName] = useState("");
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r = rows as Row[];
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (days !== "all") {
      const cutoff = Date.now() - Number(days) * 86400000;
      r = r.filter((x) => new Date(x.expense_date).getTime() >= cutoff);
    }
    return r;
  }, [rows, statusFilter, days]);

  const grouped = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of filtered) {
      const key = dim === "category" ? (r.categories?.name ?? "Uncategorized")
        : dim === "user_id" ? r.user_id
        : dim === "status" ? r.status
        : new Date(r.expense_date).toISOString().slice(0, 7);
      const arr = m.get(key) ?? [];
      arr.push(Number(r.amount));
      m.set(key, arr);
    }
    const out = Array.from(m.entries()).map(([k, vals]) => {
      const sum = vals.reduce((a, b) => a + b, 0);
      const v = measure === "sum" ? sum : measure === "count" ? vals.length : sum / vals.length;
      return { key: k, value: v, count: vals.length };
    });
    out.sort((a, b) => b.value - a.value);
    return out;
  }, [filtered, dim, measure]);

  const max = Math.max(1, ...grouped.map((g) => g.value));
  const exportRows = grouped.map((g) => ({
    group: g.key,
    measure: measure === "count" ? g.value : Number(g.value.toFixed(2)),
    count: g.count,
  }));
  const spec = { dim, measure, statusFilter, days };

  function exportCsv() {
    const rows = [
      [DIMS.find((d) => d.v === dim)?.label ?? dim, MEASURES.find((m) => m.v === measure)?.label ?? measure, "Count"],
      ...grouped.map((g) => [g.key, String(g.value), String(g.count)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-${dim}-${measure}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportXlsx() {
    const headers = Object.keys(exportRows[0] ?? {});
    const blob = createXlsxBlob(
      "Report",
      headers.length ? [headers, ...exportRows.map((r) => headers.map((h) => (r as Record<string, unknown>)[h] as string | number))] : [],
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-${dim}-${measure}-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text("Finance report", 40, 42);
    doc.setFontSize(10);
    doc.text(`Group by: ${DIMS.find((d) => d.v === dim)?.label ?? dim} · Measure: ${MEASURES.find((m) => m.v === measure)?.label ?? measure}`, 40, 60);
    doc.text(`Status: ${statusFilter} · Range: ${days === "all" ? "All time" : `${days} days`} · Source rows: ${filtered.length}`, 40, 74);
    autoTable(doc, {
      startY: 94,
      head: [["Group", "Value", "Count"]],
      body: exportRows.map((row) => [
        row.group,
        measure === "count" ? String(row.measure) : formatMoney(Number(row.measure)),
        String(row.count),
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [26, 26, 26] },
    });
    doc.save(`report-${dim}-${measure}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function saveCurrentView() {
    const name = saveName.trim();
    if (!name) {
      toast.error("Name this view first");
      return;
    }

    try {
      const result = await saveReport({ data: { id: activeSavedId ?? undefined, name, spec_json: spec } });
      setActiveSavedId(result.id);
      qc.invalidateQueries({ queryKey: ["saved-reports"] });
      toast.success(activeSavedId ? "View updated" : "View saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save view");
    }
  }

  async function deleteView(id: string) {
    try {
      await removeSaved({ data: { id } });
      if (activeSavedId === id) {
        setActiveSavedId(null);
        setSaveName("");
      }
      qc.invalidateQueries({ queryKey: ["saved-reports"] });
      toast.success("View deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete view");
    }
  }

  function applySavedView(view: { id: string; name: string; spec_json: { dim: typeof dim; measure: typeof measure; statusFilter: string; days: typeof days } }) {
    setDim(view.spec_json.dim);
    setMeasure(view.spec_json.measure);
    setStatusFilter(view.spec_json.statusFilter);
    setDays(view.spec_json.days);
    setSaveName(view.name);
    setActiveSavedId(view.id);
  }

  if (isLoading) return <div className="px-5 pt-12"><div className="h-32 rounded-3xl bg-muted animate-pulse" /></div>;
  if (!isFinance) {
    return (
      <div className="px-5 pt-16 text-center">
        <Shield className="size-7 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Finance access required.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-32">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5 text-primary" />
        <h1 className="text-3xl font-semibold tracking-tight">Report builder</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Slice your data however finance needs it.</p>

      <div className="mt-6 space-y-3">
        <Selector label="Group by" value={dim} options={DIMS.map((d) => [d.v, d.label])} onChange={(v) => setDim(v as typeof dim)} />
        <Selector label="Measure" value={measure} options={MEASURES.map((m) => [m.v, m.label])} onChange={(v) => setMeasure(v as typeof measure)} />
        <Selector label="Status filter" value={statusFilter}
          options={[["all","All"],["draft","Draft"],["submitted","Submitted"],["approved","Approved"],["reimbursed","Reimbursed"],["rejected","Rejected"]]}
          onChange={setStatusFilter} />
        <Selector label="Range" value={days}
          options={[["30","30 days"],["90","90 days"],["365","1 year"],["all","All time"]]}
          onChange={(v) => setDays(v as typeof days)} />
      </div>

      <div className="mt-6 rounded-3xl bg-card ring-1 ring-border p-4">
        <div className="flex items-center gap-2">
          <Bookmark className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Saved views</h2>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            placeholder="Quarterly reimbursements"
            className="min-w-0 flex-1 rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-border"
          />
          <button onClick={saveCurrentView} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
            {activeSavedId ? "Update" : "Save"}
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {savedViews.map((view) => {
            const savedSpec = view.spec_json as { dim: typeof dim; measure: typeof measure; statusFilter: string; days: typeof days };
            return (
            <li key={view.id} className="flex items-center gap-2 rounded-2xl bg-background px-3 py-3 ring-1 ring-border">
              <button onClick={() => applySavedView({ id: view.id, name: view.name, spec_json: savedSpec })} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{view.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {savedSpec.dim} · {savedSpec.measure} · {savedSpec.days}
                </p>
              </button>
              <button onClick={() => deleteView(view.id)} className="rounded-xl bg-muted p-2 text-muted-foreground">
                <Trash2 className="size-4" />
              </button>
            </li>
            );
          })}
          {!savedPending && savedViews.length === 0 && <li className="text-sm text-muted-foreground">No saved views yet.</li>}
        </ul>
      </div>

      <div className="mt-6 rounded-3xl bg-card ring-1 ring-border p-4">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Result</p>
        <p className="mt-1 text-xs text-muted-foreground">{filtered.length} rows · {grouped.length} groups</p>
        <ul className="mt-4 space-y-2">
          {grouped.map((g) => (
            <li key={g.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{g.key}</span>
                <span className="font-semibold tabular-nums">{measure === "count" ? g.value : formatMoney(g.value)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(g.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
          {!rowsPending && grouped.length === 0 && <li className="text-sm text-muted-foreground py-6 text-center">No data.</li>}
        </ul>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <button onClick={exportCsv} className="rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-2">
          <Download className="size-4" /> CSV
        </button>
        <button onClick={exportXlsx} className="rounded-2xl bg-card py-3 text-sm font-semibold ring-1 ring-border inline-flex items-center justify-center gap-2">
          <Sheet className="size-4" /> XLSX
        </button>
        <button onClick={exportPdf} className="rounded-2xl bg-card py-3 text-sm font-semibold ring-1 ring-border inline-flex items-center justify-center gap-2">
          <FileText className="size-4" /> PDF
        </button>
      </div>
    </div>
  );
}

function Selector({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-3">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${value === v ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
