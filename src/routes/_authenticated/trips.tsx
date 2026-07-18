import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { listMyTrips, createTrip } from "@/lib/expenses.functions";
import { Plus, Plane, Calendar, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips")({
  head: () => ({ meta: [{ title: "Trips — Expense It" }] }),
  component: TripsPage,
});

function TripsPage() {
  const fetchTrips = useServerFn(listMyTrips);
  const create = useServerFn(createTrip);
  const qc = useQueryClient();
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["my-trips"],
    queryFn: () => fetchTrips(),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await create({ data: { title: title.trim(), start_date: start || null, end_date: end || null } });
      await qc.invalidateQueries({ queryKey: ["my-trips"] });
      setOpen(false);
      setTitle(""); setStart(""); setEnd("");
      toast.success("Trip created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create trip");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 pt-10 pb-4 flex items-end justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Trips</h1>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </header>

      <div className="flex-1 px-5 pb-32 space-y-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[80px] rounded-3xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
        ))}

        {!isLoading && trips.length === 0 && (
          <div className="mt-6 border-2 border-dashed border-white/[0.06] rounded-[32px] p-10 flex flex-col items-center justify-center text-center bg-white/[0.01]">
            <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-4">
              <Plane className="w-6 h-6 text-primary/60" />
            </div>
            <p className="text-sm font-medium text-foreground/80">No trips yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a trip to group related expenses.</p>
          </div>
        )}

        {!isLoading && trips.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Link
              to="/reports/$id"
              params={{ id: t.id }}
              className="group block bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl p-4 rounded-3xl transition-all hover:bg-white/[0.06] hover:border-white/20"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-sky-500/12 border-sky-400/25 shrink-0">
                    <Plane className="w-5 h-5 text-sky-300" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{t.title}</h3>
                    {(t.start_date || t.end_date) && (
                      <p className="text-xs text-foreground/70 mt-0.5 inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {t.start_date ?? "—"} {t.end_date ? `→ ${t.end_date}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {open && (
        <>
          <button aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/70" />
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-3xl bg-[#15141c] ring-1 ring-white/10 shadow-2xl p-5 space-y-3"
          >
            <h2 className="text-lg font-semibold text-foreground">New trip</h2>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Trip name (e.g. NYC client visit)"
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                Start
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-foreground focus:outline-none focus:border-primary/40" />
              </label>
              <label className="text-xs text-muted-foreground">
                End
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-foreground focus:outline-none focus:border-primary/40" />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold bg-white/[0.05] text-foreground border border-white/10">
                Cancel
              </button>
              <button type="submit" disabled={saving || !title.trim()}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50">
                {saving ? "Creating…" : "Create trip"}
              </button>
            </div>
          </motion.form>
        </>
      )}
    </div>
  );
}