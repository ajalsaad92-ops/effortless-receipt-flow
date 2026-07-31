import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { Activity, Bot, Check, Radio, RotateCcw, Send, User, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button, Lamp, Panel, StatusChip } from "@/components/kit";
import type { ToolName } from "@/lib/ai-tools";
import { useI18n } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";
import { useLiveDiagnostics } from "@/lib/use-live-diagnostics";
import { reportToPrompt, useVehicleReport } from "@/lib/vehicle-report";

export const Route = createFileRoute("/assistant")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "المساعد الذكي — تشخيص مباشر من بيانات سيارتك" },
      {
        name: "description",
        content:
          "مساعد يقرأ سيارتك بنفسه عبر OBD2: يفحص الحالة والحساسات والأعطال، ويطلب منك التشغيل أو التحرك للتأكد قبل أن يشخّص.",
      },
      { property: "og:title", content: "تشخيص مباشر بالذكاء الاصطناعي" },
      { property: "og:description", content: "المساعد يقيس قبل أن يجيب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

/** Human-readable label per tool, so the transcript reads like a work log. */
const TOOL_LABEL: Record<ToolName, { ar: string; en: string }> = {
  get_vehicle_state: { ar: "قراءة حالة السيارة", en: "Reading vehicle state" },
  read_vehicle_identity: { ar: "قراءة تعريف السيارة", en: "Reading vehicle identity" },
  read_trouble_codes: { ar: "قراءة أكواد الأعطال", en: "Reading fault codes" },
  read_sensors: { ar: "قراءة الحساسات", en: "Reading sensors" },
  monitor_sensors: { ar: "مراقبة الحساسات", en: "Monitoring sensors" },
  scan_modules: { ar: "فحص وحدات التحكم", en: "Scanning control modules" },
  request_user_action: { ar: "طلب إجراء منك", en: "Requesting an action" },
};

function AssistantPage() {
  const { t, lang } = useI18n();
  const { q } = Route.useSearch();
  const { status } = useObd();
  const { report } = useVehicleReport();
  const connected = status === "connected";

  const [liveMode, setLiveMode] = useState(false);
  const [chatId, setChatId] = useState(() => `chat-${Date.now()}`);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  // Live mode is only meaningful with a car on the other end.
  useEffect(() => {
    if (!connected && liveMode) setLiveMode(false);
  }, [connected, liveMode]);

  const { runTool, pending, activity, confirmAction, cancelAction } = useLiveDiagnostics(liveMode);

  const briefing = useMemo(() => reportToPrompt(report, lang), [report, lang]);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { vehicleContext: briefing, liveMode } }),
    [briefing, liveMode],
  );

  const {
    messages,
    sendMessage,
    status: chatStatus,
    addToolResult,
  } = useChat({
    id: chatId,
    transport,
    onError: () => toast.error(t("ai_error")),
    // Tools are declared server-side without `execute`, so they arrive here;
    // we run them against the adapter and post the output back.
    onToolCall: ({ toolCall }) => {
      void (async () => {
        const output = await runTool(
          toolCall.toolName as ToolName,
          (toolCall.input ?? {}) as Record<string, unknown>,
        );
        addToolResult({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output });
      })();
    },
    // Once every tool call in the turn has an output, resubmit so the model can
    // reason over what it just measured.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const busy = chatStatus === "submitted" || chatStatus === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatStatus, pending]);

  useEffect(() => {
    if (!q || seeded.current) return;
    seeded.current = true;
    const prompt =
      lang === "ar"
        ? `عندي كود العطل ${q} في سيارتي. ما معناه وما الأسباب المحتملة وكيف أصلحه؟`
        : `My vehicle shows fault code ${q}. What does it mean, what are the likely causes, and how do I fix it?`;
    void sendMessage({ text: prompt });
  }, [q, lang, sendMessage]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  }, [input, busy, sendMessage]);

  const suggestions = liveMode
    ? lang === "ar"
      ? ["افحص سيارتي بالكامل وقل لي ما بها", "سيارتي تهتز عند التباطؤ — تحقق بنفسك", "هل نظام الشحن سليم؟"]
      : [
          "Run a full check and tell me what's wrong",
          "It shakes at idle — verify it yourself",
          "Is the charging system healthy?",
        ]
    : lang === "ar"
      ? ["ما معنى P0300؟", "متى أغيّر زيت الجير في تاهو 2016؟", "أعراض تلف حساس الأكسجين"]
      : [
          "What does P0300 mean?",
          "When to change transmission fluid on a 2016 Tahoe?",
          "Symptoms of a failing O2 sensor",
        ];

  return (
    <AppShell>
      <PageHeader
        title={t("ai_title")}
        description={liveMode ? t("live_mode_d") : t("ai_hint")}
        action={
          <Button
            onClick={() => {
              seeded.current = true;
              setChatId(`chat-${Date.now()}`);
            }}
          >
            <RotateCcw className="size-3.5" />
            {t("new_chat")}
          </Button>
        }
      />

      <LiveModeSwitch enabled={liveMode} connected={connected} onToggle={setLiveMode} />

      <Panel className="mt-3 !p-0">
        {liveMode && activity ? (
          <div className="scan-sweep flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-2">
            <Lamp tone="accent" live />
            <span className="text-xs font-medium text-primary">
              {TOOL_LABEL[activity as ToolName]?.[lang] ?? t("ai_reading_car")}
            </span>
          </div>
        ) : briefing && !liveMode ? (
          <p className="border-b border-border px-4 py-2.5 text-xs text-success">{t("ai_has_report")}</p>
        ) : null}

        <div className="min-h-[44vh] space-y-4 p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="flex flex-wrap gap-2 py-8">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => void sendMessage({ text: s })}
                  className="rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {messages.map((message) => (
            <MessageRow key={message.id} message={message} lang={lang} toolRan={t("tool_ran")} />
          ))}

          {pending ? (
            <ActionRequest
              instruction={pending.instruction}
              reason={pending.reason}
              title={pending.label[lang]}
              whyLabel={t("action_why")}
              headline={t("action_needed")}
              doneLabel={t("action_done")}
              skipLabel={t("action_skip")}
              onDone={confirmAction}
              onSkip={cancelAction}
            />
          ) : null}

          {chatStatus === "submitted" && !activity ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lamp tone="accent" live />
              {t("ai_hint")}
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
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none"
          />
          <Button
            variant="primary"
            onClick={submit}
            disabled={busy || !input.trim()}
            aria-label={t("send")}
            className="size-10 !px-0"
          >
            <Send className="size-4 rtl:-scale-x-100" />
          </Button>
        </div>
      </Panel>
    </AppShell>
  );
}

function LiveModeSwitch({
  enabled,
  connected,
  onToggle,
}: {
  enabled: boolean;
  connected: boolean;
  onToggle: (v: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`panel flex flex-wrap items-center gap-3 p-4 ${enabled ? "border-primary/40 bg-primary/5" : ""}`}>
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
          enabled ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-elevated text-muted-foreground"
        }`}
      >
        <Radio className="size-4" />
      </span>
      <div className="min-w-48 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {t("live_mode")}
          {enabled ? (
            <StatusChip tone="accent" live>
              {t("live_mode_on")}
            </StatusChip>
          ) : null}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {connected ? t("live_mode_d") : t("live_mode_needs_adapter")}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={t("live_mode")}
        disabled={!connected}
        onClick={() => onToggle(!enabled)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${
          enabled ? "border-primary bg-primary/30" : "border-border bg-secondary"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full transition-all ${
            enabled ? "start-6 bg-primary" : "start-1 bg-muted-foreground"
          }`}
        />
      </button>
    </div>
  );
}

function ActionRequest(props: {
  headline: string;
  title: string;
  instruction: string;
  reason: string;
  whyLabel: string;
  doneLabel: string;
  skipLabel: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rise-in rounded-lg border border-warning/40 bg-warning/10 p-4">
      <p className="label-micro text-warning">{props.headline}</p>
      <p className="mt-2 text-sm font-semibold text-warning">{props.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed">{props.instruction}</p>
      {props.reason ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium">{props.whyLabel}: </span>
          {props.reason}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={props.onDone}>
          <Check className="size-3.5" />
          {props.doneLabel}
        </Button>
        <Button onClick={props.onSkip}>
          <X className="size-3.5" />
          {props.skipLabel}
        </Button>
      </div>
    </div>
  );
}

function MessageRow({ message, lang, toolRan }: { message: UIMessage; lang: "ar" | "en"; toolRan: string }) {
  const isUser = message.role === "user";
  const text = message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

  // Surface the measurements the assistant took, so its reasoning is auditable
  // instead of the model simply asserting numbers.
  const toolParts = message.parts.filter(isToolUIPart);

  if (!text && toolParts.length === 0) return null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-md ${
          isUser ? "bg-secondary" : "border border-primary/40 bg-primary/10 text-primary"
        }`}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </span>
      <div className="max-w-[85%] space-y-2">
        {toolParts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {toolParts.map((part, i) => (
              <span
                key={`${message.id}-tool-${i}`}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-elevated px-2 py-1 font-mono text-[10px] text-muted-foreground"
                title={toolRan}
              >
                <Activity className="size-3 text-primary" />
                {getToolName(part)}
              </span>
            ))}
          </div>
        ) : null}
        {text ? (
          <div
            className={`rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
              isUser ? "bg-secondary" : "border border-border bg-elevated"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{text}</p>
            ) : (
              <div className="prose-chat" dir={lang === "ar" ? "rtl" : "ltr"}>
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
