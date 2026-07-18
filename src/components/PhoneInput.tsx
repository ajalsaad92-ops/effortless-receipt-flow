import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRIES, findCountry } from "@/lib/countries";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function PhoneInput({
  phone,
  country,
  onPhoneChange,
  onCountryChange,
  placeholder = "555 123 4567",
}: {
  phone: string;
  country: string;
  onPhoneChange: (v: string) => void;
  onCountryChange: (code: string) => void;
  placeholder?: string;
}) {
  const c = findCountry(country);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = COUNTRIES.filter((x) =>
    `${x.name} ${x.dial} ${x.code}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="flex items-center gap-2 rounded-md border border-input bg-transparent pr-3 h-9 shadow-sm focus-within:ring-1 focus-within:ring-ring">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 h-full border-r border-input text-sm font-medium hover:bg-muted/50 rounded-l-md"
          >
            <span className="text-base leading-none">{c.flag}</span>
            <span className="tabular-nums text-muted-foreground">{c.dial}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-2 w-[min(20rem,calc(100vw-2rem))]" align="start">
          <div className="relative mb-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search country…"
              className="w-full rounded-lg bg-muted pl-8 pr-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto -mr-1 pr-1">
            {filtered.map((x) => (
              <button
                key={x.code}
                type="button"
                onClick={() => { onCountryChange(x.code); setOpen(false); setQ(""); }}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-muted text-left ${country === x.code ? "bg-muted" : ""}`}
              >
                <span className="text-base">{x.flag}</span>
                <span className="flex-1 truncate">{x.name}</span>
                <span className="text-muted-foreground tabular-nums">{x.dial}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">No matches</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <input
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-base md:text-sm"
      />
    </div>
  );
}