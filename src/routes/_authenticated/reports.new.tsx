import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createReport } from "@/lib/expenses.functions";

export const Route = createFileRoute("/_authenticated/reports/new")({
  head: () => ({ meta: [{ title: "New report — Expense It" }] }),
  component: NewReport,
});

function NewReport() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createReport);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"general" | "trip" | "project">("trip");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error("Add a title");
    setBusy(true);
    try {
      const r = await create({ data: { title, description: description || null, type } });
      qc.invalidateQueries({ queryKey: ["my-reports"] });
      toast.success("Report created");
      nav({ to: "/reports/$id", params: { id: r.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create");
    } finally { setBusy(false); }
  }

  return (
    <div className="px-5 pt-6 pb-32">
      <button onClick={() => nav({ to: "/reports" })} className="size-10 rounded-full bg-card ring-1 ring-border grid place-items-center">
        <ArrowLeft className="size-5" />
      </button>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">New report</h1>
      <p className="mt-1 text-sm text-muted-foreground">Bundle related expenses into one approval.</p>

      <div className="mt-6 space-y-3">
        <div className="rounded-2xl bg-card ring-1 ring-border p-4">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. NYC client visit, Mar 2026"
            className="mt-1 w-full bg-transparent outline-none text-base font-medium" />
        </div>
        <div className="rounded-2xl bg-card ring-1 ring-border p-4">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Type</label>
          <div className="mt-2 flex gap-1.5">
            {(["trip", "project", "general"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${type === t ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-card ring-1 ring-border p-4">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="Optional context for approvers"
            className="mt-1 w-full bg-transparent outline-none text-sm resize-none" />
        </div>
      </div>

      <button onClick={save} disabled={busy}
        className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {busy && <Loader2 className="size-4 animate-spin" />} Create report
      </button>
    </div>
  );
}
