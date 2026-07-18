import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import DarkVeil from "@/components/DarkVeil";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAllowedEmailDomain } from "@/lib/app-settings.functions";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({ meta: [{ title: "Sign in — Expense It" }] }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const { user, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const fetchHd = useServerFn(getAllowedEmailDomain);
  const { data: hdData } = useQuery({
    queryKey: ["allowed-email-domain"],
    queryFn: () => fetchHd(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (ready && user) {
      nav({ to: "/dashboard", replace: true });
    }
  }, [nav, ready, user]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    nav({ to: "/dashboard", replace: true });
  }

  async function handleGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    const hd = hdData?.domain ?? undefined;
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
      ...(hd ? { extraParams: { hd } } : {}),
    });
    if (r.error) {
      toast.error(r.error.message);
      setGoogleLoading(false);
      return;
    }
    if (r.redirected) {
      return; // browser navigates away
    }
    // Tokens returned inline (rare path) — onAuthStateChange will redirect.
  }

  if (!ready) {
    return (
      <div className="dark min-h-app bg-background text-foreground grid place-items-center px-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Restoring your session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dark relative min-h-app overflow-hidden bg-background text-foreground">
      {/* Animated DarkVeil background — hue-shifted to brand green. Fixed so it
          extends behind iOS status bar / home indicator safe areas. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <DarkVeil
          hueShift={140}
          noiseIntensity={0}
          scanlineIntensity={0}
          speed={0.4}
          scanlineFrequency={0}
          warpAmount={0}
          resolutionScale={1}
        />
        {/* fade veil — vertical on mobile, horizontal on desktop so the form panel stays readable */}
        <div
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--background) / 0) 0%, hsl(var(--background) / 0.1) 30%, hsl(var(--background) / 0.55) 60%, hsl(var(--background) / 0.9) 88%, hsl(var(--background)) 100%)",
          }}
        />
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--background) / 0) 0%, hsl(var(--background) / 0.05) 35%, hsl(var(--background) / 0.6) 60%, hsl(var(--background) / 0.95) 80%, hsl(var(--background)) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 min-h-app grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT — hero / wordmark */}
        <div className="flex flex-col justify-end md:justify-center px-6 pt-20 md:p-12 lg:p-20 xl:p-28">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="max-w-md"
          >
            <h1 className="uppercase tracking-tight leading-[0.95] text-white whitespace-nowrap drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)] text-5xl font-normal md:text-[clamp(4.5rem,10vw,9.5rem)] md:font-black md:leading-[0.88] md:whitespace-normal">
              Expense<span className="md:hidden"> </span><span className="hidden md:inline"><br /></span>it
            </h1>
            <p className="mt-3 md:mt-6 text-sm md:text-lg font-semibold text-white/80 tracking-wide whitespace-nowrap">
              Snap a receipt. Get reimbursed.
            </p>
          </motion.div>
        </div>

        {/* RIGHT — auth panel */}
        <div className="flex flex-col justify-center px-6 pb-10 pt-2 md:p-12 lg:p-16">
          <div className="w-full max-w-md md:ml-auto md:rounded-3xl md:bg-white/[0.04] md:backdrop-blur-2xl md:ring-1 md:ring-white/10 md:p-10 md:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
            <form onSubmit={handleEmail} className="space-y-7">
        <div className="group">
          <label className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.14em]">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent outline-none text-base font-medium text-white placeholder:text-white/30 mt-2 pb-2 border-b border-white/15 focus:border-primary transition-colors"
            placeholder="you@company.com" />
        </div>
        <div className="group">
          <label className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.14em]">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent outline-none text-base font-medium text-white placeholder:text-white/30 mt-2 pb-2 border-b border-white/15 focus:border-primary transition-colors"
            placeholder="••••••••" />
        </div>
        <div className="flex justify-end -mt-3">
          <Link to="/forgot-password" className="text-xs font-medium text-white/60 hover:text-white transition-colors">
            Forgot password?
          </Link>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} disabled={loading} type="submit"
          className="relative w-full rounded-2xl py-4 text-sm font-semibold text-primary-foreground overflow-hidden bg-primary ring-1 ring-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_12px_30px_-8px_hsl(var(--primary)/0.55)] disabled:opacity-50">
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/25 via-transparent to-black/20" />
          <span className="relative">
          {loading ? "Signing in…" : "Sign in"}
          </span>
        </motion.button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-white/50">
              <div className="h-px bg-white/15 flex-1" /><span>or</span><div className="h-px bg-white/15 flex-1" />
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={handleGoogle} disabled={googleLoading} type="button"
              className="w-full rounded-2xl py-4 text-sm font-semibold text-white flex items-center justify-center gap-3 bg-white/[0.06] backdrop-blur-2xl ring-1 ring-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_10px_30px_-12px_rgba(0,0,0,0.5)] transition-all hover:bg-white/[0.1] disabled:opacity-60">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 7 29.5 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 43c5.4 0 10.3-2.1 14-5.4l-6.5-5.3c-2 1.4-4.6 2.2-7.5 2.2-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 38.6 16.2 43 24 43z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.3c-.5.4 7-5.1 7-15 0-1.2-.1-2.4-.4-3.5z"/></svg>
              {googleLoading ? "Opening Google…" : "Continue with Google"}
            </motion.button>

            <p className="text-center text-xs text-white/50 pt-10 leading-relaxed">
              Accounts are provisioned by your admin.<br />
              Need access? <Link to="/forgot-password" className="text-primary font-semibold">Reset password</Link> or contact them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
