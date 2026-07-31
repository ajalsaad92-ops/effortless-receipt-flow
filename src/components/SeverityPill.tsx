import type { Severity } from "@/lib/dtc-data";
import { useI18n } from "@/lib/i18n";

const STYLES: Record<Severity, string> = {
  low: "border-success/30 bg-success/10 text-success",
  medium: "border-warning/30 bg-warning/10 text-warning",
  high: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function SeverityPill({ severity }: { severity: Severity }) {
  const { t } = useI18n();
  const label = severity === "low" ? t("sev_low") : severity === "medium" ? t("sev_medium") : t("sev_high");
  return (
    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${STYLES[severity]}`}>{label}</span>
  );
}
