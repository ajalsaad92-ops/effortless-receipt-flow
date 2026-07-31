/**
 * Runs the assistant's tool calls against the real adapter, in the browser.
 *
 * The model never touches the car directly: it emits a tool call, this runs it
 * on the live ObdConnection, and the result goes back as the tool output. Every
 * handler returns a plain object — including failures, as `{ ok: false, error }`
 * — because a model that is told "the ECU did not answer" can reason about it,
 * while a thrown exception just stalls the conversation.
 */
import { ACTION_LABEL, UNSAFE_WHILE_MOVING, type ToolName, type UserAction } from "./ai-tools";
import { findDtc } from "./dtc-data";
import type { ObdConnection } from "./obd";
import { PID_MAP } from "./pids";
import { REPORT_MODULES } from "./vehicle-report";
import { decodeVin, describeVin } from "./vin";
import { describeState, readVehicleState, type VehicleState } from "./vehicle-state";

export type PendingAction = {
  action: UserAction;
  instruction: string;
  reason: string;
  label: { ar: string; en: string };
};

export type ToolRuntime = {
  connection: ObdConnection;
  /** Resolves when the driver confirms, cancels, or the wait times out. */
  awaitUserAction: (pending: PendingAction) => Promise<"done" | "cancelled" | "timeout">;
};

/** A stuck tool call blocks the whole conversation, so the wait is bounded. */
export const USER_ACTION_TIMEOUT_MS = 5 * 60_000;

function sensorReading(pid: string, bytes: number[] | null) {
  const def = PID_MAP.get(pid.toUpperCase());
  if (!def) return { pid, ok: false as const, error: "unknown-pid" };
  if (!bytes || bytes.length === 0) return { pid, name: def.en, ok: false as const, error: "no-data" };
  const value = def.decode(bytes);
  if (value === null || Number.isNaN(value)) {
    return { pid, name: def.en, ok: false as const, error: "undecodable" };
  }
  return { pid, name: def.en, value, unit: def.unit, ok: true as const };
}

export async function runObdTool(
  name: ToolName,
  input: Record<string, unknown>,
  runtime: ToolRuntime,
): Promise<Record<string, unknown>> {
  const { connection } = runtime;

  switch (name) {
    case "get_vehicle_state": {
      const state = await readVehicleState(connection);
      return { ok: true, ...stateForModel(state) };
    }

    case "read_vehicle_identity": {
      const [vin, calId, ecuName] = await Promise.all([
        connection.readVin().catch(() => null),
        connection.readMode09Text("04"),
        connection.readMode09Text("0A"),
      ]);
      const adapter = await connection.readAdapterInfo();
      const info = vin ? decodeVin(vin) : null;
      return {
        ok: true,
        vin,
        vehicle: info ? describeVin(info, "en") : null,
        make: info?.make ?? null,
        modelYear: info?.year ?? null,
        engineFromVin: info?.engine ?? null,
        calibrationId: calId,
        ecuName,
        protocol: adapter.protocol,
      };
    }

    case "read_trouble_codes": {
      const [byMode, mil] = [await connection.readTroubleCodesByMode(), await connection.readMilStatus()];
      const describe = (codes: string[]) =>
        codes.map((code) => {
          const dtc = findDtc(code);
          return dtc ? { code, title: dtc.title.en, severity: dtc.severity } : { code };
        });
      return {
        ok: true,
        milLampOn: mil?.mil ?? null,
        storedCount: mil?.count ?? null,
        stored: describe(byMode.stored),
        pending: describe(byMode.pending),
        permanent: describe(byMode.permanent),
      };
    }

    case "read_sensors": {
      const pids = (input.pids as string[]) ?? [];
      const readings = [];
      for (const pid of pids) {
        try {
          readings.push(sensorReading(pid, await connection.readPid(pid.toUpperCase())));
        } catch (error) {
          readings.push({ pid, ok: false as const, error: (error as Error).message });
        }
      }
      return { ok: true, readings };
    }

    case "monitor_sensors": {
      const pids = ((input.pids as string[]) ?? []).map((p) => p.toUpperCase());
      const seconds = Math.min(30, Math.max(3, Number(input.seconds) || 5));
      const series = new Map<string, number[]>(pids.map((p) => [p, []]));
      const deadline = Date.now() + seconds * 1000;

      while (Date.now() < deadline) {
        for (const pid of pids) {
          try {
            const reading = sensorReading(pid, await connection.readPid(pid));
            if (reading.ok) series.get(pid)!.push(reading.value);
          } catch {
            /* skip this round */
          }
        }
      }

      const samples = pids.map((pid) => {
        const values = series.get(pid) ?? [];
        const def = PID_MAP.get(pid);
        if (values.length === 0) return { pid, name: def?.en ?? pid, ok: false as const, error: "no-data" };
        const first = values[0];
        const last = values[values.length - 1];
        return {
          pid,
          name: def?.en ?? pid,
          unit: def?.unit ?? "",
          ok: true as const,
          samples: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
          start: first,
          end: last,
          change: Math.round((last - first) * 100) / 100,
        };
      });

      return { ok: true, seconds, samples, stateAfter: stateForModel(await readVehicleState(connection)) };
    }

    case "scan_modules": {
      const found = await connection.discoverEcus(REPORT_MODULES);
      return {
        ok: true,
        modules: found.map((m) => ({ address: m.header, name: m.en, answering: m.online })),
      };
    }

    case "request_user_action": {
      const action = input.action as UserAction;
      const before = await readVehicleState(connection);

      // Hard safety gate. The model is instructed not to do this, but a driver
      // at speed must not be asked to switch the engine off because a language
      // model decided it would be informative.
      if (before.ignition === "driving" && UNSAFE_WHILE_MOVING.includes(action)) {
        return {
          ok: false,
          refused: true,
          error: "unsafe-while-moving",
          message:
            "The vehicle is moving. Ask the driver to come to a safe stop first, then request this action again.",
          ...stateForModel(before),
        };
      }

      const outcome = await runtime.awaitUserAction({
        action,
        instruction: String(input.instruction ?? ""),
        reason: String(input.reason ?? ""),
        label: ACTION_LABEL[action] ?? ACTION_LABEL.other,
      });

      if (outcome !== "done") {
        return {
          ok: false,
          error: outcome,
          message:
            outcome === "cancelled"
              ? "The driver declined this step. Continue with what you can determine without it, or suggest an alternative."
              : "The driver did not confirm in time. Ask whether they want to continue.",
          ...stateForModel(before),
        };
      }

      const after = await readVehicleState(connection);
      return { ok: true, confirmed: true, ...stateForModel(after) };
    }

    default:
      return { ok: false, error: `unknown-tool:${String(name)}` };
  }
}

function stateForModel(state: VehicleState) {
  return {
    vehicleState: state.ignition,
    summary: describeState(state),
    rpm: state.rpm,
    speedKmh: state.speed,
    coolantC: state.coolant,
    engineWarm: state.engineWarm,
    batteryVolts: state.voltage,
  };
}
