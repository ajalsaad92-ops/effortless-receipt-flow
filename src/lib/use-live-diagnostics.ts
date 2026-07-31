/**
 * Wires the assistant's tool calls to the adapter and owns the "waiting for the
 * driver" handshake.
 *
 * Kept out of the route component because two things here are easy to get wrong
 * and worth isolating: the adapter must be held exclusively for the whole
 * session, and a `request_user_action` call must always settle — otherwise the
 * tool output never arrives and the conversation hangs forever.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { USER_ACTION_TIMEOUT_MS, runObdTool, type PendingAction } from "./ai-obd-runtime";
import type { ToolName } from "./ai-tools";
import { useObd } from "./obd-context";

export type ActionOutcome = "done" | "cancelled" | "timeout";

const OWNER = "assistant";

export function useLiveDiagnostics(enabled: boolean) {
  const { connection, status, acquire, release } = useObd();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const settle = useRef<((outcome: ActionOutcome) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Hold the adapter for the whole live session so the live-data poller backs
  // off, instead of trading commands with us on the same wire.
  useEffect(() => {
    if (!enabled || status !== "connected") return;
    acquire(OWNER);
    return () => release(OWNER);
  }, [enabled, status, acquire, release]);

  const finish = useCallback((outcome: ActionOutcome) => {
    clearTimeout(timer.current);
    const resolve = settle.current;
    settle.current = null;
    setPending(null);
    resolve?.(outcome);
  }, []);

  // A pending prompt must never outlive the component, or the tool call that is
  // awaiting it can never complete.
  useEffect(() => () => finish("cancelled"), [finish]);

  const awaitUserAction = useCallback(
    (next: PendingAction) =>
      new Promise<ActionOutcome>((resolve) => {
        settle.current = resolve;
        setPending(next);
        timer.current = setTimeout(() => finish("timeout"), USER_ACTION_TIMEOUT_MS);
      }),
    [finish],
  );

  const runTool = useCallback(
    async (name: ToolName, input: Record<string, unknown>) => {
      if (status !== "connected") {
        return {
          ok: false,
          error: "not-connected",
          message: "No OBD2 adapter is connected. Ask the user to connect one, or answer from knowledge alone.",
        };
      }
      setActivity(name);
      try {
        return await runObdTool(name, input, { connection, awaitUserAction });
      } catch (error) {
        // Tool failures are data, not crashes: the model can reason about
        // "the ECU did not answer" but not about a rejected promise.
        return { ok: false, error: (error as Error).message ?? "tool-failed" };
      } finally {
        setActivity(null);
      }
    },
    [connection, status, awaitUserAction],
  );

  return {
    runTool,
    pending,
    activity,
    confirmAction: () => finish("done"),
    cancelAction: () => finish("cancelled"),
  };
}
