/**
 * The instrument vocabulary every screen is built from.
 *
 * Kept deliberately small — a panel, a readout, a lamp, a tab strip, a couple
 * of buttons. The old app had 46 unused shadcn components and hand-rolled
 * Tailwind on every page; this is the opposite bet.
 */
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel p-4 sm:p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelTitle({
  icon: Icon,
  children,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {Icon ? <Icon className="size-4 text-primary" /> : null}
        {children}
      </h2>
      {action}
    </div>
  );
}

/** A measured value. Monospaced, tabular, with its unit set quieter. */
export function Readout({
  label,
  value,
  unit,
  tone = "default",
  size = "md",
  hint,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  tone?: "default" | "ok" | "warn" | "bad" | "accent";
  size?: "sm" | "md" | "lg";
  hint?: string;
}) {
  const missing = value === null || value === undefined || value === "";
  return (
    <div>
      <p className="label-micro">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span
          className={cn(
            "font-mono font-semibold leading-none",
            size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl",
            missing && "text-muted-foreground",
            !missing && tone === "ok" && "text-success",
            !missing && tone === "warn" && "text-warning",
            !missing && tone === "bad" && "text-destructive",
            !missing && tone === "accent" && "text-primary",
          )}
        >
          {missing ? "—" : value}
        </span>
        {unit && !missing ? <span className="text-[11px] text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export type LampTone = "ok" | "warn" | "bad" | "idle" | "accent";

const LAMP_COLOR: Record<LampTone, string> = {
  ok: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
  accent: "text-primary",
  idle: "text-muted-foreground",
};

export function Lamp({ tone, live, className }: { tone: LampTone; live?: boolean; className?: string }) {
  return <span className={cn("lamp", LAMP_COLOR[tone], live && "lamp-live", className)} />;
}

export function StatusChip({
  tone,
  children,
  live,
}: {
  tone: LampTone;
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-medium",
        tone === "ok" && "border-success/30 bg-success/10 text-success",
        tone === "warn" && "border-warning/30 bg-warning/10 text-warning",
        tone === "bad" && "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "accent" && "border-primary/30 bg-primary/10 text-primary",
        tone === "idle" && "border-border bg-muted text-muted-foreground",
      )}
    >
      <Lamp tone={tone} live={live} />
      {children}
    </span>
  );
}

export function Button({
  variant = "ghost",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        variant === "primary" && "bg-primary text-primary-foreground hover:brightness-110",
        variant === "ghost" && "border border-border bg-elevated hover:bg-secondary",
        variant === "danger" && "border border-destructive/40 text-destructive hover:bg-destructive/10",
        className,
      )}
      {...rest}
    />
  );
}

/** Segmented tab strip. Used everywhere pages were merged together. */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; badge?: number }>;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 [scrollbar-width:none]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {option.label}
            {option.badge ? (
              <span
                className={cn(
                  "rounded px-1.5 font-mono text-[10px]",
                  active ? "bg-black/20" : "bg-secondary",
                )}
              >
                {option.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  type = "text",
  onKeyDown,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="block">
      {label ? <span className="label-micro">{label}</span> : null}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn(
          "mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm",
          "outline-none transition-colors focus:border-primary",
          mono && "font-mono uppercase",
        )}
      />
    </label>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** Horizontal bar used for sensor values with a known range. */
export function Bar({ pct, tone = "accent" }: { pct: number; tone?: LampTone }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-secondary">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tone === "ok" && "bg-success",
          tone === "warn" && "bg-warning",
          tone === "bad" && "bg-destructive",
          tone === "accent" && "bg-primary",
          tone === "idle" && "bg-muted-foreground",
        )}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}
