/**
 * Full-vehicle scan: identity (VIN/CALID/ECU), readiness, DTCs across modes,
 * supported PID discovery with decoded values, and control-module presence.
 * The result is stored locally and turned into a compact briefing that the AI
 * assistant receives, so answers are specific to the actual car on the cable.
 */
import { useCallback, useEffect, useState } from "react";
import type { ObdConnection } from "./obd";
import { PID_MAP } from "./pids";
import { decodeVin, describeVin, type VinInfo } from "./vin";
import { findDtc } from "./dtc-data";

export type SensorSample = { pid: string; ar: string; en: string; unit: string; value: number };

export type VehicleReport = {
  at: string;
  vin: string | null;
  vinInfo: VinInfo | null;
  calId: string | null;
  cvn: string | null;
  ecuName: string | null;
  protocol: string | null;
  voltage: number | null;
  mil: boolean | null;
  dtcCount: number | null;
  stored: string[];
  pending: string[];
  permanent: string[];
  supportedPids: string[];
  sensors: SensorSample[];
  modules: Array<{ header: string; ar: string; en: string; online: boolean }>;
};

const REPORT_KEY = "gmobd.report";

export type ScanStep = { id: string; ar: string; en: string };

export const SCAN_STEPS: ScanStep[] = [
  { id: "adapter", ar: "قراءة معلومات الجهاز والبروتوكول", en: "Reading adapter info and protocol" },
  { id: "identity", ar: "تعريف السيارة (VIN وبرمجة الكمبيوتر)", en: "Identifying the vehicle (VIN and ECU calibration)" },
  { id: "dtc", ar: "قراءة الأعطال المخزنة والمعلقة والدائمة", en: "Reading stored, pending and permanent codes" },
  { id: "pids", ar: "اكتشاف الحساسات المدعومة", en: "Discovering supported sensors" },
  { id: "values", ar: "قراءة قيم الحساسات", en: "Reading sensor values" },
  { id: "modules", ar: "فحص وحدات التحكم على الشبكة", en: "Scanning control modules on the bus" },
];

export function loadReport(): VehicleReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REPORT_KEY);
    return raw ? (JSON.parse(raw) as VehicleReport) : null;
  } catch {
    return null;
  }
}

export function saveReport(report: VehicleReport) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  window.dispatchEvent(new CustomEvent("gmobd:report"));
}

export function useVehicleReport() {
  const [report, setReport] = useState<VehicleReport | null>(null);

  useEffect(() => {
    setReport(loadReport());
    const sync = () => setReport(loadReport());
    window.addEventListener("gmobd:report", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gmobd:report", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const store = useCallback((next: VehicleReport) => {
    setReport(next);
    saveReport(next);
  }, []);

  return { report, store };
}

export const REPORT_MODULES = [
  { header: "7E0", ar: "كمبيوتر المحرك ECM", en: "Engine control (ECM)" },
  { header: "7E1", ar: "ناقل الحركة TCM", en: "Transmission (TCM)" },
  { header: "760", ar: "الفرامل ABS / EBCM", en: "Brakes / ABS (EBCM)" },
  { header: "7A0", ar: "وسائد الهواء SRS", en: "Airbags (SRS)" },
  { header: "740", ar: "لوحة العدادات IPC", en: "Instrument cluster (IPC)" },
  { header: "744", ar: "التكييف HVAC", en: "Climate (HVAC)" },
  { header: "750", ar: "وحدة الجسم BCM", en: "Body control (BCM)" },
  { header: "720", ar: "الدركسون الكهربائي EPS", en: "Power steering (EPS)" },
  { header: "770", ar: "وحدة الاتصالات / OnStar", en: "Telematics / OnStar" },
];

/** Run the complete scan sequence, reporting progress step by step. */
export async function runFullScan(
  connection: ObdConnection,
  onStep: (stepId: string) => void,
  options: { modules?: boolean } = {},
): Promise<VehicleReport> {
  const report: VehicleReport = {
    at: new Date().toISOString(),
    vin: null,
    vinInfo: null,
    calId: null,
    cvn: null,
    ecuName: null,
    protocol: null,
    voltage: null,
    mil: null,
    dtcCount: null,
    stored: [],
    pending: [],
    permanent: [],
    supportedPids: [],
    sensors: [],
    modules: [],
  };

  onStep("adapter");
  const adapter = await connection.readAdapterInfo();
  report.protocol = adapter.protocol;
  report.voltage = adapter.voltage;

  onStep("identity");
  try {
    report.vin = await connection.readVin();
  } catch {
    /* ignore */
  }
  if (report.vin) report.vinInfo = decodeVin(report.vin);
  report.calId = await connection.readMode09Text("04");
  report.cvn = await connection.readMode09Text("06");
  report.ecuName = await connection.readMode09Text("0A");

  onStep("dtc");
  const status = await connection.readMilStatus();
  report.mil = status?.mil ?? null;
  report.dtcCount = status?.count ?? null;
  const dtcs = await connection.readTroubleCodesByMode();
  Object.assign(report, dtcs);

  onStep("pids");
  try {
    report.supportedPids = await connection.readSupportedPids(["00", "20", "40", "60", "80"]);
  } catch {
    /* ignore */
  }

  onStep("values");
  for (const pid of report.supportedPids) {
    const def = PID_MAP.get(pid);
    if (!def) continue;
    try {
      const bytes = await connection.readPid(pid);
      if (!bytes || bytes.length === 0) continue;
      const value = def.decode(bytes);
      if (value === null || Number.isNaN(value)) continue;
      report.sensors.push({ pid, ar: def.ar, en: def.en, unit: def.unit, value });
    } catch {
      /* skip this sensor */
    }
  }

  if (options.modules !== false) {
    onStep("modules");
    try {
      const found = await connection.discoverEcus(REPORT_MODULES);
      report.modules = found.map(({ header, ar, en, online }) => ({ header, ar, en, online }));
    } catch {
      /* ignore */
    }
  }

  return report;
}

/** Compact, model-specific briefing handed to the AI assistant with every chat. */
export function reportToPrompt(report: VehicleReport | null, lang: "ar" | "en"): string | null {
  if (!report) return null;
  const lines: string[] = [];
  const info = report.vinInfo;
  lines.push(`VIN: ${report.vin ?? "unknown"}`);
  if (info) {
    lines.push(`Vehicle: ${describeVin(info, "en")}`);
    if (info.division) lines.push(`Division: ${info.division}`);
    if (info.engine) lines.push(`Engine (from VIN position 8): ${info.engine}`);
    if (info.year) lines.push(`Model year: ${info.year}`);
  }
  if (report.ecuName) lines.push(`ECU name: ${report.ecuName}`);
  if (report.calId) lines.push(`Calibration ID: ${report.calId}`);
  if (report.protocol) lines.push(`OBD protocol: ${report.protocol}`);
  if (report.voltage !== null) lines.push(`Battery voltage: ${report.voltage} V`);
  if (report.mil !== null) lines.push(`MIL lamp: ${report.mil ? "ON" : "off"} (${report.dtcCount ?? 0} stored)`);

  const codeLine = (list: string[]) =>
    list.length === 0
      ? "none"
      : list
          .map((code) => {
            const dtc = findDtc(code);
            return dtc ? `${code} (${dtc.title.en})` : code;
          })
          .join(", ");
  lines.push(`Stored DTCs: ${codeLine(report.stored)}`);
  lines.push(`Pending DTCs: ${codeLine(report.pending)}`);
  lines.push(`Permanent DTCs: ${codeLine(report.permanent)}`);

  if (report.sensors.length) {
    lines.push(
      `Live sensor snapshot: ${report.sensors.map((s) => `${s.en}=${s.value}${s.unit}`).join(", ")}`,
    );
  }
  const online = report.modules.filter((m) => m.online).map((m) => m.en);
  if (online.length) lines.push(`Modules answering on the bus: ${online.join(", ")}`);
  lines.push(`Scan time: ${report.at}`);
  lines.push(`Answer language: ${lang === "ar" ? "Arabic" : "English"}`);
  return lines.join("\n");
}

export function reportToText(report: VehicleReport, lang: "ar" | "en") {
  const head = lang === "ar" ? "تقرير الفحص الكامل" : "Full vehicle scan report";
  return `${head}\n\n${reportToPrompt(report, lang)}`;
}