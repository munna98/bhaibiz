import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readAllPages, type ReportData } from "./report-data";

export const reportsQuery = (companyId: string, to: string) => queryOptions({
  queryKey: ["reports", companyId, to],
  queryFn: async (): Promise<ReportData> => {
    const [workers, attendance, commission, payments, adjustments, advances, repayments, history] = await Promise.all([
      readAllPages((a, b) => supabase.from("workers").select("id, full_name, worker_code, status, joining_date, opening_balance_paise").eq("company_id", companyId).order("id").range(a, b)),
      readAllPages((a, b) => supabase.from("attendance").select("id, worker_id, work_date, status").eq("company_id", companyId).lte("work_date", to).order("id").range(a, b)),
      readAllPages((a, b) => supabase.from("commission_entries").select("id, worker_id, work_date, amount_paise").eq("company_id", companyId).lte("work_date", to).order("id").range(a, b)),
      readAllPages((a, b) => supabase.from("payments").select("id, worker_id, paid_on, amount_paise, method, receipt_no, voided_at").eq("company_id", companyId).lte("paid_on", to).order("id").range(a, b)),
      readAllPages((a, b) => supabase.from("adjustments").select("id, worker_id, on_date, amount_paise, kind").eq("company_id", companyId).lte("on_date", to).order("id").range(a, b)),
      readAllPages((a, b) => supabase.from("advances").select("id, worker_id, given_on, amount_paise").eq("company_id", companyId).lte("given_on", to).order("id").range(a, b)),
      readAllPages((a, b) => supabase.from("advance_repayments").select("id, worker_id, paid_on, amount_paise").eq("company_id", companyId).lte("paid_on", to).order("id").range(a, b)),
      readAllPages((a, b) => supabase.from("worker_status_history").select("id, worker_id, status, effective_date, changed_at").eq("company_id", companyId).lte("effective_date", to).order("id").range(a, b)),
    ]);
    return { workers, attendance, commission, payments, adjustments, advances, repayments, history };
  },
});

export const auditQuery = (companyId: string, from: string, to: string) => queryOptions({
  queryKey: ["audit", companyId, from, to],
  queryFn: () => readAllPages((a, b) => supabase.from("audit_log").select("id, actor_id, entity, entity_id, action, details, at").eq("company_id", companyId)
    .gte("at", `${from}T00:00:00+05:30`).lt("at", `${new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)}T00:00:00+05:30`)
    .order("at", { ascending: false }).order("id").range(a, b)),
});