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
  nav_controls: { ar: "الفحوصات والتحكم", en: "Tests & Control" },
  nav_sensors: { ar: "الحساسات", en: "Sensors" },
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
  connect_ble: { ar: "اتصال بلوتوث BLE", en: "Connect via BLE" },
  connect_serial: { ar: "اتصال عبر منفذ COM / SPP", en: "Connect via COM / SPP port" },
  serial_unsupported: {
    ar: "متصفحك لا يدعم Web Serial. استخدم Chrome أو Edge على الكمبيوتر.",
    en: "Your browser does not support Web Serial. Use Chrome or Edge on desktop.",
  },
  laptop_help_title: { ar: "لا يظهر جهاز ELM327 في القائمة؟", en: "ELM327 not showing up?" },
  laptop_help_body: {
    ar: "أغلب أجهزة ELM327 تعمل ببلوتوث كلاسيكي (SPP) وليس BLE، ومتصفح الكمبيوتر لا يستطيع رؤيتها كأجهزة بلوتوث. الحل على اللابتوب: اقرن الجهاز من إعدادات ويندوز (كلمة المرور 1234 أو 6789)، ثم افتح «إعدادات البلوتوث ← منافذ COM» وستجد منفذ Outgoing باسم الجهاز. بعدها اضغط «اتصال عبر منفذ COM» هنا واختر ذلك المنفذ. إذا كان جهازك BLE (مثل Vgate iCar Pro BLE) استخدم «اتصال بلوتوث BLE» بدلاً من ذلك.",
    en: "Most ELM327 adapters use classic Bluetooth (SPP), not BLE, so a desktop browser cannot see them in the Bluetooth picker. On a laptop: pair the adapter in Windows settings (PIN 1234 or 6789), open Bluetooth settings → COM ports and note the Outgoing port, then press “Connect via COM / SPP port” here and pick that port. If your adapter is BLE (e.g. Vgate iCar Pro BLE) use “Connect via BLE” instead.",
  },
  baud_rate: { ar: "سرعة المنفذ (Baud)", en: "Baud rate" },
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

  controls_title: { ar: "الفحوصات والتحكم", en: "Tests & control" },
  controls_d: {
    ar: "اختر نوع السيارة لتهيئة الجهاز تلقائياً، ثم نفّذ الفحوصات وأوامر التحكم المتاحة عبر OBD2.",
    en: "Pick your vehicle to auto-configure the adapter, then run the available OBD2 tests and control commands.",
  },
  select_brand: { ar: "نوع السيارة", en: "Vehicle brand" },
  brand_saved: { ar: "تم حفظ إعدادات السيارة", en: "Vehicle profile saved" },
  protocol: { ar: "البروتوكول", en: "Protocol" },
  apply_profile: { ar: "تهيئة الجهاز الآن", en: "Configure adapter now" },
  profile_applied: { ar: "تمت تهيئة الجهاز", en: "Adapter configured" },
  supported_models: { ar: "موديلات مدعومة", en: "Supported models" },
  available_tests: { ar: "الفحوصات المتاحة", en: "Available tests" },
  run_test: { ar: "تنفيذ", en: "Run" },
  bidir: { ar: "أمر تحكم", en: "Control command" },
  read_only: { ar: "قراءة فقط", en: "Read only" },
  response: { ar: "الرد", en: "Response" },
  raw_console: { ar: "أوامر يدوية (ELM327)", en: "Manual command console" },
  send_command: { ar: "إرسال الأمر", en: "Send command" },
  need_connection: { ar: "اتصل بجهاز OBD2 أولاً", en: "Connect an OBD2 adapter first" },
  confirm_clear_title: { ar: "تأكيد مسح الأعطال", en: "Confirm clearing codes" },
  confirm_clear_body: {
    ar: "سيتم مسح جميع الأكواد المخزنة وبيانات الإطار المجمّد وإعادة ضبط مراقبات الجاهزية. لا تمسح قبل تسجيل الأكواد وإصلاح السبب.",
    en: "This clears all stored codes, freeze-frame data and resets readiness monitors. Do not clear before recording the codes and fixing the cause.",
  },
  confirm: { ar: "تأكيد المسح", en: "Confirm clear" },
  cleared_ok: { ar: "تم مسح الأعطال وإطفاء لمبة الفحص", en: "Codes cleared and MIL turned off" },
  watch_fix: { ar: "شاهد طريقة الإصلاح على يوتيوب", en: "Watch the repair on YouTube" },
  auto_diag: { ar: "التشخيص التلقائي المستمر", en: "Continuous auto-diagnosis" },
  auto_diag_d: {
    ar: "يقارن التطبيق القراءات ببعضها لحظياً (الدوران مقابل السرعة والحمل والحرارة والجهد) وينبهك عند أي خروج عن المتوقع.",
    en: "The app cross-checks readings live (RPM vs speed, load, temperature, voltage) and warns whenever something is out of range.",
  },
  expected_val: { ar: "المتوقع", en: "Expected" },
  diag_waiting: { ar: "ابدأ القراءة لعرض التشخيص التلقائي", en: "Start streaming to see the automatic diagnosis" },
  all_good: { ar: "كل القراءات ضمن المعدل الطبيعي", en: "All readings are within normal range" },

  sensors_title: { ar: "مستكشف الحساسات والوحدات", en: "Sensor & module explorer" },
  sensors_d: {
    ar: "يكتشف التطبيق تلقائياً كل الحساسات التي تدعمها سيارتك ويقرأ قيمها بالوحدات الصحيحة، ويفحص وحدات التحكم الموجودة على شبكة السيارة.",
    en: "Auto-discovers every sensor your ECU supports, reads each value in real units, and probes the control modules present on the vehicle bus.",
  },
  discover_sensors: { ar: "اكتشاف الحساسات المدعومة", en: "Discover supported sensors" },
  read_all_values: { ar: "قراءة كل القيم", en: "Read all values" },
  scan_modules: { ar: "فحص وحدات التحكم", en: "Scan control modules" },
  sensors_found: { ar: "حساس مدعوم", en: "supported sensors" },
  search_sensors: { ar: "ابحث عن حساس أو PID…", en: "Search a sensor or PID…" },
  all_groups: { ar: "كل المجموعات", en: "All groups" },
  showing_supported: { ar: "الحساسات المدعومة في سيارتك", en: "Sensors supported by your vehicle" },
  showing_all: { ar: "كل الحساسات القياسية", en: "All standard sensors" },
  modules_on_bus: { ar: "وحدات التحكم على الشبكة", en: "Modules on the bus" },
  modules_d: {
    ar: "يرسل التطبيق طلب تعريف لكل عنوان وحدة معروف ويعرض الوحدات التي ردّت — تماماً كما تفعل برامج التشخيص المتقدمة.",
    en: "Sends an identification request to each known module address and lists the ones that answered — the way advanced diagnostic tools do.",
  },
  modules_empty: { ar: "شغّل فحص وحدات التحكم لعرض الوحدات المتصلة", en: "Run the module scan to list connected modules" },
  module_online: { ar: "متصلة", en: "Online" },
  module_offline: { ar: "لا ترد", en: "No reply" },
  module_open: { ar: "افتح الوحدة", en: "Open module" },
  module_probe: { ar: "جارٍ فحص الوحدة…", en: "Probing module…" },
  module_detail: { ar: "تفاصيل الوحدة", en: "Module details" },
  module_pids: { ar: "المعرّفات المدعومة", en: "Supported PIDs" },
  module_dtcs: { ar: "أعطال هذه الوحدة", en: "Module fault codes" },
  module_no_dtcs: { ar: "لا توجد أعطال مخزّنة في هذه الوحدة", en: "No stored codes in this module" },
  module_raw: { ar: "الرد الخام", en: "Raw reply" },
  module_none_pids: { ar: "الوحدة لا تكشف معرّفات قياسية", en: "This module exposes no standard PIDs" },
  module_close: { ar: "إغلاق", en: "Close" },
  module_hint_offline: { ar: "الوحدات التي لا ترد غير قابلة للفتح", en: "Modules with no reply cannot be opened" },
  nav_report: { ar: "التقرير", en: "Report" },
  report_title: { ar: "الفحص الكامل", en: "Full vehicle scan" },
  report_d: {
    ar: "فحص شامل يتعرّف على سيارتك من رقم الهيكل ثم يقرأ الأعطال والحساسات ووحدات التحكم في تقرير واحد.",
    en: "One pass that identifies your car from its VIN, then reads codes, sensors and modules into a single report.",
  },
  report_empty: { ar: "لم يتم تشغيل فحص كامل بعد — اتصل بالجهاز ثم ابدأ الفحص.", en: "No full scan yet — connect the adapter and start a scan." },
  run_full_scan: { ar: "ابدأ الفحص الكامل", en: "Run full scan" },
  scan_done: { ar: "اكتمل الفحص الكامل", en: "Full scan complete" },
  copy_report: { ar: "نسخ التقرير", en: "Copy report" },
  copied: { ar: "تم النسخ", en: "Copied" },
  ask_ai_with_report: { ar: "اسأل المساعد بالتقرير", en: "Ask the assistant" },
  vehicle_identity: { ar: "تعريف السيارة", en: "Vehicle identity" },
  make: { ar: "الصانع", en: "Make" },
  engine: { ar: "المحرك", en: "Engine" },
  built_in: { ar: "بلد الصنع", en: "Built in" },
  ecu_name: { ar: "اسم وحدة التحكم", en: "ECU name" },
  cal_id: { ar: "رقم المعايرة", en: "Calibration ID" },
  battery_v: { ar: "جهد البطارية", en: "Battery voltage" },
  codes_summary: { ar: "ملخص الأعطال", en: "Fault summary" },
  mil_lamp: { ar: "لمبة الفحص", en: "Check-engine lamp" },
  mil_on: { ar: "مضيئة", en: "On" },
  mil_off: { ar: "مطفأة", en: "Off" },
  dtc_stored: { ar: "أعطال مخزّنة", en: "Stored codes" },
  dtc_pending: { ar: "أعطال معلّقة", en: "Pending codes" },
  dtc_permanent: { ar: "أعطال دائمة", en: "Permanent codes" },
  sensor_snapshot: { ar: "لقطة الحساسات", en: "Sensor snapshot" },
  ai_has_report: {
    ar: "المساعد يعرف سيارتك الآن — تقرير الفحص الكامل مرفق مع كل سؤال.",
    en: "The assistant knows your car — your full scan report is attached to every question.",
  },
  nav_diagrams: { ar: "المخططات", en: "Diagrams" },
  diagrams_title: { ar: "مخططات أنظمة GM", en: "GM system diagrams" },
  diagrams_d: {
    ar: "مخططات تفاعلية توضح موقع كل قطعة وأكواد الأعطال المرتبطة بها — اضغط أي نقطة لعرض التفاصيل.",
    en: "Interactive layouts showing where every part sits and which fault codes point to it — tap any hotspot for details.",
  },
  diagram_related_codes: { ar: "الأكواد المرتبطة", en: "Related codes" },
  diagram_pick_part: { ar: "اختر نقطة على المخطط", en: "Pick a hotspot on the diagram" },
  diagram_for_code: { ar: "موقع القطعة على السيارة", en: "Part location on the vehicle" },
  open_diagram: { ar: "افتح المخطط", en: "Open diagram" },
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
