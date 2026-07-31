import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { Bot, RotateCcw, Send, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { reportToPrompt, useVehicleReport } from "@/lib/vehicle-report";

export const Route = createFileRoute("/assistant")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "المساعد الذكي — تشخيص أعطال سيارات GM" },
      {
        name: "description",
        content: "اسأل مساعداً ذكياً متخصصاً في سيارات جنرال موتورز عن أي كود عطل أو عرض ميكانيكي واحصل على خطوات فحص وإصلاح.",
      },
      { property: "og:title", content: "المساعد الذكي لتشخيص سيارات GM" },
      { property: "og:description", content: "تشخيص أكواد OBD2 وأعراض الأعطال بالذكاء الاصطناعي بالعربية والإنجليزية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { t, lang } = useI18n();
  const { q } = Route.useSearch();
  const { report } = useVehicleReport();
  const [chatId, setChatId] = useState(() => `chat-${Date.now()}`);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  const briefing = useMemo(() => reportToPrompt(report, lang), [report, lang]);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { vehicleContext: briefing } }),
    [briefing],
  );
  const { messages, sendMessage, status } = useChat({
    id: chatId,
    transport,
    onError: () => toast.error(t("ai_error")),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, [chatId, busy]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!q || seeded.current) return;
    seeded.current = true;
    const prompt =
      lang === "ar"
        ? `عندي كود العطل ${q} في سيارتي. ما معناه وما الأسباب المحتملة وكيف أصلحه؟`
        : `My vehicle shows fault code ${q}. What does it mean, what are the likely causes, and how do I fix it?`;
    void sendMessage({ text: prompt });
  }, [q, lang, sendMessage]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  };

  const suggestions =
    lang === "ar"
      ? ["سيارتي تهتز عند التباطؤ", "ما معنى P0300؟", "متى أغيّر زيت الجير في تاهو 2016؟"]
      : ["My truck shakes at idle", "What does P0300 mean?", "When to change transmission fluid on a 2016 Tahoe?"];

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title={t("ai_title")} description={t("ai_hint")} />
        <button
          onClick={() => {
            seeded.current = true;
            setChatId(`chat-${Date.now()}`);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs hover:bg-secondary"
        >
          <RotateCcw className="size-3.5" />
          {t("new_chat")}
        </button>
      </div>

      <div className="rounded-3xl border border-border bg-card">
        {briefing ? (
          <p className="border-b border-border px-4 py-2.5 text-xs text-success sm:px-6">{t("ai_has_report")}</p>
        ) : null}
        <div className="min-h-[45vh] space-y-4 p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="flex flex-wrap gap-2 py-8">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => void sendMessage({ text: s })}
                  className="rounded-full border border-border px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {messages.map((message) => {
            const text = message.parts
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("");
            const isUser = message.role === "user";
            return (
              <div key={message.id} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full ${
                    isUser ? "bg-secondary" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser ? "bg-secondary" : "bg-background border border-border"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="prose-chat">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" ? (
            <div className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </span>
              <div className="flex items-center gap-1 rounded-2xl border border-border px-4 py-3">
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2 border-t border-border p-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={t("ai_hint")}
            className="max-h-40 flex-1 resize-none rounded-2xl bg-background px-4 py-3 text-sm outline-none"
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-50"
            aria-label={t("send")}
          >
            <Send className="size-4 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Dot({ delay }: { delay: string }) {
  return <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: delay }} />;
}
