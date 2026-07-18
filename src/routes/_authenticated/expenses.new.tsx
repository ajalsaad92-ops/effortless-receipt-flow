import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, X, Loader2, Check, RotateCw, AlertTriangle, MapPin, Plus, Search, Sparkles, Trash2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listCategories,
  listPolicies,
  createExpense,
  updateExpense,
  getExpense,
  enqueueReceiptJob,
  processReceiptJob,
  getReceiptJob,
  retryReceiptJob,
  markReceiptJobConsumed,
  listMyTrips,
  createTrip,
  deleteReceiptJob,
  findDuplicateExpenses,
} from "@/lib/expenses.functions";
import { evaluatePolicies } from "@/lib/policy-engine";
import { CURRENCIES, currencySymbol, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/expenses/new")({
  head: () => ({ meta: [{ title: "New expense — Expense It" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    capture:
      s.capture === "camera" || s.capture === "manual"
        ? (s.capture as "camera" | "manual")
        : undefined,
    jobId: typeof s.jobId === "string" ? s.jobId : undefined,
    expenseId: typeof s.expenseId === "string" ? s.expenseId : undefined,
  }),
  component: NewExpense,
});

function NewExpense() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { capture, jobId, expenseId } = Route.useSearch();

  const fetchCats = useServerFn(listCategories);
  const fetchPolicies = useServerFn(listPolicies);
  const create = useServerFn(createExpense);
  const update = useServerFn(updateExpense);
  const fetchExpense = useServerFn(getExpense);
  const enqueue = useServerFn(enqueueReceiptJob);
  const process = useServerFn(processReceiptJob);
  const fetchJob = useServerFn(getReceiptJob);
  const retry = useServerFn(retryReceiptJob);
  const consume = useServerFn(markReceiptJobConsumed);
  const fetchTrips = useServerFn(listMyTrips);
  const addTrip = useServerFn(createTrip);
  const removeJob = useServerFn(deleteReceiptJob);
  const findDupes = useServerFn(findDuplicateExpenses);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => fetchCats() });
  const { data: policies = [] } = useQuery({ queryKey: ["policies"], queryFn: () => fetchPolicies() });
  const { data: trips = [] } = useQuery({ queryKey: ["my-trips"], queryFn: () => fetchTrips() });

  const [preview, setPreview] = useState<string | null>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ocrRaw, setOcrRaw] = useState<unknown>(null);
  const [stage, setStage] = useState<"snap" | "review">(
    jobId || expenseId || capture === "manual" ? "review" : "snap",
  );
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [tripQuery, setTripQuery] = useState("");
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState("");
  const [newTripStart, setNewTripStart] = useState("");
  const [newTripEnd, setNewTripEnd] = useState("");

  const amountNum = Number(amount);
  const { data: duplicates = [] } = useQuery({
    queryKey: ["dupes", amountNum, currency, merchant.trim().toLowerCase(), date],
    enabled: !!amount && amountNum > 0 && !!date,
    queryFn: () => findDupes({
      data: {
        amount: amountNum,
        currency,
        merchant: merchant || null,
        expense_date: date,
        exclude_id: null,
      },
    }),
  });
  const filledRef = useRef(false);
  const lastJobIdRef = useRef<string | undefined>(jobId);
  const prefilledExpenseRef = useRef<string | undefined>(undefined);

  // Prefill from an existing draft/rejected expense.
  const { data: existingExpense } = useQuery({
    queryKey: ["edit-expense", expenseId],
    enabled: !!expenseId,
    queryFn: () => fetchExpense({ data: { id: expenseId! } }),
  });

  useEffect(() => {
    if (!existingExpense || prefilledExpenseRef.current === expenseId) return;
    prefilledExpenseRef.current = expenseId;
    const e = existingExpense.expense as {
      amount: number | string;
      currency: string;
      merchant: string | null;
      expense_date: string;
      category_id: string | null;
      notes: string | null;
      receipt_path: string | null;
      ocr_raw: unknown;
      report_id: string | null;
    };
    setMerchant(e.merchant ?? "");
    setAmount(Number(e.amount).toFixed(2));
    setCurrency(e.currency || "USD");
    setDate(e.expense_date);
    setCategoryId(e.category_id);
    setNotes(e.notes ?? "");
    setReceiptPath(e.receipt_path);
    setOcrRaw(e.ocr_raw);
    setTripId(e.report_id);
    if (existingExpense.receipt_url) setPreview(existingExpense.receipt_url);
    setStage("review");
  }, [existingExpense, expenseId]);

  // Open in-page picker if old ?capture=camera link is used.
  useEffect(() => {
    if (capture === "camera") {
      const t = setTimeout(() => fileRef.current?.click(), 150);
      return () => clearTimeout(t);
    }
  }, [capture]);

  useEffect(() => {
    if (!jobId || lastJobIdRef.current === jobId) return;
    lastJobIdRef.current = jobId;
    filledRef.current = false;
    setStage("review");
    setPreview(null);
    setReceiptPath(null);
    setMerchant("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setCategoryId(null);
    setNotes("");
    setOcrRaw(null);
  }, [jobId]);

  // Watch the active job: poll + realtime.
  const { data: job } = useQuery({
    queryKey: ["receipt-job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      try {
        return await fetchJob({ data: { id: jobId } });
      } catch {
        const { data, error } = await supabase
          .from("receipt_jobs")
          .select("*")
          .eq("id", jobId)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
    },
    enabled: !!jobId,
    refetchInterval: (q) => {
      const j = q.state.data as { status?: string } | null | undefined;
      if (!j) return 2000;
      return j.status === "queued" || j.status === "processing" ? 2000 : false;
    },
  });

  useEffect(() => {
    if (!jobId) return;
    const ch = supabase
      .channel(`receipt-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "receipt_jobs", filter: `id=eq.${jobId}` },
        () => qc.invalidateQueries({ queryKey: ["receipt-job", jobId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [jobId, qc]);

  // When job lands → prefill empty fields + signed-URL preview.
  useEffect(() => {
    if (!job) return;
    if (job.receipt_path && !receiptPath) setReceiptPath(job.receipt_path);
    if (job.receipt_path && !preview) {
      supabase.storage.from("receipts").createSignedUrl(job.receipt_path, 3600).then(({ data }) => {
        if (data?.signedUrl) setPreview(data.signedUrl);
      });
    }
    if (job.status === "done" && job.result_json && !filledRef.current) {
      const r = job.result_json as { merchant?: string; amount?: number; date?: string; category?: string };
      setMerchant((m) => m || r.merchant || "");
      setAmount((a) => a || (r.amount != null ? Number(r.amount).toFixed(2) : ""));
      setDate((d) => (d === new Date().toISOString().slice(0, 10) && r.date ? r.date : d));
      if (!categoryId && r.category) {
        const matched = categories.find((c) => c.name.toLowerCase() === r.category!.toLowerCase());
        if (matched) setCategoryId(matched.id);
      }
      setOcrRaw(r);
      filledRef.current = true;
      toast.success("Filled from receipt", { id: "receipt-flow" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, categories]);

  // Watchdog: if processing > 90s, allow retry hint (UI shows it via job state).

  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? null;
  const violations = evaluatePolicies(
    { amount: Number(amount) || 0, category_name: categoryName, merchant, receipt_path: receiptPath },
    // @ts-expect-error rule_json typed as Json from db
    policies,
  );

  async function handleFile(file: File) {
    setStage("review");
    toast.loading("Uploading receipt…", { id: "receipt-flow" });
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
      if (up.error) throw new Error(up.error.message);
      setReceiptPath(path);

      // Local preview while signed URL is fetched.
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);

      const { id } = await enqueue({ data: { receipt_path: path } });
      toast.success("Parsing in background…", { id: "receipt-flow", duration: 2000 });
      filledRef.current = false;
      void process({ data: { id } }).catch(() => {/* status persists in row */});
      nav({ to: "/expenses/new", search: { jobId: id }, replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open that file", { id: "receipt-flow" });
    }
  }

  async function handleRetry() {
    if (!jobId) return;
    filledRef.current = false;
    await retry({ data: { id: jobId } });
    void process({ data: { id: jobId } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["receipt-job", jobId] });
    toast.loading("Retrying…", { id: "receipt-flow" });
  }

  async function submit(asDraft: boolean) {
    if (!amount || !date) return toast.error("Add an amount and date");
    setSubmitting(true);
    try {
      const payload = {
        amount: Number(amount),
        currency,
        merchant: merchant || null,
        expense_date: date,
        category_id: categoryId,
        notes: notes || null,
        receipt_path: receiptPath,
        ocr_raw: ocrRaw,
        submit: !asDraft,
        report_id: tripId,
      };
      const saved = expenseId
        ? await update({ data: { ...payload, id: expenseId } })
        : await create({ data: payload });
      if (jobId) {
        await consume({ data: { id: jobId, expense_id: saved.id } }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ["my-expenses"] });
      qc.invalidateQueries({ queryKey: ["receipt-jobs-active"] });
      if (expenseId) {
        qc.invalidateQueries({ queryKey: ["expense", expenseId] });
        qc.invalidateQueries({ queryKey: ["expense-timeline", expenseId] });
      }
      toast.success(asDraft ? "Saved as draft" : "Submitted for approval");
      nav({ to: "/expenses" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSubmitting(false);
    }
  }

  const isParsing = !!jobId && job && (job.status === "queued" || job.status === "processing");
  const parseFailed = !!jobId && job?.status === "failed";
  const parseDone = !!jobId && job?.status === "done" && !!job.result_json;
  const parsed = (job?.result_json ?? null) as { merchant?: string; amount?: number; date?: string; category?: string } | null;

  return (
    <div className="px-5 pt-6 pb-32">
      <div className="flex items-center justify-between">
        <button onClick={() => nav({ to: "/dashboard" })} className="size-10 rounded-full bg-card ring-1 ring-border grid place-items-center">
          <X className="size-5" />
        </button>
        <h1 className="text-base font-semibold">New expense</h1>
        <div className="size-10" />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <AnimatePresence mode="wait">
        {stage === "snap" && !preview && (
          <motion.div
            key="snap"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-12 text-center"
          >
            <p className="text-sm text-muted-foreground">Step 1 of 2</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Snap the receipt</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
              We'll read the merchant, amount, and date for you.
            </p>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => fileRef.current?.click()}
              className="mt-10 mx-auto receipt-frame rounded-sm w-56 aspect-[3/4] grid place-items-center -rotate-2 hover:rotate-0 transition-transform"
            >
              <div className="text-center">
                <Camera className="size-9 mx-auto text-muted-foreground" />
                <p className="mt-3 text-xs font-medium text-muted-foreground">Tap to capture</p>
              </div>
            </motion.button>

            <button
              onClick={() => setStage("review")}
              className="mt-8 text-xs font-medium text-muted-foreground underline underline-offset-4"
            >
              Enter manually instead
            </button>
          </motion.div>
        )}

        {stage === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-3"
          >
            {isParsing && (
              <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                Parsing your receipt in the background — you can keep editing. Safe to navigate away or refresh.
              </div>
            )}
            {parseFailed && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground flex items-start gap-2">
                <AlertTriangle className="size-4 mt-0.5 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Couldn't parse this receipt</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{job?.error ?? "Unknown error"}. Fill it in manually or try again.</p>
                </div>
                <button onClick={handleRetry} className="inline-flex items-center gap-1 rounded-full bg-foreground/10 hover:bg-foreground/15 px-3 py-1.5 text-xs font-medium">
                  <RotateCw className="size-3" /> Retry
                </button>
              </div>
            )}
            {parseDone && parsed && (
              <div className="rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-foreground">
                <p className="font-medium">Receipt parsed — review and confirm</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {parsed.merchant ? <span className="rounded-full bg-background/70 px-2.5 py-1 ring-1 ring-border">{parsed.merchant}</span> : null}
                  {parsed.amount != null ? <span className="rounded-full bg-background/70 px-2.5 py-1 ring-1 ring-border tabular-nums">{formatMoney(parsed.amount, currency)}</span> : null}
                  {parsed.date ? <span className="rounded-full bg-background/70 px-2.5 py-1 ring-1 ring-border">{parsed.date}</span> : null}
                  {parsed.category ? <span className="rounded-full bg-background/70 px-2.5 py-1 ring-1 ring-border">{parsed.category}</span> : null}
                </div>
              </div>
            )}

            {preview && (
              <div className="receipt-frame mx-auto rounded-sm w-32 aspect-[3/4] overflow-hidden -rotate-2 mb-6">
                <img src={preview} alt="Receipt" className="size-full object-cover" />
              </div>
            )}

            <Field label="Merchant">
              <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Blue Bottle Coffee"
                className="w-full bg-transparent outline-none text-base font-medium" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Amount (${currency})`}>
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-muted-foreground tabular-nums">{currencySymbol(currency)}</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={(e) => {
                      const n = parseFloat(e.target.value);
                      if (!Number.isNaN(n)) setAmount(n.toFixed(2));
                    }}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full bg-transparent outline-none text-base font-medium tabular-nums"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="bg-transparent text-xs font-medium text-muted-foreground outline-none"
                    aria-label="Currency"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-background text-foreground">
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Date">
                <input value={date} onChange={(e) => setDate(e.target.value)} type="date"
                  className="w-full bg-transparent outline-none text-base font-medium" />
              </Field>
            </div>

            <Field label="Category">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setCategoryId(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                      categoryId === c.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                    }`}>
                    {c.name}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Notes (optional)">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Lunch with the design team"
                className="w-full bg-transparent outline-none text-sm resize-none" />
            </Field>

            <TripPicker
              trips={trips}
              tripId={tripId}
              onChange={setTripId}
              expenseDate={date}
              open={tripPickerOpen}
              setOpen={setTripPickerOpen}
              query={tripQuery}
              setQuery={setTripQuery}
              creating={creatingTrip}
              setCreating={setCreatingTrip}
              newTitle={newTripTitle}
              setNewTitle={setNewTripTitle}
              newStart={newTripStart}
              setNewStart={setNewTripStart}
              newEnd={newTripEnd}
              setNewEnd={setNewTripEnd}
              onCreate={async () => {
                if (!newTripTitle.trim()) return toast.error("Trip needs a name");
                try {
                  const row = await addTrip({
                    data: {
                      title: newTripTitle.trim(),
                      start_date: newTripStart || null,
                      end_date: newTripEnd || null,
                    },
                  });
                  await qc.invalidateQueries({ queryKey: ["my-trips"] });
                  setTripId(row.id);
                  setCreatingTrip(false);
                  setTripPickerOpen(false);
                  setNewTripTitle(""); setNewTripStart(""); setNewTripEnd("");
                  toast.success("Trip added");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Couldn't add trip");
                }
              }}
            />

            {!preview && (
              <button onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl bg-card ring-1 ring-border py-3 text-sm font-medium flex items-center justify-center gap-2">
                <Camera className="size-4" /> Attach a receipt
              </button>
            )}

            {violations.length > 0 && (
              <div className="rounded-2xl bg-warning/15 border border-warning/40 p-3 space-y-1">
                {violations.map((v, i) => (
                  <p key={i} className="text-xs text-warning">
                    <span className="font-semibold text-warning">{v.policy_name}:</span>{" "}
                    <span className="text-warning/90">{v.message}</span>
                  </p>
                ))}
              </div>
            )}

            {duplicates.length > 0 && (
              <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3">
                <div className="flex items-center gap-2">
                  <Copy className="size-4 text-warning" />
                  <p className="text-sm font-semibold">Possible duplicate</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Looks similar to {duplicates.length} expense{duplicates.length > 1 ? "s" : ""} you've already added.
                </p>
                <ul className="mt-2 space-y-1.5">
                  {duplicates.slice(0, 3).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{d.merchant ?? "Untitled"} · {d.expense_date}</span>
                      <span className="font-semibold tabular-nums shrink-0">{formatMoney(Number(d.amount), d.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-3">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => submit(true)} disabled={submitting}
                className="rounded-2xl bg-card ring-1 ring-border py-3.5 text-sm font-medium disabled:opacity-50">
                Save draft
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => submit(false)} disabled={submitting}
                className="rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Submit
              </motion.button>
            </div>

            {jobId && (
              <button
                onClick={async () => {
                  if (!confirm("Discard this receipt? The image and parsed data will be deleted.")) return;
                  try {
                    await removeJob({ data: { id: jobId } });
                    qc.invalidateQueries({ queryKey: ["receipt-jobs-active"] });
                    toast.success("Receipt discarded");
                    nav({ to: "/expenses" });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't discard");
                  }
                }}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-destructive/15 text-destructive ring-1 ring-destructive/30 py-3 text-sm font-semibold"
              >
                <Trash2 className="size-4" /> Discard receipt
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-4">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

type Trip = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status?: string;
};

function TripPicker(props: {
  trips: Trip[];
  tripId: string | null;
  onChange: (id: string | null) => void;
  expenseDate: string;
  open: boolean;
  setOpen: (b: boolean) => void;
  query: string;
  setQuery: (s: string) => void;
  creating: boolean;
  setCreating: (b: boolean) => void;
  newTitle: string;
  setNewTitle: (s: string) => void;
  newStart: string;
  setNewStart: (s: string) => void;
  newEnd: string;
  setNewEnd: (s: string) => void;
  onCreate: () => void;
}) {
  const {
    trips, tripId, onChange, expenseDate, open, setOpen, query, setQuery,
    creating, setCreating, newTitle, setNewTitle, newStart, setNewStart,
    newEnd, setNewEnd, onCreate,
  } = props;

  const selected = trips.find((t) => t.id === tripId) ?? null;

  const inDateRange = (t: Trip) => {
    if (!expenseDate || !t.start_date || !t.end_date) return false;
    return expenseDate >= t.start_date && expenseDate <= t.end_date;
  };

  const suggestion = !tripId ? trips.find(inDateRange) ?? null : null;

  const filtered = trips
    .filter((t) => t.title.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => Number(inDateRange(b)) - Number(inDateRange(a)));

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-4">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Trip (optional)</label>

      {!open && (
        <div className="mt-2">
          {selected ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selected.title}</p>
                  {(selected.start_date || selected.end_date) && (
                    <p className="text-[11px] text-muted-foreground">
                      {selected.start_date ?? "…"} → {selected.end_date ?? "…"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setOpen(true)} className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted">Change</button>
                <button onClick={() => onChange(null)} className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground" aria-label="Remove trip">
                  <X className="size-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => setOpen(true)}
                className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <MapPin className="size-4" />
                Assign to a trip
              </button>
              {suggestion && (
                <button
                  onClick={() => onChange(suggestion.id)}
                  className="w-full text-left rounded-xl bg-primary/10 border border-primary/30 px-3 py-2 flex items-center gap-2"
                >
                  <Sparkles className="size-3.5 text-primary shrink-0" />
                  <span className="text-xs">
                    This date matches <span className="font-semibold text-foreground">{suggestion.title}</span> — tap to assign
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {open && !creating && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search trips…"
              className="w-full bg-transparent outline-none text-sm"
            />
            <button onClick={() => { setOpen(false); setQuery(""); }} className="text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl ring-1 ring-border divide-y divide-border">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                No trips match "{query}".
              </div>
            )}
            {filtered.map((t) => {
              const match = inDateRange(t);
              return (
                <button
                  key={t.id}
                  onClick={() => { onChange(t.id); setOpen(false); setQuery(""); }}
                  className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-muted/60 ${tripId === t.id ? "bg-muted" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    {(t.start_date || t.end_date) && (
                      <p className="text-[11px] text-muted-foreground">
                        {t.start_date ?? "…"} → {t.end_date ?? "…"}
                      </p>
                    )}
                  </div>
                  {match && (
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider shrink-0">
                      Matches date
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCreating(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-2.5 text-sm font-medium"
          >
            <Plus className="size-4" /> New trip
          </button>
        </div>
      )}

      {open && creating && (
        <div className="mt-2 space-y-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Trip name (e.g. NYC client visit)"
            className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-xl bg-muted px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Start</span>
              <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-full bg-transparent outline-none text-sm" />
            </label>
            <label className="rounded-xl bg-muted px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">End</span>
              <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-full bg-transparent outline-none text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setCreating(false)} className="rounded-xl bg-muted py-2.5 text-sm font-medium">Back</button>
            <button onClick={onCreate} className="rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold">Create</button>
          </div>
        </div>
      )}
    </div>
  );
}