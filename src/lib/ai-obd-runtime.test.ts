import { describe, expect, it, vi } from "vitest";
import { runObdTool, type ToolRuntime } from "./ai-obd-runtime";
import { ObdConnection } from "./obd";

/**
 * Drives the assistant's tools through a real ObdConnection wired to a scripted
 * ELM327. This is what proves the plumbing: the model asks for a reading, the
 * command reaches the wire, and a usable object comes back.
 *
 * It cannot prove behaviour against a real car — only that the tool layer works.
 */
function fakeCar(replies: Record<string, string>) {
  const conn = new ObdConnection();
  const asked: string[] = [];
  const anyConn = conn as unknown as { writer: unknown; pushChunk: (t: string) => void };
  anyConn.writer = {
    writeValueWithoutResponse: async (payload: Uint8Array) => {
      const cmd = new TextDecoder().decode(payload).trim().toUpperCase();
      asked.push(cmd);
      const reply = replies[cmd] ?? "NO DATA";
      setTimeout(() => anyConn.pushChunk(`${reply}>`), 1);
    },
  };
  return { conn, asked };
}

const neverAsked: ToolRuntime["awaitUserAction"] = async () => {
  throw new Error("should not prompt the driver");
};

describe("get_vehicle_state", () => {
  it("reports an idling engine and the values behind it", async () => {
    const { conn } = fakeCar({
      "010C": "41 0C 0C 80", // 800 rpm
      "010D": "41 0D 00", // stationary
      "0105": "41 05 84", // 92 C
      ATRV: "14.1V",
    });

    const out = await runObdTool("get_vehicle_state", {}, { connection: conn, awaitUserAction: neverAsked });

    expect(out.ok).toBe(true);
    expect(out.vehicleState).toBe("idling");
    expect(out.rpm).toBe(800);
    expect(out.coolantC).toBe(92);
    expect(out.engineWarm).toBe(true);
    expect(out.batteryVolts).toBe(14.1);
  });

  it("reports key-on-engine-off, and null voltage when ATRV is unanswered", async () => {
    const { conn } = fakeCar({ "010C": "41 0C 00 00", "010D": "41 0D 00" });

    const out = await runObdTool("get_vehicle_state", {}, { connection: conn, awaitUserAction: neverAsked });

    expect(out.vehicleState).toBe("ignition-on");
    expect(out.batteryVolts).toBeNull();
    expect(out.summary).toContain("battery=not reported");
  });
});

describe("read_sensors", () => {
  it("decodes each requested PID with its unit", async () => {
    const { conn } = fakeCar({ "010C": "41 0C 1A F8", "0105": "41 05 5A" });

    const out = await runObdTool(
      "read_sensors",
      { pids: ["0C", "05"] },
      { connection: conn, awaitUserAction: neverAsked },
    );

    expect(out.readings).toEqual([
      { pid: "0C", name: "Engine RPM", value: 1726, unit: "rpm", ok: true },
      { pid: "05", name: "Coolant temperature", value: 50, unit: "°C", ok: true },
    ]);
  });

  it("returns no-data rather than inventing a value for an unsupported PID", async () => {
    const { conn } = fakeCar({ "010C": "41 0C 1A F8" });

    const out = await runObdTool("read_sensors", { pids: ["5C"] }, { connection: conn, awaitUserAction: neverAsked });

    expect((out.readings as Array<{ ok: boolean; error?: string }>)[0]).toMatchObject({
      ok: false,
      error: "no-data",
    });
  });
});

describe("read_trouble_codes", () => {
  it("returns codes with their known titles", async () => {
    const { conn } = fakeCar({
      "03": "43 01 03 00",
      "07": "47 00",
      "0A": "4A 00",
      "0101": "41 01 81 07 65 04", // MIL on, 1 stored
    });

    const out = await runObdTool("read_trouble_codes", {}, { connection: conn, awaitUserAction: neverAsked });

    expect(out.milLampOn).toBe(true);
    expect(out.stored).toEqual([
      { code: "P0300", title: "Random / multiple cylinder misfire detected", severity: "high" },
    ]);
  });
});

describe("request_user_action", () => {
  it("refuses to ask a moving driver to switch the engine off", async () => {
    const { conn } = fakeCar({ "010C": "41 0C 20 00", "010D": "41 0D 50" }); // 2048 rpm, 80 km/h
    const prompt = vi.fn();

    const out = await runObdTool(
      "request_user_action",
      { action: "turn-engine-off", instruction: "switch it off", reason: "test" },
      { connection: conn, awaitUserAction: prompt as unknown as ToolRuntime["awaitUserAction"] },
    );

    expect(out.ok).toBe(false);
    expect(out.refused).toBe(true);
    expect(out.error).toBe("unsafe-while-moving");
    expect(prompt).not.toHaveBeenCalled(); // the driver is never even shown it
  });

  it("prompts and returns the new state once the driver confirms", async () => {
    const { conn } = fakeCar({ "010C": "41 0C 0C 80", "010D": "41 0D 00", "0105": "41 05 84" });

    const out = await runObdTool(
      "request_user_action",
      { action: "idle", instruction: "let it idle", reason: "warm it up" },
      { connection: conn, awaitUserAction: async () => "done" },
    );

    expect(out.ok).toBe(true);
    expect(out.confirmed).toBe(true);
    expect(out.vehicleState).toBe("idling");
  });

  it("returns a reasonable-about result when the driver declines", async () => {
    const { conn } = fakeCar({ "010C": "41 0C 00 00" });

    const out = await runObdTool(
      "request_user_action",
      { action: "drive", instruction: "drive at 50", reason: "check the gearbox" },
      { connection: conn, awaitUserAction: async () => "cancelled" },
    );

    expect(out.ok).toBe(false);
    expect(out.error).toBe("cancelled");
    expect(String(out.message)).toContain("declined");
  });

  it("does not hang forever when the driver never answers", async () => {
    const { conn } = fakeCar({ "010C": "41 0C 00 00" });

    const out = await runObdTool(
      "request_user_action",
      { action: "idle", instruction: "idle", reason: "test" },
      { connection: conn, awaitUserAction: async () => "timeout" },
    );

    expect(out.ok).toBe(false);
    expect(out.error).toBe("timeout");
  });
});

describe("monitor_sensors", () => {
  it("summarises a window with min, max and change", async () => {
    const { conn } = fakeCar({ "010C": "41 0C 0C 80", "010D": "41 0D 00", "0105": "41 05 84" });

    const out = await runObdTool(
      "monitor_sensors",
      { pids: ["0C"], seconds: 3 },
      { connection: conn, awaitUserAction: neverAsked },
    );

    const [entry] = out.samples as Array<Record<string, unknown>>;
    expect(entry.ok).toBe(true);
    expect(entry.min).toBe(800);
    expect(entry.max).toBe(800);
    expect(entry.change).toBe(0);
    expect(entry.samples as number).toBeGreaterThan(1);
    // The state after the window matters as much as the numbers.
    expect(out.stateAfter).toMatchObject({ vehicleState: "idling" });
  }, 15_000);
});
