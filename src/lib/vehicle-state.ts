/**
 * What the car is *doing* right now.
 *
 * Most OBD2 readings are only meaningful in a particular state: fuel trims mean
 * nothing on a cold engine, an EVAP test needs the engine off, a misfire count
 * needs it running, and a transmission slip only shows while moving. The
 * assistant has to know the state before it interprets a number — and has to be
 * able to ask the driver to change it.
 */
import type { ObdConnection } from "./obd";
import { LIVE_PIDS, decodePid } from "./obd";

export type Ignition =
  /** The adapter itself is not answering. */
  | "disconnected"
  /** Key out: the ECU is asleep and answers nothing. */
  | "off"
  /** Key on, engine not turning (KOEO) — the state most actuator tests need. */
  | "ignition-on"
  /** Engine running, vehicle stationary. */
  | "idling"
  /** Engine running and moving. */
  | "driving";

export type VehicleState = {
  ignition: Ignition;
  rpm: number | null;
  speed: number | null;
  coolant: number | null;
  voltage: number | null;
  /** Coolant at or above 75 °C. Null when coolant was never read. */
  engineWarm: boolean | null;
  at: string;
};

/** Engines are only "at operating temperature" above roughly this. */
export const WARM_COOLANT_C = 75;

export const UNKNOWN_STATE: VehicleState = {
  ignition: "disconnected",
  rpm: null,
  speed: null,
  coolant: null,
  voltage: null,
  engineWarm: null,
  at: "",
};

type Sample = Pick<VehicleState, "rpm" | "speed" | "coolant" | "voltage"> & {
  /** False when not a single command got an answer. */
  responded: boolean;
};

/**
 * RPM is the primary signal because it comes from a real PID that every OBD2
 * car answers. Voltage is only ever enrichment: it comes from the adapter's
 * ATRV command, which many cheap clones never answer at all, so it must never
 * be load-bearing for deciding whether the engine is running.
 */
export function deriveIgnition(sample: Sample): Ignition {
  if (!sample.responded) return "disconnected";
  if (sample.rpm === null) {
    // The adapter is alive but the ECU is not answering: key is out.
    return "off";
  }
  if (sample.rpm === 0) return "ignition-on";
  return (sample.speed ?? 0) > 0 ? "driving" : "idling";
}

export function buildState(sample: Sample, at: string): VehicleState {
  return {
    ignition: deriveIgnition(sample),
    rpm: sample.rpm,
    speed: sample.speed,
    coolant: sample.coolant,
    voltage: sample.voltage,
    engineWarm: sample.coolant === null ? null : sample.coolant >= WARM_COOLANT_C,
    at,
  };
}

/** Read just enough PIDs to place the car in a state. Cheap by design. */
export async function readVehicleState(connection: ObdConnection): Promise<VehicleState> {
  const sample: Sample = { rpm: null, speed: null, coolant: null, voltage: null, responded: false };

  for (const key of ["rpm", "speed", "coolant"] as const) {
    try {
      const data = await connection.readPid(LIVE_PIDS[key]);
      if (data && data.length) {
        sample[key] = decodePid(key, data);
        sample.responded = true;
      } else {
        // An empty but successful read still proves the adapter is alive.
        sample.responded = true;
      }
    } catch {
      /* PID unsupported or the ECU is asleep */
    }
  }

  try {
    const raw = await connection.send("ATRV", 3000);
    const parsed = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(parsed) && parsed > 5 && parsed < 20) {
      sample.voltage = parsed;
      sample.responded = true;
    }
  } catch {
    /* many clones never answer ATRV */
  }

  return buildState(sample, new Date().toISOString());
}

export const IGNITION_LABEL: Record<Ignition, { ar: string; en: string }> = {
  disconnected: { ar: "الجهاز غير متصل", en: "Adapter not responding" },
  off: { ar: "السيارة مطفأة (المفتاح مسحوب)", en: "Vehicle off (key out)" },
  "ignition-on": { ar: "الكونتاكت مفتوح والمحرك متوقف", en: "Ignition on, engine off" },
  idling: { ar: "المحرك يعمل والسيارة واقفة", en: "Engine running, stationary" },
  driving: { ar: "السيارة تسير", en: "Vehicle moving" },
};

/** One line the model can read without having to interpret raw nulls. */
export function describeState(state: VehicleState): string {
  const parts = [`state=${state.ignition}`];
  if (state.rpm !== null) parts.push(`rpm=${state.rpm}`);
  if (state.speed !== null) parts.push(`speed=${state.speed}km/h`);
  if (state.coolant !== null) {
    parts.push(`coolant=${state.coolant}C (${state.engineWarm ? "warm" : "not yet at operating temperature"})`);
  }
  parts.push(state.voltage !== null ? `battery=${state.voltage}V` : "battery=not reported by this adapter");
  return parts.join(", ");
}

/** Physical conditions a diagnostic step can require before it means anything. */
export type StateRequirement = "engine-running" | "engine-off" | "stationary" | "moving" | "warm";

export function unmetRequirements(state: VehicleState, required: StateRequirement[]): StateRequirement[] {
  const running = state.ignition === "idling" || state.ignition === "driving";
  return required.filter((req) => {
    switch (req) {
      case "engine-running":
        return !running;
      case "engine-off":
        return running;
      case "stationary":
        return state.ignition === "driving";
      case "moving":
        return state.ignition !== "driving";
      case "warm":
        return state.engineWarm !== true;
    }
  });
}
