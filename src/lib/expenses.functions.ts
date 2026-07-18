import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluatePolicies, type PolicyRow, type Violation } from "@/lib/policy-engine";
import { z } from "zod";

const expenseInput = z.object({
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  merchant: z.string().min(1).max(200).optional().nullable(),
  expense_date: z.string(),
  category_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  receipt_path: z.string().optional().nullable(),
  ocr_raw: z.any().optional().nullable(),
  submit: z.boolean().default(false),
  report_id: z.string().uuid().optional().nullable(),
});

const savedReportInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  spec_json: z.object({
    dim: z.enum(["category", "user_id", "status", "month"]),
    measure: z.enum(["sum", "count", "avg"]),
    statusFilter: z.string().default("all"),
    days: z.enum(["30", "90", "365", "all"]),
  }),
});

async function recordAudit(
  supabase: any,
  _actor: string,
  entity: "expense" | "report" | "saved_report",
  entityId: string,
  action: string,
  diff?: Record<string, unknown>,
) {
  // audit_log INSERT is locked; writes go through the SECURITY DEFINER RPC.
  const { error } = await supabase.rpc("record_audit", {
    _entity: entity,
    _entity_id: entityId,
    _action: action,
    _diff: diff ?? null,
  });
  if (error) {
    console.error("Failed to write audit log", error.message);
  }
}

// Guards a staff-only decision/edit on a target user's data.
// Throws when the caller has no staff role, when the caller is the owner,
// or when a manager-only caller does not manage the target.
async function assertStaffActionOn(
  supabase: any,
  callerId: string,
  targetUserId: string,
) {
  if (!targetUserId) throw new Error("Not allowed");
  if (targetUserId === callerId) {
    throw new Error("You can't act on your own expenses");
  }
  const { data: roleRows, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);
  if (roleErr) throw new Error(roleErr.message);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const isFinanceOrAdmin = roles.includes("finance") || roles.includes("admin");
  const isManager = roles.includes("manager");
  if (!isFinanceOrAdmin && !isManager) throw new Error("Not allowed");
  if (!isFinanceOrAdmin) {
    const { data: manages, error: mErr } = await supabase.rpc("manages", {
      _target: targetUserId,
    });
    if (mErr) throw new Error(mErr.message);
    if (!manages) throw new Error("Not within your reporting line");
  }
}

// Asserts the caller holds finance or admin role. Used for policy CRUD and
// other staff-only writes that don't target a specific user.
async function assertFinanceOrAdmin(supabase: any, callerId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!(roles.includes("finance") || roles.includes("admin"))) {
    throw new Error("Forbidden: finance or admin only");
  }
}

// Strip ASCII control chars (except \n and \t) before sending user text to
// the model — defense in depth against prompt-injection / smuggling.
function sanitizeForModel(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

async function syncExpensePolicyState(
  supabase: any,
  expenseId: string,
  expense: { amount: number; category_name?: string | null; merchant?: string | null; receipt_path?: string | null },
) {
  const { data: policies, error: policyError } = await supabase
    .from("policies")
    .select("id,name,rule_json,severity,active")
    .eq("active", true);

  if (policyError) throw new Error(policyError.message);

  const violations = evaluatePolicies(expense, (policies ?? []) as PolicyRow[]);

  // policy_violations writes are locked behind a SECURITY DEFINER RPC so users
  // cannot fabricate violations on their own expenses via the Data API.
  const { error: rpcError } = await supabase.rpc("apply_policy_violations", {
    _expense_id: expenseId,
    _violations: violations.map((violation: Violation) => ({
      policy_id: violation.policy_id,
      policy_name: violation.policy_name,
      severity: violation.severity,
      message: violation.message,
    })),
  });
  if (rpcError) throw new Error(rpcError.message);

  const { error: updateError } = await supabase.from("expenses").update({
    policy_flags: violations.map((violation) => ({
      policy_id: violation.policy_id,
      policy_name: violation.policy_name,
      severity: violation.severity,
      message: violation.message,
    })),
  }).eq("id", expenseId);

  if (updateError) throw new Error(updateError.message);

  return violations;
}

export const listMyExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("expenses")
      .select("id,amount,currency,merchant,expense_date,status,receipt_path,notes,policy_flags,created_at,category_id,categories(name,icon)")
      .eq("user_id", userId)
      .order("expense_date", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("categories").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("policies").select("*").eq("active", true);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => expenseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const status = data.submit ? "submitted" : "draft";
    const submitted_at = data.submit ? new Date().toISOString() : null;
    const { data: row, error } = await supabase.from("expenses").insert({
      user_id: userId,
      amount: data.amount,
      currency: data.currency,
      merchant: data.merchant,
      expense_date: data.expense_date,
      category_id: data.category_id,
      notes: data.notes,
      receipt_path: data.receipt_path,
      ocr_raw: data.ocr_raw,
      status,
      submitted_at,
      report_id: data.report_id ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);

    const categoryName = data.category_id
      ? ((await supabase.from("categories").select("name").eq("id", data.category_id).maybeSingle()).data?.name ?? null)
      : null;

    const violations = await syncExpensePolicyState(supabase, row.id, {
      amount: data.amount,
      category_name: categoryName,
      merchant: data.merchant,
      receipt_path: data.receipt_path,
    });

    await recordAudit(supabase, userId, "expense", row.id, data.submit ? "submitted" : "created", {
      amount: data.amount,
      currency: data.currency,
      merchant: data.merchant,
      violation_count: violations.length,
    });

    return { id: row.id, policy_flags: violations };
  });

export const decideExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approved", "rejected", "reimbursed"]),
    notes: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const reimbursed_at = data.decision === "reimbursed" ? new Date().toISOString() : null;
    const { data: existing, error: existingError } = await supabase
      .from("expenses")
      .select("status,decision_notes,user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Not found");
    await assertStaffActionOn(supabase, userId, existing.user_id);
    const { error } = await supabase.from("expenses").update({
      status: data.decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      decision_notes: data.notes ?? null,
      reimbursed_at,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordAudit(supabase, userId, "expense", data.id, `status:${data.decision}`, {
      from: existing?.status ?? null,
      to: data.decision,
      notes: data.notes ?? null,
    });
    return { ok: true };
  });

const updateExpenseInput = expenseInput.extend({ id: z.string().uuid() });

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateExpenseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: existingErr } = await supabase
      .from("expenses")
      .select("id,user_id,status")
      .eq("id", data.id)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (!existing) throw new Error("Not found");
    if (existing.user_id !== userId) throw new Error("Not allowed");
    if (existing.status !== "draft" && existing.status !== "rejected") {
      throw new Error("Only draft or rejected expenses can be edited");
    }
    const nextStatus = data.submit ? "submitted" : existing.status;
    const submitted_at = data.submit ? new Date().toISOString() : null;
    const { error: updErr } = await supabase.from("expenses").update({
      amount: data.amount,
      currency: data.currency,
      merchant: data.merchant,
      expense_date: data.expense_date,
      category_id: data.category_id,
      notes: data.notes,
      receipt_path: data.receipt_path,
      ocr_raw: data.ocr_raw,
      report_id: data.report_id ?? null,
      status: nextStatus,
      submitted_at: data.submit ? submitted_at : null,
      decided_at: null,
      decided_by: null,
      decision_notes: null,
    }).eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    const categoryName = data.category_id
      ? ((await supabase.from("categories").select("name").eq("id", data.category_id).maybeSingle()).data?.name ?? null)
      : null;
    const violations = await syncExpensePolicyState(supabase, data.id, {
      amount: data.amount,
      category_name: categoryName,
      merchant: data.merchant,
      receipt_path: data.receipt_path,
    });
    await recordAudit(supabase, userId, "expense", data.id, data.submit ? "submitted" : "updated", {
      amount: data.amount,
      currency: data.currency,
      merchant: data.merchant,
      violation_count: violations.length,
    });
    return { id: data.id, policy_flags: violations };
  });

export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expenses")
      .select("id,amount,currency,merchant,expense_date,status,receipt_path,notes,policy_flags,user_id,submitted_at,report_id,categories(name,icon),expense_reports(id,title,type,start_date,end_date)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return [];
    const ids = Array.from(new Set(data.map((d) => d.user_id).filter(Boolean)));
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id,full_name,avatar_url")
      .in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return data.map((d) => ({ ...d, profile: byId.get(d.user_id) ?? null }));
  });

export const listDecidedApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expenses")
      .select("id,amount,currency,merchant,expense_date,status,receipt_path,notes,policy_flags,user_id,decided_at,decided_by,decision_notes,report_id,categories(name,icon),expense_reports(id,title,type,start_date,end_date)")
      .in("status", ["approved", "rejected", "reimbursed"])
      .order("decided_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return [];
    const ids = Array.from(new Set(data.map((d) => d.user_id).filter(Boolean)));
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id,full_name,avatar_url")
      .in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return data.map((d) => ({ ...d, profile: byId.get(d.user_id) ?? null }));
  });

export const revertExpenseDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: exErr } = await supabase
      .from("expenses").select("status,user_id").eq("id", data.id).maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Not found");
    await assertStaffActionOn(supabase, userId, existing.user_id);
    // Reimbursed → Approved (one step back). Approved/Rejected → Submitted (pending again).
    const isReimbursed = existing?.status === "reimbursed";
    const update = isReimbursed
      ? { status: "approved" as const, reimbursed_at: null }
      : {
          status: "submitted" as const,
          decided_by: null,
          decided_at: null,
          decision_notes: null,
          reimbursed_at: null,
        };
    const { error } = await supabase.from("expenses").update(update).eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordAudit(supabase, userId, "expense", data.id, "status:reverted", {
      from: existing?.status ?? null,
      to: update.status,
    });
    return { ok: true };
  });

export const getExpenseTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("audit_log")
      .select("id,action,diff,actor,created_at")
      .eq("entity", "expense")
      .eq("entity_id", data.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const actorIds = Array.from(
      new Set((rows ?? []).map((r) => r.actor).filter(Boolean) as string[]),
    );
    const byId = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id,full_name,avatar_url").in("id", actorIds);
      (profs ?? []).forEach((p) => byId.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url }));
    }
    return (rows ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      diff: r.diff,
      created_at: r.created_at,
      actor: r.actor ? byId.get(r.actor) ?? null : null,
    }));
  });

// ---------- Admin / Approvals ----------
export const listApprovedAwaitingReimbursement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expenses")
      .select("id,amount,currency,merchant,expense_date,status,user_id,decided_at,categories(name,icon)")
      .eq("status", "approved")
      .order("decided_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return [];
    const ids = Array.from(new Set(data.map((d) => d.user_id).filter(Boolean)));
    const { data: profs } = await context.supabase
      .from("profiles").select("id,full_name,avatar_url").in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return data.map((d) => ({ ...d, profile: byId.get(d.user_id) ?? null }));
  });

export const bulkDecideExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    ids: z.array(z.string().uuid()).min(1).max(200),
    decision: z.enum(["approved", "rejected", "reimbursed"]),
    notes: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const reimbursed_at = data.decision === "reimbursed" ? now : null;
    const { supabase, userId } = context;
    const { data: targets, error: tErr } = await supabase
      .from("expenses").select("id,user_id").in("id", data.ids);
    if (tErr) throw new Error(tErr.message);
    if (!targets || targets.length !== data.ids.length) throw new Error("Not allowed");
    for (const t of targets) {
      await assertStaffActionOn(supabase, userId, t.user_id);
    }
    const { error } = await supabase.from("expenses").update({
      status: data.decision,
      decided_by: userId,
      decided_at: now,
      decision_notes: data.notes ?? null,
      reimbursed_at,
    }).in("id", data.ids);
    if (error) throw new Error(error.message);
    for (const id of data.ids) {
      await recordAudit(supabase, userId, "expense", id, `status:${data.decision}`, {
        bulk: true, to: data.decision, notes: data.notes ?? null,
      });
    }
    return { ok: true, count: data.ids.length };
  });

export const listPendingReportsWithTotals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: reports, error } = await context.supabase
      .from("expense_reports")
      .select("id,title,description,type,status,submitted_at,user_id,start_date,end_date")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!reports || reports.length === 0) return [];
    const reportIds = reports.map((r) => r.id);
    const userIds = Array.from(new Set(reports.map((r) => r.user_id).filter(Boolean)));
    const [{ data: items }, { data: profs }] = await Promise.all([
      context.supabase
        .from("expenses")
        .select("id,amount,currency,report_id,policy_flags")
        .in("report_id", reportIds),
      context.supabase
        .from("profiles").select("id,full_name,avatar_url").in("id", userIds),
    ]);
    const byReport = new Map<string, { total: number; currency: string; count: number; flags: number }>();
    for (const it of items ?? []) {
      const cur = byReport.get(it.report_id!) ?? { total: 0, currency: it.currency, count: 0, flags: 0 };
      cur.total += Number(it.amount);
      cur.count += 1;
      cur.flags += Array.isArray(it.policy_flags) ? it.policy_flags.length : 0;
      byReport.set(it.report_id!, cur);
    }
    const profById = new Map((profs ?? []).map((p) => [p.id, p]));
    return reports.map((r) => ({
      ...r,
      profile: profById.get(r.user_id) ?? null,
      totals: byReport.get(r.id) ?? { total: 0, currency: "USD", count: 0, flags: 0 },
    }));
  });

export const listAllReportsWithTotals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: reports, error } = await context.supabase
      .from("expense_reports")
      .select("id,title,description,type,status,submitted_at,user_id,start_date,end_date,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    if (!reports || reports.length === 0) return [];
    const reportIds = reports.map((r) => r.id);
    const userIds = Array.from(new Set(reports.map((r) => r.user_id).filter(Boolean)));
    const [{ data: items }, { data: profs }] = await Promise.all([
      context.supabase
        .from("expenses")
        .select("id,amount,currency,report_id,policy_flags")
        .in("report_id", reportIds),
      context.supabase
        .from("profiles").select("id,full_name,avatar_url").in("id", userIds),
    ]);
    const byReport = new Map<string, { total: number; currency: string; count: number; flags: number }>();
    for (const it of items ?? []) {
      const cur = byReport.get(it.report_id!) ?? { total: 0, currency: it.currency, count: 0, flags: 0 };
      cur.total += Number(it.amount);
      cur.count += 1;
      cur.flags += Array.isArray(it.policy_flags) ? it.policy_flags.length : 0;
      byReport.set(it.report_id!, cur);
    }
    const profById = new Map((profs ?? []).map((p) => [p.id, p]));
    return reports.map((r) => ({
      ...r,
      profile: profById.get(r.user_id) ?? null,
      totals: byReport.get(r.id) ?? { total: 0, currency: "USD", count: 0, flags: 0 },
    }));
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [pending, approved, reportsPending] = await Promise.all([
      context.supabase.from("expenses").select("id,amount,currency", { count: "exact" }).eq("status", "submitted"),
      context.supabase.from("expenses").select("id,amount,currency", { count: "exact" }).eq("status", "approved"),
      context.supabase.from("expense_reports").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    ]);
    const sum = (rows: any[] | null) =>
      (rows ?? []).reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
    return {
      pendingExpenses: pending.count ?? 0,
      pendingExpensesTotal: sum(pending.data),
      approvedAwaitingReimbursement: approved.count ?? 0,
      approvedAwaitingReimbursementTotal: sum(approved.data),
      pendingReports: reportsPending.count ?? 0,
    };
  });

export const ocrReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ image_data_url: z.string().min(20) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Extract receipt data. Return only what you can read." },
          { role: "user", content: [
            { type: "text", text: "Extract merchant, amount (number, no symbol), date (YYYY-MM-DD), and a single-word suggested category from: Meals, Travel, Lodging, Transport, Office, Software, Entertainment, Other." },
            { type: "image_url", image_url: { url: data.image_data_url } },
          ]},
        ],
        tools: [{
          type: "function",
          function: {
            name: "receipt",
            description: "Structured receipt fields",
            parameters: {
              type: "object",
              properties: {
                merchant: { type: "string" },
                amount: { type: "number" },
                date: { type: "string", description: "YYYY-MM-DD" },
                category: { type: "string", enum: ["Meals","Travel","Lodging","Transport","Office","Software","Entertainment","Other"] },
              },
              required: ["merchant","amount","date","category"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "receipt" } },
      }),
    });
    if (res.status === 429) throw new Error("AI rate limited. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
    if (!res.ok) throw new Error("OCR failed");
    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No data extracted");
    return JSON.parse(args) as { merchant: string; amount: number; date: string; category: string };
  });

// ---------- Background receipt parsing jobs ----------

async function callGeminiOnImageUrl(imageUrl: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Extract receipt data. Return only what you can read." },
        { role: "user", content: [
          { type: "text", text: "Extract merchant, amount (number, no symbol), date (YYYY-MM-DD), and a single-word suggested category from: Meals, Travel, Lodging, Transport, Office, Software, Entertainment, Other." },
          { type: "image_url", image_url: { url: imageUrl } },
        ]},
      ],
      tools: [{
        type: "function",
        function: {
          name: "receipt",
          description: "Structured receipt fields",
          parameters: {
            type: "object",
            properties: {
              merchant: { type: "string" },
              amount: { type: "number" },
              date: { type: "string", description: "YYYY-MM-DD" },
              category: { type: "string", enum: ["Meals","Travel","Lodging","Transport","Office","Software","Entertainment","Other"] },
            },
            required: ["merchant","amount","date","category"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "receipt" } },
    }),
  });
  if (res.status === 429) throw new Error("AI rate limited. Try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
  if (!res.ok) throw new Error(`OCR failed (${res.status})`);
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No data extracted");
  return JSON.parse(args) as { merchant: string; amount: number; date: string; category: string };
}

export const enqueueReceiptJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ receipt_path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Enforce per-user folder isolation: the storage bucket policies require
    // the first path segment to equal the caller's user id. Reject any path
    // that targets another user's folder before we enqueue.
    const firstSegment = data.receipt_path.split("/")[0] ?? "";
    if (firstSegment !== userId) {
      throw new Error("Not allowed: receipt path must be in your own folder");
    }
    const { data: row, error } = await supabase
      .from("receipt_jobs")
      .insert({ user_id: userId, receipt_path: data.receipt_path, status: "queued" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const processReceiptJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load + claim the job (skip if already finished).
    const { data: job, error: loadErr } = await supabase
      .from("receipt_jobs")
      .select("id,receipt_path,status,user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!job) throw new Error("Job not found");
    // Belt-and-suspenders: RLS already scopes by user_id, but verify explicitly
    // so the function never processes a job that isn't the caller's.
    if (job.user_id !== userId) throw new Error("Not allowed");
    if (job.status === "done") return { ok: true, status: "done" as const };

    await supabase
      .from("receipt_jobs")
      .update({ status: "processing", started_at: new Date().toISOString(), error: null })
      .eq("id", data.id);

    try {
      const { data: signed, error: sErr } = await supabase.storage
        .from("receipts")
        .createSignedUrl(job.receipt_path, 600);
      if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "Could not read receipt");

      const result = await callGeminiOnImageUrl(signed.signedUrl);

      await supabase
        .from("receipt_jobs")
        .update({
          status: "done",
          result_json: result,
          finished_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      return { ok: true, status: "done" as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Parsing failed";
      await supabase
        .from("receipt_jobs")
        .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
        .eq("id", data.id);
      return { ok: false, status: "failed" as const, error: msg };
    }
  });

export const getReceiptJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("receipt_jobs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listActiveReceiptJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("receipt_jobs")
      .select("id,status,error,created_at,started_at")
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markReceiptJobConsumed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), expense_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("receipt_jobs")
      .update({ consumed: true, expense_id: data.expense_id ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const retryReceiptJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("receipt_jobs")
      .update({ status: "queued", error: null, started_at: null, finished_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReceiptJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job, error: jobErr } = await supabase
      .from("receipt_jobs").select("id,user_id,receipt_path").eq("id", data.id).maybeSingle();
    if (jobErr) throw new Error(jobErr.message);
    if (!job || job.user_id !== userId) throw new Error("Not found");
    if (job.receipt_path) {
      await supabase.storage.from("receipts").remove([job.receipt_path]);
    }
    const { error } = await supabase.from("receipt_jobs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: e, error: eErr } = await supabase
      .from("expenses").select("id,user_id,status,receipt_path").eq("id", data.id).maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!e) throw new Error("Not found");
    if (e.user_id !== userId) throw new Error("Not allowed");
    if (e.status !== "draft" && e.status !== "rejected") {
      throw new Error("Only draft or rejected expenses can be deleted");
    }
    if (e.receipt_path) {
      await supabase.storage.from("receipts").remove([e.receipt_path]);
      await supabase.from("receipt_jobs").delete().eq("receipt_path", e.receipt_path);
    }
    await supabase.from("policy_violations").delete().eq("expense_id", data.id);
    await supabase.from("expense_comments").delete().eq("expense_id", data.id);
    const { error } = await supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordAudit(supabase, userId, "expense", data.id, "deleted", { status: e.status });
    return { ok: true };
  });

export const findDuplicateExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      amount: z.number().positive(),
      currency: z.string().default("USD"),
      merchant: z.string().nullable().optional(),
      expense_date: z.string(),
      exclude_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const day = new Date(data.expense_date);
    const from = new Date(day); from.setDate(from.getDate() - 3);
    const to = new Date(day); to.setDate(to.getDate() + 3);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    let q = supabase.from("expenses")
      .select("id,amount,currency,merchant,expense_date,status")
      .eq("user_id", userId)
      .eq("currency", data.currency)
      .gte("amount", data.amount - 0.01)
      .lte("amount", data.amount + 0.01)
      .gte("expense_date", iso(from))
      .lte("expense_date", iso(to))
      .order("expense_date", { ascending: false })
      .limit(5);
    if (data.exclude_id) q = q.neq("id", data.exclude_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const merchant = (data.merchant ?? "").trim().toLowerCase();
    const matches = (rows ?? []).map((r) => {
      const m = (r.merchant ?? "").trim().toLowerCase();
      const sameMerchant = merchant.length > 0 && m.length > 0 && (m === merchant || m.includes(merchant) || merchant.includes(m));
      const sameDay = r.expense_date === data.expense_date;
      let score = 0;
      if (sameMerchant) score += 2;
      if (sameDay) score += 2;
      else score += 1;
      return { ...r, score };
    }).sort((a, b) => b.score - a.score);
    return matches;
  });

// ---------- Profile ----------
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile, error }, { data: userResp }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,avatar_url,department,phone,phone_country").eq("id", userId).maybeSingle(),
      supabase.auth.getUser(),
    ]);
    if (error) throw new Error(error.message);
    return { profile, email: userResp.user?.email ?? null };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      full_name: z.string().min(1).max(120).optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      phone_country: z.string().max(4).optional().nullable(),
      department: z.string().max(120).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({
      full_name: data.full_name ?? null,
      phone: data.phone ?? null,
      phone_country: data.phone_country ?? null,
      department: data.department ?? null,
    }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Roles ----------
export const myRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.role as string);
  });

// ---------- Expense detail ----------
export const getExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: e, error } = await supabase
      .from("expenses")
      .select("*,categories(name,icon)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!e) throw new Error("Not found");
    let receipt_url: string | null = null;
    if (e.receipt_path) {
      const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(e.receipt_path, 3600);
      receipt_url = signed?.signedUrl ?? null;
    }
    const [comments, violations, profile] = await Promise.all([
      supabase.from("expense_comments").select("id,body,created_at,user_id").eq("expense_id", data.id).order("created_at"),
      supabase.from("policy_violations").select("*").eq("expense_id", data.id),
      supabase.from("profiles").select("id,full_name,avatar_url").eq("id", e.user_id).maybeSingle(),
    ]);
    return { expense: e, receipt_url, comments: comments.data ?? [], violations: violations.data ?? [], owner: profile.data };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ expense_id: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Confirm caller is the expense owner or a staff member who manages them.
    // RLS enforces the same, but check explicitly so the failure mode is clear
    // and we never leak a partial write.
    const { data: exp, error: expErr } = await supabase
      .from("expenses").select("user_id").eq("id", data.expense_id).maybeSingle();
    if (expErr) throw new Error(expErr.message);
    if (!exp) throw new Error("Not found");
    if (exp.user_id !== userId) {
      await assertStaffActionOn(supabase, userId, exp.user_id);
    }
    const { error } = await supabase.from("expense_comments").insert({
      expense_id: data.expense_id, user_id: userId, body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Finance: all expenses ----------
export const listAllExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expenses")
      .select("id,amount,currency,merchant,expense_date,status,user_id,category_id,policy_flags,categories(name)")
      .order("expense_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((d) => d.user_id).filter(Boolean)));
    const byId = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>();
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles").select("id,full_name,avatar_url").in("id", ids);
      (profs ?? []).forEach((p) => byId.set(p.id, p));
    }
    return rows.map((d) => ({ ...d, profile: byId.get(d.user_id) ?? null }));
  });

export const listSavedReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_reports")
      .select("id,name,spec_json,updated_at,created_at,owner_id")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSavedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => savedReportInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name,
      spec_json: data.spec_json,
      owner_id: context.userId,
    };

    if (data.id) {
      const { error } = await context.supabase.from("saved_reports").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await recordAudit(context.supabase, context.userId, "saved_report", data.id, "updated", payload);
      return { id: data.id };
    }

    const { data: row, error } = await context.supabase.from("saved_reports").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await recordAudit(context.supabase, context.userId, "saved_report", row.id, "created", payload);
    return { id: row.id };
  });

export const deleteSavedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordAudit(context.supabase, context.userId, "saved_report", data.id, "deleted");
    return { ok: true };
  });

// ---------- Bundles / Reports ----------
export const listMyReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expense_reports")
      .select("id,title,description,type,status,submitted_at,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Trips (expense_reports of type 'trip') ----------
export const listMyTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expense_reports")
      .select("id,title,description,status,start_date,end_date,created_at")
      .eq("user_id", context.userId)
      .eq("type", "trip")
      .in("status", ["draft", "submitted"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("expense_reports").insert({
      user_id: context.userId,
      title: data.title,
      description: data.description ?? null,
      type: "trip",
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
    }).select("id,title,start_date,end_date").single();
    if (error) throw new Error(error.message);
    await recordAudit(context.supabase, context.userId, "report", row.id, "created", {
      title: data.title, type: "trip",
    });
    return row;
  });

export const listPendingReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expense_reports")
      .select("id,title,description,type,status,submitted_at,user_id")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    type: z.enum(["general", "trip", "project"]).default("general"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("expense_reports").insert({
      user_id: context.userId, title: data.title, description: data.description, type: data.type,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await recordAudit(context.supabase, context.userId, "report", row.id, "created", {
      title: data.title,
      type: data.type,
    });
    return { id: row.id };
  });

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [rep, items] = await Promise.all([
      supabase.from("expense_reports").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("expenses").select("id,amount,currency,merchant,expense_date,status,policy_flags,categories(name)").eq("report_id", data.id).order("expense_date"),
    ]);
    if (rep.error) throw new Error(rep.error.message);
    if (!rep.data) throw new Error("Not found");
    return { report: rep.data, items: items.data ?? [] };
  });

export const setExpenseReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    expense_id: z.string().uuid(),
    report_id: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: exp, error: eErr } = await supabase
      .from("expenses")
      .select("id,user_id,status,report_id")
      .eq("id", data.expense_id)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!exp) throw new Error("Not found");
    if (exp.user_id !== userId) {
      throw new Error("Only the owner can move an expense between reports");
    }
    if (exp.status !== "draft" && exp.status !== "rejected") {
      throw new Error("Submitted or decided expenses can't be re-bucketed");
    }
    if (data.report_id) {
      const { data: rep, error: rErr } = await supabase
        .from("expense_reports")
        .select("id,user_id")
        .eq("id", data.report_id)
        .maybeSingle();
      if (rErr) throw new Error(rErr.message);
      if (!rep || rep.user_id !== userId) throw new Error("Report not found");
    }
    const { error } = await supabase.from("expenses")
      .update({ report_id: data.report_id })
      .eq("id", data.expense_id);
    if (error) throw new Error(error.message);
    await recordAudit(supabase, userId, "expense", data.expense_id, "report:moved", {
      from: exp.report_id ?? null,
      to: data.report_id ?? null,
    });
    return { ok: true };
  });

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error: e1 } = await context.supabase.from("expense_reports")
      .update({ status: "submitted", submitted_at: now }).eq("id", data.id);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await context.supabase.from("expenses")
      .update({ status: "submitted", submitted_at: now }).eq("report_id", data.id).eq("status", "draft");
    if (e2) throw new Error(e2.message);
    await recordAudit(context.supabase, context.userId, "report", data.id, "submitted", { submitted_at: now });
    return { ok: true };
  });

export const decideReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approved", "rejected", "reimbursed"]),
    notes: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rep, error: rErr } = await supabase
      .from("expense_reports")
      .select("id,user_id,status")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!rep) throw new Error("Not found");
    await assertStaffActionOn(supabase, userId, rep.user_id);
    const now = new Date().toISOString();
    const reimbursed_at = data.decision === "reimbursed" ? now : null;
    const { error: e1 } = await supabase.from("expense_reports").update({
      status: data.decision, decided_by: userId, decided_at: now, decision_notes: data.notes ?? null,
    }).eq("id", data.id);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase.from("expenses").update({
      status: data.decision, decided_by: userId, decided_at: now, reimbursed_at,
    }).eq("report_id", data.id);
    if (e2) throw new Error(e2.message);
    await recordAudit(supabase, userId, "report", data.id, `status:${data.decision}`, {
      to: data.decision,
      notes: data.notes ?? null,
    });
    return { ok: true };
  });

// ---------- Policies ----------
export const listAllPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("policies").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const policyInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  rule_json: z.any(),
  severity: z.enum(["warning", "error"]).default("warning"),
  active: z.boolean().default(true),
  ai_generated: z.boolean().default(false),
});

export const upsertPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => policyInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceOrAdmin(context.supabase, context.userId);
    if (data.id) {
      const { data: dup } = await context.supabase
        .from("policies")
        .select("id")
        .ilike("name", data.name)
        .neq("id", data.id)
        .maybeSingle();
      if (dup) throw new Error(`A policy named "${data.name}" already exists`);
      const { error } = await context.supabase.from("policies").update({
        name: data.name, description: data.description, rule_json: data.rule_json,
        severity: data.severity, active: data.active,
      }).eq("id", data.id);
      if (error) throw new Error(error.code === "23505" ? `A policy named "${data.name}" already exists` : error.message);
      return { id: data.id };
    }
    const { data: dup } = await context.supabase
      .from("policies")
      .select("id")
      .ilike("name", data.name)
      .maybeSingle();
    if (dup) throw new Error(`A policy named "${data.name}" already exists`);
    const { data: row, error } = await context.supabase.from("policies").insert({
      name: data.name, description: data.description, rule_json: data.rule_json,
      severity: data.severity, active: data.active, ai_generated: data.ai_generated,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.code === "23505" ? `A policy named "${data.name}" already exists` : error.message);
    return { id: row.id };
  });

export const deletePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceOrAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("policies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generatePolicyFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ prompt: z.string().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceOrAdmin(context.supabase, context.userId);
    const safePrompt = sanitizeForModel(data.prompt).slice(0, 500);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Convert a natural-language expense policy into a structured rule. Choose ONE rule type that best captures the intent." },
          { role: "user", content: safePrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "policy",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Short policy name" },
                description: { type: "string" },
                severity: { type: "string", enum: ["warning", "error"] },
                rule: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["amount_max","category_amount_max","receipt_required_above","category_blocked","merchant_blocked","per_diem","mileage_rate"] },
                    max: { type: "number" },
                    amount: { type: "number" },
                    category: { type: "string" },
                    merchant: { type: "string" },
                    period: { type: "string", enum: ["day","night","person","trip"] },
                    rate: { type: "number" },
                    unit: { type: "string", enum: ["mi","km"] },
                  },
                  required: ["type"],
                },
              },
              required: ["name","severity","rule"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "policy" } },
      }),
    });
    if (res.status === 429) throw new Error("AI rate limited. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error("Couldn't generate policy");
    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No policy generated");
    return JSON.parse(args) as { name: string; description?: string; severity: "warning"|"error"; rule: { type: string; max?: number; amount?: number; category?: string; merchant?: string; period?: "day"|"night"|"person"|"trip"; rate?: number; unit?: "mi"|"km" } };
  });

// ---------- Ask AI ----------
export const askAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().min(2).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI not configured");
    const [{ data: rows }, { data: pols }] = await Promise.all([
      context.supabase
        .from("expenses")
        .select("amount,currency,merchant,expense_date,status,categories(name)")
        .eq("user_id", context.userId)
        .order("expense_date", { ascending: false })
        .limit(200),
      context.supabase
        .from("policies")
        .select("name,description,rule_json,severity,active")
        .eq("active", true),
    ]);
    const summary = (rows ?? []).map((r) => `${r.expense_date}|${r.categories?.name ?? "Uncat"}|${r.merchant ?? ""}|${r.amount}|${r.status}`).join("\n");
    const policyLines = (pols ?? []).map((p) => {
      const r = (p.rule_json ?? {}) as { type?: string; max?: number; amount?: number; category?: string; merchant?: string; period?: string; rate?: number; unit?: string };
      let desc = "";
      switch (r.type) {
        case "per_diem": desc = `${r.category} per-diem $${r.max}/${r.period ?? "day"}`; break;
        case "category_amount_max": desc = `${r.category} cap $${r.max}`; break;
        case "amount_max": desc = `Single-expense cap $${r.max}`; break;
        case "receipt_required_above": desc = `Receipt required above $${r.amount}`; break;
        case "category_blocked": desc = `${r.category} not reimbursable`; break;
        case "merchant_blocked": desc = `Merchant "${r.merchant}" blocked`; break;
        case "mileage_rate": desc = `Mileage $${r.rate}/${r.unit ?? "mi"}`; break;
        default: desc = JSON.stringify(r);
      }
      return `- ${p.name}: ${desc} [${p.severity}]`;
    }).join("\n");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a friendly expense assistant. Answer concisely (max 4 sentences) using the user's expense rows AND the company policies provided. When the user asks about per-diems, limits, or what's reimbursable, quote the policy directly. Currency is USD unless stated. If the data doesn't answer the question, say so." },
          { role: "user", content: `Active company policies:\n${policyLines || "(none configured)"}\n\nMy expenses (date|category|merchant|amount|status):\n${summary}\n\nQuestion: ${data.question}` },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI rate limited. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error("AI error");
    const json = await res.json();
    return { answer: json?.choices?.[0]?.message?.content ?? "" };
  });
