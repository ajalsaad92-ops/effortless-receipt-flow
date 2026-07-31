import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "ar" | "en";

const dict = {
  appName: { ar: "جي إم أوبد", en: "GM OBD" },
  tagline: {
    ar: "تشخيص وصيانة سيارات جنرال موتورز عبر OBD2",
    en: "Diagnose and maintain GM vehicles over OBD2",
  },
  nav_home: { ar: "الرئيسية", en: "Home" },
  nav_scan: { ar: "الفحص", en: "Scan" },
  nav_codes: { ar: "أكواد الأعطال", en: "Fault Codes" },
  nav_live: { ar: "بيانات حية", en: "Live Data" },
  nav_garage: { ar: "المرآب", en: "Garage" },
  nav_assistant: { ar: "المساعد الذكي", en: "AI Assistant" },
  lang_switch: { ar: "English", en: "عربي" },

  home_title: { ar: "لوحة التحكم", en: "Dashboard" },
  home_start_scan: { ar: "ابدأ فحصاً", en: "Start a scan" },
  home_start_scan_d: { ar: "اتصل بجهاز ELM327 أو أدخل الكود يدوياً", en: "Connect an ELM327 or enter a code manually" },
  home_browse: { ar: "تصفح قاعدة الأكواد", en: "Browse code database" },
  home_browse_d: { ar: "شروحات وأسباب وحلول لأكواد GM", en: "Meanings, causes and fixes for GM codes" },
  home_garage_d: { ar: "سياراتك وجدول الصيانة", en: "Your vehicles and service schedule" },
  home_ai_d: { ar: "اسأل عن أي عطل بلغتك", en: "Ask about any fault in your language" },
  home_live_d: { ar: "قراءات المحرك اللحظية", en: "Real-time engine readings" },
  recent_scans: { ar: "آخر عمليات الفحص", en: "Recent scans" },
  no_scans: { ar: "لا توجد عمليات فحص بعد", en: "No scans yet" },
  clear_history: { ar: "مسح السجل", en: "Clear history" },

  connect: { ar: "اتصال بالجهاز", en: "Connect device" },
  disconnect: { ar: "قطع الاتصال", en: "Disconnect" },
  connected: { ar: "متصل", en: "Connected" },
  disconnected: { ar: "غير متصل", en: "Not connected" },
  connecting: { ar: "جارٍ الاتصال…", en: "Connecting…" },
  bt_unsupported: {
    ar: "متصفحك لا يدعم البلوتوث. استخدم Chrome على أندرويد أو الكمبيوتر، أو أدخل الأكواد يدوياً.",
    en: "Your browser does not support Web Bluetooth. Use Chrome on Android/desktop, or enter codes manually.",
  },
  read_codes: { ar: "قراءة الأكواد", en: "Read codes" },
  clear_codes: { ar: "مسح الأكواد", en: "Clear codes" },
  manual_entry: { ar: "إدخال يدوي", en: "Manual entry" },
  manual_hint: { ar: "أدخل كود العطل مثل P0300", en: "Enter a fault code, e.g. P0300" },
  lookup: { ar: "بحث", en: "Look up" },
  bluetooth: { ar: "بلوتوث ELM327", en: "ELM327 Bluetooth" },
  results: { ar: "النتائج", en: "Results" },
  no_codes_found: { ar: "لا توجد أكواد أعطال مخزنة — السيارة سليمة", en: "No stored fault codes — vehicle is clean" },
  save_to_history: { ar: "حفظ في السجل", en: "Save to history" },
  saved: { ar: "تم الحفظ", en: "Saved" },

  search_codes: { ar: "ابحث بالكود أو الوصف…", en: "Search by code or description…" },
  all_systems: { ar: "كل الأنظمة", en: "All systems" },
  severity: { ar: "الخطورة", en: "Severity" },
  sev_low: { ar: "منخفضة", en: "Low" },
  sev_medium: { ar: "متوسطة", en: "Medium" },
  sev_high: { ar: "عالية", en: "High" },
  meaning: { ar: "المعنى", en: "Meaning" },
  symptoms: { ar: "الأعراض", en: "Symptoms" },
  causes: { ar: "الأسباب المحتملة", en: "Likely causes" },
  fixes: { ar: "خطوات الإصلاح", en: "Repair steps" },
  affected: { ar: "موديلات GM المتأثرة", en: "Affected GM models" },
  not_found: { ar: "لم يتم العثور على هذا الكود في قاعدة البيانات", en: "This code was not found in the database" },
  ask_ai_about: { ar: "اسأل المساعد عن هذا الكود", en: "Ask the assistant about this code" },
  back: { ar: "رجوع", en: "Back" },
  codes_count: { ar: "كود", en: "codes" },
  no_results: { ar: "لا توجد نتائج مطابقة", en: "No matching results" },

  live_title: { ar: "البيانات الحية", en: "Live data" },
  live_hint: { ar: "اتصل بالجهاز لعرض القراءات اللحظية، أو جرّب وضع العرض", en: "Connect a device for real readings, or try demo mode" },
  start_stream: { ar: "بدء القراءة", en: "Start streaming" },
  stop_stream: { ar: "إيقاف", en: "Stop" },
  demo_mode: { ar: "وضع العرض التجريبي", en: "Demo mode" },
  export_report: { ar: "تصدير تقرير", en: "Export report" },

  garage_title: { ar: "المرآب", en: "Garage" },
  add_vehicle: { ar: "إضافة سيارة", en: "Add vehicle" },
  model: { ar: "الموديل", en: "Model" },
  year: { ar: "سنة الصنع", en: "Year" },
  nickname: { ar: "الاسم", en: "Nickname" },
  odometer: { ar: "العداد (كم)", en: "Odometer (km)" },
  vin: { ar: "رقم الهيكل VIN", en: "VIN" },
  save: { ar: "حفظ", en: "Save" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  delete: { ar: "حذف", en: "Delete" },
  no_vehicles: { ar: "لم تضف أي سيارة بعد", en: "No vehicles added yet" },
  maintenance: { ar: "جدول الصيانة", en: "Service schedule" },
  due_now: { ar: "مستحقة الآن", en: "Due now" },
  due_in: { ar: "متبقٍ", en: "Remaining" },
  km: { ar: "كم", en: "km" },
  log_service: { ar: "تسجيل صيانة", en: "Log service" },
  history: { ar: "السجل", en: "History" },
  update_odo: { ar: "تحديث العداد", en: "Update odometer" },

  ai_title: { ar: "المساعد الذكي", en: "AI Assistant" },
  ai_hint: { ar: "صف العطل أو اكتب كود الخطأ وسأساعدك", en: "Describe the fault or paste a code and I'll help" },
  send: { ar: "إرسال", en: "Send" },
  ai_error: { ar: "تعذر الوصول للمساعد. حاول لاحقاً.", en: "Could not reach the assistant. Try again later." },
  new_chat: { ar: "محادثة جديدة", en: "New conversation" },
} as const;

export type TKey = keyof typeof dict;

type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (k: TKey) => string;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem("gmobd.lang") as Lang | null;
    if (stored === "ar" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("gmobd.lang", l);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t: (k: TKey) => dict[k][lang],
      setLang,
      toggleLang: () => setLang(lang === "ar" ? "en" : "ar"),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
