import { describe, expect, it } from "vitest";
import { ObdConnection, decodePid, hexBytes, parseDtcResponse, replyMatches } from "./obd";

/**
 * Drives a real ObdConnection through a scripted fake ELM327, so the transport
 * is exercised end to end (queue, timeouts, chunked notifications) rather than
 * mocked away.
 */
type Step = { delay: number; reply?: string; chunks?: Array<{ at: number; text: string }> };

function fakeAdapter(steps: Step[]) {
  const conn = new ObdConnection();
  const sent: string[] = [];
  let n = 0;
  // `writer` and `pushChunk` are private to TypeScript but present at runtime;
  // this is the seam a real BLE characteristic plugs into.
  const anyConn = conn as unknown as {
    writer: unknown;
    pushChunk: (t: string) => void;
  };
  const push = (t: string) => anyConn.pushChunk(t);
  anyConn.writer = {
    writeValueWithoutResponse: async (payload: Uint8Array) => {
      sent.push(new TextDecoder().decode(payload).trim());
      const step = steps[n++] ?? { delay: 5, reply: "NO DATA>" };
      if (step.chunks) for (const c of step.chunks) setTimeout(() => push(c.text), c.at);
      else setTimeout(() => push(step.reply!), step.delay);
    },
  };
  return { conn, sent };
}

describe("ObdConnection command queue", () => {
  it("does not hand a timed-out command's late reply to the next command", async () => {
    // 010C (RPM) times out at 50ms; its reply lands at 600ms, long after the
    // line was flushed and while 0105 (coolant) is waiting. Before the fix the
    // coolant read resolved with the RPM frame — a wrong number, not an error.
    const { conn } = fakeAdapter([
      { delay: 600, reply: "41 0C 1A F8>" },
      { delay: 900, reply: "41 05 5A>" },
    ]);

    await expect(conn.send("010C", 50)).rejects.toThrow("timeout");
    const coolant = await conn.send("0105", 3000);

    expect(coolant).toBe("41 05 5A");
    expect(coolant).not.toContain("41 0C");
  });

  it("accepts a reply whose envelope matches the command", () => {
    expect(replyMatches("0105", "41 05 5A")).toBe(true);
    expect(replyMatches("0902", "49 02 01 31 47 31")).toBe(true);
    expect(replyMatches("03", "43 02 03 00 01 71")).toBe(true);
    expect(replyMatches("ATRV", "13.9V")).toBe(true); // AT replies have no envelope
    expect(replyMatches("0105", "NO DATA")).toBe(true); // a valid answer
    expect(replyMatches("0100", "0: 41 00 BE 3E")).toBe(true); // ISO-TP prefix
  });

  it("rejects a reply carrying a different PID or mode", () => {
    expect(replyMatches("0105", "41 0C 1A F8")).toBe(false); // RPM answering coolant
    expect(replyMatches("010D", "41 05 5A")).toBe(false);
    expect(replyMatches("03", "41 0C 1A F8")).toBe(false);
  });

  it("does not let an expired timer wipe the buffer of a later command", async () => {
    // 0100 answers in 5ms; its 300ms timer used to stay armed and clear the
    // buffer mid-way through the next command's multi-chunk reply.
    const { conn } = fakeAdapter([
      { delay: 5, reply: "41 00 BE 3E B8 11>" },
      {
        delay: 0,
        chunks: [
          { at: 10, text: "49 02 01 31 47 31" }, // first half of the VIN frame
          { at: 400, text: " 4A 31 32 33 34 35 36 37>" }, // arrives after the stale timer
        ],
      },
    ]);

    await conn.send("0100", 300);
    const vin = await conn.send("0902", 2000);

    expect(vin).toBe("49 02 01 31 47 31 4A 31 32 33 34 35 36 37");
  });

  it("keeps commands strictly serialised", async () => {
    const { conn, sent } = fakeAdapter([
      { delay: 30, reply: "A>" },
      { delay: 5, reply: "B>" },
      { delay: 1, reply: "C>" },
    ]);

    const results = await Promise.all([conn.send("AT1"), conn.send("AT2"), conn.send("AT3")]);

    expect(results).toEqual(["A", "B", "C"]);
    expect(sent).toEqual(["AT1", "AT2", "AT3"]);
  });

  it("surfaces a timeout as an error rather than a wrong value", async () => {
    const { conn } = fakeAdapter([{ delay: 5000, reply: "41 0C 00 00>" }]);
    await expect(conn.send("010C", 50)).rejects.toThrow("timeout");
  });

  it("recovers immediately when a timed-out reply never arrives", async () => {
    // A timeout must not cascade. Draining costs a short quiet period, but the
    // very next command still gets its own answer — no reply is sacrificed.
    const { conn } = fakeAdapter([
      { delay: 10_000, reply: "never>" }, // adapter goes silent
      { delay: 5, reply: "41 05 5A>" },
      { delay: 5, reply: "41 0D 32>" },
    ]);

    await expect(conn.send("0105", 30)).rejects.toThrow("timeout");
    await expect(conn.send("0105", 2000)).resolves.toBe("41 05 5A");
    await expect(conn.send("010D", 2000)).resolves.toBe("41 0D 32");
  });
});

describe("hexBytes", () => {
  it("parses a single-frame reply with spaces", () => {
    expect(hexBytes("41 05 5A", "0105")).toEqual([0x41, 0x05, 0x5a]);
  });

  it("drops the echoed command", () => {
    expect(hexBytes("0105\r41 05 5A", "0105")).toEqual([0x41, 0x05, 0x5a]);
  });

  it("ignores adapter status words", () => {
    expect(hexBytes("SEARCHING...\r41 05 5A")).toEqual([0x41, 0x05, 0x5a]);
    expect(hexBytes("NO DATA")).toEqual([]);
    expect(hexBytes("?")).toEqual([]);
  });

  it("joins ISO-TP multi-line frames and strips their line index", () => {
    expect(hexBytes("0: 49 02 01 31\r1: 47 31 4A 31")).toEqual([
      0x49, 0x02, 0x01, 0x31, 0x47, 0x31, 0x4a, 0x31,
    ]);
  });

  it("skips odd-length lines instead of misaligning every byte after them", () => {
    expect(hexBytes("007\r41 05 5A")).toEqual([0x41, 0x05, 0x5a]);
  });
});

describe("parseDtcResponse", () => {
  it("decodes a CAN mode 03 reply with its DTC count byte", () => {
    // 43 <count=02> 0300 0171  ->  P0300, P0171
    expect(parseDtcResponse("43 02 03 00 01 71")).toEqual(["P0300", "P0171"]);
  });

  it("decodes each DTC letter prefix from the top two bits", () => {
    expect(parseDtcResponse("43 04 03 00 43 21 83 33 C1 23")).toEqual([
      "P0300",
      "C0321",
      "B0333",
      "U0123",
    ]);
  });

  it("drops 0000 padding", () => {
    expect(parseDtcResponse("43 01 03 00 00 00 00 00")).toEqual(["P0300"]);
  });

  it("returns nothing for an empty or unsupported reply", () => {
    expect(parseDtcResponse("NO DATA")).toEqual([]);
    expect(parseDtcResponse("43 00")).toEqual([]);
  });

  it("handles pending (07) and permanent (0A) reply headers", () => {
    expect(parseDtcResponse("47 01 01 33")).toEqual(["P0133"]);
    expect(parseDtcResponse("4A 01 04 20")).toEqual(["P0420"]);
  });
});

describe("decodePid", () => {
  it("decodes RPM as (A*256+B)/4", () => {
    expect(decodePid("rpm", [0x1a, 0xf8])).toBe(1726);
  });

  it("decodes temperatures with the -40 offset", () => {
    expect(decodePid("coolant", [0x5a])).toBe(50);
    expect(decodePid("intake", [0x00])).toBe(-40);
  });

  it("decodes percentages against 255", () => {
    expect(decodePid("throttle", [0xff])).toBe(100);
    expect(decodePid("load", [0x00])).toBe(0);
  });

  it("reads speed straight from byte A", () => {
    expect(decodePid("speed", [0x64])).toBe(100);
  });
});
