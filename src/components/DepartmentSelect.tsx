import { useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DepartmentSelect({
  value,
  onChange,
  options,
  placeholder = "Optional",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const term = q.trim();
  const filtered = options.filter((o) => o.toLowerCase().includes(term.toLowerCase()));
  const showCreate = term && !options.some((o) => o.toLowerCase() === term.toLowerCase());

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className={value ? "" : "text-muted-foreground"}>{value || placeholder}</span>
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-[var(--radix-popover-trigger-width)] min-w-[14rem]" align="start">
        <div className="relative mb-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search or add…"
            className="w-full rounded-lg bg-muted pl-8 pr-3 py-2 text-sm outline-none"
          />
        </div>
        <div className="max-h-56 overflow-y-auto -mr-1 pr-1">
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-muted text-left text-muted-foreground"
            >
              Clear
            </button>
          )}
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false); setQ(""); }}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-muted text-left ${value === o ? "bg-muted" : ""}`}
            >
              <span className="flex-1 truncate">{o}</span>
              {value === o && <Check className="size-3.5" />}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onClick={() => { onChange(term); setOpen(false); setQ(""); }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-muted text-left text-primary"
            >
              <Plus className="size-3.5" /> Add "{term}"
            </button>
          )}
          {!showCreate && filtered.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">No departments yet</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}