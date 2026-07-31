import type { LiveReading } from "./obd";

export type Finding = {
  id: string;
  level: "ok" | "warn" | "bad";
  ar: string;
  en: string;
  /** what the app expected to see */
  expectedAr: string;
  expectedEn: string;
};

type Rule = (r: LiveReading) => Finding | null;

const f = (
  id: string,
  level: Finding["level"],
  ar: string,
  en: string,
  expectedAr: string,
  expectedEn: string,
): Finding => ({ id, level, ar, en, expectedAr, expectedEn });

const RULES: Rule[] = [
  // ── Idle behaviour ──────────────────────────────────────────
  (r) => {
    if (r.speed > 3 || r.throttle > 8) return null;
    if (r.rpm > 1250)
      return f(
        "idle-high",
        "bad",
        "دوران التباطؤ مرتفع بدون ضغط على الدواسة — غالباً تسريب هواء، خانق متسخ، أو حساس موضع خانق.",
        "Idle RPM is high with the pedal released — likely a vacuum leak, dirty throttle body, or TPS fault.",
        "المتوقع 600–950 لفة عند التباطؤ",
        "Expected 600–950 rpm at idle",
      );
    if (r.rpm > 0 && r.rpm < 550)
      return f(
        "idle-low",
        "bad",
        "دوران التباطؤ منخفض جداً وقد يؤدي لانطفاء المحرك — نظّف الخانق وافحص صمام IAC/PCV والبخاخات.",
        "Idle RPM is too low and the engine may stall — clean the throttle, check IAC/PCV and injectors.",
        "المتوقع 600–950 لفة عند التباطؤ",
        "Expected 600–950 rpm at idle",
      );
    if (r.rpm >= 550 && r.rpm <= 1250)
      return f("idle-ok", "ok", "دوران التباطؤ ضمن المعدل الطبيعي.", "Idle RPM is within the normal range.", "600–950 لفة", "600–950 rpm");
    return null;
  },

  // ── Load vs RPM correlation ─────────────────────────────────
  (r) => {
    if (r.rpm < 500) return null;
    if (r.speed < 3 && r.throttle < 8) {
      if (r.load > 45)
        return f(
          "load-idle-high",
          "bad",
          "حمل المحرك مرتفع رغم التباطؤ — احتراق ناقص، مكيّف محمّل، أو عادم مسدود (كاتلست).",
          "Engine load is high at idle — misfire, heavy A/C load, or a restricted exhaust/catalyst.",
          "المتوقع 15–35% حمل عند التباطؤ",
          "Expected 15–35% load at idle",
        );
      return f("load-idle-ok", "ok", "حمل المحرك عند التباطؤ طبيعي.", "Engine load at idle is normal.", "15–35%", "15–35%");
    }
    if (r.throttle > 45 && r.load < 40)
      return f(
        "load-low-wot",
        "bad",
        "الدواسة مضغوطة بقوة لكن الحمل منخفض — فلتر هواء مسدود، حساس هواء MAF متسخ، أو ضعف ضغط وقود.",
        "Throttle is wide but load is low — clogged air filter, dirty MAF, or weak fuel pressure.",
        "المتوقع حمل > 60% عند فتح خانق كبير",
        "Expected load > 60% at large throttle openings",
      );
    return null;
  },

  // ── RPM ↔ speed (gearing / slipping) ────────────────────────
  (r) => {
    if (r.speed < 15 || r.rpm < 800) return null;
    const ratio = r.rpm / r.speed;
    if (ratio > 90)
      return f(
        "gear-slip",
        "bad",
        `نسبة الدوران للسرعة عالية جداً (${Math.round(ratio)}) — احتمال انزلاق ناقل الحركة أو زيت ناقل متدهور.`,
        `RPM-to-speed ratio is very high (${Math.round(ratio)}) — possible transmission slip or degraded fluid.`,
        "المتوقع 25–70 لفة لكل كم/س حسب الغيار",
        "Expected 25–70 rpm per km/h depending on gear",
      );
    if (ratio < 18)
      return f(
        "gear-low",
        "warn",
        "نسبة الدوران للسرعة منخفضة جداً — تأكد من صحة إشارة حساس السرعة.",
        "RPM-to-speed ratio is unusually low — verify the vehicle speed sensor signal.",
        "المتوقع 25–70 لفة لكل كم/س",
        "Expected 25–70 rpm per km/h",
      );
    return f(
      "gear-ok",
      "ok",
      "نسبة الدوران إلى السرعة سليمة — ناقل الحركة يعمل ضمن المتوقع.",
      "RPM-to-speed ratio looks healthy — the transmission is behaving as expected.",
      "25–70 لفة لكل كم/س",
      "25–70 rpm per km/h",
    );
  },

  // ── Coolant temperature ─────────────────────────────────────
  (r) => {
    if (r.coolant >= 110)
      return f(
        "coolant-hot",
        "bad",
        "حرارة الماء مرتفعة خطرة — أوقف المحرك. افحص المروحة الكهربائية وريلاي المروحة والثرموستات ومستوى الماء.",
        "Coolant temperature is dangerously high — stop the engine. Check the electric fan, fan relay, thermostat and coolant level.",
        "المتوقع 85–105°م بعد التسخين",
        "Expected 85–105 °C once warm",
      );
    if (r.coolant >= 105)
      return f(
        "coolant-warm",
        "warn",
        "الحرارة أعلى من المعتاد — يجب أن تكون المروحة تعمل الآن؛ إن لم تدر فافحص الريلاي والفيوز وحساس ECT.",
        "Temperature above normal — the fan should be running now; if not, check the relay, fuse and ECT sensor.",
        "المتوقع 85–105°م",
        "Expected 85–105 °C",
      );
    if (r.coolant > 0 && r.coolant < 70 && r.rpm > 500)
      return f(
        "coolant-cold",
        "warn",
        "المحرك لا يصل لحرارة التشغيل — ثرموستات عالق مفتوح، ما يزيد استهلاك الوقود.",
        "Engine is not reaching operating temperature — thermostat stuck open, which raises fuel consumption.",
        "المتوقع 85–105°م بعد بضع دقائق",
        "Expected 85–105 °C after a few minutes",
      );
    if (r.coolant >= 85)
      return f("coolant-ok", "ok", "حرارة الماء ضمن المدى الطبيعي.", "Coolant temperature is in the normal range.", "85–105°م", "85–105 °C");
    return null;
  },

  // ── Intake air temperature ──────────────────────────────────
  (r) => {
    if (r.intake >= 70)
      return f(
        "iat-high",
        "warn",
        "حرارة هواء الشفط عالية جداً — عزل ردياتير الهواء ضعيف أو الحساس معطل، ويسبب فقد قدرة.",
        "Intake air temperature is very high — poor intake heat isolation or a failing sensor; causes power loss.",
        "المتوقع حرارة الجو + 10–20°م",
        "Expected ambient + 10–20 °C",
      );
    return null;
  },

  // ── Charging system ─────────────────────────────────────────
  (r) => {
    if (r.rpm < 500) return null;
    if (r.voltage < 13.0)
      return f(
        "volt-low",
        "bad",
        "جهد الشحن منخفض — الدينامو أو منظّم الجهد أو سير الدينامو أو أطراف البطارية.",
        "Charging voltage is low — alternator, voltage regulator, belt, or battery terminals.",
        "المتوقع 13.5–14.7 فولت والمحرك يعمل",
        "Expected 13.5–14.7 V with the engine running",
      );
    if (r.voltage > 15.0)
      return f(
        "volt-high",
        "bad",
        "جهد الشحن مرتفع — منظّم جهد تالف وقد يتلف البطارية والحساسات.",
        "Charging voltage is too high — faulty regulator that can damage the battery and sensors.",
        "المتوقع 13.5–14.7 فولت",
        "Expected 13.5–14.7 V",
      );
    return f("volt-ok", "ok", "نظام الشحن سليم.", "Charging system looks healthy.", "13.5–14.7 فولت", "13.5–14.7 V");
  },

  // ── Throttle plausibility ───────────────────────────────────
  (r) => {
    if (r.throttle > 20 && r.rpm < 900 && r.speed < 5)
      return f(
        "tps-mismatch",
        "bad",
        "الخانق مفتوح لكن الدوران لم يرتفع — عطل في حساس الخانق أو الخانق الكهربائي أو نقص وقود.",
        "Throttle is open but RPM did not rise — throttle position sensor, electronic throttle body, or fuel delivery fault.",
        "فتح الخانق يجب أن يرفع الدوران فوراً",
        "Opening the throttle should raise RPM immediately",
      );
    return null;
  },
];

export function analyzeReading(reading: LiveReading | null): Finding[] {
  if (!reading) return [];
  return RULES.map((rule) => rule(reading)).filter((x): x is Finding => x !== null);
}

/** Findings that persisted across the last N samples — reduces false alarms. */
export function analyzeTrend(samples: LiveReading[], window = 5): Finding[] {
  const recent = samples.slice(-window);
  if (recent.length === 0) return [];
  const perSample = recent.map((s) => analyzeReading(s));
  const counts = new Map<string, { finding: Finding; n: number }>();
  for (const list of perSample) {
    for (const finding of list) {
      const entry = counts.get(finding.id);
      if (entry) entry.n += 1;
      else counts.set(finding.id, { finding, n: 1 });
    }
  }
  const threshold = Math.max(1, Math.ceil(recent.length * 0.6));
  return [...counts.values()]
    .filter((e) => e.n >= threshold)
    .map((e) => e.finding)
    .sort((a, b) => order(a.level) - order(b.level));
}

const order = (l: Finding["level"]) => (l === "bad" ? 0 : l === "warn" ? 1 : 2);
