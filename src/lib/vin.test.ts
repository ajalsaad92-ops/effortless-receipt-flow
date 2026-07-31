import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinYear, isVinLike } from "./vin";
import { PID_MAP, decodeSupportMask } from "./pids";

describe("isVinLike", () => {
  it("accepts a 17-character VIN", () => {
    expect(isVinLike("1GNSKBKC5FR123456")).toBe(true);
  });

  it("rejects the letters I, O and Q, which never appear in a VIN", () => {
    expect(isVinLike("1GNSKBKC5FRI23456")).toBe(false);
    expect(isVinLike("1GNSKBKC5FRO23456")).toBe(false);
    expect(isVinLike("1GNSKBKC5FRQ23456")).toBe(false);
  });

  it("rejects wrong lengths", () => {
    expect(isVinLike("1GNSKBKC5FR12345")).toBe(false);
    expect(isVinLike("")).toBe(false);
  });
});

describe("decodeVinYear", () => {
  it("maps the 2010+ window", () => {
    expect(decodeVinYear("A")).toBe(2010);
    expect(decodeVinYear("F")).toBe(2015);
  });

  it("uses position 7 to pick the right 30-year cycle", () => {
    // numeric position 7 -> the 1980-2009 cycle
    expect(decodeVinYear("A", "5")).toBe(1980);
    expect(decodeVinYear("Y", "1")).toBe(2000);
    // alphabetic position 7 -> the 2010+ cycle
    expect(decodeVinYear("A", "S")).toBe(2010);
  });

  it("never returns a year in the future", () => {
    const cutoff = new Date().getFullYear() + 1;
    for (const c of "ABCDEFGHJKLMNPRSTVWXY123456789") {
      const year = decodeVinYear(c);
      expect(year).not.toBeNull();
      expect(year!).toBeLessThanOrEqual(cutoff);
    }
  });

  it("skips the letters excluded from the year code table", () => {
    // I, O, Q, U and Z are never year codes
    for (const c of ["I", "O", "Q", "U", "Z"]) expect(decodeVinYear(c)).toBeNull();
  });

  it("returns null for a non-code character", () => {
    expect(decodeVinYear("-")).toBeNull();
  });
});

describe("decodeVin", () => {
  it("identifies a Chevrolet Tahoe WMI", () => {
    const info = decodeVin("1GNSKBKC5FR123456");
    expect(info.valid).toBe(true);
    expect(info.make).toBe("Chevrolet");
    expect(info.brandKey).toBe("gm");
    expect(info.country).toBe("USA");
    expect(info.year).toBe(2015);
  });

  it("falls back to a generic brand for an unknown WMI", () => {
    const info = decodeVin("ZZZ99999999999999");
    expect(info.brandKey).toBe("generic");
    expect(info.make).toBe("Unknown make");
  });

  it("normalises lowercase and separator characters", () => {
    expect(decodeVin("1gn-skbkc5fr123456").vin).toBe("1GNSKBKC5FR123456");
  });

  it("marks a short VIN invalid instead of inventing a year", () => {
    const info = decodeVin("1GNSK");
    expect(info.valid).toBe(false);
    expect(info.year).toBeNull();
  });
});

describe("decodeSupportMask", () => {
  it("decodes the first bit as PID 01", () => {
    expect(decodeSupportMask(0x00, [0x80, 0x00, 0x00, 0x00])).toEqual(["01"]);
  });

  it("decodes a full mask against the 0x20 block", () => {
    expect(decodeSupportMask(0x20, [0x00, 0x00, 0x00, 0x01])).toEqual(["40"]);
  });

  it("returns nothing when the ECU supports nothing in the block", () => {
    expect(decodeSupportMask(0x00, [0x00, 0x00, 0x00, 0x00])).toEqual([]);
  });
});

describe("PID decoders match SAE J1979", () => {
  const decode = (pid: string, bytes: number[]) => PID_MAP.get(pid)!.decode(bytes);

  it("engine RPM (0C)", () => expect(decode("0C", [0x1a, 0xf8])).toBe(1726));
  it("coolant temperature (05)", () => expect(decode("05", [0x5a])).toBe(50));
  it("MAF g/s (10)", () => expect(decode("10", [0x01, 0xf4])).toBe(5));
  it("timing advance (0E)", () => expect(decode("0E", [0x80])).toBe(0));
  it("fuel trim is signed around 128 (06)", () => {
    expect(decode("06", [0x80])).toBe(0);
    expect(decode("06", [0x00])).toBe(-100);
  });
  it("control module voltage (42)", () => expect(decode("42", [0x37, 0x6c])).toBeCloseTo(14.19, 2));
  it("catalyst temperature (3C)", () => expect(decode("3C", [0x0f, 0xa0])).toBe(360));
});
