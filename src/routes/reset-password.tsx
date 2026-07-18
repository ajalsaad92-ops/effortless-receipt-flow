import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Expense It" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user lands via the recovery link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // Give the URL hash a brief moment to be processed
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (!d2.session) setInvalid(true);
          });
        }, 1200);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setDone(true);
    setTimeout(() => nav({ to: "/dashboard" }), 1400);
  }

  if (invalid) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Link expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">This password reset link is invalid or has expired. Request a new one to continue.</p>
          <Link to="/forgot-password" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="size-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-4">
            <CheckCircle2 className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
          <p className="mt-2 text-sm text-muted-foreground">Taking you to the dashboard…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <form onSubmit={save} className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose something at least 8 characters.</p>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoFocus
          disabled={!ready}
          className="mt-6 w-full rounded-2xl bg-card ring-1 ring-border px-4 py-3.5 text-sm outline-none disabled:opacity-50" />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password"
          disabled={!ready}
          className="mt-3 w-full rounded-2xl bg-card ring-1 ring-border px-4 py-3.5 text-sm outline-none disabled:opacity-50" />
        <button disabled={busy || !ready} className="mt-3 w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {ready ? "Save password" : "Verifying link…"}
        </button>
      </form>
    </div>
  );
}
