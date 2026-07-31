import { useCallback, useEffect, useState } from "react";

export type Vehicle = {
  id: string;
  nickname: string;
  model: string;
  year: string;
  vin: string;
  odometer: number;
};

export type ServiceItemKey = "oil" | "airFilter" | "plugs" | "brakes" | "transmission" | "coolant";

export const SERVICE_PLAN: Record<ServiceItemKey, { intervalKm: number; ar: string; en: string }> = {
  oil: { intervalKm: 8000, ar: "تغيير زيت المحرك والفلتر", en: "Engine oil & filter change" },
  airFilter: { intervalKm: 20000, ar: "فلتر الهواء", en: "Air filter" },
  plugs: { intervalKm: 100000, ar: "البواجي", en: "Spark plugs" },
  brakes: { intervalKm: 30000, ar: "فحص الفرامل", en: "Brake inspection" },
  transmission: { intervalKm: 80000, ar: "زيت ناقل الحركة", en: "Transmission fluid" },
  coolant: { intervalKm: 90000, ar: "سائل التبريد", en: "Coolant flush" },
};

export type ServiceLog = { id: string; vehicleId: string; item: ServiceItemKey; odometer: number; date: string };

export type ScanRecord = {
  id: string;
  date: string;
  source: "bluetooth" | "manual";
  vehicleId: string | null;
  codes: string[];
};

const KEYS = {
  vehicles: "gmobd.vehicles",
  logs: "gmobd.servicelogs",
  scans: "gmobd.scans",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("gmobd:storage", { detail: key }));
}

function useLocalCollection<T>(key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(read<T[]>(key, []));
    setReady(true);
    const sync = () => setItems(read<T[]>(key, []));
    window.addEventListener("gmobd:storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gmobd:storage", sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  const save = useCallback(
    (next: T[]) => {
      setItems(next);
      write(key, next);
    },
    [key],
  );

  return { items, ready, save };
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useVehicles() {
  const { items, ready, save } = useLocalCollection<Vehicle>(KEYS.vehicles);
  return {
    vehicles: items,
    ready,
    addVehicle: (v: Omit<Vehicle, "id">) => save([...items, { ...v, id: newId() }]),
    updateVehicle: (id: string, patch: Partial<Vehicle>) =>
      save(items.map((v) => (v.id === id ? { ...v, ...patch } : v))),
    removeVehicle: (id: string) => save(items.filter((v) => v.id !== id)),
  };
}

export function useServiceLogs() {
  const { items, ready, save } = useLocalCollection<ServiceLog>(KEYS.logs);
  return {
    logs: items,
    ready,
    addLog: (log: Omit<ServiceLog, "id">) => save([{ ...log, id: newId() }, ...items]),
    removeLog: (id: string) => save(items.filter((l) => l.id !== id)),
  };
}

export function useScans() {
  const { items, ready, save } = useLocalCollection<ScanRecord>(KEYS.scans);
  return {
    scans: items,
    ready,
    addScan: (scan: Omit<ScanRecord, "id">) => save([{ ...scan, id: newId() }, ...items].slice(0, 50)),
    clearScans: () => save([]),
  };
}

export function serviceStatus(vehicle: Vehicle, logs: ServiceLog[], item: ServiceItemKey) {
  const plan = SERVICE_PLAN[item];
  const last = logs
    .filter((l) => l.vehicleId === vehicle.id && l.item === item)
    .sort((a, b) => b.odometer - a.odometer)[0];
  const lastOdo = last?.odometer ?? 0;
  const nextDue = lastOdo + plan.intervalKm;
  const remaining = nextDue - vehicle.odometer;
  return { plan, lastOdo, nextDue, remaining, due: remaining <= 0 };
}
