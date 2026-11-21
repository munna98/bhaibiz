import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/company";

export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
export type Mark = AttendanceStatus | "pending";

export const canMarkAttendance = (role: AppRole) => role !== "accountant";

/** Shift a YYYY-MM-DD date by n days. */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whether this role may mark attendance on `date` (mirrors the database rule). */
export function canEditDate(role: AppRole, date: string, today: string): boolean {
  if (!canMarkAttendance(role)) return false;
  if (date > today) return false;
  if (role === "operator") return date >= addDays(today, -1);
  return true;
}

/** Changing an already-marked past day needs a reason. */
export const needsReason = (current: Mark, next: Mark, date: string, today: string) =>
  current !== "pending" && current !== next && date < today;

/** Tapping a tile toggles between worked and not_worked (pending defaults to worked). */
export const nextTileStatus = (current: Mark): AttendanceStatus =>
  current === "worked" ? "not_worked" : "worked";

export function summarize(marks: Mark[]) {
  const s = { total: marks.length, worked: 0, not_worked: 0, pending: 0 };
  for (const m of marks) s[m]++;
  return s;
}

export type DayPaymentStatus = "paid" | "partial" | "unpaid" | "no_dues";

export function computeDayPaymentStatus({
  mark,
  outstanding,
  hasPaymentOnDate,
  entryAmount = 0,
  allocatedAmount = 0,
}: {
  mark: Mark;
  outstanding: number;
  hasPaymentOnDate: boolean;
  entryAmount?: number | undefined;
  allocatedAmount?: number | undefined;
}): DayPaymentStatus {
  const isAllocated = entryAmount > 0 && allocatedAmount >= entryAmount;
  const isPartiallyAllocated = entryAmount > 0 && allocatedAmount > 0 && allocatedAmount < entryAmount;

  if (hasPaymentOnDate || (mark === "worked" && isAllocated)) {
    return "paid";
  }

  if (mark === "worked" && isPartiallyAllocated && outstanding > 0) {
    return "partial";
  }

  if (outstanding <= 0) {
    return "no_dues";
  }

  return "unpaid";
}

export const attendanceOnQuery = (companyId: string, date: string) =>
  queryOptions({
    queryKey: ["attendance", companyId, date],
    queryFn: async () => {
      const [att, com] = await Promise.all([
        supabase.from("attendance").select("id, worker_id, status").eq("company_id", companyId).eq("work_date", date),
        supabase.from("commission_entries").select("amount_paise").eq("company_id", companyId).eq("work_date", date),
      ]);
      if (att.error) throw att.error;
      if (com.error) throw com.error;
      const byWorker: Record<string, AttendanceStatus> = {};
      for (const r of att.data) byWorker[r.worker_id] = r.status;
      const earned = com.data.reduce((s, r) => s + r.amount_paise, 0);
      return { byWorker, earned };
    },
  });

export const workerAttendanceQuery = (workerId: string) =>
  queryOptions({
    queryKey: ["worker-attendance", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, work_date, status")
        .eq("worker_id", workerId)
        .order("work_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });
