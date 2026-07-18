import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Save, ChevronDown, Repeat2, Users, ChevronRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/expenses.functions";
import { COUNTRIES, findCountry } from "@/lib/countries";
import { useRoles } from "@/hooks/use-roles";
import { usePersona, setPersona as writePersona } from "@/hooks/use-persona";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Expense It" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const { isManager, isAdmin, isFinance } = useRoles();
  const canSwitch = isManager || isAdmin || isFinance;
  const navigate = useNavigate();
  const persona = usePersona();
  const togglePersona = () => {
    const next = persona === "admin" ? "personal" : "admin";
    writePersona(next);
    navigate({ to: next === "admin" ? "/admin" : "/dashboard" });
  };

  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("US");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.profile) return;
    setFullName(data.profile.full_name ?? "");
    setDepartment(data.profile.department ?? "");
    setPhone(data.profile.phone ?? "");
    setCountry(data.profile.phone_country ?? "US");
  }, [data]);

  const c = findCountry(country);
  const filtered = COUNTRIES.filter((x) =>
    `${x.name} ${x.dial} ${x.code}`.toLowerCase().includes(pickerQ.toLowerCase()),
  );

  async function save() {
    setSaving(true);
    try {
      await update({ data: { full_name: fullName, department, phone, phone_country: country } });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally { setSaving(false); }
  }

  async function changePassword() {
    if (newPwd.length < 8) return toast.error("Password must be at least 8 characters");
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) return toast.error(error.message);
    setNewPwd("");
    toast.success("Password updated");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="px-5 pt-12 pb-32 max-w-xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account</p>
        </div>
        {canSwitch && (
          <button
            type="button"
            onClick={togglePersona}
            aria-label={`Switch to ${persona === "admin" ? "personal" : "admin"} view`}
            className={`md:hidden mt-2 inline-flex items-center gap-2 rounded-full pl-2 pr-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
              persona === "admin"
                ? "bg-primary/15 text-primary ring-primary/30"
                : "bg-card text-foreground ring-border"
            }`}
          >
            <span className={`grid place-items-center size-6 rounded-full ${
              persona === "admin" ? "bg-primary/25" : "bg-muted"
            }`}>
              <Repeat2 className="size-3.5" />
            </span>
            <span className="flex items-center gap-1">
              <span className={persona === "admin" ? "opacity-60" : ""}>Personal</span>
              <span className="opacity-40">/</span>
              <span className={persona === "admin" ? "" : "opacity-60"}>Admin</span>
            </span>
          </button>
        )}
      </div>

      {isAdmin && (
        <Link
          to="/admin/users"
          className="mt-6 flex items-center gap-3 rounded-2xl bg-card ring-1 ring-border p-4 hover:bg-muted/40 transition-colors"
        >
          <span className="grid place-items-center size-10 rounded-xl bg-primary/15 text-primary">
            <Users className="size-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold">Team management</span>
            <span className="block text-xs text-muted-foreground">Invite, edit roles, and remove people</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      <div className="mt-6 space-y-3">
        <Field label="Full name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-transparent outline-none text-base font-medium" />
        </Field>

        <Field label="Email">
          <p className="text-base font-medium text-muted-foreground">{data?.email ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">Email changes happen via the auth flow.</p>
        </Field>

        <Field label="Department">
          <input value={department} onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Design"
            className="w-full bg-transparent outline-none text-base font-medium" />
        </Field>

        <Field label="Phone">
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl bg-muted px-2.5 py-1.5 text-sm font-medium"
            >
              <span className="text-lg leading-none">{c.flag}</span>
              <span className="tabular-nums text-muted-foreground">{c.dial}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="555 123 4567"
              className="flex-1 bg-transparent outline-none text-base font-medium"
            />
            {pickerOpen && (
              <div className="absolute top-full left-0 mt-2 z-10 w-72 rounded-2xl bg-card ring-1 ring-border shadow-2xl p-2">
                <input autoFocus value={pickerQ} onChange={(e) => setPickerQ(e.target.value)}
                  placeholder="Search country…"
                  className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none mb-1" />
                <div className="max-h-64 overflow-y-auto">
                  {filtered.map((x) => (
                    <button
                      key={x.code}
                      type="button"
                      onClick={() => { setCountry(x.code); setPickerOpen(false); setPickerQ(""); }}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-muted text-left ${country === x.code ? "bg-muted" : ""}`}
                    >
                      <span className="text-base">{x.flag}</span>
                      <span className="flex-1 truncate">{x.name}</span>
                      <span className="text-muted-foreground tabular-nums">{x.dial}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Field>

        <button onClick={save} disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-semibold disabled:opacity-50">
          <Save className="size-4" /> Save changes
        </button>
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Password</h2>
      <div className="mt-3 space-y-3">
        <Field label="New password">
          <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full bg-transparent outline-none text-base font-medium" />
        </Field>
        <button onClick={changePassword}
          className="w-full rounded-2xl bg-card ring-1 ring-border py-3 text-sm font-medium">
          Update password
        </button>
      </div>

      <button onClick={signOut}
        className="mt-10 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-destructive/15 text-destructive ring-1 ring-destructive/30 py-3 text-sm font-semibold">
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-4">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
