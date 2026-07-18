import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import { Sparkles, Loader2, Send, ScrollText, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { askAi } from "@/lib/expenses.functions";
import { useRoles } from "@/hooks/use-roles";
import { PoliciesPanel } from "./policies";

export const Route = createFileRoute("/_authenticated/ask-ai")({
  head: () => ({ meta: [{ title: "Ask AI — Expense It" }] }),
  component: AskAiPage,
});

const SUGGESTIONS = [
  "What's my meals per diem?",
  "What are the company spending rules?",
  "How much did I spend on travel last month?",
  "Anything still waiting on approval?",
];

function AskAiPage() {
  const ask = useServerFn(askAi);
  const { isFinance } = useRoles();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const [policiesOpen, setPoliciesOpen] = useState(false);

  async function send(text?: string) {
    const question = (text ?? q).trim();
    if (!question) return;
    setLoading(true);
    setThread((t) => [...t, { q: question, a: "" }]);
    setQ("");
    try {
      const r = await ask({ data: { question } });
      setThread((t) => t.map((m, i) => i === t.length - 1 ? { ...m, a: r.answer } : m));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't ask");
      setThread((t) => t.slice(0, -1));
    } finally { setLoading(false); }
  }

  return (
    <div className="px-5 pt-12 pb-32">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <h1 className="text-3xl font-semibold tracking-tight">Ask AI</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Your expenses, in plain English.</p>

      {thread.length === 0 && (
        <div className="mt-6 space-y-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="w-full text-left rounded-2xl bg-card ring-1 ring-border px-4 py-3 text-sm hover:bg-accent transition">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-4">
        {thread.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-end">
              <p className="rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm max-w-[85%]">{m.q}</p>
            </div>
            <div className="mt-2 flex">
              <div className="rounded-2xl rounded-bl-sm bg-card ring-1 ring-border px-4 py-2.5 text-sm max-w-[85%]">
                {m.a || <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {isFinance && (
        <div className="mt-10 rounded-3xl bg-card ring-1 ring-border overflow-hidden">
          <button
            type="button"
            onClick={() => setPoliciesOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/40 transition-colors"
          >
            <ScrollText className="size-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Policies</p>
              <p className="text-xs text-muted-foreground">Spending rules evaluated on every submission.</p>
            </div>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${policiesOpen ? "rotate-180" : ""}`} />
          </button>
          {policiesOpen && (
            <div className="border-t border-border p-5">
              <PoliciesPanel />
            </div>
          )}
        </div>
      )}

      <div className="fixed left-0 right-0 bottom-20 px-5">
        <div className="max-w-md mx-auto flex gap-2 bg-background/90 backdrop-blur p-2 rounded-3xl ring-1 ring-border shadow-lg pb-[8px] mb-[12px]">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask something…"
            className="flex-1 bg-transparent outline-none px-3 text-sm" />
          <button onClick={() => send()} disabled={loading}
            className="size-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-50">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
