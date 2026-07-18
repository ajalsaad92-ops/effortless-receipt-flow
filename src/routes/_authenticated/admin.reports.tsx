import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  FileText,
  FileDown,
  Plus,
  Save,
  Trash2,
  Loader2,
  Sparkles,
  ChevronDown,
  Check,
  X,
  ArrowLeft,
  FolderOpen,
  Pencil,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Cell,
} from "recharts";
import { toast } from "sonner";
import {
  runReport,
  listReportTemplates,
  saveReportTemplate,
  deleteReportTemplate,
  listReportLookups,
  reportSpec,
  COLUMN_KEYS,
  STATUS_OPTIONS,
  GROUP_OPTIONS,
  DATE_PRESETS,
  type ReportSpec,
  type ColumnKey,
} from "@/lib/report-builder.functions";
import { fmtMoney, fmtDate, statusTone } from "@/lib/format";
import { createXlsxBlob } from "@/lib/xlsx-export";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — Expense It" }] }),
  ssr: false,
  component: ReportBuilderPage,
});

// ---------------- Defaults & presets ----------------

const DEFAULT_SPEC: ReportSpec = reportSpec.parse({
  date: { preset: "this_month" },
  filters: {},
  groupBy: "none",
  columns: ["expense_date", "employee", "merchant", "category", "amount", "status"],
  sort: { column: "expense_date", dir: "desc" },
  limit: 500,
});

type Preset = { id: string; name: string; spec: ReportSpec };

const PRESETS: Preset[] = [
  {
    id: "by-employee-month",
    name: "Spend by employee (this month)",
    spec: reportSpec.parse({
      date: { preset: "this_month" },
      filters: {},
      groupBy: "employee",
      columns: ["expense_date", "employee", "merchant", "category", "amount", "status"],
      sort: { column: "amount", dir: "desc" },
      limit: 500,
    }),
  },
  {
    id: "by-category-quarter",
    name: "Spend by category (this quarter)",
    spec: reportSpec.parse({
      date: { preset: "this_quarter" },
      filters: {},
      groupBy: "category",
      columns: ["expense_date", "category", "merchant", "amount", "employee"],
      sort: { column: "amount", dir: "desc" },
      limit: 500,
    }),
  },
  {
    id: "by-trip-ytd",
    name: "Spend by trip / report (YTD)",
    spec: reportSpec.parse({
      date: { preset: "ytd" },
      filters: {},
      groupBy: "report",
      columns: ["expense_date", "report", "employee", "merchant", "amount", "status"],
      sort: { column: "amount", dir: "desc" },
      limit: 500,
    }),
  },
  {
    id: "violations-90",
    name: "Policy violations (last 90 days)",
    spec: reportSpec.parse({
      date: { preset: "last_90" },
      filters: { hasFlag: true },
      groupBy: "employee",
      columns: ["expense_date", "employee", "merchant", "amount", "flags", "status"],
      sort: { column: "expense_date", dir: "desc" },
      limit: 500,
    }),
  },
  {
    id: "awaiting-reimb",
    name: "Awaiting reimbursement",
    spec: reportSpec.parse({
      date: { preset: "all_time" },
      filters: { statuses: ["approved"] },
      groupBy: "employee",
      columns: ["expense_date", "employee", "merchant", "category", "amount"],
      sort: { column: "expense_date", dir: "asc" },
      limit: 2000,
    }),
  },
  {
    id: "top-merchants",
    name: "Top merchants (last 90 days)",
    spec: reportSpec.parse({
      date: { preset: "last_90" },
      filters: {},
      groupBy: "merchant",
      columns: ["expense_date", "merchant", "category", "employee", "amount"],
      sort: { column: "amount", dir: "desc" },
      limit: 500,
    }),
  },
];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  expense_date: "Date",
  employee: "Employee",
  merchant: "Merchant",
  category: "Category",
  report: "Trip / report",
  amount: "Amount",
  currency: "Currency",
  status: "Status",
  flags: "Flags",
  notes: "Notes",
};

// ---------------- Page ----------------

function ReportBuilderPage() {
  const qc = useQueryClient();
  const fetchTemplates = useServerFn(listReportTemplates);
  const fetchLookups = useServerFn(listReportLookups);
  const runReportFn = useServerFn(runReport);
  const saveFn = useServerFn(saveReportTemplate);
  const delFn = useServerFn(deleteReportTemplate);
  const [spec, setSpec] = useState<ReportSpec>(DEFAULT_SPEC);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string>("Untitled report");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [mode, setMode] = useState<"library" | "builder">("library");

  const { data: templates = [], isPending: templatesPending } = useQuery({
    queryKey: ["report-templates"],
    queryFn: () => fetchTemplates(),
  });

  const { data: lookups } = useQuery({
    queryKey: ["report-lookups"],
    queryFn: () => fetchLookups(),
    staleTime: 5 * 60_000,
  });

  const { data: result, isFetching, error } = useQuery({
    queryKey: ["run-report", spec],
    queryFn: () => runReportFn({ data: spec }),
    placeholderData: (prev) => prev,
  });

  const applyPreset = (p: Preset) => {
    setSpec(p.spec);
    setActiveTemplateId(null);
    setActiveName(p.name);
    setMode("builder");
  };

  const applyTemplate = (t: any) => {
    try {
      const parsed = reportSpec.parse(t.spec_json);
      setSpec(parsed);
      setActiveTemplateId(t.id);
      setActiveName(t.name);
      setMode("builder");
    } catch {
      toast.error("Couldn't load this template");
    }
  };

  const startNew = () => {
    setSpec(DEFAULT_SPEC);
    setActiveTemplateId(null);
    setActiveName("Untitled report");
    setMode("builder");
  };

  const saveCurrent = async () => {
    const name = saveName.trim() || activeName;
    if (!name) return toast.error("Give it a name");
    try {
      const { id } = await saveFn({
        data: { id: activeTemplateId ?? undefined, name, spec },
      });
      setActiveTemplateId(id);
      setActiveName(name);
      setSaveName("");
      setSaveOpen(false);
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success(activeTemplateId ? "Template updated" : "Template saved");
      if (!activeTemplateId) setMode("library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    }
  };

  const removeTemplate = async (id: string) => {
    if (!confirm("Delete this saved report?")) return;
    try {
      await delFn({ data: { id } });
      if (activeTemplateId === id) {
        setActiveTemplateId(null);
        setActiveName("Untitled report");
      }
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    }
  };

  // ---------------- Export ----------------

  const buildExportRows = (): { headers: string[]; rows: (string | number)[][] } => {
    if (!result) return { headers: [], rows: [] };
    const headers = spec.columns.map((c) => COLUMN_LABELS[c]);
    const rows: (string | number)[][] = result.rows.map((r: any) =>
      spec.columns.map((c) => {
        const v = r[c];
        if (c === "amount") return Number(v ?? 0);
        if (c === "expense_date") return v ?? "";
        return v ?? "";
      }),
    );
    return { headers, rows };
  };

  const fileBase = () => {
    const safe = activeName.replace(/[^a-z0-9-_ ]/gi, "").trim() || "report";
    const date = new Date().toISOString().slice(0, 10);
    return `${safe} ${date}`;
  };

  const exportCSV = () => {
    const { headers, rows } = buildExportRows();
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `${fileBase()}.csv`);
  };

  const exportXLSX = async () => {
    const { headers, rows } = buildExportRows();
    const blob = createXlsxBlob("Report", [headers, ...rows]);
    triggerDownload(blob, `${fileBase()}.xlsx`);
  };

  const exportPDF = async () => {
    const [{ jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = (autoTableMod as any).default ?? autoTableMod;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text(activeName, 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(120);
    const rangeLabel = formatRangeLabel(spec);
    doc.text(
      `${rangeLabel}  ·  ${result?.count ?? 0} rows  ·  Total ${fmtMoney(
        result?.grandTotal ?? 0,
        result?.currency === "—" ? "USD" : result?.currency ?? "USD",
      )}`,
      40,
      58,
    );
    const { headers, rows } = buildExportRows();
    autoTable(doc, {
      head: [headers],
      body: rows.map((r) =>
        r.map((v, i) => (spec.columns[i] === "amount" ? fmtMoney(Number(v)) : v)),
      ),
      startY: 76,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [22, 110, 70], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 245] },
    });
    doc.save(`${fileBase()}.pdf`);
  };

  return (
    <div className="px-5 md:px-8 pt-10 pb-16 max-w-[1400px]">
      {mode === "library" ? (
        <LibraryView
          templates={templates}
          isPending={templatesPending}
          onOpen={applyTemplate}
          onDelete={removeTemplate}
          onNew={startNew}
        />
      ) : (
      <>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setMode("library")}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> All reports
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight truncate">{activeName}</h1>
            <button
              type="button"
              onClick={() => { setSaveName(activeName); setSaveOpen(true); }}
              aria-label="Rename"
              title="Rename"
              className="shrink-0 inline-flex items-center justify-center size-8 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06]"
            >
              <Pencil className="size-4" />
            </button>
          </div>
          <p className="text-sm text-white/55 mt-1">
            {activeTemplateId ? "Saved report · changes apply on Update" : "New report · save it to your library when ready"}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <PresetsMenu onPick={applyPreset} />
          <div className="flex items-center gap-1.5">
            <ExportBtn icon={FileDown} label="CSV" onClick={exportCSV} />
            <ExportBtn icon={FileSpreadsheet} label="XLSX" onClick={exportXLSX} />
            <ExportBtn icon={FileText} label="PDF" onClick={exportPDF} />
          </div>
          <button
            type="button"
            onClick={() => { setSaveName(activeTemplateId ? activeName : ""); setSaveOpen(true); }}
            className="rounded-xl px-3 h-9 text-xs font-semibold bg-primary text-primary-foreground inline-flex items-center gap-1.5 shadow-[0_4px_14px_-2px_hsla(152,55%,45%,0.5)]"
          >
            <Save className="size-3.5" /> {activeTemplateId ? "Update" : "Save to library"}
          </button>
        </div>
      </div>

      <div className="mt-6">
      {/* Builder toolbar */}
        <main className="space-y-4 min-w-0">
          <BuilderControls spec={spec} setSpec={setSpec} lookups={lookups} />

          <ColumnsAndSort spec={spec} setSpec={setSpec} />

          <PreviewPanel
            spec={spec}
            result={result}
            isFetching={isFetching}
            error={error as Error | null}
            activeName={activeName}
          />
        </main>
      </div>
      </>
      )}

      {/* Save dialog */}
      <AnimatePresence>
        {saveOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSaveOpen(false)}
              className="fixed inset-0 z-40 bg-black/60"
              aria-label="Close"
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(28rem,calc(100vw-1.5rem))] rounded-3xl bg-[#15141c] ring-1 ring-white/10 shadow-2xl p-6"
            >
              <h3 className="text-base font-semibold text-white">
                {activeTemplateId ? "Update template" : "Save as template"}
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Saved templates appear in the left sidebar for one-click access.
              </p>
              <input
                autoFocus
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. Q1 travel by employee"
                className="mt-4 w-full rounded-2xl bg-white/[0.06] ring-1 ring-white/10 focus:ring-primary outline-none px-4 h-11 text-sm text-white placeholder:text-white/35"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCurrent();
                  if (e.key === "Escape") setSaveOpen(false);
                }}
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSaveOpen(false)}
                  className="rounded-2xl px-4 h-10 text-sm font-medium text-white/80 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveCurrent}
                  className="rounded-2xl px-4 h-10 text-sm font-semibold bg-primary text-primary-foreground"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------- Section ----------------

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-3">
      <div className="flex items-center gap-2 px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/55">
        <Icon className="size-3" /> {title}
      </div>
      {children}
    </div>
  );
}

// ---------------- Builder controls ----------------

const DATE_LABELS: Record<(typeof DATE_PRESETS)[number], string> = {
  this_month: "This month",
  this_quarter: "This quarter",
  this_year: "This year",
  last_7: "Last 7 days",
  last_30: "Last 30 days",
  last_90: "Last 90 days",
  ytd: "Year to date",
  all_time: "All time",
  custom: "Custom range",
};

function formatRangeLabel(spec: ReportSpec): string {
  if (spec.date.preset === "custom") {
    return `${spec.date.from ?? "—"} → ${spec.date.to ?? "—"}`;
  }
  return DATE_LABELS[spec.date.preset];
}

function BuilderControls({
  spec,
  setSpec,
  lookups,
}: {
  spec: ReportSpec;
  setSpec: (s: ReportSpec) => void;
  lookups: any;
}) {
  const update = (patch: Partial<ReportSpec>) => setSpec({ ...spec, ...patch });
  const updateFilters = (patch: Partial<ReportSpec["filters"]>) =>
    setSpec({ ...spec, filters: { ...spec.filters, ...patch } });

  return (
    <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-4 md:p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date */}
        <FieldLabel label="Date range">
          <select
            value={spec.date.preset}
            onChange={(e) =>
              update({
                date: { ...spec.date, preset: e.target.value as any },
              })
            }
            className="builder-select"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {DATE_LABELS[p]}
              </option>
            ))}
          </select>
          {spec.date.preset === "custom" && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="date"
                value={spec.date.from ?? ""}
                onChange={(e) =>
                  update({ date: { ...spec.date, from: e.target.value } })
                }
                className="builder-input"
              />
              <span className="text-white/40 text-xs">→</span>
              <input
                type="date"
                value={spec.date.to ?? ""}
                onChange={(e) =>
                  update({ date: { ...spec.date, to: e.target.value } })
                }
                className="builder-input"
              />
            </div>
          )}
        </FieldLabel>

        {/* Status */}
        <FieldLabel label="Status">
          <MultiChip
            options={STATUS_OPTIONS.map((s) => ({ id: s, label: s }))}
            selected={spec.filters.statuses}
            onChange={(v) => updateFilters({ statuses: v as any })}
            placeholder="All statuses"
          />
        </FieldLabel>

        {/* Group by */}
        <FieldLabel label="Group by">
          <select
            value={spec.groupBy}
            onChange={(e) => update({ groupBy: e.target.value as any })}
            className="builder-select"
          >
            {GROUP_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g === "none" ? "No grouping" : g[0].toUpperCase() + g.slice(1)}
              </option>
            ))}
          </select>
        </FieldLabel>

        {/* Limit */}
        <FieldLabel label="Row limit">
          <select
            value={spec.limit}
            onChange={(e) =>
              update({ limit: Number(e.target.value) as ReportSpec["limit"] })
            }
            className="builder-select"
          >
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={2000}>2,000</option>
          </select>
        </FieldLabel>

        {/* Employees */}
        <FieldLabel label="Employees">
          <MultiChip
            options={(lookups?.employees ?? []).map((e: any) => ({
              id: e.id,
              label: e.full_name ?? "—",
            }))}
            selected={spec.filters.employees}
            onChange={(v) => updateFilters({ employees: v })}
            placeholder="All employees"
          />
        </FieldLabel>

        {/* Categories */}
        <FieldLabel label="Categories">
          <MultiChip
            options={(lookups?.categories ?? []).map((c: any) => ({
              id: c.id,
              label: c.name,
            }))}
            selected={spec.filters.categories}
            onChange={(v) => updateFilters({ categories: v })}
            placeholder="All categories"
          />
        </FieldLabel>

        {/* Trips/reports */}
        <FieldLabel label="Trips / reports">
          <MultiChip
            options={(lookups?.reports ?? []).map((r: any) => ({
              id: r.id,
              label: r.title,
            }))}
            selected={spec.filters.reports}
            onChange={(v) => updateFilters({ reports: v })}
            placeholder="All trips"
          />
        </FieldLabel>

        {/* Amount range + flag */}
        <FieldLabel label="Amount ($)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={spec.filters.amountMin ?? ""}
              onChange={(e) =>
                updateFilters({
                  amountMin: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="builder-input flex-1"
            />
            <span className="text-white/40 text-xs">→</span>
            <input
              type="number"
              placeholder="Max"
              value={spec.filters.amountMax ?? ""}
              onChange={(e) =>
                updateFilters({
                  amountMax: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="builder-input flex-1"
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-white/70 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={spec.filters.hasFlag === true}
              onChange={(e) =>
                updateFilters({ hasFlag: e.target.checked ? true : null })
              }
              className="size-3.5 accent-primary"
            />
            Only with policy flags
          </label>
        </FieldLabel>
      </div>

      <style>{`
        .builder-select, .builder-input {
          width: 100%;
          background: hsla(0,0%,100%,0.06);
          border: 1px solid hsla(0,0%,100%,0.10);
          border-radius: 0.75rem;
          padding: 0 0.75rem;
          height: 2.25rem;
          color: white;
          font-size: 0.8125rem;
          outline: none;
        }
        .builder-select:focus, .builder-input:focus {
          border-color: hsl(var(--primary));
        }
        .builder-select option {
          background: #15141c; color: white;
        }
      `}</style>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/55 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

// ---------------- MultiChip ----------------

function MultiChip({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const labelMap = useMemo(
    () => Object.fromEntries(options.map((o) => [o.id, o.label])),
    [options],
  );
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="builder-select text-left flex items-center justify-between gap-2"
      >
        <span className={`truncate ${selected.length === 0 ? "text-white/40" : ""}`}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
              ? (labelMap[selected[0]] ?? "1 selected")
              : `${selected.length} selected`}
        </span>
        <ChevronDown className="size-3.5 text-white/50 shrink-0" />
      </button>
      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30"
            aria-label="Close"
          />
          <div className="absolute z-40 mt-1 w-full max-h-64 overflow-auto rounded-xl bg-[#15141c] ring-1 ring-white/15 shadow-2xl py-1">
            {options.length === 0 && (
              <p className="text-xs text-white/50 px-3 py-2">No options</p>
            )}
            {options.map((o) => {
              const sel = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-white/85 hover:bg-white/5 text-left"
                >
                  <span
                    className={`size-4 rounded grid place-items-center ring-1 ${
                      sel
                        ? "bg-primary ring-primary text-primary-foreground"
                        : "ring-white/20"
                    }`}
                  >
                    {sel && <Check className="size-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full text-left px-3 py-1.5 mt-1 text-xs text-white/55 hover:bg-white/5 border-t border-white/5"
              >
                Clear selection
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Columns + sort ----------------

function ColumnsAndSort({
  spec,
  setSpec,
}: {
  spec: ReportSpec;
  setSpec: (s: ReportSpec) => void;
}) {
  const toggleCol = (c: ColumnKey) => {
    const has = spec.columns.includes(c);
    let next = has ? spec.columns.filter((x) => x !== c) : [...spec.columns, c];
    if (next.length === 0) next = [c];
    setSpec({ ...spec, columns: next });
  };
  return (
    <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-4 md:p-5 flex flex-col md:flex-row md:items-end gap-4">
      <div className="flex-1 min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/55 mb-2">
          Columns
        </span>
        <div className="flex flex-wrap gap-1.5">
          {COLUMN_KEYS.map((c) => {
            const sel = spec.columns.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCol(c)}
                className={`text-xs h-8 px-3 rounded-full ring-1 transition-colors ${
                  sel
                    ? "bg-primary/20 text-white ring-primary/50"
                    : "bg-white/[0.04] text-white/65 ring-white/10 hover:bg-white/10"
                }`}
              >
                {COLUMN_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <FieldLabel label="Sort by">
          <select
            value={spec.sort.column}
            onChange={(e) =>
              setSpec({ ...spec, sort: { ...spec.sort, column: e.target.value as ColumnKey } })
            }
            className="builder-select"
          >
            {COLUMN_KEYS.map((c) => (
              <option key={c} value={c}>
                {COLUMN_LABELS[c]}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Dir">
          <select
            value={spec.sort.dir}
            onChange={(e) =>
              setSpec({ ...spec, sort: { ...spec.sort, dir: e.target.value as "asc" | "desc" } })
            }
            className="builder-select"
          >
            <option value="desc">↓ Desc</option>
            <option value="asc">↑ Asc</option>
          </select>
        </FieldLabel>
      </div>
    </div>
  );
}

// ---------------- Preview + exports ----------------

function PreviewPanel({
  spec,
  result,
  isFetching,
  error,
  activeName,
}: {
  spec: ReportSpec;
  result: any;
  isFetching: boolean;
  error: Error | null;
  activeName: string;
}) {
  const total = result?.grandTotal ?? 0;
  const currency = result?.currency === "—" ? "USD" : result?.currency ?? "USD";
  const isMixed = result?.currency === "—";
  const rowCount = result?.count ?? 0;
  const avg = rowCount > 0 ? total / rowCount : 0;

  // Chart data: top 8 groups when grouped, else top 8 by amount from flat rows.
  const chartData = useMemo(() => {
    if (!result) return [] as { label: string; value: number }[];
    if (spec.groupBy !== "none" && result.groups?.length) {
      return [...result.groups]
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 8)
        .map((g: any) => ({ label: g.label || "—", value: Number(g.total) || 0 }));
    }
    if (result.rows?.length) {
      return [...result.rows]
        .sort((a: any, b: any) => Number(b.amount) - Number(a.amount))
        .slice(0, 8)
        .map((r: any) => ({
          label: r.merchant || r.employee || r.category || r.expense_date || "—",
          value: Number(r.amount) || 0,
        }));
    }
    return [];
  }, [result, spec.groupBy]);

  return (
    <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 overflow-hidden">
      <div className="p-4 md:p-5 border-b border-white/5">
        <p className="text-xs uppercase tracking-wider text-white/55 font-semibold">
          Preview · {formatRangeLabel(spec)}
        </p>
        <h2 className="text-base font-semibold text-white truncate mt-0.5">{activeName}</h2>
      </div>

      {/* Summary band */}
      <div className="px-4 md:px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-white/5">
        <Stat label="Rows" value={rowCount} loading={isFetching && !result} />
        <Stat
          label={`Total${isMixed ? " · mixed" : ""}`}
          value={fmtMoney(total, currency)}
          loading={isFetching && !result}
        />
        <Stat
          label="Avg / row"
          value={rowCount > 0 ? fmtMoney(avg, currency) : "—"}
          loading={isFetching && !result}
        />
        <Stat
          label={spec.groupBy !== "none" ? `Top ${spec.groupBy}` : "Top item"}
          value={chartData[0]?.label ?? "—"}
          loading={isFetching && !result}
        />
        {isFetching && result && (
          <span className="col-span-2 md:col-span-4 -mt-2 text-xs text-white/55 inline-flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" /> Updating…
          </span>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="px-4 md:px-5 pt-4 pb-2 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2">
            {spec.groupBy !== "none" ? `Top ${chartData.length} by total` : `Top ${chartData.length} expenses`}
          </p>
          <div className="h-44 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RTooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{
                    background: "#15141c",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                  formatter={(v: any) => [fmtMoney(Number(v), currency), "Total"]}
                />
                <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={`hsla(152, 55%, ${55 - i * 3}%, ${0.9 - i * 0.05})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {error ? (
        <div className="p-6 text-sm text-destructive">{error.message}</div>
      ) : (
        <div className="overflow-auto max-h-[60vh]">
          {spec.groupBy === "none" ? (
            <FlatTable spec={spec} rows={result?.rows ?? []} loading={isFetching && !result} />
          ) : (
            <GroupedView spec={spec} groups={result?.groups ?? []} loading={isFetching && !result} />
          )}
        </div>
      )}
    </div>
  );
}

function ExportBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-3 h-9 text-xs font-semibold bg-white/[0.05] ring-1 ring-white/10 hover:bg-white/10 text-white inline-flex items-center gap-1.5"
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function Stat({ label, value, loading }: { label: string; value: any; loading: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">{label}</p>
      <p className="text-sm font-semibold text-white tabular-nums">
        {loading ? "…" : value}
      </p>
    </div>
  );
}

function FlatTable({
  spec,
  rows,
  loading,
}: {
  spec: ReportSpec;
  rows: any[];
  loading: boolean;
}) {
  if (loading) return <SkeletonRows />;
  if (rows.length === 0)
    return (
      <div className="p-12 text-center">
        <FileText className="size-8 mx-auto text-white/40" />
        <p className="mt-3 text-sm font-semibold text-white">No matching expenses</p>
        <p className="mt-1 text-xs text-white/60">Try widening the date range or removing filters.</p>
      </div>
    );
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-[#15141c]/95 backdrop-blur z-10">
        <tr>
          {spec.columns.map((c) => (
            <th
              key={c}
              className={`text-[10px] uppercase tracking-wider text-white/55 font-semibold px-3 py-2 text-left ${
                c === "amount" ? "text-right" : ""
              }`}
            >
              {COLUMN_LABELS[c]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
            {spec.columns.map((c) => (
              <td
                key={c}
                className={`px-3 py-2 text-white/85 ${
                  c === "amount" ? "text-right tabular-nums font-medium" : ""
                }`}
              >
                {renderCell(r, c)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderCell(r: any, c: ColumnKey) {
  switch (c) {
    case "expense_date":
      return r.expense_date ? fmtDate(r.expense_date, { month: "short", day: "numeric", year: "numeric" }) : "";
    case "amount":
      return fmtMoney(r.amount, r.currency);
    case "status": {
      const t = statusTone(r.status);
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${t.bg} ${t.fg}`}>
          {t.label}
        </span>
      );
    }
    case "flags":
      return r.flags > 0 ? (
        <span className="text-warning text-xs font-medium">{r.flags}</span>
      ) : (
        <span className="text-white/30">—</span>
      );
    case "notes":
      return <span className="block max-w-[18rem] truncate text-white/65">{r.notes ?? ""}</span>;
    default:
      return r[c] ?? <span className="text-white/30">—</span>;
  }
}

function GroupedView({
  spec,
  groups,
  loading,
}: {
  spec: ReportSpec;
  groups: any[];
  loading: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (loading) return <SkeletonRows />;
  if (groups.length === 0)
    return (
      <div className="p-12 text-center">
        <FileText className="size-8 mx-auto text-white/40" />
        <p className="mt-3 text-sm font-semibold text-white">No matching expenses</p>
      </div>
    );
  return (
    <ul className="divide-y divide-white/5">
      {groups.map((g) => {
        const open = openKey === g.key;
        const cur = g.currency === "—" ? "USD" : g.currency;
        return (
          <li key={g.key}>
            <button
              type="button"
              onClick={() => setOpenKey(open ? null : g.key)}
              className="w-full px-4 md:px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ChevronDown
                  className={`size-4 text-white/50 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
                />
                <span className="text-sm font-medium text-white truncate">{g.label}</span>
                <span className="text-xs text-white/55 shrink-0">
                  · {g.count} item{g.count === 1 ? "" : "s"}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-white">
                {fmtMoney(g.total, cur)}
                {g.currency === "—" && (
                  <span className="ml-1 text-[10px] text-white/45">mixed</span>
                )}
              </span>
            </button>
            {open && (
              <div className="bg-black/20">
                <FlatTable spec={spec} rows={g.rows} loading={false} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SkeletonRows() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 rounded-xl bg-white/[0.04] animate-pulse" />
      ))}
    </div>
  );
}

// ---------------- helpers ----------------

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------- Library view ----------------

function LibraryView({
  templates,
  isPending,
  onOpen,
  onDelete,
  onNew,
}: {
  templates: any[];
  isPending: boolean;
  onOpen: (t: any) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-white/65 mt-1">
            Your saved spend reports. Open one to view, tweak, or export as PDF, CSV, or XLSX.
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="rounded-2xl px-4 h-10 text-sm font-semibold bg-primary text-primary-foreground inline-flex items-center gap-1.5 shadow-[0_4px_14px_-2px_hsla(152,55%,45%,0.5)]"
        >
          <Plus className="size-4" /> New report
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-[11px] uppercase tracking-wider text-white/45 font-semibold mb-3">My reports</h2>
        {isPending ? (
          <ul className="divide-y divide-white/5 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="size-9 rounded-xl bg-white/[0.05] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-24 rounded bg-white/[0.04] animate-pulse" />
                </div>
              </li>
            ))}
          </ul>
        ) : templates.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <FolderOpen className="size-7 mx-auto text-white/40" />
            <p className="mt-3 text-sm font-semibold text-white">No reports yet</p>
            <p className="mt-1 text-xs text-white/55 max-w-sm mx-auto">
              Build one from scratch — or use a preset from the New report screen. Save it and it shows up here.
            </p>
            <button
              type="button"
              onClick={onNew}
              className="mt-5 inline-flex items-center gap-1.5 rounded-2xl bg-primary text-primary-foreground px-4 h-10 text-sm font-semibold"
            >
              <Plus className="size-4" /> New report
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-white/5 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 overflow-hidden">
            {templates.map((t: any) => {
              const spec = t.spec_json ?? {};
              const groupLabel = spec.groupBy && spec.groupBy !== "none" ? `Grouped by ${spec.groupBy}` : "Ungrouped";
              const dateLabel = (spec.date?.preset ?? "this_month").replace(/_/g, " ");
              return (
                <li key={t.id} className="group relative flex items-center hover:bg-white/[0.03] transition-colors">
                  <button
                    type="button"
                    onClick={() => onOpen(t)}
                    className="flex-1 min-w-0 text-left px-4 py-3.5 flex items-center gap-3"
                  >
                    <div className="size-9 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center shrink-0">
                      <FileText className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                      <p className="text-[11px] text-white/55 mt-0.5 capitalize">{dateLabel} · {groupLabel}</p>
                    </div>
                    <p className="text-[11px] text-white/40 shrink-0 hidden sm:block">
                      Updated {new Date(t.updated_at ?? t.created_at).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                    className="mr-3 opacity-0 group-hover:opacity-100 size-8 grid place-items-center rounded-lg text-white/50 hover:text-destructive hover:bg-white/5"
                    aria-label="Delete report"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PresetsMenu({ onPick }: { onPick: (p: Preset) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-xl px-3 h-9 text-xs font-semibold bg-white/[0.05] ring-1 ring-white/10 hover:bg-white/10 text-white inline-flex items-center gap-1.5"
      >
        <Sparkles className="size-3.5" /> Presets <ChevronDown className="size-3.5 opacity-60" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close"
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.ul
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              className="absolute right-0 top-11 z-50 w-72 rounded-2xl bg-[#15141c] ring-1 ring-white/10 shadow-2xl p-1.5"
            >
              {PRESETS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { onPick(p); setOpen(false); }}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm text-white/85 hover:bg-white/[0.06]"
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
