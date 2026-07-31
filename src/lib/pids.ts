/**
 * Full Mode 01 PID library, modelled after python-OBD's command table
 * (brendan-w/python-OBD) — name, unit and decoder for every standard sensor,
 * plus decoding of the 0100/0120/0140/0160 "supported PIDs" bitmasks so the
 * app can auto-discover exactly what the ECU exposes (like python-OBD does).
 */

export type PidGroup = "engine" | "fuel" | "air" | "oxygen" | "emissions" | "electrical" | "status";

export type PidDef = {
  /** two hex digits, e.g. "0C" */
  pid: string;
  ar: string;
  en: string;
  unit: string;
  group: PidGroup;
  /** bytes -> value (null when the frame is too short) */
  decode: (b: number[]) => number | null;
  min?: number;
  max?: number;
};

const A = (b: number[]) => b[0] ?? 0;
const AB = (b: number[]) => (b[0] ?? 0) * 256 + (b[1] ?? 0);
const pct = (b: number[]) => Math.round(((b[0] ?? 0) * 100) / 2.55) / 100;
const signedPct = (b: number[]) => Math.round((((b[0] ?? 0) - 128) * 100) / 1.28) / 100;
const temp = (b: number[]) => (b[0] ?? 0) - 40;

export const PIDS: PidDef[] = [
  { pid: "04", ar: "حمل المحرك المحسوب", en: "Calculated engine load", unit: "%", group: "engine", decode: pct, max: 100 },
  { pid: "05", ar: "حرارة سائل التبريد", en: "Coolant temperature", unit: "°C", group: "engine", decode: temp, min: -40, max: 130 },
  { pid: "06", ar: "تصحيح الوقود قصير المدى — الصف 1", en: "Short term fuel trim B1", unit: "%", group: "fuel", decode: signedPct, min: -100, max: 99 },
  { pid: "07", ar: "تصحيح الوقود طويل المدى — الصف 1", en: "Long term fuel trim B1", unit: "%", group: "fuel", decode: signedPct, min: -100, max: 99 },
  { pid: "08", ar: "تصحيح الوقود قصير المدى — الصف 2", en: "Short term fuel trim B2", unit: "%", group: "fuel", decode: signedPct, min: -100, max: 99 },
  { pid: "09", ar: "تصحيح الوقود طويل المدى — الصف 2", en: "Long term fuel trim B2", unit: "%", group: "fuel", decode: signedPct, min: -100, max: 99 },
  { pid: "0A", ar: "ضغط الوقود", en: "Fuel pressure", unit: "kPa", group: "fuel", decode: (b) => A(b) * 3, max: 765 },
  { pid: "0B", ar: "ضغط مشعب السحب (MAP)", en: "Intake manifold pressure", unit: "kPa", group: "air", decode: A, max: 255 },
  { pid: "0C", ar: "دوران المحرك", en: "Engine RPM", unit: "rpm", group: "engine", decode: (b) => Math.round(AB(b) / 4), max: 7000 },
  { pid: "0D", ar: "سرعة السيارة", en: "Vehicle speed", unit: "km/h", group: "engine", decode: A, max: 255 },
  { pid: "0E", ar: "توقيت الإشعال المتقدم", en: "Timing advance", unit: "°", group: "engine", decode: (b) => A(b) / 2 - 64, min: -64, max: 63 },
  { pid: "0F", ar: "حرارة هواء السحب", en: "Intake air temperature", unit: "°C", group: "air", decode: temp, min: -40, max: 130 },
  { pid: "10", ar: "تدفق الهواء (MAF)", en: "Mass air flow", unit: "g/s", group: "air", decode: (b) => Math.round((AB(b) / 100) * 100) / 100, max: 400 },
  { pid: "11", ar: "فتحة الخانق", en: "Throttle position", unit: "%", group: "engine", decode: pct, max: 100 },
  { pid: "14", ar: "حساس الأكسجين 1 — الجهد", en: "O2 sensor 1 voltage", unit: "V", group: "oxygen", decode: (b) => Math.round((A(b) / 200) * 1000) / 1000, max: 1.275 },
  { pid: "15", ar: "حساس الأكسجين 2 — الجهد", en: "O2 sensor 2 voltage", unit: "V", group: "oxygen", decode: (b) => Math.round((A(b) / 200) * 1000) / 1000, max: 1.275 },
  { pid: "16", ar: "حساس الأكسجين 3 — الجهد", en: "O2 sensor 3 voltage", unit: "V", group: "oxygen", decode: (b) => Math.round((A(b) / 200) * 1000) / 1000, max: 1.275 },
  { pid: "17", ar: "حساس الأكسجين 4 — الجهد", en: "O2 sensor 4 voltage", unit: "V", group: "oxygen", decode: (b) => Math.round((A(b) / 200) * 1000) / 1000, max: 1.275 },
  { pid: "1F", ar: "زمن التشغيل منذ الإقلاع", en: "Run time since start", unit: "s", group: "status", decode: AB, max: 65535 },
  { pid: "21", ar: "المسافة مع إضاءة لمبة الفحص", en: "Distance with MIL on", unit: "km", group: "emissions", decode: AB, max: 65535 },
  { pid: "22", ar: "ضغط سكة الوقود (نسبي)", en: "Fuel rail pressure (rel.)", unit: "kPa", group: "fuel", decode: (b) => Math.round(AB(b) * 0.079), max: 5177 },
  { pid: "23", ar: "ضغط سكة الوقود (مباشر)", en: "Fuel rail gauge pressure", unit: "kPa", group: "fuel", decode: (b) => AB(b) * 10, max: 655350 },
  { pid: "2C", ar: "أمر صمام EGR", en: "Commanded EGR", unit: "%", group: "emissions", decode: pct, max: 100 },
  { pid: "2D", ar: "خطأ EGR", en: "EGR error", unit: "%", group: "emissions", decode: signedPct, min: -100, max: 99 },
  { pid: "2E", ar: "أمر تنقية الكانستر", en: "Commanded evap purge", unit: "%", group: "emissions", decode: pct, max: 100 },
  { pid: "2F", ar: "مستوى الوقود", en: "Fuel level", unit: "%", group: "fuel", decode: pct, max: 100 },
  { pid: "31", ar: "المسافة منذ مسح الأعطال", en: "Distance since codes cleared", unit: "km", group: "emissions", decode: AB, max: 65535 },
  { pid: "33", ar: "الضغط الجوي", en: "Barometric pressure", unit: "kPa", group: "air", decode: A, max: 255 },
  { pid: "3C", ar: "حرارة المحفز — الصف 1 حساس 1", en: "Catalyst temp B1S1", unit: "°C", group: "emissions", decode: (b) => Math.round(AB(b) / 10 - 40), min: -40, max: 6513 },
  { pid: "3D", ar: "حرارة المحفز — الصف 2 حساس 1", en: "Catalyst temp B2S1", unit: "°C", group: "emissions", decode: (b) => Math.round(AB(b) / 10 - 40), min: -40, max: 6513 },
  { pid: "42", ar: "جهد وحدة التحكم", en: "Control module voltage", unit: "V", group: "electrical", decode: (b) => Math.round((AB(b) / 1000) * 100) / 100, max: 65 },
  { pid: "43", ar: "القيمة المطلقة للحمل", en: "Absolute load value", unit: "%", group: "engine", decode: (b) => Math.round((AB(b) * 100) / 2.55) / 100, max: 25700 },
  { pid: "44", ar: "نسبة الوقود/الهواء المطلوبة", en: "Commanded A/F ratio", unit: "λ", group: "fuel", decode: (b) => Math.round((AB(b) / 32768) * 1000) / 1000, max: 2 },
  { pid: "45", ar: "الموضع النسبي للخانق", en: "Relative throttle position", unit: "%", group: "engine", decode: pct, max: 100 },
  { pid: "46", ar: "حرارة الهواء الخارجي", en: "Ambient air temperature", unit: "°C", group: "air", decode: temp, min: -40, max: 130 },
  { pid: "47", ar: "موضع الخانق المطلق B", en: "Absolute throttle position B", unit: "%", group: "engine", decode: pct, max: 100 },
  { pid: "49", ar: "موضع دواسة البنزين D", en: "Accelerator pedal position D", unit: "%", group: "engine", decode: pct, max: 100 },
  { pid: "4A", ar: "موضع دواسة البنزين E", en: "Accelerator pedal position E", unit: "%", group: "engine", decode: pct, max: 100 },
  { pid: "4C", ar: "أمر مشغّل الخانق", en: "Commanded throttle actuator", unit: "%", group: "engine", decode: pct, max: 100 },
  { pid: "51", ar: "نوع الوقود", en: "Fuel type", unit: "", group: "status", decode: A, max: 23 },
  { pid: "52", ar: "نسبة الإيثانول", en: "Ethanol percent", unit: "%", group: "fuel", decode: pct, max: 100 },
  { pid: "5C", ar: "حرارة زيت المحرك", en: "Engine oil temperature", unit: "°C", group: "engine", decode: temp, min: -40, max: 210 },
  { pid: "5E", ar: "معدل استهلاك الوقود", en: "Fuel rate", unit: "L/h", group: "fuel", decode: (b) => Math.round((AB(b) / 20) * 100) / 100, max: 3277 },
];

export const PID_MAP = new Map(PIDS.map((p) => [p.pid, p]));

export const GROUP_LABELS: Record<PidGroup, { ar: string; en: string }> = {
  engine: { ar: "المحرك", en: "Engine" },
  fuel: { ar: "الوقود", en: "Fuel" },
  air: { ar: "الهواء والسحب", en: "Air & intake" },
  oxygen: { ar: "حساسات الأكسجين", en: "Oxygen sensors" },
  emissions: { ar: "العادم والانبعاثات", en: "Emissions" },
  electrical: { ar: "الكهرباء", en: "Electrical" },
  status: { ar: "الحالة", en: "Status" },
};

/** Decode a 4-byte support bitmask returned by 0100/0120/0140/0160 into PID strings. */
export function decodeSupportMask(base: number, bytes: number[]): string[] {
  const out: string[] = [];
  bytes.slice(0, 4).forEach((byte, index) => {
    for (let bit = 0; bit < 8; bit += 1) {
      if (byte & (0x80 >> bit)) {
        const pid = base + index * 8 + bit + 1;
        out.push(pid.toString(16).toUpperCase().padStart(2, "0"));
      }
    }
  });
  return out;
}

export const SUPPORT_QUERIES = ["00", "20", "40", "60", "80"] as const;
