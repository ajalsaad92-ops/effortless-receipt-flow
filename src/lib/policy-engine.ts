// Shared policy evaluation. Used by both client (preflight) and server (authoritative).
export type PolicyRule =
  | { type: "category_amount_max"; category: string; max: number; per?: "person" | "expense" }
  | { type: "amount_max"; max: number }
  | { type: "receipt_required_above"; amount: number }
  | { type: "category_blocked"; category: string }
  | { type: "merchant_blocked"; merchant: string }
  | { type: "per_diem"; category: string; max: number; period: "day" | "night" | "person" | "trip" }
  | { type: "mileage_rate"; rate: number; unit: "mi" | "km" };

export type PolicyRow = {
  id: string;
  name: string;
  rule_json: PolicyRule;
  severity: "warning" | "error";
  active: boolean;
};

export type ExpenseLike = {
  amount: number;
  category_name?: string | null;
  merchant?: string | null;
  receipt_path?: string | null;
};

export type Violation = {
  policy_id: string;
  policy_name: string;
  severity: "warning" | "error";
  message: string;
};

export function evaluatePolicies(expense: ExpenseLike, policies: PolicyRow[]): Violation[] {
  const violations: Violation[] = [];
  for (const p of policies) {
    if (!p.active) continue;
    const r = p.rule_json;
    let hit: string | null = null;
    switch (r.type) {
      case "amount_max":
        if (expense.amount > r.max) hit = `Amount ${expense.amount} exceeds cap of ${r.max}.`;
        break;
      case "category_amount_max":
        if (expense.category_name?.toLowerCase() === r.category.toLowerCase() && expense.amount > r.max)
          hit = `${r.category} cap is ${r.max}; submitted ${expense.amount}.`;
        break;
      case "receipt_required_above":
        if (expense.amount > r.amount && !expense.receipt_path)
          hit = `Receipt required for amounts over ${r.amount}.`;
        break;
      case "category_blocked":
        if (expense.category_name?.toLowerCase() === r.category.toLowerCase())
          hit = `${r.category} is not reimbursable.`;
        break;
      case "merchant_blocked":
        if (expense.merchant?.toLowerCase().includes(r.merchant.toLowerCase()))
          hit = `Merchant "${r.merchant}" is blocked.`;
        break;
      case "per_diem":
        if (expense.category_name?.toLowerCase() === r.category.toLowerCase() && expense.amount > r.max)
          hit = `${r.category} per-diem is ${r.max}/${r.period}; submitted ${expense.amount}.`;
        break;
      case "mileage_rate":
        // descriptive only — no per-expense violation
        break;
    }
    if (hit) violations.push({ policy_id: p.id, policy_name: p.name, severity: p.severity, message: hit });
  }
  return violations;
}
