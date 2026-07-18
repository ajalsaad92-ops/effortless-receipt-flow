import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "manager", "finance", "employee", "contractor"] as const;
const roleSchema = z.enum(ROLES);

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, department, manager_id, created_at, phone, phone_country")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const emails = new Map<string, { email: string | null; last_sign_in_at: string | null; invited_at: string | null; confirmed: boolean }>();
    // page through auth users (1k cap is fine for MVP)
    const { data: authList, error: aErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (aErr) throw new Error(aErr.message);
    for (const u of authList.users) {
      if (!ids.includes(u.id)) continue;
      emails.set(u.id, {
        email: u.email ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        invited_at: u.invited_at ?? null,
        confirmed: !!u.email_confirmed_at || !!u.confirmed_at,
      });
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      department: p.department,
      manager_id: p.manager_id,
      created_at: p.created_at,
      phone: p.phone,
      phone_country: p.phone_country,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      ...(emails.get(p.id) ?? { email: null, last_sign_in_at: null, invited_at: null, confirmed: false }),
    }));
  });

export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("department")
      .not("department", "is", null);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const r of data ?? []) {
      const v = (r.department ?? "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email().max(255),
      full_name: z.string().min(1).max(120),
      role: roleSchema,
      department: z.string().max(120).optional().nullable(),
      manager_id: z.string().uuid().optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      phone_country: z.string().max(4).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const redirectTo = `${process.env.SUPABASE_URL?.replace(/\/$/, "")}`;
    const { data: invite, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name },
      redirectTo,
    });
    if (error) throw new Error(error.message);

    const userId = invite.user.id;
    // handle_new_user trigger creates profile + employee role; reconcile.
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: data.full_name,
      department: data.department ?? null,
      manager_id: data.manager_id ?? null,
      phone: data.phone ?? null,
      phone_country: data.phone_country ?? null,
    });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });

    await context.supabase.rpc("record_audit", {
      _entity: "user",
      _entity_id: userId,
      _action: "invite",
      _diff: { email: data.email, role: data.role },
    });

    return { id: userId };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      full_name: z.string().min(1).max(120).optional(),
      department: z.string().max(120).nullable().optional(),
      manager_id: z.string().uuid().nullable().optional(),
      role: roleSchema.optional(),
      phone: z.string().max(40).nullable().optional(),
      phone_country: z.string().max(4).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const profilePatch: { full_name?: string; department?: string | null; manager_id?: string | null; phone?: string | null; phone_country?: string | null } = {};
    if (data.full_name !== undefined) profilePatch.full_name = data.full_name;
    if (data.department !== undefined) profilePatch.department = data.department;
    if (data.manager_id !== undefined) profilePatch.manager_id = data.manager_id;
    if (data.phone !== undefined) profilePatch.phone = data.phone;
    if (data.phone_country !== undefined) profilePatch.phone_country = data.phone_country;
    if (Object.keys(profilePatch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }
    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
      if (error) throw new Error(error.message);
    }

    await context.supabase.rpc("record_audit", {
      _entity: "user",
      _entity_id: data.user_id,
      _action: "update",
      _diff: { ...profilePatch, ...(data.role ? { role: data.role } : {}) },
    });

    return { ok: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("You cannot delete your own account");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);

    await context.supabase.rpc("record_audit", {
      _entity: "user",
      _entity_id: data.user_id,
      _action: "delete",
    });

    return { ok: true };
  });