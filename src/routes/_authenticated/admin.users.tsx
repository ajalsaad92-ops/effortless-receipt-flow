import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, Loader2, MoreHorizontal, Plus, Search, Send, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import { listUsers, inviteUser, updateUser, resendInvite, deleteUser, listDepartments } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PhoneInput } from "@/components/PhoneInput";
import { DepartmentSelect } from "@/components/DepartmentSelect";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Team — Expense It" }] }),
  component: AdminUsers,
});

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", hint: "Full control" },
  { value: "manager", label: "Manager", hint: "Approves expenses" },
  { value: "finance", label: "Finance", hint: "Reports & policies" },
  { value: "employee", label: "Employee", hint: "Submits expenses" },
  { value: "contractor", label: "Contractor", hint: "Limited access" },
] as const;
type RoleValue = typeof ROLE_OPTIONS[number]["value"];

function roleBadge(role: string) {
  const tone: Record<string, string> = {
    admin: "bg-primary/15 text-primary border-primary/20",
    manager: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    finance: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    employee: "bg-muted text-foreground border-border",
    contractor: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  };
  return tone[role] ?? "bg-muted text-foreground border-border";
}

function initials(name: string | null, email: string | null) {
  const src = name || email || "?";
  return src.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function AdminUsers() {
  const { isAdmin, isLoading: rolesLoading } = useRoles();
  const list = useServerFn(listUsers);
  const listDepts = useServerFn(listDepartments);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list(),
    enabled: isAdmin,
  });
  const { data: departments } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => listDepts(),
    enabled: isAdmin,
  });

  const [q, setQ] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePrefill, setInvitePrefill] = useState<string>("");
  const [editing, setEditing] = useState<null | NonNullable<typeof data>[number]>(null);
  const [deleting, setDeleting] = useState<null | NonNullable<typeof data>[number]>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter((u) =>
      [u.full_name, u.email, u.department, ...(u.roles ?? [])].filter(Boolean).some((s) => String(s).toLowerCase().includes(term)),
    );
  }, [data, q]);

  const trimmedQ = q.trim();
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedQ);

  if (!rolesLoading && !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have access to team management.</p>
          <Link to="/dashboard" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-10 pb-10 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/dashboard" className="size-9 rounded-full grid place-items-center hover:bg-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-xs text-muted-foreground">Invite, edit, and remove people. Set their role.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="rounded-full">
          <UserPlus className="size-4" /> Invite
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, role…" className="pl-9 rounded-2xl h-11 bg-card" />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            {trimmedQ ? <>No teammates match <span className="text-foreground font-medium">"{trimmedQ}"</span>.</> : "No teammates match."}
          </p>
          {looksLikeEmail && (
            <Button
              onClick={() => { setInvitePrefill(trimmedQ); setInviteOpen(true); }}
              className="rounded-full"
            >
              <UserPlus className="size-4" /> Invite {trimmedQ}
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map((u) => (
              <motion.li
                key={u.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-2xl bg-card ring-1 ring-border p-3.5 flex items-center gap-3"
              >
                <Avatar className="size-10">
                  <AvatarFallback className="text-xs font-semibold">{initials(u.full_name, u.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold truncate">{u.full_name || u.email || "Unnamed"}</p>
                    {!u.confirmed && <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5">Pending</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}{u.department ? ` · ${u.department}` : ""}</p>
                </div>
                <div className="hidden sm:flex flex-wrap gap-1 max-w-[180px] justify-end">
                  {(u.roles.length ? u.roles : ["employee"]).map((r) => (
                    <span key={r} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleBadge(r)}`}>{r}</span>
                  ))}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full"><MoreHorizontal className="size-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(u)}>Edit role & profile</DropdownMenuItem>
                    {!u.confirmed && (
                      <DropdownMenuItem onClick={async () => {
                        try { await resendInvite({ data: { email: u.email! } }); toast.success("Invite resent"); }
                        catch (e: any) { toast.error(e.message); }
                      }}><Send className="size-4" /> Resend invite</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(u)}>
                      <Trash2 className="size-4" /> Remove user
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={(o) => { setInviteOpen(o); if (!o) setInvitePrefill(""); }}
        prefillEmail={invitePrefill}
        departments={departments ?? []}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["admin-users"] });
          qc.invalidateQueries({ queryKey: ["admin-departments"] });
        }}
      />
      <EditDialog
        user={editing}
        departments={departments ?? []}
        onClose={() => setEditing(null)}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["admin-users"] });
          qc.invalidateQueries({ queryKey: ["admin-departments"] });
        }}
      />
      <DeleteDialog
        user={deleting}
        onClose={() => setDeleting(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
      />
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onDone, prefillEmail, departments }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; prefillEmail?: string; departments: string[] }) {
  const fn = useServerFn(inviteUser);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<RoleValue>("employee");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("US");
  useMemo(() => {
    if (open && prefillEmail) setEmail(prefillEmail);
  }, [open, prefillEmail]);
  const m = useMutation({
    mutationFn: () => fn({ data: { email, full_name: name, role, department: department || null, phone: phone || null, phone_country: phone ? country : null } }),
    onSuccess: () => {
      toast.success(`Invite sent to ${email}`);
      setEmail(""); setName(""); setDepartment(""); setRole("employee"); setPhone(""); setCountry("US");
      onOpenChange(false);
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-h-[92dvh] overflow-y-auto p-5 sm:p-6 w-[calc(100vw-1.5rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>Invite teammate</DialogTitle>
          <DialogDescription>They'll get an email to set their password and join.</DialogDescription>
        </DialogHeader>
        <form
          id="invite-form"
          onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <PhoneInput phone={phone} country={country} onPhoneChange={setPhone} onCountryChange={setCountry} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <DepartmentSelect value={department} onChange={setDepartment} options={departments} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as RoleValue)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.label}</span>
                        <span className="text-[11px] text-muted-foreground">{r.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" form="invite-form" disabled={m.isPending} className="w-full sm:w-auto">
            {m.isPending && <Loader2 className="size-4 animate-spin" />} Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ user, onClose, onDone, departments }: { user: any; onClose: () => void; onDone: () => void; departments: string[] }) {
  const fn = useServerFn(updateUser);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<RoleValue>("employee");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("US");

  const open = !!user;
  // sync when user changes
  useMemo(() => {
    if (user) {
      setName(user.full_name ?? "");
      setDepartment(user.department ?? "");
      setRole((user.roles?.[0] as RoleValue) ?? "employee");
      setPhone(user.phone ?? "");
      setCountry(user.phone_country ?? "US");
    }
  }, [user?.id]);

  const m = useMutation({
    mutationFn: () => fn({
      data: {
        user_id: user!.id,
        full_name: name,
        department: department || null,
        role,
        phone: phone || null,
        phone_country: phone ? country : null,
      },
    }),
    onSuccess: () => { toast.success("Updated"); onClose(); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl max-h-[92dvh] overflow-y-auto p-5 sm:p-6 w-[calc(100vw-1.5rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>Edit teammate</DialogTitle>
          <DialogDescription className="truncate">{user?.email}</DialogDescription>
        </DialogHeader>
        <form id="edit-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <PhoneInput phone={phone} country={country} onPhoneChange={setPhone} onCountryChange={setCountry} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <DepartmentSelect value={department} onChange={setDepartment} options={departments} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as RoleValue)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" form="edit-form" disabled={m.isPending} className="w-full sm:w-auto">
            {m.isPending && <Loader2 className="size-4 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const fn = useServerFn(deleteUser);
  const m = useMutation({
    mutationFn: () => fn({ data: { user_id: user!.id } }),
    onSuccess: () => { toast.success("User removed"); onClose(); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <AlertDialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this user?</AlertDialogTitle>
          <AlertDialogDescription>
            {user?.full_name || user?.email} will lose access immediately. Their submitted expenses are retained.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={m.isPending}
            onClick={(e) => { e.preventDefault(); m.mutate(); }}
          >
            {m.isPending && <Loader2 className="size-4 animate-spin" />} Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}