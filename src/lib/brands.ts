import { useCallback, useEffect, useState } from "react";

export type BrandKey = "gm" | "kia" | "nissan" | "generic";

export type ActuatorTest = {
  id: string;
  ar: string;
  en: string;
  /** Raw ELM327 / OBD command sequence sent in order. */
  commands: string[];
  /** true when the command actually drives a component (needs confirmation). */
  bidirectional: boolean;
  noteAr: string;
  noteEn: string;
};

export type BrandProfile = {
  key: BrandKey;
  ar: string;
  en: string;
  /** ELM327 init sequence: protocol + headers tuned per manufacturer. */
  init: string[];
  protocolAr: string;
  protocolEn: string;
  models: string[];
  tests: ActuatorTest[];
};

const COMMON_TESTS = (): ActuatorTest[] => [
  {
    id: "mode03",
    ar: "قراءة أكواد الأعطال المخزنة",
    en: "Read stored trouble codes",
    commands: ["03"],
    bidirectional: false,
    noteAr: "الأكواد المخزنة في كمبيوتر المحرك.",
    noteEn: "Codes stored in the engine computer.",
  },
  {
    id: "mode07",
    ar: "الأكواد المعلّقة (Pending)",
    en: "Pending codes",
    commands: ["07"],
    bidirectional: false,
    noteAr: "أعطال رُصدت مرة واحدة ولم تُثبّت بعد.",
    noteEn: "Faults seen once that have not matured yet.",
  },
  {
    id: "mode0A",
    ar: "الأكواد الدائمة (Permanent)",
    en: "Permanent codes",
    commands: ["0A"],
    bidirectional: false,
    noteAr: "لا تُمسح إلا بعد إصلاح فعلي واكتمال دورات القيادة.",
    noteEn: "Only clear after a real repair and completed drive cycles.",
  },
  {
    id: "mode04",
    ar: "مسح الأعطال وإطفاء لمبة الفحص",
    en: "Clear codes & turn off MIL",
    commands: ["04"],
    bidirectional: true,
    noteAr: "يمسح الأكواد وبيانات الإطار المجمّد ويعيد ضبط مراقبات الجاهزية.",
    noteEn: "Clears codes, freeze frame and resets readiness monitors.",
  },
  {
    id: "freeze",
    ar: "الإطار المجمّد (ظروف لحظة العطل)",
    en: "Freeze frame data",
    commands: ["0200"],
    bidirectional: false,
    noteAr: "قراءات المحرك المسجلة لحظة تخزين العطل.",
    noteEn: "Engine snapshot captured when the fault was stored.",
  },
  {
    id: "vin",
    ar: "قراءة رقم الهيكل VIN",
    en: "Read VIN",
    commands: ["0902"],
    bidirectional: false,
    noteAr: "الوضع 09 — معلومات المركبة.",
    noteEn: "Mode 09 vehicle information.",
  },
  {
    id: "o2test",
    ar: "نتائج اختبار حسّاسات الأكسجين",
    en: "O2 sensor test results",
    commands: ["0500"],
    bidirectional: false,
    noteAr: "الوضع 05 — نتائج مراقبة حسّاسات الأكسجين.",
    noteEn: "Mode 05 oxygen sensor monitoring results.",
  },
  {
    id: "monitors",
    ar: "نتائج المراقبات المستمرة",
    en: "On-board monitor results",
    commands: ["0600"],
    bidirectional: false,
    noteAr: "الوضع 06 — نتائج الاختبارات الداخلية بالقيم والحدود.",
    noteEn: "Mode 06 internal test results with values and limits.",
  },
];

export const BRANDS: Record<BrandKey, BrandProfile> = {
  gm: {
    key: "gm",
    ar: "جنرال موتورز (شفروليه، جي إم سي، كاديلاك، بويك)",
    en: "General Motors (Chevrolet, GMC, Cadillac, Buick)",
    init: ["ATZ", "ATE0", "ATL0", "ATS0", "ATH1", "ATSP6", "ATSH7E0"],
    protocolAr: "ISO 15765-4 CAN بسرعة 500k و11-bit — بروتوكول GM بعد 2008 (GMLAN)",
    protocolEn: "ISO 15765-4 CAN 500k 11-bit — GM GMLAN (2008+)",
    models: ["Silverado", "Tahoe", "Suburban", "Malibu", "Cruze", "Camaro", "Traverse", "Equinox", "Yukon", "Escalade"],
    tests: [
      ...COMMON_TESTS(),
      {
        id: "gm-fan",
        ar: "مروحة التبريد — طلب تشغيل (Mode 08)",
        en: "Cooling fan request (Mode 08)",
        commands: ["08 01 FF 00 00 00 00"],
        bidirectional: true,
        noteAr: "الوضع 08 غير مدعوم على أغلب سيارات GM؛ إن لم يستجب استخدم اختبار الريلاي اليدوي.",
        noteEn: "Mode 08 is unsupported on most GM cars; fall back to the manual relay test.",
      },
      {
        id: "gm-evap",
        ar: "اختبار تسريب نظام EVAP",
        en: "EVAP leak test request",
        commands: ["08 00 00 00 00 00 00"],
        bidirectional: true,
        noteAr: "يطلب من الكمبيوتر بدء اختبار تسريب البخار إن كان مدعوماً.",
        noteEn: "Asks the ECM to start an EVAP leak test if supported.",
      },
      {
        id: "gm-abs",
        ar: "قراءة أعطال ABS / الفرامل",
        en: "Read ABS / brake module codes",
        commands: ["ATSH7E4", "03", "ATSH7E0"],
        bidirectional: false,
        noteAr: "يوجّه الطلب إلى وحدة الفرامل بعنوان مختلف.",
        noteEn: "Targets the brake module on a different CAN address.",
      },
      {
        id: "gm-trans",
        ar: "قراءة أعطال ناقل الحركة (6T70 / 6L80)",
        en: "Read transmission module codes",
        commands: ["ATSH7E1", "03", "ATSH7E0"],
        bidirectional: false,
        noteAr: "وحدة TCM على العنوان 7E1.",
        noteEn: "TCM lives on address 7E1.",
      },
    ],
  },
  kia: {
    key: "kia",
    ar: "كيا (وهيونداي)",
    en: "Kia (and Hyundai)",
    init: ["ATZ", "ATE0", "ATL0", "ATS0", "ATH1", "ATSP6", "ATSH7E0"],
    protocolAr: "ISO 15765-4 CAN 500k — بروتوكول KWP/CAN لكيا وهيونداي بعد 2006",
    protocolEn: "ISO 15765-4 CAN 500k — Kia/Hyundai KWP-over-CAN (2006+)",
    models: ["Rio", "Cerato", "Sportage", "Sorento", "Picanto", "Optima / K5", "Seltos", "Carnival"],
    tests: [
      ...COMMON_TESTS(),
      {
        id: "kia-tcm",
        ar: "قراءة أعطال ناقل الحركة",
        en: "Read transmission (TCM) codes",
        commands: ["ATSH7E1", "03", "ATSH7E0"],
        bidirectional: false,
        noteAr: "وحدة ناقل الحركة على 7E1 في معظم موديلات كيا.",
        noteEn: "TCM sits on 7E1 on most Kia models.",
      },
      {
        id: "kia-abs",
        ar: "قراءة أعطال ABS",
        en: "Read ABS codes",
        commands: ["ATSH7D1", "1902FF", "ATSH7E0"],
        bidirectional: false,
        noteAr: "UDS الخدمة 19 لقراءة أعطال وحدة ABS في كيا.",
        noteEn: "UDS service 19 to read Kia ABS module faults.",
      },
      {
        id: "kia-srs",
        ar: "قراءة أعطال وسائد الهواء SRS",
        en: "Read airbag (SRS) codes",
        commands: ["ATSH7D4", "1902FF", "ATSH7E0"],
        bidirectional: false,
        noteAr: "لا تفصل البطارية أثناء العمل على وسائد الهواء.",
        noteEn: "Never disconnect the battery while working on airbags.",
      },
      {
        id: "kia-clear-uds",
        ar: "مسح أعطال الوحدات الفرعية (UDS)",
        en: "Clear sub-module faults (UDS)",
        commands: ["14FFFFFF", "ATSH7E0"],
        bidirectional: true,
        noteAr: "الخدمة 14 تمسح أعطال الوحدة المختارة حالياً.",
        noteEn: "Service 14 clears faults on the currently addressed module.",
      },
    ],
  },
  nissan: {
    key: "nissan",
    ar: "نيسان (صني الهندي، صني، سنترا)",
    en: "Nissan (Indian Sunny, Sunny, Sentra)",
    init: ["ATZ", "ATE0", "ATL0", "ATS0", "ATH1", "ATSP6", "ATSH7E0"],
    protocolAr: "نيسان صني الهندي (N17 محرك HR15DE) يستخدم ISO 15765-4 CAN 500k؛ الموديلات الأقدم ISO 9141-2 (ATSP3)",
    protocolEn: "Indian Sunny (N17, HR15DE) uses ISO 15765-4 CAN 500k; older models use ISO 9141-2 (ATSP3)",
    models: ["Sunny N17 (India)", "Sunny", "Micra", "Sentra", "Almera", "Tiida", "X-Trail"],
    tests: [
      ...COMMON_TESTS(),
      {
        id: "nis-old",
        ar: "تبديل البروتوكول القديم ISO 9141-2",
        en: "Switch to legacy ISO 9141-2",
        commands: ["ATSP3", "ATZ", "ATE0"],
        bidirectional: false,
        noteAr: "استخدمه إن لم يتصل الجهاز بموديلات ما قبل 2010.",
        noteEn: "Use this when pre-2010 models refuse to connect.",
      },
      {
        id: "nis-cvt",
        ar: "قراءة أعطال ناقل الحركة CVT",
        en: "Read CVT transmission codes",
        commands: ["ATSH7E1", "03", "ATSH7E0"],
        bidirectional: false,
        noteAr: "راقب أيضاً حرارة زيت الـ CVT — التسخين الزائد أشهر أعطال صني.",
        noteEn: "Also watch CVT fluid temperature — overheating is the classic Sunny failure.",
      },
      {
        id: "nis-abs",
        ar: "قراءة أعطال ABS",
        en: "Read ABS codes",
        commands: ["ATSH7E2", "03", "ATSH7E0"],
        bidirectional: false,
        noteAr: "بعض الموديلات تستخدم 7D1 بدلاً من 7E2.",
        noteEn: "Some models use 7D1 instead of 7E2.",
      },
      {
        id: "nis-idle",
        ar: "إعادة تعلّم دوران التباطؤ (Idle Air Volume Learning)",
        en: "Idle air volume relearn",
        commands: ["ATSH7E0", "04"],
        bidirectional: true,
        noteAr:
          "إجراء نيسان: سخّن المحرك، أطفئ كل الأحمال، امسح الأعطال، ثم اتبع تسلسل الدواسة (ON/OFF ×5 خلال 5 ثوانٍ) — التطبيق يمسح الأعطال فقط ويعرض لك الخطوات.",
        noteEn:
          "Nissan procedure: warm up, all loads off, clear codes, then the pedal sequence (5× ON/OFF within 5s) — the app clears codes and walks you through the rest.",
      },
    ],
  },
  generic: {
    key: "generic",
    ar: "أي سيارة (OBD2 قياسي)",
    en: "Any vehicle (generic OBD2)",
    init: ["ATZ", "ATE0", "ATL0", "ATS0", "ATSP0"],
    protocolAr: "اكتشاف تلقائي للبروتوكول",
    protocolEn: "Automatic protocol detection",
    models: [],
    tests: COMMON_TESTS(),
  },
};

export const BRAND_LIST = [BRANDS.gm, BRANDS.kia, BRANDS.nissan, BRANDS.generic];

const KEY = "gmobd.brand";

export function useBrand() {
  const [brand, setBrandState] = useState<BrandKey>("gm");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY) as BrandKey | null;
    if (stored && stored in BRANDS) setBrandState(stored);
  }, []);

  const setBrand = useCallback((b: BrandKey) => {
    setBrandState(b);
    window.localStorage.setItem(KEY, b);
  }, []);

  return { brand, profile: BRANDS[brand], setBrand };
}
