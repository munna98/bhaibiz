import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/company";

export type Worker = Omit<Database["public"]["Tables"]["workers"]["Row"], "aadhaar_hash">;
export type Agreement = Pick<
  Database["public"]["Tables"]["commission_agreements"]["Row"],
  "id" | "worker_id" | "daily_rate_paise" | "effective_from" | "note" | "created_at"
>;
export type WorkerStatus = Database["public"]["Enums"]["worker_status"];

export const canManageWorkers = (role: AppRole) => role === "owner" || role === "manager";
export const canChangeRate = (role: AppRole) => role === "owner";
export const canSeeAadhaar = (role: AppRole) => role === "owner";

/** Today's date in India as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** DD-MM-YYYY */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/** ₹ in Indian grouping, e.g. 123456 paise -> ₹1,234.56; whole rupees drop decimals. */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  const whole = Number.isInteger(rupees);
  return "₹" + rupees.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

/** Parses a rupee amount typed by a user into paise. Returns null when invalid or not positive. */
export function rupeesToPaise(input: string): number | null {
  const s = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const paise = Math.round(Number(s) * 100);
  return paise > 0 ? paise : null;
}

/** Normalises an Indian mobile number to 10 digits, or null if it is not a valid mobile. */
export function normalizeMobile(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** The daily rate that applies on `date`: latest agreement with effective_from <= date. */
export function rateOn(agreements: Pick<Agreement, "daily_rate_paise" | "effective_from">[], date: string): number | null {
  let best: { daily_rate_paise: number; effective_from: string } | null = null;
  for (const a of agreements) {
    if (a.effective_from <= date && (!best || a.effective_from > best.effective_from)) best = a;
  }
  return best?.daily_rate_paise ?? null;
}

export const workersQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["workers", companyId],
    queryFn: async (): Promise<Worker[]> => {
      const { data, error } = await supabase
        .from("workers")
        .select("id, company_id, worker_code, full_name, mobile, alt_mobile, category, joining_date, native_state, native_address, kerala_address, emergency_name, emergency_phone, notes, photo_path, status, aadhaar_last4, created_by, created_at, updated_at")
        .eq("company_id", companyId)
        .order("worker_code");
      if (error) throw error;
      return data;
    },
  });

export const agreementsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["agreements", companyId],
    queryFn: async (): Promise<Agreement[]> => {
      const { data, error } = await supabase
        .from("commission_agreements")
        .select("id, worker_id, daily_rate_paise, effective_from, note, created_at")
        .eq("company_id", companyId)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const statusHistoryQuery = (workerId: string) =>
  queryOptions({
    queryKey: ["worker-status-history", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_status_history")
        .select("id, status, effective_date, reason, changed_at")
        .eq("worker_id", workerId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const documentsQuery = (workerId: string) =>
  queryOptions({
    queryKey: ["worker-documents", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_documents")
        .select("id, storage_path, file_name, uploaded_at")
        .eq("worker_id", workerId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const BUCKET = "worker-files";

export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  return out;
}

export const INDIAN_STATES = [
  "West Bengal", "Assam", "Bihar", "Odisha", "Jharkhand", "Uttar Pradesh", "Tamil Nadu", "Karnataka",
  "Madhya Pradesh", "Chhattisgarh", "Rajasthan", "Maharashtra", "Andhra Pradesh", "Telangana", "Tripura",
  "Manipur", "Meghalaya", "Nagaland", "Mizoram", "Arunachal Pradesh", "Sikkim", "Punjab", "Haryana",
  "Gujarat", "Uttarakhand", "Himachal Pradesh", "Jammu and Kashmir", "Goa", "Delhi", "Kerala",
];

export const WORKER_CATEGORIES = ["Helper", "Mason", "Carpenter", "Painter", "Plumber", "Electrician", "Welder", "Loading", "Hotel", "Farm"];
