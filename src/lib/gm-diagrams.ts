/**
 * GM component-location maps. Each diagram is an SVG-friendly schematic drawn
 * from normalised coordinates, so a fault code can be traced straight to the
 * part on the car.
 */
import type { SystemKey } from "./dtc-data";

export type DiagramPart = {
  id: string;
  ar: string;
  en: string;
  /** % coordinates inside the diagram box */
  x: number;
  y: number;
  codes: string[];
  noteAr: string;
  noteEn: string;
};

export type Diagram = {
  id: string;
  ar: string;
  en: string;
  system: SystemKey;
  descAr: string;
  descEn: string;
  /** simple schematic shapes: rectangles drawn behind the hotspots */
  shapes: Array<{ x: number; y: number; w: number; h: number; r?: number; label?: string }>;
  parts: DiagramPart[];
};

export const DIAGRAMS: Diagram[] = [
  {
    id: "engine-bay",
    ar: "حجرة المحرك — محركات GM V8 / Ecotec",
    en: "Engine bay — GM V8 / Ecotec",
    system: "engine",
    descAr: "مواقع الحساسات والملفات والمروحة في حجرة المحرك لسيارات شيفروليه وجي إم سي وكاديلاك.",
    descEn: "Sensor, coil and fan locations in the engine bay of Chevrolet, GMC and Cadillac models.",
    shapes: [
      { x: 8, y: 12, w: 84, h: 76, r: 6, label: "Engine bay" },
      { x: 30, y: 28, w: 40, h: 40, r: 4, label: "Engine block" },
      { x: 12, y: 20, w: 14, h: 30, r: 3, label: "Radiator" },
    ],
    parts: [
      { id: "maf", ar: "حساس تدفق الهواء MAF", en: "MAF sensor", x: 72, y: 22, codes: ["P0101", "P0102", "P0103"], noteAr: "على أنبوب الهواء بعد الفلتر مباشرة — نظّفه ببخاخ MAF فقط.", noteEn: "On the intake duct right after the air filter — clean only with MAF spray." },
      { id: "map", ar: "حساس ضغط المشعب MAP", en: "MAP sensor", x: 50, y: 30, codes: ["P0106", "P0107", "P0108"], noteAr: "أعلى مشعب السحب؛ افحص خرطوم الفراغ المتشقق.", noteEn: "On top of the intake manifold; check for cracked vacuum hose." },
      { id: "coil", ar: "ملفات الإشعال / البواجي", en: "Ignition coils / plugs", x: 42, y: 46, codes: ["P0300", "P0301", "P0302", "P0303", "P0304"], noteAr: "ملف لكل بوجي فوق غطاء الصمامات — بدّل الملف مع البوجي.", noteEn: "Coil-on-plug above the valve cover — replace coil together with the plug." },
      { id: "ect", ar: "حساس حرارة الماء ECT", en: "Coolant temp sensor (ECT)", x: 32, y: 58, codes: ["P0117", "P0118", "P0128"], noteAr: "قرب مخرج الترموستات — سبب شائع لعدم دوران المروحة.", noteEn: "Near the thermostat housing — a common cause of a fan that never runs." },
      { id: "fan", ar: "مروحة التبريد والريلاي", en: "Cooling fan & relay", x: 17, y: 62, codes: ["P0480", "P0481", "P0691"], noteAr: "الريلاي في صندوق الفيوزات؛ يجب أن تدور المروحة عند 100°م أو مع المكيّف.", noteEn: "Relay in the underhood fuse box; fan must run at ~100°C or with A/C on." },
      { id: "o2", ar: "حساس الأكسجين الأمامي", en: "Upstream O2 sensor", x: 60, y: 66, codes: ["P0131", "P0135", "P0171", "P0174"], noteAr: "على المشعب قبل المحفز — يستخدم مفتاح 22 مم خاص.", noteEn: "On the manifold before the catalyst — needs a 22 mm O2 socket." },
      { id: "purge", ar: "صمام تنقية الكانستر", en: "EVAP purge valve", x: 66, y: 40, codes: ["P0442", "P0455", "P0496"], noteAr: "عطل شائع في GM يسبب تعثر التشغيل بعد التزويد بالوقود.", noteEn: "Common GM failure causing stalling right after refuelling." },
      { id: "oil", ar: "حساس ضغط الزيت", en: "Oil pressure sensor", x: 46, y: 70, codes: ["P0521", "P0522", "P06DD"], noteAr: "خلف مشعب السحب في محركات 5.3/6.2 — يسبب صوت الليفتر وتحذير AFM.", noteEn: "Behind the intake on 5.3/6.2 V8 — causes lifter noise and AFM warnings." },
      { id: "cam", ar: "حساس عمود الكامات / موقت السلسلة", en: "Camshaft sensor / timing chain", x: 26, y: 38, codes: ["P0008", "P0016", "P0017", "P0011"], noteAr: "شد السلسلة عطل معروف في 2.4L Ecotec وV8 AFM.", noteEn: "Chain stretch is a known 2.4L Ecotec and AFM V8 failure." },
    ],
  },
  {
    id: "transmission",
    ar: "ناقل الحركة 6T70 / 6L80",
    en: "Transmission 6T70 / 6L80",
    system: "transmission",
    descAr: "مواقع ملفات النقل وحساسات السرعة وجسم الصمامات داخل ناقل الحركة الأوتوماتيكي.",
    descEn: "Shift solenoids, speed sensors and valve body layout inside the automatic transmission.",
    shapes: [
      { x: 10, y: 20, w: 80, h: 60, r: 30, label: "Gearbox" },
      { x: 26, y: 44, w: 48, h: 22, r: 4, label: "Valve body" },
    ],
    parts: [
      { id: "sol", ar: "ملفات النقل (Shift solenoids)", en: "Shift solenoids", x: 40, y: 54, codes: ["P0751", "P0756", "P0776", "P0796"], noteAr: "داخل جسم الصمامات — تُستبدل مع فلتر وزيت الجير.", noteEn: "Inside the valve body — replace together with filter and fluid." },
      { id: "tcc", ar: "ملف قفل التوربين TCC", en: "TCC lock-up solenoid", x: 62, y: 52, codes: ["P0741", "P0742"], noteAr: "الاهتزاز عند 60-80 كم/س عرض نموذجي لتلف TCC.", noteEn: "Shudder at 60–80 km/h is the classic TCC failure symptom." },
      { id: "iss", ar: "حساس سرعة الدخل ISS", en: "Input speed sensor (ISS)", x: 24, y: 34, codes: ["P0716", "P0717"], noteAr: "يقرأ سرعة عمود الإدخال؛ فقدانه يسبب نقلات قاسية.", noteEn: "Reads input shaft speed; loss of signal causes harsh shifts." },
      { id: "oss", ar: "حساس سرعة الخرج OSS", en: "Output speed sensor (OSS)", x: 76, y: 34, codes: ["P0721", "P0722"], noteAr: "يؤثر على عداد السرعة ونقاط النقل.", noteEn: "Affects the speedometer and shift points." },
      { id: "tft", ar: "حساس حرارة زيت الجير", en: "Fluid temperature sensor", x: 50, y: 70, codes: ["P0711", "P0712", "P0713"], noteAr: "ضمن ضفيرة جسم الصمامات الداخلية.", noteEn: "Part of the internal valve-body harness." },
    ],
  },
  {
    id: "electrical",
    ar: "الدائرة الكهربائية والشحن",
    en: "Charging & electrical circuit",
    system: "electrical",
    descAr: "البطارية والدينمو ومسارات الشحن وصندوق الفيوزات — لتتبع أعطال الجهد والشبكة.",
    descEn: "Battery, alternator, charging paths and the fuse box — for tracing voltage and network faults.",
    shapes: [
      { x: 8, y: 18, w: 84, h: 64, r: 6, label: "Circuit" },
      { x: 14, y: 30, w: 22, h: 20, r: 3, label: "Battery" },
      { x: 64, y: 30, w: 22, h: 20, r: 3, label: "Alternator" },
    ],
    parts: [
      { id: "bat", ar: "البطارية والأطراف", en: "Battery & terminals", x: 25, y: 40, codes: ["P0562", "P0563", "U0100"], noteAr: "التآكل على الأطراف يسبب أعطال شبكة وهمية في وحدات متعددة.", noteEn: "Terminal corrosion causes phantom network faults across modules." },
      { id: "alt", ar: "الدينمو والريغولاتور", en: "Alternator & regulator", x: 75, y: 40, codes: ["P0620", "P0621", "P0622"], noteAr: "GM تتحكم بالشحن عبر BCM — قد يكون العطل في الوحدة لا الدينمو.", noteEn: "GM regulates charging via the BCM — the fault may be the module, not the alternator." },
      { id: "grounds", ar: "نقاط التأريض", en: "Ground points", x: 50, y: 66, codes: ["U0073", "U0101", "U0140"], noteAr: "نظّف نقاط الأرضي على الشاسيه وجسم المحرك أولاً.", noteEn: "Clean chassis and engine ground straps first." },
      { id: "fuse", ar: "صندوق الفيوزات", en: "Underhood fuse box", x: 50, y: 26, codes: ["P0685", "P0689"], noteAr: "يحتوي ريلاي المروحة ومضخة الوقود وريلاي التشغيل الرئيسي.", noteEn: "Holds the fan, fuel pump and main run/crank relays." },
    ],
  },
];

export function diagramsForCode(code: string) {
  const upper = code.toUpperCase();
  return DIAGRAMS.flatMap((diagram) =>
    diagram.parts.filter((part) => part.codes.includes(upper)).map((part) => ({ diagram, part })),
  );
}