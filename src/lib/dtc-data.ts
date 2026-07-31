import { BRAND_DTCS } from "./dtc-brands";

export type Severity = "low" | "medium" | "high";
export type SystemKey = "engine" | "fuel" | "ignition" | "emissions" | "transmission" | "electrical" | "body" | "chassis" | "network";

export type Dtc = {
  code: string;
  system: SystemKey;
  severity: Severity;
  title: { ar: string; en: string };
  meaning: { ar: string; en: string };
  symptoms: { ar: string[]; en: string[] };
  causes: { ar: string[]; en: string[] };
  fixes: { ar: string[]; en: string[] };
  models: string[];
};

export const SYSTEM_LABEL: Record<SystemKey, { ar: string; en: string }> = {
  engine: { ar: "المحرك", en: "Engine" },
  fuel: { ar: "الوقود والهواء", en: "Fuel & Air" },
  ignition: { ar: "الإشعال", en: "Ignition" },
  emissions: { ar: "العادم والانبعاثات", en: "Emissions" },
  transmission: { ar: "ناقل الحركة", en: "Transmission" },
  electrical: { ar: "الكهرباء", en: "Electrical" },
  body: { ar: "الهيكل والمقصورة", en: "Body" },
  chassis: { ar: "الشاسيه والفرامل", en: "Chassis" },
  network: { ar: "شبكة الاتصال", en: "Network" },
};

export const DTC_DATABASE: Dtc[] = [
  {
    code: "P0300",
    system: "ignition",
    severity: "high",
    title: { ar: "احتراق غير منتظم عشوائي في عدة أسطوانات", en: "Random / multiple cylinder misfire detected" },
    meaning: {
      ar: "كمبيوتر المحرك رصد فقدان احتراق في أكثر من أسطوانة دون تحديد أسطوانة بعينها، ما يعني مشكلة عامة في الإشعال أو الوقود أو ضغط الهواء.",
      en: "The ECM detected misfires across more than one cylinder without isolating a single one, pointing to a general ignition, fuel, or air problem.",
    },
    symptoms: {
      ar: ["اهتزاز المحرك عند التباطؤ", "ضعف تسارع", "لمبة الفحص تومض", "زيادة استهلاك الوقود"],
      en: ["Rough idle", "Loss of power", "Flashing check-engine light", "Higher fuel consumption"],
    },
    causes: {
      ar: ["بواجي مستهلكة أو فجوة خاطئة", "كويلات إشعال ضعيفة", "تسريب هواء بعد حساس الهواء", "ضغط وقود منخفض / فلتر مسدود", "بخاخات متسخة"],
      en: ["Worn spark plugs or wrong gap", "Weak ignition coils", "Vacuum leak after the MAF", "Low fuel pressure / clogged filter", "Dirty injectors"],
    },
    fixes: {
      ar: ["افحص البواجي واستبدلها كمجموعة (GM توصي كل 100 ألف كم)", "بدّل الكويلات بين الأسطوانات لعزل الضعيف", "افحص تسريبات الهواء برذاذ منظف الدواسة", "قِس ضغط الوقود مقارنة بالمواصفة", "افحص الضغط الميكانيكي (Compression) إن استمر العطل"],
      en: ["Inspect plugs and replace as a set (GM ~100k km)", "Swap coils between cylinders to isolate a weak one", "Smoke-test or spray-test for vacuum leaks", "Measure fuel pressure against spec", "Run a compression test if the misfire persists"],
    },
    models: ["Silverado 5.3L", "Tahoe", "Malibu", "Camaro", "Traverse"],
  },
  {
    code: "P0301",
    system: "ignition",
    severity: "high",
    title: { ar: "فقدان احتراق في الأسطوانة رقم 1", en: "Cylinder 1 misfire detected" },
    meaning: { ar: "الأسطوانة الأولى تحديداً لا تحترق بشكل سليم.", en: "Cylinder number 1 specifically is not firing correctly." },
    symptoms: { ar: ["رجّة واضحة", "صوت محرك غير منتظم", "لمبة فحص المحرك"], en: ["Noticeable shake", "Uneven engine note", "Check-engine light"] },
    causes: { ar: ["بوجي أو كويل الأسطوانة 1", "بخاخ معطل", "صمام مسرّب أو ضغط منخفض", "عطل في وحدة AFM/DOD"], en: ["Plug or coil on cylinder 1", "Failed injector", "Leaking valve / low compression", "AFM/DOD lifter failure"] },
    fixes: { ar: ["استبدل بوجي الأسطوانة 1", "بدّل الكويل مع أسطوانة أخرى وراقب انتقال الكود", "افحص مقاومة البخاخ", "اختبر الضغط الميكانيكي"], en: ["Replace the cylinder 1 spark plug", "Swap the coil with another cylinder and see if the code follows", "Test injector resistance", "Perform a compression test"] },
    models: ["Silverado", "Sierra", "Suburban", "Impala"],
  },
  {
    code: "P0171",
    system: "fuel",
    severity: "medium",
    title: { ar: "الخليط فقير — البنك 1", en: "System too lean (Bank 1)" },
    meaning: { ar: "الكمبيوتر يعوّض بزيادة الوقود لأن كمية الهواء الداخلة أكبر مما يقيسه الحساس.", en: "The ECM is adding fuel because more air enters than the sensor measures." },
    symptoms: { ar: ["تباطؤ غير مستقر", "تردد عند التسارع", "استهلاك وقود غير طبيعي"], en: ["Unstable idle", "Hesitation on acceleration", "Odd fuel economy"] },
    causes: { ar: ["حساس هواء MAF متسخ", "تسريب في خرطوم الشفط أو مانع كتيمة", "غطاء وقود غير محكم", "مضخة وقود ضعيفة", "حساس أكسجين متعب"], en: ["Dirty MAF sensor", "Intake hose or gasket leak", "Loose fuel cap", "Weak fuel pump", "Aging oxygen sensor"] },
    fixes: { ar: ["نظّف حساس MAF بمنظف مخصص فقط", "افحص خراطيم الشفط ومانع كتيمة المنيفولد", "اقرأ قيم Fuel Trim قصيرة وطويلة المدى", "قِس ضغط الوقود"], en: ["Clean the MAF with dedicated cleaner only", "Inspect intake hoses and manifold gasket", "Read short and long term fuel trims", "Check fuel pressure"] },
    models: ["Equinox 2.4L", "Malibu", "Cruze 1.4T", "Terrain"],
  },
  {
    code: "P0172",
    system: "fuel",
    severity: "medium",
    title: { ar: "الخليط غني — البنك 1", en: "System too rich (Bank 1)" },
    meaning: { ar: "كمية الوقود أكبر من اللازم مقارنة بالهواء.", en: "Too much fuel is being delivered relative to air." },
    symptoms: { ar: ["رائحة بنزين", "دخان أسود", "تراكم كربون على البواجي"], en: ["Fuel smell", "Black smoke", "Carbon-fouled plugs"] },
    causes: { ar: ["فلتر هواء مسدود", "منظم ضغط وقود معطل", "بخاخ يسرّب", "حساس أكسجين خاطئ القراءة", "حساس حرارة ماء معطل"], en: ["Clogged air filter", "Faulty fuel pressure regulator", "Leaking injector", "Misreading O2 sensor", "Bad coolant temp sensor"] },
    fixes: { ar: ["استبدل فلتر الهواء", "افحص ضغط الوقود ومنظمه", "افحص البخاخات بحثاً عن تسريب", "افحص حساس حرارة المحرك"], en: ["Replace the air filter", "Test fuel pressure and regulator", "Check injectors for leak-down", "Test the engine coolant temperature sensor"] },
    models: ["Impala 3.6L", "Silverado", "Traverse"],
  },
  {
    code: "P0420",
    system: "emissions",
    severity: "medium",
    title: { ar: "كفاءة الحفاز أقل من الحد — البنك 1", en: "Catalyst system efficiency below threshold (Bank 1)" },
    meaning: { ar: "حساس الأكسجين الخلفي يقرأ إشارة قريبة من الأمامي، ما يعني ضعف عمل الكتلايزر.", en: "The downstream O2 sensor mirrors the upstream one, indicating a weak catalytic converter." },
    symptoms: { ar: ["لمبة فحص المحرك فقط غالباً", "رسوب في فحص العادم", "رائحة كبريت"], en: ["Usually just the check-engine light", "Emissions test failure", "Sulphur smell"] },
    causes: { ar: ["حفاز تالف أو مسدود", "حساس أكسجين خلفي متعب", "تسريب في العادم قبل الحساس", "احتراق غير منتظم أتلف الحفاز"], en: ["Failed or clogged catalytic converter", "Aging downstream O2 sensor", "Exhaust leak before the sensor", "Prior misfires that damaged the catalyst"] },
    fixes: { ar: ["أصلح أي عطل احتراق أو خليط أولاً", "افحص تسريبات العادم", "قارن رسم إشارة الحساسين على السكانر", "استبدل الحفاز إذا ثبت تلفه"], en: ["Fix any misfire or fuel-trim fault first", "Inspect the exhaust for leaks", "Compare both O2 sensor waveforms on the scanner", "Replace the converter if confirmed failed"] },
    models: ["Malibu", "Cruze", "Equinox", "Tahoe"],
  },
  {
    code: "P0430",
    system: "emissions",
    severity: "medium",
    title: { ar: "كفاءة الحفاز أقل من الحد — البنك 2", en: "Catalyst system efficiency below threshold (Bank 2)" },
    meaning: { ar: "نفس مشكلة P0420 لكن على بنك الأسطوانات الثاني في محركات V6/V8.", en: "Same as P0420 but on the second cylinder bank of V6/V8 engines." },
    symptoms: { ar: ["لمبة فحص المحرك", "ضعف طفيف في الأداء"], en: ["Check-engine light", "Slightly reduced performance"] },
    causes: { ar: ["حفاز بنك 2 تالف", "حساس أكسجين خلفي", "تسريب عادم"], en: ["Failed bank 2 converter", "Downstream O2 sensor", "Exhaust leak"] },
    fixes: { ar: ["افحص بنك 2 تحديداً (جهة الأسطوانة رقم 2)", "افحص الحساس الخلفي", "أصلح تسريبات العادم"], en: ["Inspect bank 2 specifically (cylinder 2 side)", "Test the downstream sensor", "Repair exhaust leaks"] },
    models: ["Tahoe 5.3L", "Sierra", "Camaro V6", "Yukon"],
  },
  {
    code: "P0442",
    system: "emissions",
    severity: "low",
    title: { ar: "تسريب صغير في نظام تبخير الوقود EVAP", en: "Small EVAP system leak detected" },
    meaning: { ar: "النظام لا يحتفظ بالضغط، أشهر أسبابه غطاء الوقود.", en: "The system cannot hold pressure; the fuel cap is the most common cause." },
    symptoms: { ar: ["لمبة فحص المحرك", "رائحة بنزين خفيفة"], en: ["Check-engine light", "Faint fuel smell"] },
    causes: { ar: ["غطاء خزان غير محكم أو تالف", "خراطيم EVAP متشققة", "صمام Purge أو Vent معطل"], en: ["Loose or damaged fuel cap", "Cracked EVAP hoses", "Faulty purge or vent valve"] },
    fixes: { ar: ["اربط الغطاء حتى تسمع صوت الطقطقة أو استبدله", "افحص خراطيم النظام", "اختبر النظام بالدخان (Smoke test)"], en: ["Tighten the cap until it clicks, or replace it", "Inspect the EVAP hoses", "Run a smoke test on the system"] },
    models: ["Cruze", "Malibu", "Trax", "Silverado"],
  },
  {
    code: "P0455",
    system: "emissions",
    severity: "low",
    title: { ar: "تسريب كبير في نظام EVAP", en: "Large EVAP system leak detected" },
    meaning: { ar: "تسريب واسع في دائرة أبخرة الوقود.", en: "A gross leak in the fuel vapour circuit." },
    symptoms: { ar: ["لمبة فحص المحرك", "رائحة وقود واضحة"], en: ["Check-engine light", "Noticeable fuel odour"] },
    causes: { ar: ["غطاء وقود مفقود", "خرطوم مفصول", "علبة الكربون مكسورة"], en: ["Missing fuel cap", "Disconnected hose", "Cracked charcoal canister"] },
    fixes: { ar: ["تأكد من وجود الغطاء وإحكامه", "افحص الخراطيم أسفل السيارة", "افحص علبة الكربون"], en: ["Confirm the cap is present and sealed", "Inspect hoses under the vehicle", "Inspect the charcoal canister"] },
    models: ["Equinox", "Impala", "Suburban"],
  },
  {
    code: "P0128",
    system: "engine",
    severity: "low",
    title: { ar: "حرارة المحرك أقل من حرارة التشغيل", en: "Coolant thermostat below regulating temperature" },
    meaning: { ar: "المحرك لا يصل لدرجة حرارته المثالية خلال الوقت المتوقع.", en: "The engine does not reach its target temperature in the expected time." },
    symptoms: { ar: ["تدفئة ضعيفة", "زيادة استهلاك الوقود", "مؤشر حرارة منخفض"], en: ["Poor cabin heat", "Higher fuel use", "Low temperature gauge"] },
    causes: { ar: ["ثرموستات عالق مفتوح", "حساس حرارة المياه معطل", "نقص سائل التبريد"], en: ["Thermostat stuck open", "Faulty coolant temp sensor", "Low coolant level"] },
    fixes: { ar: ["استبدل الثرموستات", "افحص قراءة حساس ECT على السكانر", "اضبط مستوى سائل التبريد"], en: ["Replace the thermostat", "Check ECT sensor value on the scanner", "Top up coolant to spec"] },
    models: ["Cruze", "Malibu", "Equinox", "Trax"],
  },
  {
    code: "P0011",
    system: "engine",
    severity: "medium",
    title: { ar: "توقيت كامة العمود A متقدم أكثر من اللازم", en: "Camshaft position A timing over-advanced (Bank 1)" },
    meaning: { ar: "نظام توقيت الصمامات المتغير VVT لا يعمل ضمن النطاق المطلوب.", en: "The variable valve timing system is outside its commanded range." },
    symptoms: { ar: ["صعوبة تشغيل", "ضعف عزم", "صوت طقطقة عند البدء"], en: ["Hard starting", "Loss of torque", "Rattle on start-up"] },
    causes: { ar: ["زيت متسخ أو منخفض", "صمام VVT/OCV مسدود", "شبكة تصفية الزيت مسدودة", "جنزير توقيت مشدود بشكل خاطئ"], en: ["Dirty or low oil", "Clogged VVT/OCV solenoid", "Blocked oil screen", "Stretched timing chain"] },
    fixes: { ar: ["غيّر الزيت والفلتر بلزوجة GM الموصى بها", "نظّف أو استبدل صمام VVT", "افحص شد جنزير التوقيت — عطل شائع في محركات 2.4L Ecotec"], en: ["Change oil and filter with GM-spec viscosity", "Clean or replace the VVT solenoid", "Check timing chain stretch — common on 2.4L Ecotec"] },
    models: ["Equinox 2.4L", "Malibu 2.4L", "Terrain", "Captiva"],
  },
  {
    code: "P0014",
    system: "engine",
    severity: "medium",
    title: { ar: "توقيت كامة العادم متأخر/متقدم بشكل خاطئ", en: "Exhaust camshaft position B timing over-advanced" },
    meaning: { ar: "خلل في تحكم توقيت كامة العادم.", en: "Fault controlling the exhaust camshaft timing." },
    symptoms: { ar: ["تباطؤ غير مستقر", "استهلاك زيت", "انخفاض قوة"], en: ["Rough idle", "Oil consumption", "Reduced power"] },
    causes: { ar: ["ملف VVT للعادم", "ضغط زيت منخفض", "جنزير توقيت متمدد"], en: ["Exhaust VVT solenoid", "Low oil pressure", "Stretched timing chain"] },
    fixes: { ar: ["افحص ضغط الزيت أولاً", "استبدل ملف VVT", "افحص التوقيت ميكانيكياً"], en: ["Check oil pressure first", "Replace the VVT solenoid", "Verify mechanical timing"] },
    models: ["Equinox", "Malibu", "Traverse"],
  },
  {
    code: "P0016",
    system: "engine",
    severity: "high",
    title: { ar: "عدم تطابق بين عمود المرفق وعمود الكامات", en: "Crankshaft / camshaft position correlation" },
    meaning: { ar: "إشارتا المرفق والكامات غير متوافقتين — غالباً تمدد جنزير التوقيت.", en: "Crank and cam signals do not correlate, usually a stretched timing chain." },
    symptoms: { ar: ["صعوبة أو تعذّر التشغيل", "طقطقة معدنية", "وضع الطوارئ"], en: ["Hard or no start", "Metallic rattle", "Limp mode"] },
    causes: { ar: ["جنزير توقيت متمدد أو مشدّاته تالفة", "حساس كامة/مرفق معطل", "ضغط زيت منخفض"], en: ["Stretched chain or failed tensioner", "Faulty cam/crank sensor", "Low oil pressure"] },
    fixes: { ar: ["لا تكمل القيادة — خطر تلف المحرك", "افحص زاوية انحراف الجنزير على السكانر", "استبدل طقم التوقيت كاملاً"], en: ["Stop driving — risk of engine damage", "Check chain offset angle on the scanner", "Replace the complete timing kit"] },
    models: ["Cruze 1.4T", "Equinox 2.4L", "Malibu 2.0T"],
  },
  {
    code: "P0101",
    system: "fuel",
    severity: "medium",
    title: { ar: "نطاق/أداء حساس تدفق الهواء MAF", en: "MAF sensor circuit range / performance" },
    meaning: { ar: "قراءة حساس الهواء لا تتوافق مع بقية معطيات المحرك.", en: "The air-flow reading does not agree with other engine data." },
    symptoms: { ar: ["تسارع ضعيف", "انطفاء المحرك", "تباطؤ متذبذب"], en: ["Poor acceleration", "Stalling", "Hunting idle"] },
    causes: { ar: ["حساس MAF متسخ", "فلتر هواء متسخ", "تسريب هواء", "خرطوم شفط ممزق"], en: ["Dirty MAF", "Dirty air filter", "Vacuum leak", "Torn intake duct"] },
    fixes: { ar: ["نظّف الحساس", "استبدل فلتر الهواء", "افحص خرطوم الهواء بين الفلتر والخانق"], en: ["Clean the sensor", "Replace the air filter", "Inspect the duct between filter and throttle"] },
    models: ["Silverado", "Tahoe", "Malibu", "Impala"],
  },
  {
    code: "P0135",
    system: "emissions",
    severity: "low",
    title: { ar: "عطل دائرة تسخين حساس الأكسجين — بنك 1 حساس 1", en: "O2 sensor heater circuit (Bank 1, Sensor 1)" },
    meaning: { ar: "سخّان الحساس الأمامي لا يعمل، فيتأخر دخول النظام في وضع التحكم المغلق.", en: "The upstream sensor heater is not working, delaying closed-loop operation." },
    symptoms: { ar: ["زيادة استهلاك وقود عند البرودة", "لمبة فحص"], en: ["Higher cold-start fuel use", "Check-engine light"] },
    causes: { ar: ["حساس أكسجين تالف", "فيوز أو سلك مقطوع", "أكسدة في الكونكتور"], en: ["Failed O2 sensor", "Blown fuse or broken wire", "Corroded connector"] },
    fixes: { ar: ["افحص الفيوز والتغذية 12 فولت", "قِس مقاومة السخّان", "استبدل الحساس"], en: ["Check the fuse and 12V supply", "Measure heater resistance", "Replace the sensor"] },
    models: ["Aveo", "Cruze", "Silverado", "Colorado"],
  },
  {
    code: "P0113",
    system: "fuel",
    severity: "low",
    title: { ar: "إشارة حساس حرارة الهواء الداخل مرتفعة", en: "Intake air temperature sensor circuit high" },
    meaning: { ar: "الكمبيوتر يقرأ جهداً مرتفعاً من حساس IAT.", en: "The ECM reads an abnormally high voltage from the IAT sensor." },
    symptoms: { ar: ["صعوبة تشغيل بارد", "تغيّر في التسارع"], en: ["Hard cold start", "Changed throttle response"] },
    causes: { ar: ["حساس معطل", "سلك مقطوع", "كونكتور غير موصول"], en: ["Failed sensor", "Open wire", "Unplugged connector"] },
    fixes: { ar: ["افحص الكونكتور", "قِس مقاومة الحساس مقابل الحرارة", "استبدل الحساس"], en: ["Inspect the connector", "Measure sensor resistance vs temperature", "Replace the sensor"] },
    models: ["Cruze", "Sonic", "Silverado"],
  },
  {
    code: "P0121",
    system: "engine",
    severity: "medium",
    title: { ar: "أداء حساس موضع دواسة/بوابة الخانق", en: "Throttle position sensor range / performance" },
    meaning: { ar: "قراءة حساس الخانق غير منطقية مقارنة بالحمل والدوران.", en: "Throttle sensor reading is implausible versus load and RPM." },
    symptoms: { ar: ["تسارع متقطع", "دخول وضع الطوارئ", "لمبة تحكم بالجر"], en: ["Surging acceleration", "Limp mode", "Traction control light"] },
    causes: { ar: ["جسم خانق متسخ بالكربون", "حساس TPS تالف", "أسلاك متآكلة"], en: ["Carbon-fouled throttle body", "Failed TPS", "Chafed wiring"] },
    fixes: { ar: ["نظّف جسم الخانق وأعد التعلّم (Relearn)", "افحص جهد الحساس أثناء فتح الدواسة تدريجياً", "استبدل جسم الخانق عند الحاجة"], en: ["Clean the throttle body and perform a relearn", "Watch sensor voltage while sweeping the pedal", "Replace the throttle body if needed"] },
    models: ["Malibu", "Impala", "Silverado", "Equinox"],
  },
  {
    code: "P0336",
    system: "engine",
    severity: "high",
    title: { ar: "أداء حساس موضع عمود المرفق", en: "Crankshaft position sensor circuit range" },
    meaning: { ar: "إشارة حساس المرفق غير مستقرة، ويعتمد عليها الإشعال والحقن.", en: "The crank sensor signal is erratic; ignition and injection depend on it." },
    symptoms: { ar: ["انطفاء مفاجئ", "تعذّر التشغيل", "تقطيع أثناء السير"], en: ["Sudden stall", "No start", "Cutting out while driving"] },
    causes: { ar: ["حساس تالف بالحرارة", "ترس مسنن تالف", "تشويش كهربائي أو أرضي ضعيف"], en: ["Heat-failed sensor", "Damaged reluctor ring", "Electrical noise or weak ground"] },
    fixes: { ar: ["استبدل حساس المرفق", "نفّذ إجراء Crankshaft Variation Relearn بعد الاستبدال", "افحص الأسلاك والأرضي"], en: ["Replace the crank sensor", "Run the crankshaft variation relearn afterwards", "Inspect wiring and grounds"] },
    models: ["Silverado", "Tahoe", "Impala", "Trailblazer"],
  },
  {
    code: "P0442",
    system: "emissions",
    severity: "low",
    title: { ar: "تسريب صغير في EVAP", en: "Small EVAP leak" },
    meaning: { ar: "مكرر — راجع الشرح أعلاه.", en: "Duplicate entry — see above." },
    symptoms: { ar: ["لمبة فحص"], en: ["Check-engine light"] },
    causes: { ar: ["غطاء الوقود"], en: ["Fuel cap"] },
    fixes: { ar: ["أحكم الغطاء"], en: ["Tighten the cap"] },
    models: ["GM"],
  },
  {
    code: "P0700",
    system: "transmission",
    severity: "high",
    title: { ar: "طلب عطل من وحدة تحكم ناقل الحركة", en: "Transmission control system malfunction request" },
    meaning: { ar: "كود إعلامي يعني وجود كود آخر مخزّن داخل وحدة الجير TCM.", en: "An informational code meaning the TCM has stored another specific code." },
    symptoms: { ar: ["نقلات قاسية", "وضع الطوارئ (Limp)", "لمبة فحص"], en: ["Harsh shifts", "Limp mode", "Check-engine light"] },
    causes: { ar: ["أعطال داخل وحدة الجير", "زيت جير متدهور", "ملفات ضغط (Solenoids) معطلة"], en: ["Faults inside the TCM", "Degraded transmission fluid", "Failed pressure solenoids"] },
    fixes: { ar: ["اقرأ أكواد وحدة الجير بسكانر يدعم GM", "افحص مستوى ولون زيت الجير", "افحص ملفات الضغط ووحدة الصمامات"], en: ["Read TCM codes with a GM-capable scanner", "Check fluid level and condition", "Test the shift solenoids and valve body"] },
    models: ["Silverado 6L80", "Traverse 6T70", "Malibu", "Equinox"],
  },
  {
    code: "P0741",
    system: "transmission",
    severity: "high",
    title: { ar: "أداء قابض محول العزم (TCC)", en: "Torque converter clutch circuit performance / stuck off" },
    meaning: { ar: "قابض محول العزم لا يقفل كما يأمره الكمبيوتر.", en: "The torque converter clutch is not locking as commanded." },
    symptoms: { ar: ["اهتزاز عند السرعات الثابتة", "ارتفاع دوران المحرك على الطريق السريع", "استهلاك وقود مرتفع"], en: ["Shudder at steady speed", "High RPM on the highway", "Poor fuel economy"] },
    causes: { ar: ["زيت جير متسخ", "ملف TCC معطل", "محول عزم تالف", "وحدة صمامات مهترئة"], en: ["Dirty fluid", "Failed TCC solenoid", "Bad torque converter", "Worn valve body"] },
    fixes: { ar: ["غيّر زيت الجير والفلتر بمواصفة Dexron المناسبة", "استبدل ملف TCC", "افحص محول العزم"], en: ["Change fluid and filter with the correct Dexron spec", "Replace the TCC solenoid", "Inspect the torque converter"] },
    models: ["Silverado", "Suburban", "Impala", "Traverse"],
  },
  {
    code: "P0agree",
    system: "network",
    severity: "medium",
    title: { ar: "خطأ اتصال داخلي", en: "Internal communication error" },
    meaning: { ar: "مدخل احتياطي.", en: "Placeholder entry." },
    symptoms: { ar: [], en: [] },
    causes: { ar: [], en: [] },
    fixes: { ar: [], en: [] },
    models: [],
  },
  {
    code: "U0100",
    system: "network",
    severity: "high",
    title: { ar: "انقطاع الاتصال بوحدة التحكم بالمحرك", en: "Lost communication with ECM/PCM" },
    meaning: { ar: "الوحدات الأخرى لم تعد ترى رسائل كمبيوتر المحرك على شبكة CAN.", en: "Other modules no longer see ECM messages on the CAN bus." },
    symptoms: { ar: ["عدة لمبات تحذير", "تعذّر التشغيل", "عدادات ميتة"], en: ["Multiple warning lights", "No start", "Dead gauges"] },
    causes: { ar: ["أسلاك CAN مقطوعة", "بطارية ضعيفة أو أرضي سيئ", "كمبيوتر معطل", "أكسدة في الكونكتور"], en: ["Broken CAN wiring", "Weak battery or bad ground", "Failed ECM", "Corroded connector"] },
    fixes: { ar: ["افحص جهد البطارية والأرضيات أولاً", "قِس مقاومة شبكة CAN (نحو 60 أوم)", "افحص كونكتور الكمبيوتر"], en: ["Check battery voltage and grounds first", "Measure CAN bus resistance (~60 ohms)", "Inspect the ECM connector"] },
    models: ["Silverado", "Cruze", "Malibu", "Tahoe"],
  },
  {
    code: "U0101",
    system: "network",
    severity: "high",
    title: { ar: "انقطاع الاتصال بوحدة ناقل الحركة", en: "Lost communication with TCM" },
    meaning: { ar: "لا توجد رسائل من وحدة الجير على الشبكة.", en: "No messages from the transmission module on the bus." },
    symptoms: { ar: ["الجير في وضع الطوارئ", "لمبات متعددة"], en: ["Transmission limp mode", "Multiple lights"] },
    causes: { ar: ["أسلاك أو كونكتور الجير", "وحدة TCM تالفة", "تغذية كهربائية مفقودة"], en: ["TCM wiring or connector", "Failed TCM", "Missing power supply"] },
    fixes: { ar: ["افحص تغذية وأرضي الوحدة", "افحص كونكتور الجير من التسريب الزيتي", "افحص شبكة CAN"], en: ["Check module power and ground", "Inspect the transmission connector for fluid intrusion", "Test the CAN bus"] },
    models: ["Silverado", "Traverse", "Acadia"],
  },
  {
    code: "P0521",
    system: "engine",
    severity: "high",
    title: { ar: "نطاق/أداء حساس ضغط زيت المحرك", en: "Engine oil pressure sensor range / performance" },
    meaning: { ar: "قراءة ضغط الزيت خارج النطاق المتوقع.", en: "Oil pressure reading is outside the expected range." },
    symptoms: { ar: ["تحذير ضغط الزيت", "صوت طقطقة", "دخول وضع الحماية"], en: ["Oil pressure warning", "Tapping noise", "Protection mode"] },
    causes: { ar: ["حساس ضغط زيت معطل (شائع في محركات 5.3L)", "زيت منخفض أو مخفف", "مضخة زيت ضعيفة", "شبكة سحب مسدودة"], en: ["Failed pressure sensor (common on 5.3L)", "Low or diluted oil", "Weak oil pump", "Clogged pickup screen"] },
    fixes: { ar: ["قِس الضغط بمقياس ميكانيكي قبل استبدال أي شيء", "غيّر الزيت والفلتر", "استبدل الحساس إن كان الضغط الفعلي سليماً"], en: ["Verify with a mechanical gauge before replacing parts", "Change oil and filter", "Replace the sensor if actual pressure is fine"] },
    models: ["Silverado 5.3L", "Tahoe", "Yukon", "Suburban"],
  },
  {
    code: "P0496",
    system: "emissions",
    severity: "low",
    title: { ar: "تدفق تنقية EVAP مرتفع", en: "EVAP flow during a non-purge condition" },
    meaning: { ar: "صمام التنقية يسمح بمرور الأبخرة في وقت غير مناسب.", en: "The purge valve flows vapour when it should be closed." },
    symptoms: { ar: ["صعوبة تشغيل بعد التزود بالوقود", "تباطؤ غير مستقر"], en: ["Hard start after refuelling", "Rough idle"] },
    causes: { ar: ["صمام Purge عالق مفتوح", "خرطوم متضرر"], en: ["Purge valve stuck open", "Damaged hose"] },
    fixes: { ar: ["استبدل صمام التنقية", "افحص الخراطيم"], en: ["Replace the purge valve", "Inspect hoses"] },
    models: ["Cruze", "Equinox", "Malibu"],
  },
  {
    code: "P0138",
    system: "emissions",
    severity: "low",
    title: { ar: "جهد حساس الأكسجين الخلفي مرتفع", en: "O2 sensor circuit high voltage (Bank 1, Sensor 2)" },
    meaning: { ar: "الحساس الخلفي يعطي جهداً مرتفعاً باستمرار.", en: "The downstream sensor holds an abnormally high voltage." },
    symptoms: { ar: ["لمبة فحص", "قد يرافقه P0420"], en: ["Check-engine light", "Often paired with P0420"] },
    causes: { ar: ["حساس تالف", "خليط غني", "قصر في الأسلاك"], en: ["Failed sensor", "Rich mixture", "Shorted wiring"] },
    fixes: { ar: ["افحص قراءة الحساس الحية", "افحص الأسلاك", "استبدل الحساس"], en: ["Watch live sensor data", "Inspect wiring", "Replace the sensor"] },
    models: ["Impala", "Silverado", "Trax"],
  },
  {
    code: "C0035",
    system: "chassis",
    severity: "medium",
    title: { ar: "دائرة حساس سرعة العجلة الأمامية اليسرى", en: "Left front wheel speed sensor circuit" },
    meaning: { ar: "وحدة ABS لا تتلقى إشارة سليمة من حساس العجلة.", en: "The ABS module is not receiving a valid wheel speed signal." },
    symptoms: { ar: ["لمبة ABS", "إطفاء نظام الثبات", "عداد السرعة غير دقيق"], en: ["ABS light", "Stability control disabled", "Inaccurate speedometer"] },
    causes: { ar: ["حساس متسخ أو تالف", "حلقة مسننة مكسورة", "أسلاك مقطوعة قرب العجلة", "رمان بلي بحساس مدمج"], en: ["Dirty or failed sensor", "Cracked tone ring", "Broken wiring near the wheel", "Hub bearing with integrated sensor"] },
    fixes: { ar: ["نظّف الحساس والحلقة المسننة", "افحص الأسلاك عند حركة المقود", "استبدل الرمان بلي بالحساس (شائع في GM)"], en: ["Clean the sensor and tone ring", "Flex the harness while watching data", "Replace the hub assembly with sensor (common on GM)"] },
    models: ["Silverado", "Tahoe", "Traverse", "Equinox"],
  },
  {
    code: "C0561",
    system: "chassis",
    severity: "medium",
    title: { ar: "نظام التحكم بالثبات معطّل", en: "System disabled information stored (Stability system)" },
    meaning: { ar: "نظام الثبات/الجر أُوقف بسبب عطل آخر مخزن.", en: "Stability/traction control was disabled because of another stored fault." },
    symptoms: { ar: ["لمبات StabiliTrak وTraction", "رسالة Service StabiliTrak"], en: ["StabiliTrak and traction lights", "Service StabiliTrak message"] },
    causes: { ar: ["حساس عجلة معطل", "حساس زاوية المقود غير معاير", "جهد بطارية منخفض", "مفتاح ضغط الفرامل"], en: ["Faulty wheel sensor", "Uncalibrated steering angle sensor", "Low battery voltage", "Brake pressure switch"] },
    fixes: { ar: ["اقرأ أكواد ABS ومعالجتها أولاً", "عاير حساس زاوية المقود", "افحص البطارية والدينامو"], en: ["Read and fix ABS codes first", "Calibrate the steering angle sensor", "Test battery and alternator"] },
    models: ["Silverado", "Malibu", "Acadia", "Yukon"],
  },
  {
    code: "B0080",
    system: "body",
    severity: "high",
    title: { ar: "عطل في دائرة وسادة هوائية / أنظمة الأمان", en: "Deployment loop / restraint system fault" },
    meaning: { ar: "وحدة الأمان رصدت خللاً في دائرة الوسائد الهوائية.", en: "The restraint module detected a fault in an airbag circuit." },
    symptoms: { ar: ["لمبة الوسادة الهوائية مضاءة", "تعطّل نظام الحماية"], en: ["Airbag light on", "Restraint system disabled"] },
    causes: { ar: ["كونكتور تحت المقعد مفصول", "مستشعر وزن الراكب", "ساعة زنبركية (Clock spring) تالفة"], en: ["Disconnected connector under the seat", "Passenger presence sensor", "Failed clock spring"] },
    fixes: { ar: ["افصل البطارية قبل العمل على نظام الوسائد", "افحص الكونكتورات أسفل المقاعد", "أعد معايرة مستشعر وزن الراكب"], en: ["Disconnect the battery before working on airbags", "Inspect connectors under the seats", "Recalibrate the passenger presence sensor"] },
    models: ["Silverado", "Malibu", "Tahoe"],
  },
  {
    code: "P0562",
    system: "electrical",
    severity: "medium",
    title: { ar: "جهد النظام منخفض", en: "System voltage low" },
    meaning: { ar: "جهد التغذية أقل من الحد المطلوب لتشغيل الوحدات.", en: "Supply voltage is below the level required by the modules." },
    symptoms: { ar: ["إضاءة خافتة", "صعوبة تشغيل", "أكواد متعددة عشوائية"], en: ["Dim lights", "Hard starting", "Multiple random codes"] },
    causes: { ar: ["دينامو ضعيف", "بطارية متهالكة", "سير مهترئ", "أطراف بطارية مؤكسدة"], en: ["Weak alternator", "Worn battery", "Slipping belt", "Corroded battery terminals"] },
    fixes: { ar: ["اختبر البطارية والدينامو تحت الحمل", "نظّف أطراف البطارية", "افحص سير المولد"], en: ["Load-test the battery and alternator", "Clean battery terminals", "Inspect the accessory belt"] },
    models: ["Silverado", "Impala", "Equinox"],
  },
  {
    code: "P0463",
    system: "electrical",
    severity: "low",
    title: { ar: "إشارة حساس مستوى الوقود مرتفعة", en: "Fuel level sensor circuit high input" },
    meaning: { ar: "قراءة عوامة الوقود غير منطقية.", en: "The fuel level sender reading is implausible." },
    symptoms: { ar: ["عداد وقود خاطئ", "لمبة فحص"], en: ["Incorrect fuel gauge", "Check-engine light"] },
    causes: { ar: ["عوامة/مرسل مستوى الوقود تالف", "أسلاك مقطوعة", "وحدة المضخة كاملة"], en: ["Failed level sender", "Broken wiring", "Complete pump module"] },
    fixes: { ar: ["افحص قراءة المستوى الحية", "افحص أسلاك وحدة المضخة", "استبدل المرسل"], en: ["Watch live level data", "Inspect pump module wiring", "Replace the sender"] },
    models: ["Silverado", "Suburban", "Impala"],
  },
  {
    code: "P2135",
    system: "engine",
    severity: "high",
    title: { ar: "عدم تطابق حساسي موضع الخانق A/B", en: "Throttle position sensor A/B voltage correlation" },
    meaning: { ar: "الحساسان داخل جسم الخانق لا يعطيان قراءات متوافقة.", en: "The two sensors inside the throttle body disagree." },
    symptoms: { ar: ["وضع الطوارئ فوراً", "دواسة بلا استجابة", "رسالة Reduced Engine Power"], en: ["Immediate limp mode", "Unresponsive pedal", "Reduced Engine Power message"] },
    causes: { ar: ["جسم خانق تالف", "كونكتور مؤكسد", "أسلاك مقطوعة"], en: ["Failed throttle body", "Corroded connector", "Broken wiring"] },
    fixes: { ar: ["افحص كونكتور الخانق", "راقب جهد الحساسين معاً", "استبدل جسم الخانق ثم نفّذ Relearn"], en: ["Inspect the throttle connector", "Watch both sensor voltages together", "Replace the throttle body then perform a relearn"] },
    models: ["Silverado", "Trailblazer", "Impala", "Colorado"],
  },
  {
    code: "P0449",
    system: "emissions",
    severity: "low",
    title: { ar: "دائرة صمام تهوية EVAP", en: "EVAP vent valve solenoid circuit" },
    meaning: { ar: "خلل كهربائي في صمام تهوية نظام الأبخرة.", en: "Electrical fault in the EVAP vent solenoid." },
    symptoms: { ar: ["لمبة فحص", "صعوبة تزويد الوقود"], en: ["Check-engine light", "Trouble refuelling"] },
    causes: { ar: ["صمام تهوية مؤكسد (شائع في البيك أب)", "أسلاك متضررة"], en: ["Corroded vent valve (common on trucks)", "Damaged wiring"] },
    fixes: { ar: ["استبدل صمام التهوية والفلتر المرافق", "افحص الأسلاك قرب الخزان"], en: ["Replace the vent valve and its filter", "Inspect wiring near the tank"] },
    models: ["Silverado", "Sierra", "Tahoe"],
  },
  {
    code: "P0053",
    system: "emissions",
    severity: "low",
    title: { ar: "مقاومة سخّان حساس الأكسجين", en: "HO2S heater resistance (Bank 1, Sensor 1)" },
    meaning: { ar: "مقاومة سخّان الحساس خارج المواصفة.", en: "Sensor heater resistance is out of specification." },
    symptoms: { ar: ["لمبة فحص", "استهلاك وقود أعلى"], en: ["Check-engine light", "Higher fuel use"] },
    causes: { ar: ["حساس متقادم", "دائرة تغذية ضعيفة"], en: ["Aged sensor", "Weak supply circuit"] },
    fixes: { ar: ["قِس مقاومة السخّان", "استبدل الحساس بقطعة أصلية GM"], en: ["Measure heater resistance", "Replace with a GM-spec sensor"] },
    models: ["Cruze", "Malibu", "Equinox"],
  },
  {
    code: "P0068",
    system: "fuel",
    severity: "medium",
    title: { ar: "عدم تطابق تدفق الهواء مع موضع الخانق", en: "MAP / MAF - throttle position correlation" },
    meaning: { ar: "بيانات الهواء لا تتوافق مع فتحة الخانق، غالباً تسريب هواء كبير.", en: "Air data does not match throttle opening, usually a large air leak." },
    symptoms: { ar: ["دوران عالٍ عند التباطؤ", "انطفاء", "ضعف عزم"], en: ["High idle", "Stalling", "Loss of torque"] },
    causes: { ar: ["تسريب في مجرى الهواء أو الشفط", "حساس MAP معطل", "خانق متسخ"], en: ["Intake or vacuum leak", "Failed MAP sensor", "Dirty throttle"] },
    fixes: { ar: ["افحص خراطيم الهواء والشفط", "قارن MAP مع الضغط الجوي عند التوقف", "نظّف الخانق"], en: ["Inspect intake and vacuum hoses", "Compare MAP to barometric pressure key-on", "Clean the throttle"] },
    models: ["Cruze 1.4T", "Malibu 2.0T", "Trax"],
  },
];

const seen = new Set<string>();
export const DTCS: Dtc[] = [...DTC_DATABASE, ...BRAND_DTCS].filter((d) => {
  if (!/^[PBCU][0-9A-F]{4}$/i.test(d.code) || seen.has(d.code)) return false;
  seen.add(d.code);
  return true;
});

/** Direct YouTube search link showing how to repair a given code. */
export function youtubeSearchUrl(code: string, lang: "ar" | "en", models: string[] = []) {
  const model = models[0] ?? "";
  const query =
    lang === "ar"
      ? `${code} ${model} شرح اصلاح عطل`
      : `${code} ${model} diagnose and fix`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
}

export function findDtc(code: string): Dtc | undefined {
  const normalized = code.trim().toUpperCase();
  return DTCS.find((d) => d.code === normalized);
}

export function guessSystem(code: string): SystemKey {
  const c = code.toUpperCase();
  if (c.startsWith("B")) return "body";
  if (c.startsWith("C")) return "chassis";
  if (c.startsWith("U")) return "network";
  const n = Number(c.slice(1, 3));
  if (n >= 30 && n < 40) return "ignition";
  if (n >= 1 && n < 3) return "fuel";
  if (n >= 4 && n < 5) return "emissions";
  if (n >= 7 && n < 8) return "transmission";
  return "engine";
}
