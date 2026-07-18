import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share, Plus, X } from "lucide-react";

const DISMISS_KEY = "polaroid:install-hint-dismissed";

/**
 * iOS Safari "Add to Home Screen" hint. Shows once for users on iPhone Safari
 * (not already installed) so they can escape Safari's chrome bars and run the
 * app fullscreen. Dismissal is remembered in localStorage.
 */
export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {}
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    // @ts-expect-error iOS-only standalone flag
    const inStandalone = window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (isIOS && isSafari && !inStandalone) {
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="fixed left-3 right-3 z-40 pointer-events-none"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="pointer-events-auto mx-auto max-w-md rounded-2xl bg-[#0f0e16]/85 backdrop-blur-2xl ring-1 ring-white/10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] px-4 py-3 flex items-start gap-3">
            <div className="size-9 shrink-0 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center text-primary">
              <Plus className="size-4" strokeWidth={2.6} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white leading-tight">
                Install Expense It for fullscreen
              </p>
              <p className="mt-1 text-[11.5px] text-white/65 leading-snug">
                Tap <Share className="inline size-3 -mt-0.5 mx-0.5" /> Share, then
                <span className="font-medium text-white/85"> Add to Home Screen</span> to lose the Safari bars.
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="-mr-1 -mt-1 size-7 rounded-full grid place-items-center text-white/50 hover:text-white/90 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}