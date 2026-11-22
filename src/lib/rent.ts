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

export function workerPeriodsSinceJoining(
  joiningDate?: string | null,
  toDate?: string,
  maxMonths = 60
): string[] {
  const curP = currentPeriod(toDate);
  if (!joiningDate || !/^\d{4}-\d{2}/.test(joiningDate)) {
    return [curP];
  }
  const joinP = joiningDate.slice(0, 7);
  if (joinP > curP) {
    return [];
  }
  const [curY, curM] = curP.split("-").map(Number);
  const [joinY, joinM] = joinP.split("-").map(Number);

  const periods: string[] = [];
  let y = curY;
  let m = curM;
  let count = 0;

  while ((y > joinY || (y === joinY && m >= joinM)) && count < maxMonths) {
    periods.push(`${y}-${String(m).padStart(2, "0")}`);
    count++;
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return periods;
}

export interface WorkerRentMonthBreakdown {
  period: string;
  charged: number;
  paid: number;
  due: number;
  dueDate?: string;
  notes?: string | null;
  isOverride: boolean;
}

export function computeWorkerRentBreakdown(params: {
  joiningDate?: string | null;
  monthlyRentPaise: number;
  charges: { period: string; amount_paise: number; due_date?: string; notes?: string | null }[];
  payments: { period: string; amount_paise: number; voided_at?: string | null }[];
  toDate?: string;
}): {
  breakdown: WorkerRentMonthBreakdown[];
  totalCharged: number;
  totalPaid: number;
  totalDue: number;
} {
  const { joiningDate, monthlyRentPaise, charges, payments, toDate } = params;
  const toPeriod = toDate ? currentPeriod(toDate) : undefined;
  const activePeriods =
    monthlyRentPaise > 0 ? workerPeriodsSinceJoining(joiningDate, toDate) : [];

  const allPeriodsSet = new Set<string>(activePeriods);
  for (const c of charges) {
    if (!toPeriod || c.period <= toPeriod) {
      allPeriodsSet.add(c.period);
    }
  }
  for (const p of payments) {
    if (!p.voided_at && (!toPeriod || p.period <= toPeriod)) {
      allPeriodsSet.add(p.period);
    }
  }

  const chargeByPeriod = new Map<
    string,
    { amount_paise: number; due_date?: string; notes?: string | null }
  >();
  for (const c of charges) {
    chargeByPeriod.set(c.period, c);
  }

  const paidByPeriod = new Map<string, number>();
  for (const p of payments) {
    if (p.voided_at) continue;
    if (toPeriod && p.period > toPeriod) continue;
    paidByPeriod.set(p.period, (paidByPeriod.get(p.period) ?? 0) + p.amount_paise);
  }

  const sortedPeriods = Array.from(allPeriodsSet).sort((a, b) => b.localeCompare(a));
  const breakdown: WorkerRentMonthBreakdown[] = [];
  let totalCharged = 0;
  let totalPaid = 0;

  for (const period of sortedPeriods) {
    let charged = 0;
    let dueDate: string | undefined;
    let notes: string | null = null;
    let isOverride = false;

    if (chargeByPeriod.has(period)) {
      const c = chargeByPeriod.get(period)!;
      charged = c.amount_paise;
      dueDate = c.due_date;
      notes = c.notes ?? null;
      isOverride = true;
    } else if (activePeriods.includes(period)) {
      charged = Math.max(0, monthlyRentPaise);
      dueDate = `${period}-01`;
      notes = null;
      isOverride = false;
    }

    const paid = paidByPeriod.get(period) ?? 0;
    const due = Math.max(0, charged - paid);

    breakdown.push({
      period,
      charged,
      paid,
      due,
      dueDate,
      notes,
      isOverride,
    });

    totalCharged += charged;
    totalPaid += paid;
  }

  return {
    breakdown,
    totalCharged,
    totalPaid,
    totalDue: Math.max(0, totalCharged - totalPaid),
  };
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
