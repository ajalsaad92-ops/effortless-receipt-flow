import { createFileRoute, Link } from "@tanstack/react-router";
import { Bluetooth, Eraser, Keyboard, Loader2, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SeverityPill } from "@/components/SeverityPill";
import { findDtc } from "@/lib/dtc-data";
import { useScans, useVehicles } from "@/lib/garage";
import { useI18n } from "@/lib/i18n";
import { useObd } from "@/lib/obd-context";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "فحص السيارة — قراءة أكواد OBD2 لسيارات GM" },
      {
        name: "description",
        content: "اتصل بجهاز ELM327 عبر البلوتوث لقراءة ومسح أكواد الأعطال، أو أدخل الكود يدوياً للحصول على التشخيص.",
      },
      { property: "og:title", content: "فحص السيارة عبر OBD2" },
      { property: "og:description", content: "قراءة أكواد الأعطال من جهاز ELM327 أو إدخالها يدوياً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const { t, lang } = useI18n();
  const { status, supported, connect, disconnect, connection, deviceName } = useObd();
  const { addScan } = useScans();
  const { vehicles } = useVehicles();

  const [codes, setCodes] = useState<string[] | null>(null);
  const [source, setSource] = useState<"bluetooth" | "manual">("manual");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [confirmClear, setConfirmClear] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success(t("connected"));
    } catch (error) {
      const message = (error as Error).message;
      toast.error(message === "bluetooth-unsupported" ? t("bt_unsupported") : message);
    }
  };

  const handleRead = async () => {
    setBusy(true);
    try {
      const found = await connection.readTroubleCodes();
      setCodes(found);
      setSource("bluetooth");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      await connection.clearTroubleCodes();
      setCodes([]);
      toast.success(t("cleared_ok"));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  };

  const handleManual = () => {
    const entered = manual
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((c) => /^[PBCU][0-9A-F]{4}$/.test(c));
    if (entered.length === 0) {
      toast.error(t("manual_hint"));
      return;
    }
    setCodes(entered);
    setSource("manual");
  };

  const save = () => {
    if (!codes) return;
    addScan({ date: new Date().toISOString(), source, vehicleId: vehicleId || null, codes });
    toast.success(t("saved"));
  };

  return (
    <AppShell>
      <PageHeader title={t("nav_scan")} description={t("home_start_scan_d")} />

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bluetooth className="size-4 text-primary" />
            {t("bluetooth")}
          </div>

          {!supported ? (
            <p className="mt-3 rounded-2xl bg-warning/15 p-3 text-xs leading-relaxed text-warning-foreground">
              {t("bt_unsupported")}
            </p>
          ) : null}

          <p className="mt-3 text-xs text-muted-foreground">
            {status === "connected" ? `${t("connected")} · ${deviceName}` : t("disconnected")}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {status === "connected" ? (
              <>
                <button
                  onClick={handleRead}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {t("read_codes")}
                </button>
                <button
                  onClick={() => setConfirmClear(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm disabled:opacity-60"
                >
                  <Eraser className="size-4" />
                  {t("clear_codes")}
                </button>
                <button
                  onClick={disconnect}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-muted-foreground hover:text-destructive"
                >
                  {t("disconnect")}
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                disabled={status === "connecting"}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {status === "connecting" ? <Loader2 className="size-4 animate-spin" /> : <Bluetooth className="size-4" />}
                {status === "connecting" ? t("connecting") : t("connect")}
              </button>
            )}
          </div>

          {confirmClear ? (
            <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <p className="text-sm font-medium">{t("confirm_clear_title")}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("confirm_clear_body")}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleClear}
                  disabled={busy}
                  className="rounded-full bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground disabled:opacity-60"
                >
                  {t("confirm")}
                </button>
                <button onClick={() => setConfirmClear(false)} className="rounded-full border border-border px-4 py-2 text-xs">
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="size-4 text-primary" />
            {t("manual_entry")}
          </div>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManual()}
            placeholder={t("manual_hint")}
            className="mt-3 h-12 w-full rounded-2xl border border-border bg-background px-4 font-mono text-sm uppercase outline-none focus:border-primary"
          />
          <button
            onClick={handleManual}
            className="mt-3 w-full rounded-full bg-secondary px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            {t("lookup")}
          </button>
        </section>
      </div>

      {codes ? (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("results")}</h2>
            <div className="flex items-center gap-2">
              {vehicles.length > 0 ? (
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="h-9 rounded-full border border-border bg-card px-3 text-xs"
                >
                  <option value="">—</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nickname || v.model}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                onClick={save}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium hover:bg-secondary"
              >
                <Save className="size-3.5" />
                {t("save_to_history")}
              </button>
            </div>
          </div>

          {codes.length === 0 ? (
            <p className="rounded-3xl border border-success/40 bg-success/10 p-6 text-center text-sm font-medium text-success">
              {t("no_codes_found")}
            </p>
          ) : (
            <ul className="grid gap-2.5 md:grid-cols-2">
              {codes.map((code) => {
                const dtc = findDtc(code);
                return (
                  <li key={code}>
                    <Link
                      to="/codes/$code"
                      params={{ code }}
                      className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-semibold text-primary">{code}</span>
                        {dtc ? <SeverityPill severity={dtc.severity} /> : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">{dtc ? dtc.title[lang] : t("not_found")}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
