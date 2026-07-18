import { useEffect, useState } from "react";

const KEY = "sidenav-persona";
const EVENT = "persona-change";
export type Persona = "personal" | "admin";

function read(): Persona {
  if (typeof window === "undefined") return "personal";
  try {
    const v = localStorage.getItem(KEY);
    return v === "admin" ? "admin" : "personal";
  } catch { return "personal"; }
}

export function setPersona(p: Persona) {
  try { localStorage.setItem(KEY, p); } catch {/* ignore */}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: p }));
  }
}

export function usePersona(): Persona {
  const [persona, set] = useState<Persona>("personal");
  useEffect(() => {
    set(read());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Persona>).detail;
      if (detail === "admin" || detail === "personal") set(detail);
      else set(read());
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return persona;
}