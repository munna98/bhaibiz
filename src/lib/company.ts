import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Manager",
  operator: "Operator",
  accountant: "Accountant",
};

export const ROLE_HINTS: Record<AppRole, string> = {
  owner: "Full control, waivers, Aadhaar, team",
  manager: "Workers, accommodations, attendance, payments",
  operator: "Attendance & collections for assigned workers",
  accountant: "Reports and payments, read-only workers",
};

export const INVITABLE_ROLES: AppRole[] = ["manager", "operator", "accountant"];

export type MyMembership = {
  company_id: string;
  company_name: string | null;
  role: AppRole;
  company: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    receipt_prefix: string;
    created_at?: string;
    trial_ends_at?: string | null;
    subscription_expires_at?: string | null;
  };
};

export const myMembershipsQuery = () =>
  queryOptions({
    queryKey: ["my-memberships"],
    queryFn: async (): Promise<MyMembership[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      await supabase.rpc("accept_my_invites");
      const { data, error } = await supabase
        .from("memberships")
        .select(
          "company_id, company_name, role, company:companies(id, name, phone, address, receipt_prefix, created_at, trial_ends_at, subscription_expires_at)"
        )
        .eq("user_id", u.user.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as MyMembership[];
    },
  });

const KEY = "bhaibiz.activeCompany";
export const getActiveCompanyId = () =>
  typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
export const setActiveCompanyId = (id: string) => window.localStorage.setItem(KEY, id);

export function pickActive(list: MyMembership[]): MyMembership | undefined {
  const saved = getActiveCompanyId();
  return list.find((m) => m.company_id === saved) ?? list[0];
}

/** Receipt number format: PREFIX-YYYY-00001, sequence resets each year per company. */
export function formatReceiptNo(prefix: string, year: number, seq: number) {
  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}
