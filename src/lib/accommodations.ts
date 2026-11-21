import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { capitalizeWords } from "./utils";

export type Accommodation = Database["public"]["Tables"]["accommodations"]["Row"];
export type OperatorAccommodation = Database["public"]["Tables"]["operator_accommodations"]["Row"];

export const accommodationsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["accommodations", companyId],
    queryFn: async (): Promise<Accommodation[]> => {
      const { data, error } = await supabase
        .from("accommodations")
        .select("id, company_id, name, address, created_at, updated_at")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const operatorAccommodationsQuery = (companyId: string, userId?: string) =>
  queryOptions({
    queryKey: ["operator-accommodations", companyId, userId ?? "all"],
    queryFn: async (): Promise<OperatorAccommodation[]> => {
      let query = supabase
        .from("operator_accommodations")
        .select("id, company_id, user_id, accommodation_id, created_at")
        .eq("company_id", companyId);
      if (userId) {
        query = query.eq("user_id", userId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

export async function createAccommodation(params: {
  companyId: string;
  name: string;
  address?: string | null;
}) {
  const { data, error } = await supabase
    .from("accommodations")
    .insert({
      company_id: params.companyId,
      name: capitalizeWords(params.name.trim()),
      address: params.address?.trim() || null,
    })
    .select("id, company_id, name, address, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAccommodation(params: {
  id: string;
  name: string;
  address?: string | null;
}) {
  const { data, error } = await supabase
    .from("accommodations")
    .update({
      name: capitalizeWords(params.name.trim()),
      address: params.address?.trim() || null,
    })
    .eq("id", params.id)
    .select("id, company_id, name, address, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAccommodation(id: string) {
  const { error } = await supabase.from("accommodations").delete().eq("id", id);
  if (error) throw error;
}

export async function setOperatorAccommodations(params: {
  companyId: string;
  userId: string;
  accommodationIds: string[];
}) {
  // Delete existing operator accommodations for this user in this company
  const { error: delError } = await supabase
    .from("operator_accommodations")
    .delete()
    .eq("company_id", params.companyId)
    .eq("user_id", params.userId);
  if (delError) throw delError;

  if (params.accommodationIds.length > 0) {
    const rows = params.accommodationIds.map((accId) => ({
      company_id: params.companyId,
      user_id: params.userId,
      accommodation_id: accId,
    }));
    const { error: insError } = await supabase.from("operator_accommodations").insert(rows);
    if (insError) throw insError;
  }
}

export async function setWorkerAccommodation(params: {
  workerId: string;
  accommodationId: string | null;
}) {
  const { error } = await supabase
    .from("workers")
    .update({ accommodation_id: params.accommodationId })
    .eq("id", params.workerId);
  if (error) throw error;
}
