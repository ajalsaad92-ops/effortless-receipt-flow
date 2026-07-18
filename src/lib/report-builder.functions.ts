import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------------- Spec schema ----------------

export const COLUMN_KEYS = [
  "expense_date",
  "employee",
  "merchant",
  "category",
  "report",
  "amount",
  "currency",
  "status",
  "flags",
  "notes",
] as const;
export type ColumnKey = (typeof COLUMN_KEYS)[number];

export const STATUS_OPTIONS = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "reimbursed",
] as const;

export const GROUP_OPTIONS = [
  "none",
  "employee",
  "category",
  "report",
  "month",
  "merchant",
  "status",
] as const;

export const DATE_PRESETS = [
  "this_month",
  "this_quarter",
  "this_year",
  "last_7",
  "last_30",
  "last_90",
  "ytd",
  "all_time",
  "custom",
] as const;

export const reportSpec = z.object({
  kind: z.literal("builder").default("builder"),
  date: z.object({
    preset: z.enum(DATE_PRESETS).default("this_month"),
    from: z.string().optional().nullable(), // ISO date when preset = custom
    to: z.string().optional().nullable(),
  }),
  filters: z.object({
    statuses: z.array(z.enum(STATUS_OPTIONS)).default([]),
    employees: z.array(z.string().uuid()).default([]),
    categories: z.array(z.string().uuid()).default([]),
    reports: z.array(z.string().uuid()).default([]),
    amountMin: z.number().nullable().optional(),
    amountMax: z.number().nullable().optional(),
    hasFlag: z.boolean().nullable().optional(),
    currency: z.string().optional().nullable(),
  }),
  groupBy: z.enum(GROUP_OPTIONS).default("none"),
  columns: z.array(z.enum(COLUMN_KEYS)).min(1).default([
    "expense_date",
    "employee",
    "merchant",
    "category",
    "amount",
    "status",
  ]),
  sort: z.object({
    column: z.enum(COLUMN_KEYS).default("expense_date"),
    dir: z.enum(["asc", "desc"]).default("desc"),
  }),
  limit: z.union([z.literal(100), z.literal(500), z.literal(2000)]).default(500),
});

export type ReportSpec = z.infer<typeof reportSpec>;

function resolveDateRange(d: ReportSpec["date"]): { from: string | null; to: string | null } {
  const today = new Date();
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const startOfQuarter = new Date(
    today.getFullYear(),
    Math.floor(today.getMonth() / 3) * 3,
    1,
  );
  const minusDays = (n: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() - n);
    return x;
  };
  switch (d.preset) {
    case "this_month":
      return { from: iso(startOfMonth), to: iso(today) };
    case "this_quarter":
      return { from: iso(startOfQuarter), to: iso(today) };
    case "this_year":
    case "ytd":
      return { from: iso(startOfYear), to: iso(today) };
    case "last_7":
      return { from: iso(minusDays(7)), to: iso(today) };
    case "last_30":
      return { from: iso(minusDays(30)), to: iso(today) };
    case "last_90":
      return { from: iso(minusDays(90)), to: iso(today) };
    case "all_time":
      return { from: null, to: null };
    case "custom":
      return { from: d.from ?? null, to: d.to ?? null };
  }
}

// ---------------- runReport ----------------

export const runReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reportSpec.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Gate: admin / finance / manager only.
    // Row scoping is handled by RLS on `expenses` via the `manages()` helper:
    //   - admin / finance: see all rows
    //   - manager: sees only rows owned by users in their reporting chain
    //   - employee: blocked above
    // We rely on the user-scoped `context.supabase` client (NOT supabaseAdmin)
    // so RLS enforces tenancy. Do not switch this query to the admin client.
    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: any) => r.role);
    if (!roles.some((r: string) => ["admin", "finance", "manager"].includes(r))) {
      throw new Error("Forbidden");
    }

    const range = resolveDateRange(data.date);

    let q = supabase
      .from("expenses")
      .select(
        "id,amount,currency,merchant,expense_date,status,policy_flags,notes,user_id,category_id,report_id",
      )
      .order("expense_date", { ascending: false })
      .limit(data.limit);

    if (range.from) q = q.gte("expense_date", range.from);
    if (range.to) q = q.lte("expense_date", range.to);
    if (data.filters.statuses.length) q = q.in("status", data.filters.statuses);
    if (data.filters.employees.length) q = q.in("user_id", data.filters.employees);
    if (data.filters.categories.length)
      q = q.in("category_id", data.filters.categories);
    if (data.filters.reports.length) q = q.in("report_id", data.filters.reports);
    if (typeof data.filters.amountMin === "number")
      q = q.gte("amount", data.filters.amountMin);
    if (typeof data.filters.amountMax === "number")
      q = q.lte("amount", data.filters.amountMax);
    if (data.filters.currency) q = q.eq("currency", data.filters.currency);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // No FK relationships are defined on expenses, so related display data
    // must be resolved with separate lookups.
    let profileMap: Record<string, string> = {};
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", ids);
      profileMap = Object.fromEntries(
        (profs ?? []).map((p: any) => [p.id, p.full_name ?? "—"]),
      );
    }

    let categoryMap: Record<string, string> = {};
    const categoryIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.category_id).filter(Boolean)),
    ) as string[];
    if (categoryIds.length) {
      const { data: categories } = await supabase
        .from("categories")
        .select("id,name")
        .in("id", categoryIds);
      categoryMap = Object.fromEntries(
        (categories ?? []).map((category: any) => [category.id, category.name ?? "Uncategorized"]),
      );
    }

    let reportMap: Record<string, string> = {};
    const reportIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.report_id).filter(Boolean)),
    ) as string[];
    if (reportIds.length) {
      const { data: reports } = await supabase
        .from("expense_reports")
        .select("id,title")
        .in("id", reportIds);
      reportMap = Object.fromEntries(
        (reports ?? []).map((report: any) => [report.id, report.title ?? "Unassigned"]),
      );
    }

    type Row = {
      id: string;
      expense_date: string;
      employee: string;
      merchant: string | null;
      category: string | null;
      report: string | null;
      amount: number;
      currency: string;
      status: string;
      flags: number;
      notes: string | null;
      user_id: string;
      category_id: string | null;
      report_id: string | null;
      _month: string;
    };

    let normalized: Row[] = (rows ?? []).map((r: any) => {
      const employee = profileMap[r.user_id] ?? "—";
      const flagCount = Array.isArray(r.policy_flags) ? r.policy_flags.length : 0;
      return {
        id: r.id,
        expense_date: r.expense_date,
        employee,
        merchant: r.merchant,
        category: r.category_id ? (categoryMap[r.category_id] ?? "Uncategorized") : null,
        report: r.report_id ? (reportMap[r.report_id] ?? "Unassigned") : null,
        amount: Number(r.amount),
        currency: r.currency,
        status: r.status,
        flags: flagCount,
        notes: r.notes,
        user_id: r.user_id,
        category_id: r.category_id,
        report_id: r.report_id,
        _month: (r.expense_date ?? "").slice(0, 7),
      };
    });

    if (data.filters.hasFlag === true) normalized = normalized.filter((r) => r.flags > 0);
    if (data.filters.hasFlag === false) normalized = normalized.filter((r) => r.flags === 0);

    // sort (client could re-sort but server respects spec for export parity)
    normalized.sort((a, b) => {
      const col = data.sort.column;
      const av = (a as any)[col];
      const bv = (b as any)[col];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return data.sort.dir === "asc" ? cmp : -cmp;
    });

    // grouping
    type Group = {
      key: string;
      label: string;
      count: number;
      total: number;
      currency: string; // best-effort; mixed shows "—"
      rows: Row[];
    };

    let groups: Group[] = [];
    if (data.groupBy !== "none") {
      const groupKey = (r: Row): { key: string; label: string } => {
        switch (data.groupBy) {
          case "employee":
            return { key: r.user_id, label: r.employee };
          case "category":
            return { key: r.category_id ?? "_uncat", label: r.category ?? "Uncategorized" };
          case "report":
            return { key: r.report_id ?? "_unassigned", label: r.report ?? "Unassigned" };
          case "merchant":
            return { key: r.merchant ?? "_unknown", label: r.merchant ?? "Unknown" };
          case "status":
            return { key: r.status, label: r.status };
          case "month":
            return { key: r._month, label: r._month };
          default:
            return { key: "_all", label: "All" };
        }
      };
      const map = new Map<string, Group>();
      for (const r of normalized) {
        const { key, label } = groupKey(r);
        const g = map.get(key);
        if (g) {
          g.count += 1;
          g.total += r.amount;
          if (g.currency !== r.currency) g.currency = "—";
          g.rows.push(r);
        } else {
          map.set(key, {
            key,
            label,
            count: 1,
            total: r.amount,
            currency: r.currency,
            rows: [r],
          });
        }
      }
      groups = Array.from(map.values()).sort((a, b) => b.total - a.total);
    }

    const grandTotal = normalized.reduce((s, r) => s + r.amount, 0);
    const currencies = Array.from(new Set(normalized.map((r) => r.currency)));

    return {
      rows: normalized,
      groups,
      grandTotal,
      currency: currencies.length === 1 ? currencies[0] : "—",
      count: normalized.length,
    };
  });

// ---------------- Templates CRUD ----------------

export const listReportTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("saved_reports")
      .select("id,name,spec_json,owner_id,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Filter to builder-kind templates (older /finance/reports rows have a
    // different spec shape).
    return (data ?? []).filter(
      (t: any) => t.spec_json && t.spec_json.kind === "builder",
    );
  });

export const saveReportTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        spec: reportSpec,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      // Verify ownership (or finance/admin override) before mutating.
      const { data: existing, error: lookupErr } = await supabase
        .from("saved_reports")
        .select("owner_id")
        .eq("id", data.id)
        .maybeSingle();
      if (lookupErr) throw new Error(lookupErr.message);
      if (!existing) throw new Error("Template not found");
      if (existing.owner_id !== userId) {
        const { data: rolesRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const roles = (rolesRows ?? []).map((r: any) => r.role);
        if (!roles.some((r: string) => ["finance", "admin"].includes(r))) {
          throw new Error("Forbidden");
        }
      }
      const { data: row, error } = await supabase
        .from("saved_reports")
        .update({ name: data.name, spec_json: data.spec, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }
    const { data: row, error } = await supabase
      .from("saved_reports")
      .insert({ owner_id: userId, name: data.name, spec_json: data.spec })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteReportTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: lookupErr } = await supabase
      .from("saved_reports")
      .select("owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!existing) throw new Error("Template not found");
    if (existing.owner_id !== userId) {
      const { data: rolesRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roles = (rolesRows ?? []).map((r: any) => r.role);
      if (!roles.some((r: string) => ["finance", "admin"].includes(r))) {
        throw new Error("Forbidden");
      }
    }
    const { error } = await supabase.from("saved_reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Lookups for builder dropdowns ----------------

export const listReportLookups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Gate: admin / finance / manager only. Prevents authenticated employees
    // from enumerating all colleague profile IDs via this RPC.
    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: any) => r.role);
    if (!roles.some((r: string) => ["admin", "finance", "manager"].includes(r))) {
      throw new Error("Forbidden");
    }
    const [emp, cat, rep] = await Promise.all([
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("categories").select("id,name,icon").order("sort_order"),
      supabase
        .from("expense_reports")
        .select("id,title,type")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return {
      employees: emp.data ?? [],
      categories: cat.data ?? [],
      reports: rep.data ?? [],
    };
  });