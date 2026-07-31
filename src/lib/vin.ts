/**
 * Offline VIN decoder: world manufacturer identifier (WMI), model year,
 * assembly plant and — for GM, Kia and Nissan — the engine code carried in
 * position 8. Everything the ECU cannot tell us is inferred from the VIN so the
 * AI assistant always receives a precise vehicle description.
 */

export type VinInfo = {
  vin: string;
  valid: boolean;
  make: string;
  brandKey: "gm" | "kia" | "nissan" | "generic";
  division: string | null;
  country: string | null;
  bodyClass: string | null;
  year: number | null;
  plant: string | null;
  serial: string | null;
  engine: string | null;
};

const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";

/**
 * Position 10 -> model year. The code repeats every 30 years, so the letter is
 * ambiguous on its own. Position 7 disambiguates on a real 17-character VIN
 * (numeric = 1980-2009, alphabetic = 2010+); without it we take the most recent
 * year that is not in the future. The old version only ever considered
 * 2010-2039, so every pre-2010 car came back with a year 30 years too late.
 */
export function decodeVinYear(char: string, positionSeven?: string): number | null {
  const index = YEAR_CODES.indexOf(char.toUpperCase());
  if (index === -1) return null;
  const cutoff = new Date().getFullYear() + 1;
  const older = 1980 + index;
  const newer = 2010 + index;

  if (positionSeven && /^[0-9]$/.test(positionSeven)) return older;
  if (positionSeven && /^[A-Z]$/i.test(positionSeven)) return newer <= cutoff ? newer : older;
  return newer <= cutoff ? newer : older;
}

type Wmi = { make: string; brandKey: VinInfo["brandKey"]; division?: string; country?: string; body?: string };

const WMI: Record<string, Wmi> = {
  "1G1": { make: "Chevrolet", brandKey: "gm", division: "Chevrolet", country: "USA", body: "Passenger car" },
  "1G2": { make: "Pontiac", brandKey: "gm", division: "Pontiac", country: "USA", body: "Passenger car" },
  "1G4": { make: "Buick", brandKey: "gm", division: "Buick", country: "USA", body: "Passenger car" },
  "1G6": { make: "Cadillac", brandKey: "gm", division: "Cadillac", country: "USA", body: "Passenger car" },
  "1GC": { make: "Chevrolet", brandKey: "gm", division: "Chevrolet", country: "USA", body: "Truck / pickup" },
  "1GN": { make: "Chevrolet", brandKey: "gm", division: "Chevrolet", country: "USA", body: "SUV / MPV" },
  "1GY": { make: "Cadillac", brandKey: "gm", division: "Cadillac", country: "USA", body: "SUV" },
  "1GK": { make: "GMC", brandKey: "gm", division: "GMC", country: "USA", body: "SUV / MPV" },
  "1GT": { make: "GMC", brandKey: "gm", division: "GMC", country: "USA", body: "Truck / pickup" },
  "2G1": { make: "Chevrolet", brandKey: "gm", division: "Chevrolet", country: "Canada", body: "Passenger car" },
  "2GC": { make: "Chevrolet", brandKey: "gm", division: "Chevrolet", country: "Canada", body: "Truck / pickup" },
  "3G1": { make: "Chevrolet", brandKey: "gm", division: "Chevrolet", country: "Mexico", body: "Passenger car" },
  "3GN": { make: "Chevrolet", brandKey: "gm", division: "Chevrolet", country: "Mexico", body: "SUV" },
  KL1: { make: "Chevrolet (Daewoo)", brandKey: "gm", division: "GM Korea", country: "South Korea", body: "Passenger car" },
  KL8: { make: "Chevrolet (GM Korea)", brandKey: "gm", division: "GM Korea", country: "South Korea", body: "Passenger car" },
  W0L: { make: "Opel / Vauxhall (GM)", brandKey: "gm", division: "Opel", country: "Germany", body: "Passenger car" },
  KNA: { make: "Kia", brandKey: "kia", division: "Kia", country: "South Korea", body: "Passenger car" },
  KNB: { make: "Kia", brandKey: "kia", division: "Kia", country: "South Korea", body: "SUV / MPV" },
  KND: { make: "Kia", brandKey: "kia", division: "Kia", country: "South Korea", body: "SUV / MPV" },
  KNM: { make: "Renault Samsung / Kia", brandKey: "kia", division: "Kia", country: "South Korea", body: "Passenger car" },
  U5Y: { make: "Kia", brandKey: "kia", division: "Kia Slovakia", country: "Slovakia", body: "Passenger car" },
  JN1: { make: "Nissan", brandKey: "nissan", division: "Nissan", country: "Japan", body: "Passenger car" },
  JN8: { make: "Nissan", brandKey: "nissan", division: "Nissan", country: "Japan", body: "SUV / MPV" },
  "1N4": { make: "Nissan", brandKey: "nissan", division: "Nissan", country: "USA", body: "Passenger car" },
  "3N1": { make: "Nissan", brandKey: "nissan", division: "Nissan", country: "Mexico", body: "Passenger car" },
  MDH: { make: "Nissan (India)", brandKey: "nissan", division: "Nissan India", country: "India", body: "Passenger car" },
  MEE: { make: "Nissan / Renault (India)", brandKey: "nissan", division: "Nissan India", country: "India", body: "Passenger car" },
};

/** Position 8 engine codes, per brand (most common ones). */
const ENGINE_CODES: Record<string, Record<string, string>> = {
  gm: {
    "1": "1.4L L4 turbo (LUJ/LUV)",
    A: "2.4L L4 Ecotec (LAF/LEA)",
    B: "2.0L L4 turbo",
    C: "3.6L V6 (LFX/LGX)",
    F: "1.8L L4 Ecotec",
    G: "5.3L V8 (LC9/L83)",
    H: "3.5L V6",
    J: "6.2L V8 (L86/LT1)",
    K: "1.6L L4",
    L: "5.3L V8 AFM",
    M: "2.5L L4 (LCV)",
    R: "4.3L V6 (LV3)",
    T: "2.8L V6",
    X: "3.0L V6",
    Z: "6.0L V8 (L96)",
  },
  kia: {
    "2": "1.6L Gamma MPI",
    "3": "1.6L Gamma GDI",
    "4": "2.0L Nu MPI",
    "5": "2.4L Theta II GDI",
    "6": "2.0L Theta turbo",
    "7": "1.4L Kappa",
    "8": "3.3L Lambda V6",
    A: "1.25L Kappa",
    B: "1.6L CRDi diesel",
  },
  nissan: {
    A: "HR15DE 1.5L",
    B: "HR16DE 1.6L",
    C: "MR20DE 2.0L",
    D: "QR25DE 2.5L",
    E: "VQ35DE 3.5L V6",
    K: "K9K 1.5 dCi diesel",
    L: "HR12DE 1.2L",
  },
};

export function isVinLike(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase());
}

export function decodeVin(rawVin: string): VinInfo {
  const vin = rawVin.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const valid = isVinLike(vin);
  const wmi = WMI[vin.slice(0, 3)] ?? WMI[vin.slice(0, 2)];
  const brandKey = wmi?.brandKey ?? "generic";
  const engineChar = vin[7];
  return {
    vin,
    valid,
    make: wmi?.make ?? "Unknown make",
    brandKey,
    division: wmi?.division ?? null,
    country: wmi?.country ?? null,
    bodyClass: wmi?.body ?? null,
    year: valid ? decodeVinYear(vin[9], vin[6]) : null,
    plant: valid ? vin[10] : null,
    serial: valid ? vin.slice(11) : null,
    engine: engineChar ? (ENGINE_CODES[brandKey]?.[engineChar] ?? null) : null,
  };
}

export function describeVin(info: VinInfo, lang: "ar" | "en") {
  const parts = [
    info.year ? String(info.year) : null,
    info.make,
    info.bodyClass,
    info.engine,
    info.country ? (lang === "ar" ? `صنع في ${info.country}` : `built in ${info.country}`) : null,
  ].filter(Boolean);
  return parts.join(" · ");
}