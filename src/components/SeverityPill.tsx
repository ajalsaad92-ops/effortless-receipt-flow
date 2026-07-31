import type { Severity } from "@/lib/dtc-data";
import { useI18n } from "@/lib/i18n";

const STYLES: Record<Severity, string> = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/20 text-warning-foreground",
  high: "bg-destructive/15 text-destructive",
};

export function SeverityPill({ severity }: { severity: Severity }) {
  const { t } = useI18n();
  const label = severity === "low" ? t("sev_low") : severity === "medium" ? t("sev_medium") : t("sev_high");
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${STYLES[severity]}`}>{label}</span>;
}
