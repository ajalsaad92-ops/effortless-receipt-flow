import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Sparkles, Plus, Trash2, Loader2, Shield, Utensils, BedDouble, Car, Receipt, Ban, Zap } from "lucide-react";
import { toast } from "sonner";
import { listAllPolicies, upsertPolicy, deletePolicy, generatePolicyFromText } from "@/lib/expenses.functions";
import { useRoles } from "@/hooks/use-roles";

export const Route = createFileRoute("/_authenticated/policies")({
  head: () => ({ meta: [{ title: "Policies — Expense It" }] }),
  component: PoliciesPage,
});

const RULE_TYPES = [
  { v: "amount_max", label: "Cap any single expense" },
  { v: "category_amount_max", label: "Cap a category" },
  { v: "per_diem", label: "Per-diem (per day/night/person)" },
  { v: "mileage_rate", label: "Mileage reimbursement rate" },
  { v: "receipt_required_above", label: "Receipt required above" },
  { v: "category_blocked", label: "Block a category" },
  { v: "merchant_blocked", label: "Block a merchant" },
] as const;

type Draft = {
  name: string; description: string; severity: "warning" | "error"; active: boolean;
  type: string; max?: number; amount?: number; category?: string; merchant?: string;
  period?: "day" | "night" | "person" | "trip"; rate?: number; unit?: "mi" | "km";
  ai_generated: boolean;
};

const PRESETS: { icon: typeof Utensils; label: string; hint: string; draft: Partial<Draft> }[] = [
  { icon: Utensils, label: "Meals per diem", hint: "$75 / day", draft: { name: "Meals per diem", type: "per_diem", category: "Meals", max: 75, period: "day", severity: "warning" } },
  { icon: BedDouble, label: "Hotel cap", hint: "$250 / night", draft: { name: "Hotel cap", type: "per_diem", category: "Lodging", max: 250, period: "night", severity: "warning" } },
  { icon: Car, label: "Mileage rate", hint: "$0.67 / mi", draft: { name: "Mileage rate", type: "mileage_rate", rate: 0.67, unit: "mi", severity: "warning" } },
  { icon: Receipt, label: "Receipt required", hint: "Above $25", draft: { name: "Receipt required", type: "receipt_required_above", amount: 25, severity: "error" } },
  { icon: Ban, label: "No alcohol", hint: "Block category", draft: { name: "No alcohol", type: "category_blocked", category: "Alcohol", severity: "error" } },
  { icon: Zap, label: "Single-expense cap", hint: "Above $500", draft: { name: "Single-expense cap", type: "amount_max", max: 500, severity: "warning" } },
];

function PoliciesPage() {
  const { isFinance, isLoading: rolesLoading } = useRoles();

  if (rolesLoading) return <div className="px-5 pt-12"><div className="h-32 rounded-3xl bg-muted animate-pulse" /></div>;
  if (!isFinance) {
    return (
      <div className="px-5 pt-16 text-center">
        <Shield className="size-7 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Only finance & admins can manage policies.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-32">
      <h1 className="text-3xl font-semibold tracking-tight">Policies</h1>
      <p className="mt-1 text-sm text-muted-foreground">Spending rules evaluated on every submission.</p>
      <PoliciesPanel className="mt-6" />
    </div>
  );
}

export function PoliciesPanel({ className = "" }: { className?: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listAllPolicies);
  const upsert = useServerFn(upsertPolicy);
  const del = useServerFn(deletePolicy);
  const gen = useServerFn(generatePolicyFromText);

  const { data: policies = [], isPending: policiesPending } = useQuery({ queryKey: ["all-policies"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<Draft>({ name: "", description: "", severity: "warning", active: true, type: "amount_max", ai_generated: false });
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [presetValue, setPresetValue] = useState<string>("");
  const [savingPreset, setSavingPreset] = useState(false);

  async function generate() {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const r = await gen({ data: { prompt: aiPrompt } });
      setDraft({
        name: r.name, description: r.description ?? "", severity: r.severity, active: true,
        type: r.rule.type, max: r.rule.max, amount: r.rule.amount, category: r.rule.category, merchant: r.rule.merchant,
        ai_generated: true,
      });
      setOpen(true);
      setAiPrompt("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate");
    } finally { setGenerating(false); }
  }

  async function save() {
    if (!draft.name) return toast.error("Name required");
    const rule_json: Record<string, unknown> = { type: draft.type };
    if (draft.type === "amount_max") rule_json.max = Number(draft.max);
    if (draft.type === "category_amount_max") { rule_json.max = Number(draft.max); rule_json.category = draft.category; }
    if (draft.type === "receipt_required_above") rule_json.amount = Number(draft.amount);
    if (draft.type === "category_blocked") rule_json.category = draft.category;
    if (draft.type === "merchant_blocked") rule_json.merchant = draft.merchant;
    if (draft.type === "per_diem") {
      rule_json.category = draft.category; rule_json.max = Number(draft.max); rule_json.period = draft.period ?? "day";
    }
    if (draft.type === "mileage_rate") {
      rule_json.rate = Number(draft.rate); rule_json.unit = draft.unit ?? "mi";
    }
    try {
      await upsert({ data: {
        name: draft.name, description: draft.description || null, rule_json,
        severity: draft.severity, active: draft.active, ai_generated: draft.ai_generated,
      }});
      toast.success("Policy saved");
      setOpen(false);
      setDraft({ name: "", description: "", severity: "warning", active: true, type: "amount_max", ai_generated: false });
      qc.invalidateQueries({ queryKey: ["all-policies"] });
      qc.invalidateQueries({ queryKey: ["policies"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this policy?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["all-policies"] });
  }

  function openPreset(idx: number) {
    const p = PRESETS[idx];
    setActivePreset(idx);
    const initial = p.draft.max ?? p.draft.amount ?? p.draft.rate ?? "";
    setPresetValue(String(initial));
  }

  async function addPreset(idx: number) {
    const p = PRESETS[idx];
    const d = p.draft;
    const num = Number(presetValue);
    const rule_json: Record<string, unknown> = { type: d.type };
    if (d.type === "amount_max") rule_json.max = num;
    if (d.type === "category_amount_max") { rule_json.max = num; rule_json.category = d.category; }
    if (d.type === "receipt_required_above") rule_json.amount = num;
    if (d.type === "category_blocked") rule_json.category = d.category;
    if (d.type === "merchant_blocked") rule_json.merchant = d.merchant;
    if (d.type === "per_diem") { rule_json.category = d.category; rule_json.max = num; rule_json.period = d.period ?? "day"; }
    if (d.type === "mileage_rate") { rule_json.rate = num; rule_json.unit = d.unit ?? "mi"; }
    setSavingPreset(true);
    try {
      await upsert({ data: {
        name: d.name ?? p.label, description: null, rule_json,
        severity: d.severity ?? "warning", active: true, ai_generated: false,
      }});
      toast.success(`${p.label} added`);
      setActivePreset(null);
      setPresetValue("");
      qc.invalidateQueries({ queryKey: ["all-policies"] });
      qc.invalidateQueries({ queryKey: ["policies"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally { setSavingPreset(false); }
  }

  return (
    <div className={className}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Quick add</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((p, idx) => {
            const Icon = p.icon;
            const isActive = activePreset === idx;
            const hasAmount = p.draft.type !== "category_blocked" && p.draft.type !== "merchant_blocked";
            const unitLabel = p.draft.type === "mileage_rate"
              ? ` / ${p.draft.unit ?? "mi"}`
              : p.draft.type === "per_diem"
                ? ` / ${p.draft.period ?? "day"}`
                : "";
            return (
              <div key={p.label} className={`rounded-2xl ring-1 transition ${isActive ? "bg-card ring-primary" : "bg-card ring-border hover:bg-accent"}`}>
                {!isActive ? (
                  <button onClick={() => hasAmount ? openPreset(idx) : addPreset(idx)} className="w-full p-3 text-left">
                    <Icon className="size-4 text-primary mb-1.5" />
                    <p className="text-xs font-semibold">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground">{p.hint}</p>
                  </button>
                ) : (
                  <div className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon className="size-4 text-primary" />
                      <p className="text-xs font-semibold">{p.label}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-background ring-1 ring-border px-2 py-1.5">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        autoFocus type="number" step="0.01" value={presetValue}
                        onChange={(e) => setPresetValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addPreset(idx); if (e.key === "Escape") setActivePreset(null); }}
                        className="w-full bg-transparent outline-none text-sm font-semibold tabular-nums min-w-0"
                      />
                      {unitLabel && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{unitLabel}</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button onClick={() => setActivePreset(null)} className="rounded-lg bg-muted py-1.5 text-[11px] font-medium">Cancel</button>
                      <button onClick={() => addPreset(idx)} disabled={savingPreset || !presetValue}
                        className="rounded-lg bg-primary text-primary-foreground py-1.5 text-[11px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1">
                        {savingPreset ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-accent p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-sm font-semibold">Describe a policy</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">e.g. "meals can't exceed $75 per person" or "no alcohol".</p>
        <div className="flex gap-2">
          <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe in plain English…"
            className="flex-1 rounded-2xl bg-card ring-1 ring-border px-4 py-3 text-sm outline-none" />
          <button onClick={generate} disabled={generating}
            className="rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-semibold">{policies.length} policies</h2>
        <button onClick={() => setOpen(true)} className="text-xs font-medium text-primary inline-flex items-center gap-1">
          <Plus className="size-3.5" /> Add manually
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {policies.map((p) => {
          const r = (p.rule_json ?? {}) as { type?: string; max?: number; amount?: number; category?: string; merchant?: string; period?: string; rate?: number; unit?: string };
          return (
            <li key={p.id} className="rounded-2xl bg-card ring-1 ring-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{p.name}</p>
                    {p.ai_generated && <span className="text-[9px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">AI</span>}
                    <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${p.severity === "error" ? "bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/40" : "bg-warning/20 text-warning ring-1 ring-inset ring-warning/40"}`}>
                      {p.severity}
                    </span>
                    {!p.active && <span className="text-[9px] uppercase text-muted-foreground">paused</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ruleSummary(r)}
                  </p>
                </div>
                <button onClick={() => remove(p.id)} className="size-8 rounded-full grid place-items-center text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
        {!policiesPending && policies.length === 0 && (
          <li className="rounded-3xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            No policies yet. Describe one above to get started.
          </li>
        )}
      </ul>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm grid place-items-end sm:place-items-center p-4"
            onClick={() => setOpen(false)}>
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-background rounded-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-semibold">New policy</h3>
              <FieldStack label="Name">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full bg-transparent outline-none text-base font-medium" placeholder="e.g. Meals cap" />
              </FieldStack>
              <FieldStack label="Description">
                <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="w-full bg-transparent outline-none text-sm" placeholder="Optional context" />
              </FieldStack>
              <FieldStack label="Rule type">
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="w-full bg-transparent outline-none text-sm">
                  {RULE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </FieldStack>
              {(draft.type === "amount_max" || draft.type === "category_amount_max") && (
                <FieldStack label="Max amount (USD)">
                  <input type="number" value={draft.max ?? ""} onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) })}
                    className="w-full bg-transparent outline-none text-base font-medium tabular-nums" />
                </FieldStack>
              )}
              {draft.type === "receipt_required_above" && (
                <FieldStack label="Above amount (USD)">
                  <input type="number" value={draft.amount ?? ""} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                    className="w-full bg-transparent outline-none text-base font-medium tabular-nums" />
                </FieldStack>
              )}
              {(draft.type === "category_amount_max" || draft.type === "category_blocked") && (
                <FieldStack label="Category">
                  <input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="w-full bg-transparent outline-none text-sm" placeholder="Meals" />
                </FieldStack>
              )}
              {draft.type === "merchant_blocked" && (
                <FieldStack label="Merchant contains">
                  <input value={draft.merchant ?? ""} onChange={(e) => setDraft({ ...draft, merchant: e.target.value })}
                    className="w-full bg-transparent outline-none text-sm" />
                </FieldStack>
              )}
              {draft.type === "per_diem" && (
                <>
                  <FieldStack label="Category">
                    <input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      className="w-full bg-transparent outline-none text-sm" placeholder="Meals" />
                  </FieldStack>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldStack label="Max amount (USD)">
                      <input type="number" value={draft.max ?? ""} onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) })}
                        className="w-full bg-transparent outline-none text-base font-medium tabular-nums" />
                    </FieldStack>
                    <FieldStack label="Per">
                      <select value={draft.period ?? "day"} onChange={(e) => setDraft({ ...draft, period: e.target.value as Draft["period"] })}
                        className="w-full bg-transparent outline-none text-sm">
                        <option value="day">Day</option>
                        <option value="night">Night</option>
                        <option value="person">Person</option>
                        <option value="trip">Trip</option>
                      </select>
                    </FieldStack>
                  </div>
                </>
              )}
              {draft.type === "mileage_rate" && (
                <div className="grid grid-cols-2 gap-3">
                  <FieldStack label="Rate (USD)">
                    <input type="number" step="0.01" value={draft.rate ?? ""} onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })}
                      className="w-full bg-transparent outline-none text-base font-medium tabular-nums" />
                  </FieldStack>
                  <FieldStack label="Unit">
                    <select value={draft.unit ?? "mi"} onChange={(e) => setDraft({ ...draft, unit: e.target.value as "mi" | "km" })}
                      className="w-full bg-transparent outline-none text-sm">
                      <option value="mi">per mile</option>
                      <option value="km">per km</option>
                    </select>
                  </FieldStack>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <FieldStack label="Severity">
                  <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as "warning" | "error" })}
                    className="w-full bg-transparent outline-none text-sm">
                    <option value="warning">Warning</option>
                    <option value="error">Error (block)</option>
                  </select>
                </FieldStack>
                <FieldStack label="Active">
                  <select value={String(draft.active)} onChange={(e) => setDraft({ ...draft, active: e.target.value === "true" })}
                    className="w-full bg-transparent outline-none text-sm">
                    <option value="true">Yes</option>
                    <option value="false">Paused</option>
                  </select>
                </FieldStack>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => setOpen(false)} className="rounded-2xl bg-card ring-1 ring-border py-3 text-sm font-medium">Cancel</button>
                <button onClick={save} className="rounded-2xl bg-primary text-primary-foreground py-3 text-sm font-semibold">Save policy</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldStack({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-3">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ruleSummary(r: { type?: string; max?: number; amount?: number; category?: string; merchant?: string; period?: string; rate?: number; unit?: string }) {
  switch (r.type) {
    case "amount_max": return `Any expense over $${r.max} is flagged.`;
    case "category_amount_max": return `${r.category ?? "?"} over $${r.max} is flagged.`;
    case "receipt_required_above": return `Receipt required above $${r.amount}.`;
    case "category_blocked": return `${r.category ?? "?"} not reimbursable.`;
    case "merchant_blocked": return `Merchant contains "${r.merchant}".`;
    case "per_diem": return `${r.category ?? "?"} per-diem: $${r.max} / ${r.period ?? "day"}.`;
    case "mileage_rate": return `Mileage reimbursed at $${r.rate} / ${r.unit ?? "mi"}.`;
    default: return "—";
  }
}
