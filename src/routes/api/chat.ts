import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are a master General Motors (Chevrolet, GMC, Cadillac, Buick) diagnostic technician.
You help users diagnose and repair GM vehicles using OBD2 data.

Rules:
- Reply in the SAME language as the user (Arabic or English). For Arabic use clear, simple mechanic vocabulary.
- When given a DTC code, explain: meaning, likely causes ordered by probability, how to test each, and the repair.
- Mention GM-specific known issues (AFM/DOD lifters, 2.4L Ecotec timing chain stretch, 5.3L oil pressure sensor, 1.4T turbo PCV, 6T70/6L80 shift solenoids) when relevant.
- Give safety warnings for fuel, airbag and high-voltage work.
- Keep answers structured with short markdown headings and bullet lists. Be concrete, never vague.
- If information is missing (model, year, engine, mileage, other codes), ask one short clarifying question first.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({ originalMessages: body.messages as UIMessage[] });
      },
    },
  },
});
