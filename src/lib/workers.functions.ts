import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatAadhaar, normalizeAadhaar, validateAadhaar } from "./aadhaar";
import { decryptAadhaar, encryptAadhaar, hashAadhaar } from "./aadhaar-crypto";
import { capitalizeWords } from "./utils";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const opt = (max: number) => z.string().trim().max(max).optional().default("");

const personalSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  alt_mobile: opt(15),
  native_state: opt(60),
  native_address: opt(400),
  kerala_address: opt(400),
  emergency_name: opt(120),
  emergency_phone: opt(15),
  category: opt(60),
  joining_date: isoDate,
  notes: opt(1000),
  accommodation_id: z.string().uuid().nullable().optional(),
});

const createSchema = z.object({
  companyId: z.string().uuid(),
  worker: personalSchema,
  aadhaar: z.string().max(20),
  ratePaise: z.number().int().positive().max(10_000_000),
  rateFrom: isoDate,
  openingBalancePaise: z.number().int().nonnegative().max(100_000_000).optional().default(0),
});

function friendly(message: string) {
  const dup = message.match(/DUPLICATE_AADHAAR:(\S+)/);
  if (dup) return `This Aadhaar number is already registered to worker ${dup[1]}.`;
  if (message.includes("Not allowed")) return "You don't have permission to do this.";
  return message;
}

function aadhaarKey() {
  return process.env["AADHAAR_KEY"] || process.env["SUPABASE_PROJECT_ID"] || "bhaibiz-default-aadhaar-key";
}

export const createWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const num = normalizeAadhaar(data.aadhaar);
    const invalid = validateAadhaar(num);
    if (invalid) throw new Error(invalid);
    const key = aadhaarKey();
    const [hash, cipher] = await Promise.all([hashAadhaar(num, key), encryptAadhaar(num, key)]);
    const workerPayload = {
      ...data.worker,
      full_name: capitalizeWords(data.worker.full_name.trim()),
      emergency_name: data.worker.emergency_name ? capitalizeWords(data.worker.emergency_name.trim()) : "",
      opening_balance_paise: data.openingBalancePaise ?? 0,
    };
    const { data: id, error } = await context.supabase.rpc("create_worker", {
      _company: data.companyId,
      _w: workerPayload,
      _aadhaar_last4: num.slice(-4),
      _aadhaar_hash: hash,
      _aadhaar_cipher: cipher,
      _rate_paise: data.ratePaise,
      _rate_from: data.rateFrom,
    });
    if (error) throw new Error(friendly(error.message));
    return { id: id as string };
  });

export const changeAadhaar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workerId: z.string().uuid(), aadhaar: z.string().max(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const num = normalizeAadhaar(data.aadhaar);
    const invalid = validateAadhaar(num);
    if (invalid) throw new Error(invalid);
    const key = aadhaarKey();
    const [hash, cipher] = await Promise.all([hashAadhaar(num, key), encryptAadhaar(num, key)]);
    const { error } = await context.supabase.rpc("set_worker_aadhaar", {
      _worker: data.workerId,
      _aadhaar_last4: num.slice(-4),
      _aadhaar_hash: hash,
      _aadhaar_cipher: cipher,
    });
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });

export const revealAadhaar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Only owners can read this row (enforced by the database).
    const { data: row, error } = await context.supabase
      .from("worker_aadhaar")
      .select("cipher, company_id")
      .eq("worker_id", data.workerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Only the owner can view the full Aadhaar number.");
    const number = await decryptAadhaar(row.cipher, aadhaarKey());
    const { error: auditError } = await context.supabase.from("audit_log").insert({
      company_id: row.company_id,
      actor_id: context.userId,
      entity: "worker",
      entity_id: data.workerId,
      action: "aadhaar_viewed",
    });
    if (auditError) throw new Error("Could not record identity access. Try again.");
    return { aadhaar: formatAadhaar(number) };
  });
