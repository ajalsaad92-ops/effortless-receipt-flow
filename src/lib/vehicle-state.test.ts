import { describe, expect, it } from "vitest";
import { buildState, deriveIgnition, describeState, unmetRequirements } from "./vehicle-state";

const sample = (patch: Partial<Parameters<typeof deriveIgnition>[0]> = {}) => ({
  rpm: null,
  speed: null,
  coolant: null,
  voltage: null,
  responded: true,
  ...patch,
});

describe("deriveIgnition", () => {
  it("reports disconnected when nothing answered at all", () => {
    expect(deriveIgnition(sample({ responded: false }))).toBe("disconnected");
  });

  it("reports the key out when the adapter is alive but the ECU is silent", () => {
    expect(deriveIgnition(sample({ rpm: null }))).toBe("off");
  });

  it("reports key-on-engine-off at zero RPM", () => {
    expect(deriveIgnition(sample({ rpm: 0, speed: 0 }))).toBe("ignition-on");
  });

  it("separates idling from driving by road speed", () => {
    expect(deriveIgnition(sample({ rpm: 780, speed: 0 }))).toBe("idling");
    expect(deriveIgnition(sample({ rpm: 2100, speed: 60 }))).toBe("driving");
  });

  it("does not depend on battery voltage", () => {
    // Many clone adapters never answer ATRV, so voltage is null on exactly the
    // hardware most likely to be in use. It must never decide the state.
    expect(deriveIgnition(sample({ rpm: 800, speed: 0, voltage: null }))).toBe("idling");
    expect(deriveIgnition(sample({ rpm: 0, voltage: null }))).toBe("ignition-on");
  });

  it("treats a running engine as running even with an implausible voltage", () => {
    expect(deriveIgnition(sample({ rpm: 900, speed: 0, voltage: 11.2 }))).toBe("idling");
  });
});

describe("buildState", () => {
  it("marks the engine warm only at operating temperature", () => {
    expect(buildState(sample({ rpm: 800, coolant: 92 }), "t").engineWarm).toBe(true);
    expect(buildState(sample({ rpm: 800, coolant: 40 }), "t").engineWarm).toBe(false);
  });

  it("leaves warmth unknown when coolant was never read", () => {
    expect(buildState(sample({ rpm: 800 }), "t").engineWarm).toBeNull();
  });
});

describe("describeState", () => {
  it("says the battery was not reported rather than implying a reading", () => {
    const text = describeState(buildState(sample({ rpm: 800, speed: 0 }), "t"));
    expect(text).toContain("battery=not reported");
    expect(text).not.toMatch(/battery=\d/);
  });

  it("includes the values that were actually read", () => {
    const text = describeState(buildState(sample({ rpm: 820, speed: 0, coolant: 91, voltage: 14.1 }), "t"));
    expect(text).toContain("rpm=820");
    expect(text).toContain("coolant=91C");
    expect(text).toContain("battery=14.1V");
  });
});

describe("unmetRequirements", () => {
  const state = (patch: Parameters<typeof buildState>[0]) => buildState(patch, "t");

  it("blocks running-engine tests when the engine is off", () => {
    expect(unmetRequirements(state(sample({ rpm: 0 })), ["engine-running"])).toEqual(["engine-running"]);
  });

  it("blocks engine-off tests while it is idling", () => {
    expect(unmetRequirements(state(sample({ rpm: 800, speed: 0 })), ["engine-off"])).toEqual(["engine-off"]);
  });

  it("blocks stationary tests while moving", () => {
    expect(unmetRequirements(state(sample({ rpm: 2000, speed: 70 })), ["stationary"])).toEqual(["stationary"]);
  });

  it("blocks moving tests while stationary", () => {
    expect(unmetRequirements(state(sample({ rpm: 800, speed: 0 })), ["moving"])).toEqual(["moving"]);
  });

  it("blocks warm-engine tests on a cold engine, and on an unknown one", () => {
    expect(unmetRequirements(state(sample({ rpm: 800, coolant: 30 })), ["warm"])).toEqual(["warm"]);
    expect(unmetRequirements(state(sample({ rpm: 800 })), ["warm"])).toEqual(["warm"]);
  });

  it("passes when every condition is met", () => {
    const warmIdle = state(sample({ rpm: 800, speed: 0, coolant: 92 }));
    expect(unmetRequirements(warmIdle, ["engine-running", "stationary", "warm"])).toEqual([]);
  });
});
