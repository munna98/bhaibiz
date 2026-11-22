import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PayMethod } from "./money";

export type RentCharge = Database["public"]["Tables"]["rent_charges"]["Row"];
export type RentPayment = Database["public"]["Tables"]["rent_payments"]["Row"];
export type WorkerRentBalance = Database["public"]["Views"]["worker_rent_balances"]["Row"];

export function currentPeriod(dateStr?: string): string {
  const d = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatPeriod(period: string): string {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period;
  const [yearStr, monthStr] = period.split("-");
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || monthStr;
  return `${monthName} ${yearStr}`;
}

export function recentPeriods(count = 6): { period: string; label: string }[] {
  const now = new Date();
  const list: { period: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const p = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    list.push({ period: p, label: formatPeriod(p) });
  }
  return list;
}

export const workerRentQuery = (workerId: string) =>
  queryOptions({
    queryKey: ["worker-rent", workerId],
    queryFn: async () => {
      const [chargesRes, paymentsRes] = await Promise.all([
        supabase
          .from("rent_charges")
          .select("*")
          .eq("worker_id", workerId)
          .order("period", { ascending: false }),
        supabase
          .from("rent_payments")
          .select("*")
          .eq("worker_id", workerId)
          .order("paid_on", { ascending: false }),
      ]);
      if (chargesRes.error) throw chargesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      return {
        charges: chargesRes.data ?? [],
        payments: paymentsRes.data ?? [],
      };
    },
  });

export const workerRentBalancesQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["worker-rent-balances", companyId],
    queryFn: async (): Promise<WorkerRentBalance[]> => {
      const { data, error } = await supabase
        .from("worker_rent_balances")
        .select("*")
        .eq("company_id", companyId);
      if (error) throw error;
      return data ?? [];
    },
  });

export const rentPaymentQuery = (id: string) =>
  queryOptions({
    queryKey: ["rent-payment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rent_payments")
        .select(
          "*, worker:workers(full_name, worker_code, mobile, accommodation:accommodations(name)), company:companies(name, phone, address)"
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

export async function chargeMonthlyRent(companyId: string, period: string): Promise<number> {
  const { data, error } = await supabase.rpc("charge_monthly_rent", {
    _company: companyId,
    _period: period,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function chargeWorkerRent(params: {
  workerId: string;
  period: string;
  amountPaise: number;
  dueDate?: string;
  notes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("charge_worker_rent", {
    _worker: params.workerId,
    _period: params.period,
    _amount: params.amountPaise,
    _due_date: params.dueDate,
    _notes: params.notes,
  });
  if (error) throw error;
  return data;
}

export async function recordRentPayment(params: {
  workerId: string;
  period: string;
  amountPaise: number;
  paidOn: string;
  method: PayMethod;
  reference?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("record_rent_payment", {
    _worker: params.workerId,
    _period: params.period,
    _amount: params.amountPaise,
    _paid_on: params.paidOn,
    _method: params.method,
    _reference: params.reference?.trim() || "",
  });
  if (error) throw error;
  return data;
}

export async function voidRentPayment(paymentId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("void_rent_payment", {
    _payment: paymentId,
    _reason: reason.trim(),
  });
  if (error) throw error;
}

export function invalidateRent(qc: { invalidateQueries: (o: { queryKey: unknown[] }) => unknown }) {
  for (const k of [
    "worker-rent",
    "worker-rent-balances",
    "rent-payment",
    "balances",
    "reports",
    "audit",
  ]) {
    qc.invalidateQueries({ queryKey: [k] });
  }
}
