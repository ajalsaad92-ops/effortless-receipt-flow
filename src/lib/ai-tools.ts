/**
 * The contract between the model (running on the server) and the car (attached
 * to the browser over Bluetooth/serial).
 *
 * Tools are declared server-side with no `execute`, so the AI SDK streams the
 * call to the client, which runs it against the live ObdConnection and posts
 * the output back. Schemas live here so both halves cannot drift apart.
 */
import { z } from "zod";

export const USER_ACTIONS = [
  "start-engine",
  "turn-engine-off",
  "ignition-on-engine-off",
  "idle",
  "rev-engine",
  "drive",
  "stop-vehicle",
  "ac-on",
  "ac-off",
  "press-brake",
  "other",
] as const;

export type UserAction = (typeof USER_ACTIONS)[number];

/** Actions that must never be requested while the vehicle is moving. */
export const UNSAFE_WHILE_MOVING: UserAction[] = [
  "start-engine",
  "turn-engine-off",
  "ignition-on-engine-off",
];

export const ACTION_LABEL: Record<UserAction, { ar: string; en: string }> = {
  "start-engine": { ar: "شغّل المحرك", en: "Start the engine" },
  "turn-engine-off": { ar: "أطفئ المحرك", en: "Switch the engine off" },
  "ignition-on-engine-off": { ar: "افتح الكونتاكت بدون تشغيل المحرك", en: "Ignition on, engine off" },
  idle: { ar: "اترك المحرك يعمل على التباطؤ", en: "Let the engine idle" },
  "rev-engine": { ar: "ارفع الدوران", en: "Raise the engine speed" },
  drive: { ar: "قُد السيارة", en: "Drive the vehicle" },
  "stop-vehicle": { ar: "أوقف السيارة بأمان", en: "Bring the vehicle to a safe stop" },
  "ac-on": { ar: "شغّل المكيّف", en: "Switch the A/C on" },
  "ac-off": { ar: "أطفئ المكيّف", en: "Switch the A/C off" },
  "press-brake": { ar: "اضغط دواسة الفرامل", en: "Press the brake pedal" },
  other: { ar: "إجراء مطلوب", en: "Requested action" },
};

export const toolInputs = {
  get_vehicle_state: z.object({}),

  read_vehicle_identity: z.object({}),

  read_trouble_codes: z.object({}),

  read_sensors: z.object({
    pids: z
      .array(z.string().regex(/^[0-9A-Fa-f]{2}$/))
      .min(1)
      .max(12)
      .describe('Mode 01 PIDs as two hex digits, e.g. ["0C","05","06"].'),
  }),

  monitor_sensors: z.object({
    pids: z
      .array(z.string().regex(/^[0-9A-Fa-f]{2}$/))
      .min(1)
      .max(4)
      .describe("Up to 4 Mode 01 PIDs to watch."),
    seconds: z.number().int().min(3).max(30).describe("How long to sample for."),
  }),

  scan_modules: z.object({}),

  request_user_action: z.object({
    action: z.enum(USER_ACTIONS),
    instruction: z
      .string()
      .max(300)
      .describe("Exactly what the driver should do, in the user's language."),
    reason: z.string().max(300).describe("Why this is needed, in the user's language."),
  }),
} as const;

export type ToolName = keyof typeof toolInputs;

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  get_vehicle_state:
    "Read what the car is doing right now: engine off / ignition on / idling / driving, engine speed, road speed, coolant temperature and whether the engine is at operating temperature. Call this FIRST, and again after any requested action, before interpreting any other reading.",
  read_vehicle_identity:
    "Read the VIN (decoded to make, model year and engine), ECU calibration id, ECU name and the OBD protocol in use.",
  read_trouble_codes: "Read stored, pending and permanent diagnostic trouble codes, plus the MIL lamp state.",
  read_sensors: "Read the current value of specific Mode 01 sensors, with correct units.",
  monitor_sensors:
    "Sample sensors repeatedly for a few seconds and return min, max, average and the change over the window. Use this to watch how a value responds while the driver changes something.",
  scan_modules: "Probe the vehicle bus and report which control modules (ECM, TCM, ABS, SRS, BCM …) answer.",
  request_user_action:
    "Ask the driver to physically change the vehicle's state, then wait for them to confirm. Returns the new vehicle state. Never request an action that is unsafe for the current state.",
};

export type ToolResult = Record<string, unknown> & { ok: boolean; error?: string };
