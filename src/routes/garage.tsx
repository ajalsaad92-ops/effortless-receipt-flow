import { createFileRoute } from "@tanstack/react-router";
import { Car, Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import {
  SERVICE_PLAN,
  serviceStatus,
  useServiceLogs,
  useVehicles,
  type ServiceItemKey,
  type Vehicle,
} from "@/lib/garage";

export const Route = createFileRoute("/garage")({
  head: () => ({
    meta: [
      { title: "المرآب — سياراتك وجدول الصيانة الدورية" },
      {
        name: "description",
        content: "أضف سيارات GM الخاصة بك وتابع مواعيد تغيير الزيت والبواجي والفرامل وزيت الجير حسب قراءة العداد.",
      },
      { property: "og:title", content: "المرآب وجدول الصيانة" },
      { property: "og:description", content: "تتبع الصيانة الدورية لسيارات جنرال موتورز حسب المسافة المقطوعة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GaragePage,
});

const EMPTY = { nickname: "", model: "", year: "", vin: "", odometer: 0 };

function GaragePage() {
  const { t, lang } = useI18n();
  const { vehicles, addVehicle, updateVehicle, removeVehicle } = useVehicles();
  const { logs, addLog } = useServiceLogs();
  const [form, setForm] = useState<Omit<Vehicle, "id">>(EMPTY);
  const [open, setOpen] = useState(false);

  const submit = () => {
    if (!form.model.trim()) {
      toast.error(t("model"));
      return;
    }
    addVehicle(form);
    setForm(EMPTY);
    setOpen(false);
    toast.success(t("saved"));
  };

  return (
    <AppShell>
      <PageHeader title={t("garage_title")} description={t("home_garage_d")} />

      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        <Plus className="size-4" />
        {t("add_vehicle")}
      </button>

      {open ? (
        <div className="mt-4 grid gap-3 rounded-3xl border border-border bg-card p-5 sm:grid-cols-2">
          <Field label={t("nickname")} value={form.nickname} onChange={(v) => setForm({ ...form, nickname: v })} />
          <Field label={t("model")} value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="Silverado 5.3L" />
          <Field label={t("year")} value={form.year} onChange={(v) => setForm({ ...form, year: v })} placeholder="2018" />
          <Field label={t("vin")} value={form.vin} onChange={(v) => setForm({ ...form, vin: v })} />
          <Field
            label={t("odometer")}
            value={String(form.odometer || "")}
            onChange={(v) => setForm({ ...form, odometer: Number(v) || 0 })}
          />
          <div className="flex items-end gap-2">
            <button onClick={submit} className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
              {t("save")}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2.5 text-sm text-muted-foreground">
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {vehicles.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t("no_vehicles")}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {vehicles.map((vehicle) => (
            <article key={vehicle.id} className="rounded-3xl border border-border bg-card p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-secondary">
                    <Car className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold">{vehicle.nickname || vehicle.model}</h2>
                    <p className="text-xs text-muted-foreground">
                      {[vehicle.model, vehicle.year, vehicle.vin].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    {t("odometer")}
                    <input
                      type="number"
                      value={vehicle.odometer}
                      onChange={(e) => updateVehicle(vehicle.id, { odometer: Number(e.target.value) || 0 })}
                      className="h-9 w-28 rounded-xl border border-border bg-background px-3 text-sm tabular-nums text-foreground"
                    />
                  </label>
                  <button
                    onClick={() => removeVehicle(vehicle.id)}
                    className="grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </header>

              <h3 className="mb-2 mt-5 text-sm font-semibold text-muted-foreground">{t("maintenance")}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(SERVICE_PLAN) as ServiceItemKey[]).map((item) => {
                  const s = serviceStatus(vehicle, logs, item);
                  const pct = Math.min(100, Math.max(0, ((s.plan.intervalKm - s.remaining) / s.plan.intervalKm) * 100));
                  return (
                    <li key={item} className="rounded-2xl border border-border/70 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{s.plan[lang]}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            s.due ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
                          }`}
                        >
                          {s.due ? t("due_now") : `${t("due_in")} ${s.remaining.toLocaleString()} ${t("km")}`}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${s.due ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <button
                        onClick={() => {
                          addLog({ vehicleId: vehicle.id, item, odometer: vehicle.odometer, date: new Date().toISOString() });
                          toast.success(t("saved"));
                        }}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Check className="size-3.5" />
                        {t("log_service")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}
