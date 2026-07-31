import { describe, expect, it } from "vitest";
import { analyzeReading, analyzeTrend } from "./diagnostics";
import { EMPTY_READING, type LiveReading } from "./obd";

const reading = (patch: Partial<LiveReading>): LiveReading => ({ ...EMPTY_READING, ...patch });
const ids = (r: LiveReading) => analyzeReading(r).map((f) => f.id);

describe("unread sensors never produce a verdict", () => {
  it("says nothing at all when nothing has been read", () => {
    expect(analyzeReading(EMPTY_READING)).toEqual([]);
  });

  it("does not judge the charging system when voltage was never returned", () => {
    // The regression: voltage used to default to 14 V, so a car whose adapter
    // never answers ATRV was told its charging system was healthy.
    const r = reading({ rpm: 800, speed: 0, throttle: 0, load: 20, coolant: 90, intake: 30 });
    expect(r.voltage).toBeNull();
    expect(ids(r)).not.toContain("volt-ok");
    expect(ids(r)).not.toContain("volt-low");
  });

  it("still judges the charging system once a real voltage arrives", () => {
    expect(ids(reading({ rpm: 800, voltage: 14.2 }))).toContain("volt-ok");
    expect(ids(reading({ rpm: 800, voltage: 12.1 }))).toContain("volt-low");
    expect(ids(reading({ rpm: 800, voltage: 15.4 }))).toContain("volt-high");
  });

  it("does not infer an idle fault from a missing throttle reading", () => {
    expect(ids(reading({ rpm: 1900, speed: 0 }))).not.toContain("idle-high");
  });

  it("does not compute a gear ratio from a missing speed", () => {
    expect(ids(reading({ rpm: 3000 }))).not.toContain("gear-slip");
  });
});

describe("diagnostic rules", () => {
  it("flags a high idle only with the pedal released", () => {
    expect(ids(reading({ rpm: 1900, speed: 0, throttle: 2 }))).toContain("idle-high");
    expect(ids(reading({ rpm: 1900, speed: 60, throttle: 30 }))).not.toContain("idle-high");
  });

  it("flags a dangerously hot engine", () => {
    expect(ids(reading({ coolant: 115 }))).toContain("coolant-hot");
    expect(ids(reading({ coolant: 95 }))).toContain("coolant-ok");
  });

  it("flags a thermostat stuck open", () => {
    expect(ids(reading({ coolant: 55, rpm: 900 }))).toContain("coolant-cold");
  });

  it("flags high load at idle", () => {
    expect(ids(reading({ rpm: 800, speed: 0, throttle: 2, load: 60 }))).toContain("load-idle-high");
  });

  it("flags an open throttle that does not raise RPM", () => {
    expect(ids(reading({ throttle: 40, rpm: 700, speed: 0 }))).toContain("tps-mismatch");
  });
});

describe("analyzeTrend", () => {
  it("reports only findings that persist across most samples", () => {
    const hot = reading({ coolant: 115 });
    const normal = reading({ coolant: 95 });
    // 4 of 5 hot -> above the 60% threshold
    expect(analyzeTrend([hot, hot, normal, hot, hot]).map((f) => f.id)).toContain("coolant-hot");
    // 1 of 5 -> a transient spike is not reported
    expect(analyzeTrend([normal, normal, hot, normal, normal]).map((f) => f.id)).not.toContain(
      "coolant-hot",
    );
  });

  it("returns nothing for no samples", () => {
    expect(analyzeTrend([])).toEqual([]);
  });

  it("sorts the worst findings first", () => {
    const bad = reading({ coolant: 115, rpm: 800, voltage: 14.2 });
    const levels = analyzeTrend([bad, bad, bad]).map((f) => f.level);
    expect(levels).toEqual([...levels].sort((a, b) => (a === "bad" ? -1 : b === "bad" ? 1 : 0)));
    expect(levels[0]).toBe("bad");
  });
});
