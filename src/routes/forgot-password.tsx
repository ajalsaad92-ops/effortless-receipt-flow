import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — Expense It" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 pt-20 pb-10">
      <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-8 w-fit">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>

      {sent ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="size-12 rounded-2xl bg-primary/10 grid place-items-center mb-6">
            <MailCheck className="size-6 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            We sent a password reset link to <span className="text-foreground font-medium">{email}</span>. The link expires in 1 hour.
          </p>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="mt-8 text-sm text-primary font-medium"
          >
            Use a different email
          </button>
        </motion.div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="size-10 rounded-2xl bg-primary mb-8" />
            <h1 className="text-3xl font-semibold tracking-tight">Forgot password?</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send you a reset link.</p>
          </motion.div>

          <form onSubmit={submit} className="mt-10 space-y-3">
            <div className="rounded-2xl bg-card ring-1 ring-border p-4">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-base font-medium mt-1" placeholder="you@company.com" />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} disabled={busy} type="submit"
              className="w-full rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Sending…" : "Send reset link"}
            </motion.button>
          </form>
        </>
      )}
    </div>
  );
}
