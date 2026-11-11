import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/company";

export type PayMethod = Database["public"]["Enums"]["pay_method"];
export const METHODS: { value: PayMethod; label: string }[] = [
  { value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }, { value: "bank", label: "Bank" }, { value: "other", label: "Other" },
];
export const methodLabel = (m: PayMethod) => METHODS.find((x) => x.value === m)?.label ?? m;

export const canHandleMoney = (role: AppRole) => role !== "operator";
export const canAdjust = (role: AppRole) => role === "owner";

/** Shared client-side guard; the money RPCs remain authoritative. */
export function validMoneyAmount(amount: number | null, maximum?: number): amount is number {
  return amount !== null && Number.isSafeInteger(amount) && amount > 0 && amount <= 2147483647
    && (maximum === undefined || amount <= maximum);
}

export function validMoneyDate(date: string, today: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today
    && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export type Balance = { worker_id: string; status: string; earned: number; collected: number; adjusted: number; outstanding: number; advance: number };

export function toBalance(r: { worker_id: string | null; status: string | null; earned_paise: number | null; collected_paise: number | null; adjusted_paise: number | null; advance_balance_paise: number | null }): Balance {
  const earned = Number(r.earned_paise ?? 0), collected = Number(r.collected_paise ?? 0), adjusted = Number(r.adjusted_paise ?? 0);
  return { worker_id: r.worker_id ?? "", status: r.status ?? "active", earned, collected, adjusted, outstanding: earned - collected - adjusted, advance: Number(r.advance_balance_paise ?? 0) };
}

/** Dashboard total: outstanding of active workers only. */
export const totalOutstanding = (bs: Balance[]) => bs.filter((b) => b.status === "active").reduce((s, b) => s + Math.max(0, b.outstanding), 0);

/** Oldest-first allocation preview (mirrors the database). */
export function allocateFIFO(days: { id: string; work_date: string; unpaid: number }[], amount: number) {
  const out: { id: string; work_date: string; take: number }[] = [];
  let left = amount;
  for (const d of [...days].sort((a, b) => a.work_date.localeCompare(b.work_date))) {
    if (left <= 0) break;
    if (d.unpaid <= 0) continue;
    const take = Math.min(left, d.unpaid);
    out.push({ id: d.id, work_date: d.work_date, take });
    left -= take;
  }
  return out;
}

export const balancesQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["balances", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("worker_balances").select("*").eq("company_id", companyId);
      if (error) throw error;
      return data.map(toBalance);
    },
  });

export const collectedOnQuery = (companyId: string, date: string) =>
  queryOptions({
    queryKey: ["collected", companyId, date],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("amount_paise").eq("company_id", companyId).eq("paid_on", date).is("voided_at", null);
      if (error) throw error;
      return data.reduce((s, r) => s + r.amount_paise, 0);
    },
  });

export const unpaidDaysQuery = (workerId: string) =>
  queryOptions({
    queryKey: ["unpaid-days", workerId],
    queryFn: async () => {
      const [e, a] = await Promise.all([
        supabase.from("commission_entries").select("id, work_date, amount_paise").eq("worker_id", workerId).eq("kind", "earn").is("reversed_at", null),
        supabase.from("payment_allocations").select("commission_entry_id, amount_paise, payment:payments!inner(worker_id, voided_at)").eq("payment.worker_id", workerId).is("payment.voided_at", null),
      ]);
      if (e.error) throw e.error;
      if (a.error) throw a.error;
      const paid: Record<string, number> = {};
      for (const r of a.data) paid[r.commission_entry_id] = (paid[r.commission_entry_id] ?? 0) + r.amount_paise;
      return e.data.map((d) => ({ id: d.id, work_date: d.work_date, amount: d.amount_paise, unpaid: d.amount_paise - (paid[d.id] ?? 0) }));
    },
  });

export const ledgerQuery = (workerId: string) =>
  queryOptions({
    queryKey: ["ledger", workerId],
    queryFn: async () => {
      const [c, p, adj, adv, rep] = await Promise.all([
        supabase.from("commission_entries").select("id, work_date, kind, amount_paise, created_at").eq("worker_id", workerId),
        supabase.from("payments").select("id, paid_on, amount_paise, method, reference, receipt_no, voided_at, void_reason, created_at").eq("worker_id", workerId),
        supabase.from("adjustments").select("id, on_date, kind, amount_paise, reason, created_at").eq("worker_id", workerId),
        supabase.from("advances").select("id, given_on, amount_paise, reason, created_at").eq("worker_id", workerId),
        supabase.from("advance_repayments").select("id, paid_on, amount_paise, method, reference, created_at").eq("worker_id", workerId),
      ]);
      for (const r of [c, p, adj, adv, rep]) if (r.error) throw r.error;
      return { commission: c.data ?? [], payments: p.data ?? [], adjustments: adj.data ?? [], advances: adv.data ?? [], repayments: rep.data ?? [] };
    },
  });

export const paymentQuery = (id: string) =>
  queryOptions({
    queryKey: ["payment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, worker:workers(full_name, worker_code, mobile), company:companies(name, phone, address), allocations:payment_allocations(amount_paise, entry:commission_entries(work_date))")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

export const invalidateMoney = (qc: { invalidateQueries: (o: { queryKey: unknown[] }) => unknown }) => {
  for (const k of ["balances", "collected", "unpaid-days", "ledger", "payment", "reports", "audit"]) qc.invalidateQueries({ queryKey: [k] });
};
