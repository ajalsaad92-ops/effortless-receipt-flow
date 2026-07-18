import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Receipt, Inbox, User, HelpCircle, Plus, PencilLine, ImagePlus, UploadCloud, Loader2, Sparkles, ShieldCheck, FileText, Wallet, Users, BarChart3, MoreHorizontal, Repeat2, ScrollText, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { enqueueReceiptJob, processReceiptJob, listActiveReceiptJobs } from "@/lib/expenses.functions";
import DarkVeil from "@/components/DarkVeil";
import InstallHint from "@/components/InstallHint";
import { SubTabs } from "@/components/SubTabs";
import { SideNav } from "@/components/SideNav";
import { usePersona, setPersona as writePersona } from "@/hooks/use-persona";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

type Tab = { to: string; label: string; icon: LucideIcon; subTabs?: { to: string; label: string; icon: LucideIcon }[] };

const tabs: readonly Tab[] = [
  { to: "/dashboard", label: "Home", icon: LayoutGrid },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/approvals", label: "Inbox", icon: Inbox },
  { to: "/profile", label: "Profile", icon: User },
] as const;

// Admin persona bottom-nav tabs. The "More" tab opens a sub-tabs sheet
// (mega-menu style) so admins can reach every admin route from mobile.
const adminTabs: readonly Tab[] = [
  { to: "/admin", label: "Overview", icon: ShieldCheck },
  { to: "/approvals", label: "Approvals", icon: Inbox },
  {
    to: "/admin/reports",
    label: "More",
    icon: MoreHorizontal,
    subTabs: [
      { to: "/admin/reports", label: "Reports", icon: FileText },
      { to: "/admin/reimburse", label: "Reimburse", icon: Wallet },
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/policies", label: "Policies", icon: ScrollText },
      { to: "/finance/reports", label: "Finance", icon: BarChart3 },
    ],
  },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function AuthedLayout() {
  const loc = useLocation();
  const { user, ready } = useAuth();
  const { isManager, isAdmin, isFinance } = useRoles();
  const canSwitchPersona = isManager || isAdmin || isFinance;
  const persona = usePersona();
  const adminMode = canSwitchPersona && persona === "admin";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enqueue = useServerFn(enqueueReceiptJob);
  const process = useServerFn(processReceiptJob);
  const fetchActiveJobs = useServerFn(listActiveReceiptJobs);

  // Pull-to-refresh on mobile: invalidate all queries so visible data refetches.
  const { pull, refreshing, threshold } = usePullToRefresh(async () => {
    await qc.invalidateQueries();
  });

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
    }
  }, [navigate, ready, user]);

  // Active jobs tray — survives refresh/navigation.
  const { data: activeJobs = [] } = useQuery({
    queryKey: ["receipt-jobs-active"],
    queryFn: () => fetchActiveJobs(),
    refetchInterval: 5000,
    enabled: ready && !!user,
    retry: false,
  });

  // Realtime: refresh on any receipt_jobs change.
  useEffect(() => {
    const ch = supabase
      .channel("receipt-jobs-tray")
      .on("postgres_changes", { event: "*", schema: "public", table: "receipt_jobs" }, () => {
        qc.invalidateQueries({ queryKey: ["receipt-jobs-active"] });
        qc.invalidateQueries({ queryKey: ["receipt-job"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Allow drop-to-upload on the home + expenses surfaces (incl. /expenses/new).
  const dropEnabled =
    loc.pathname === "/dashboard" ||
    loc.pathname.startsWith("/expenses");

  useEffect(() => {
    if (!dropEnabled) {
      setDragActive(false);
      if (dragHideTimer.current) clearTimeout(dragHideTimer.current);
      return;
    }
    const hasFiles = (e: DragEvent) =>
      (e.dataTransfer?.files?.length ?? 0) > 0 || Array.from(e.dataTransfer?.types ?? []).includes("Files");

    // Use dragover + debounce instead of enter/leave depth counting —
    // dragleave fires unpredictably between child elements and would hide
    // the overlay (and cancel the drop) mid-drag.
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setDragActive(true);
      if (dragHideTimer.current) clearTimeout(dragHideTimer.current);
      dragHideTimer.current = setTimeout(() => setDragActive(false), 120);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (dragHideTimer.current) clearTimeout(dragHideTimer.current);
      setDragActive(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        toast.loading("Opening receipt…", { id: "receipt-flow" });
        handlePickedFile(file);
      }
    };
    // Some browsers won't fire `drop` unless `dragover` is also prevented at
    // the document level — register both with capture for safety.
    window.addEventListener("dragover", onOver, true);
    window.addEventListener("drop", onDrop, true);
    return () => {
      window.removeEventListener("dragover", onOver, true);
      window.removeEventListener("drop", onDrop, true);
      if (dragHideTimer.current) clearTimeout(dragHideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropEnabled]);

  // Carry the dark theme + DarkVeil background across the whole authed app.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.add("dark");
    return () => { root.classList.remove("dark"); };
  }, []);

  const personalTabs: Tab[] = [
    tabs[0],
    tabs[1],
    isManager ? tabs[2] : { to: "/ask-ai", label: "Ask", icon: HelpCircle },
    tabs[3],
  ];
  const visibleTabs: Tab[] = adminMode
    ? (adminTabs
        .filter((t) =>
          // Hide admin-only sub-tabs for plain managers.
          t.label === "More"
            ? true
            : true,
        )
        .map((t) => {
          if (t.label !== "More") return t;
          return {
            ...t,
            subTabs: t.subTabs?.filter((s) =>
              s.to === "/admin/users" || s.to === "/finance/reports"
                ? (isAdmin || isFinance)
                : true,
            ),
          };
        }))
    : personalTabs;

  // Close the More sheet when the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [loc.pathname]);

  const go = (search: Record<string, string>) => {
    setAddOpen(false);
    navigate({ to: "/expenses/new", search });
  };

  const handlePickedFile = (file: File | undefined) => {
    if (!file) return;
    setAddOpen(false);
    void startReceiptJob(file);
  };

  async function startReceiptJob(file: File) {
    toast.loading("Uploading receipt…", { id: "receipt-flow" });
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
      if (up.error) throw new Error(up.error.message);

      const { id } = await enqueue({ data: { receipt_path: path } });
      toast.success("Parsing in background…", { id: "receipt-flow", duration: 2500 });
      qc.invalidateQueries({ queryKey: ["receipt-jobs-active"] });

      // Fire-and-forget. Server keeps writing status to the row even if the
      // browser navigates or refreshes; the new-expense screen polls the row.
      void process({ data: { id } }).catch(() => {/* error captured in row */});

      navigate({ to: "/expenses/new", search: { jobId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start receipt", { id: "receipt-flow" });
    }
  }

  const inProgressJobs = activeJobs.filter((j) => j.status === "queued" || j.status === "processing");
  const readyJobs = activeJobs.filter((j) => j.status === "done");
  const failedJobs = activeJobs.filter((j) => j.status === "failed");
  const showTray =
    (inProgressJobs.length > 0 || readyJobs.length > 0 || failedJobs.length > 0) &&
    !loc.pathname.startsWith("/expenses/new");

  if (!ready || !user) {
    return (
      <div className="dark relative min-h-app bg-background text-foreground">
        <div className="relative z-10 flex min-h-app items-center justify-center px-6">
          <div className="text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Restoring your session…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark relative isolate min-h-app pb-28 md:pb-8 text-foreground">
      {/* Pull-to-refresh indicator (mobile only) */}
      {(pull > 0 || refreshing) && (
        <div
          aria-hidden
          className="md:hidden fixed left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          style={{
            top: `calc(env(safe-area-inset-top) + ${Math.max(8, pull - 28)}px)`,
            opacity: Math.min(1, pull / threshold),
            transition: refreshing ? "top 200ms ease-out, opacity 200ms ease-out" : undefined,
          }}
        >
          <div className="size-9 rounded-full bg-[#0f0e16]/85 backdrop-blur-xl ring-1 ring-white/10 grid place-items-center shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
            <Loader2
              className={`size-4 text-primary ${refreshing ? "animate-spin" : ""}`}
              style={!refreshing ? { transform: `rotate(${pull * 3}deg)` } : undefined}
            />
          </div>
        </div>
      )}

      {/* Animated DarkVeil — fixed behind all authed content, persistent across routes */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background">
        <DarkVeil
          hueShift={140}
          noiseIntensity={0}
          scanlineIntensity={0}
          speed={0.45}
          scanlineFrequency={0}
          warpAmount={0}
          resolutionScale={1}
        />
        {/* Heavier veil — thins the green shapes so they read as subtle motion, not a wash.
            Use color-mix so opacities work with our oklch --background token. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--background) 55%, transparent) 0%, color-mix(in oklab, var(--background) 65%, transparent) 50%, color-mix(in oklab, var(--background) 80%, transparent) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 32%, color-mix(in oklab, var(--background) 30%, transparent) 0%, color-mix(in oklab, var(--background) 60%, transparent) 55%, color-mix(in oklab, var(--background) 80%, transparent) 100%)",
          }}
        />
      </div>

      <SideNav onAddClick={() => setAddOpen((v) => !v)} />

      <div
        className="relative z-10 transition-[padding] duration-300 md:pl-[calc(var(--sidenav-width,15rem)+1.5rem)] md:[--safe-top:0px] [--safe-top:env(safe-area-inset-top)] [padding-top:var(--safe-top)]"
      >
        {/* Admin mode strip — inline, owns its own row so it never collides
            with page titles. Personal mode renders nothing here. */}
        {adminMode && (
          <div
            className="md:hidden flex justify-end px-4 pt-3"
          >
            <button
              type="button"
              onClick={() => {
                writePersona("personal");
                navigate({ to: "/dashboard" });
              }}
              aria-label="Exit admin view"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary ring-1 ring-primary/40 backdrop-blur px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
            >
              <ShieldCheck className="size-3.5" />
              Admin
              <Repeat2 className="size-3 opacity-70" />
            </button>
          </div>
        )}
        <div className="md:hidden">
          <SubTabs />
        </div>
        <Outlet />
      </div>

      <InstallHint />

      {/* Background receipt processing tray */}
      <AnimatePresence>
        {showTray && (
          <motion.button
            type="button"
            onClick={() => {
              const j = readyJobs[0] ?? inProgressJobs[0] ?? failedJobs[0];
              if (j) navigate({ to: "/expenses/new", search: { jobId: j.id } });
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={`fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur ring-1 ${
              readyJobs.length > 0
                ? "bg-primary/90 ring-primary/50 shadow-[0_8px_30px_-6px_hsla(152,55%,45%,0.6)]"
                : "bg-[#15141c]/90 ring-white/10"
            }`}
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)" }}
          >
            {readyJobs.length > 0 ? (
              <>
                <Sparkles className="size-3.5" />
                {readyJobs.length} receipt{readyJobs.length > 1 ? "s" : ""} ready — tap to review
              </>
            ) : inProgressJobs.length > 0 ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Parsing {inProgressJobs.length} receipt{inProgressJobs.length > 1 ? "s" : ""} — tap to open
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-destructive" />
                {failedJobs.length} receipt failed — tap to retry
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Drag-and-drop overlay — shows whenever a file is dragged over the
          home or expenses surfaces. Drop is handled by the window listeners. */}
      <AnimatePresence>
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center p-6"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative rounded-3xl border-2 border-dashed border-primary/70 bg-primary/10 px-8 py-10 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 ring-1 ring-primary/40">
                <UploadCloud className="h-7 w-7 text-primary" strokeWidth={2.4} />
              </div>
              <div className="text-lg font-semibold text-white">Drop to add expense</div>
              <div className="mt-1 text-sm text-white/70">Receipt image, photo, or PDF</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for the add menu — darken instead of blur-fade so the
          sheet itself reads as bold, opaque, full-saturation content. */}
      <AnimatePresence>
        {addOpen && (
          <motion.button
            type="button"
            aria-label="Close"
            onClick={() => setAddOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/70"
          />
        )}
      </AnimatePresence>

      {/* Add action sheet, anchored above the center + */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-30 w-[min(22rem,calc(100vw-1.5rem))]"
          >
            <div className="rounded-3xl bg-[#15141c] ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden">
              <SheetAction
                icon={ImagePlus}
                title="Upload or take photo"
                subtitle="Camera, photos, or files"
                onClick={() => uploadRef.current?.click()}
              />
              <div className="h-px bg-border mx-4" />
              <SheetAction
                icon={PencilLine}
                title="Enter manually"
                subtitle="Type the details yourself"
                onClick={() => go({ capture: "manual" })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden inputs — kept in the layout so the user gesture from the
          sheet button opens the OS picker directly (mobile browsers block
          .click() across navigations / setTimeouts). */}
      <input
        ref={uploadRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => { handlePickedFile(e.target.files?.[0]); e.target.value = ""; }}
      />

      {/* Floating liquid-glass pill bottom nav */}
      <nav
        className="md:hidden fixed left-0 right-0 z-20 flex flex-col items-center gap-1.5 px-3"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {/* Sub-tabs sheet for the active "More" tab (admin persona only). */}
        <AnimatePresence>
          {moreOpen && adminMode && (() => {
            const moreTab = visibleTabs.find((t) => t.label === "More");
            const subs = moreTab?.subTabs ?? [];
            if (subs.length === 0) return null;
            return (
              <motion.div
                key="more-sheet"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="rounded-full overflow-hidden"
                style={{
                  background: "hsla(0, 0%, 8%, 0.72)",
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  border: "1px solid hsla(0, 0%, 100%, 0.10)",
                  boxShadow: "0 12px 40px hsla(0, 0%, 0%, 0.45)",
                }}
              >
                <div className="flex items-center gap-0.5 p-1.5">
                  {subs.map((s) => {
                    const active = loc.pathname === s.to || loc.pathname.startsWith(s.to + "/");
                    const SubIcon = s.icon;
                    return (
                      <Link
                        key={s.to}
                        to={s.to}
                        onClick={() => setMoreOpen(false)}
                        className="relative flex flex-col items-center justify-center min-w-[66px] py-1.5 px-2 rounded-full"
                      >
                        {active && (
                          <motion.span
                            layoutId="more-sub-pill"
                            className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_18px_-2px_hsla(152,55%,45%,0.45)]"
                            transition={{ type: "spring", stiffness: 380, damping: 28 }}
                          />
                        )}
                        <SubIcon
                          className={`size-[16px] relative z-10 ${active ? "text-primary-foreground" : "text-white/65"}`}
                          strokeWidth={active ? 2.4 : 2}
                        />
                        <span
                          className={`relative z-10 text-[10px] mt-0.5 font-medium tracking-wide ${
                            active ? "text-primary-foreground" : "text-white/65"
                          }`}
                        >
                          {s.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <motion.div
          layout
          transition={{ type: "spring", damping: 18, stiffness: 160, mass: 0.7 }}
          className="relative flex items-center gap-1 px-2 py-2 rounded-full"
          style={{
            background: "hsla(0, 0%, 8%, 0.62)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid hsla(0, 0%, 100%, 0.10)",
            boxShadow:
              "0 12px 40px hsla(0, 0%, 0%, 0.45), 0 1px 0 hsla(0, 0%, 100%, 0.06) inset",
          }}
        >
          {visibleTabs.slice(0, 2).map((t) => (
            <PillTab
              key={t.to + t.label}
              to={t.to}
              label={t.label}
              icon={t.icon}
              active={loc.pathname.startsWith(t.to)}
              hasSubMenu={!!t.subTabs?.length}
              subMenuOpen={t.label === "More" && moreOpen}
              onClickOverride={t.label === "More" ? () => setMoreOpen((v) => !v) : undefined}
            />
          ))}
          <motion.button
            type="button"
            aria-label={addOpen ? "Close add menu" : "Add expense"}
            aria-expanded={addOpen}
            onClick={() => setAddOpen((v) => !v)}
            whileTap={{ scale: 0.9 }}
            animate={{ rotate: addOpen ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            className="size-12 mx-1 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-[0_8px_24px_-6px_hsla(152,55%,45%,0.55)] ring-1 ring-white/20"
          >
            <Plus className="size-5" strokeWidth={2.6} />
          </motion.button>
          {visibleTabs.slice(2).map((t) => (
            <PillTab
              key={t.to + t.label}
              to={t.to}
              label={t.label}
              icon={t.icon}
              active={loc.pathname.startsWith(t.to)}
              hasSubMenu={!!t.subTabs?.length}
              subMenuOpen={t.label === "More" && moreOpen}
              onClickOverride={t.label === "More" ? () => setMoreOpen((v) => !v) : undefined}
            />
          ))}
        </motion.div>
      </nav>
    </div>
  );
}

function PillTab({
  to,
  label,
  icon: Icon,
  active,
  hasSubMenu,
  subMenuOpen,
  onClickOverride,
}: {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  active: boolean;
  hasSubMenu?: boolean;
  subMenuOpen?: boolean;
  onClickOverride?: () => void;
}) {
  if (onClickOverride) {
    return (
      <button
        type="button"
        onClick={onClickOverride}
        aria-expanded={subMenuOpen}
        className="relative flex flex-col items-center justify-center min-w-[64px] h-12 px-2 rounded-full"
      >
        {(active || subMenuOpen) && (
          <motion.div
            layoutId="pill-active-bg"
            className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_18px_-2px_hsla(152,55%,45%,0.45)]"
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          />
        )}
        <Icon
          className={`size-[18px] relative z-10 ${(active || subMenuOpen) ? "text-primary-foreground" : "text-white/55"}`}
          strokeWidth={(active || subMenuOpen) ? 2.4 : 2}
        />
        <span
          className={`relative z-10 text-[10px] mt-0.5 font-medium tracking-wide ${
            (active || subMenuOpen) ? "text-primary-foreground" : "text-white/55"
          }`}
        >
          {label}
        </span>
      </button>
    );
  }
  return (
    <Link
      to={to}
      className="relative flex flex-col items-center justify-center min-w-[64px] h-12 px-2 rounded-full"
    >
      {active && (
        <motion.div
          layoutId="pill-active-bg"
          className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_18px_-2px_hsla(152,55%,45%,0.45)]"
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
        />
      )}
      <Icon
        className={`size-[18px] relative z-10 ${active ? "text-primary-foreground" : "text-white/55"}`}
        strokeWidth={active ? 2.4 : 2}
      />
      <span
        className={`relative z-10 text-[10px] mt-0.5 font-medium tracking-wide ${
          active ? "text-primary-foreground" : "text-white/55"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

function SheetAction({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: typeof LayoutGrid;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-white/5 active:bg-white/10 transition-colors"
    >
      <span className="size-11 rounded-2xl bg-primary/20 ring-1 ring-primary/40 grid place-items-center text-primary">
        <Icon className="size-5" strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-white">{title}</span>
        <span className="block text-xs text-white/65 mt-0.5">{subtitle}</span>
      </span>
    </button>
  );
}