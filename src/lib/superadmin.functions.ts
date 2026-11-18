import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSuperAdminEmail } from "@/lib/superadmin";

function assertSuperAdmin(email: string | undefined) {
  if (!isSuperAdminEmail(email)) {
    throw new Error("Forbidden: super admin only");
  }
}

// ---------------------------------------------------------------------------
// listTenants — all companies with member & worker counts
// ---------------------------------------------------------------------------
export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertSuperAdmin(context.claims.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: companies, error } = await supabaseAdmin
      .from("companies")
      .select("id, name, phone, address, receipt_prefix, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch member counts for all companies in one query
    const { data: memberRows } = await supabaseAdmin
      .from("memberships")
      .select("company_id");

    // Fetch worker counts
    const { data: workerRows } = await supabaseAdmin
      .from("workers")
      .select("company_id, status");

    const memberCounts: Record<string, number> = {};
    for (const row of memberRows ?? []) {
      memberCounts[row.company_id] = (memberCounts[row.company_id] ?? 0) + 1;
    }

    const workerCounts: Record<string, number> = {};
    const activeWorkerCounts: Record<string, number> = {};
    for (const row of workerRows ?? []) {
      workerCounts[row.company_id] = (workerCounts[row.company_id] ?? 0) + 1;
      if (row.status === "active") {
        activeWorkerCounts[row.company_id] = (activeWorkerCounts[row.company_id] ?? 0) + 1;
      }
    }

    return (companies ?? []).map((c) => ({
      ...c,
      member_count: memberCounts[c.id] ?? 0,
      worker_count: workerCounts[c.id] ?? 0,
      active_worker_count: activeWorkerCounts[c.id] ?? 0,
    }));
  });

// ---------------------------------------------------------------------------
// getTenantDetail — full detail for one company
// ---------------------------------------------------------------------------
export const getTenantDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null || !("companyId" in input)) {
      throw new Error("companyId is required");
    }
    return input as { companyId: string };
  })
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [companyRes, membersRes, workersRes] = await Promise.all([
      supabaseAdmin
        .from("companies")
        .select("id, name, phone, address, receipt_prefix, created_at, created_by")
        .eq("id", data.companyId)
        .single(),

      supabaseAdmin
        .from("memberships")
        .select("id, user_id, role, created_at, company_name")
        .eq("company_id", data.companyId)
        .order("created_at"),

      supabaseAdmin
        .from("workers")
        .select("id, full_name, worker_code, mobile, status, joining_date, category")
        .eq("company_id", data.companyId)
        .order("worker_code"),
    ]);

    if (companyRes.error) throw new Error(companyRes.error.message);

    // Enrich members with profile data
    const memberUserIds = (membersRes.data ?? []).map((m) => m.user_id);
    const profilesRes =
      memberUserIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select("id, full_name, email, username")
            .in("id", memberUserIds)
        : { data: [] };

    const profilesById: Record<string, { full_name: string | null; email: string | null; username: string | null }> = {};
    for (const p of profilesRes.data ?? []) {
      profilesById[p.id] = { full_name: p.full_name, email: p.email, username: p.username };
    }

    const members = (membersRes.data ?? []).map((m) => ({
      ...m,
      profile: profilesById[m.user_id] ?? { full_name: null, email: null, username: null },
    }));

    return {
      company: companyRes.data,
      members,
      workers: workersRes.data ?? [],
    };
  });

// ---------------------------------------------------------------------------
// getImpersonatedCompany — returns a synthetic MyMembership for super admin
// impersonation so the normal AppShell can render with real company data
// ---------------------------------------------------------------------------
export const getImpersonatedCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null || !("companyId" in input)) {
      throw new Error("companyId is required");
    }
    return input as { companyId: string };
  })
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .select("id, name, phone, address, receipt_prefix")
      .eq("id", data.companyId)
      .single();

    if (error || !company) throw new Error("Company not found");

    // Return a synthetic membership shaped like MyMembership
    return {
      company_id: company.id,
      company_name: company.name,
      role: "owner" as const,
      company: {
        id: company.id,
        name: company.name,
        phone: company.phone,
        address: company.address,
        receipt_prefix: company.receipt_prefix,
      },
    };
  });

// ---------------------------------------------------------------------------
// getTenantStats — financial snapshot for one company
// ---------------------------------------------------------------------------
export const getTenantStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null || !("companyId" in input)) {
      throw new Error("companyId is required");
    }
    return input as { companyId: string };
  })
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [earnedRes, collectedRes, advancesRes, repaymentsRes] = await Promise.all([
      supabaseAdmin
        .from("commission_entries")
        .select("amount_paise, reversed_at")
        .eq("company_id", data.companyId)
        .eq("kind", "earn"),

      supabaseAdmin
        .from("payments")
        .select("amount_paise, voided_at")
        .eq("company_id", data.companyId),

      supabaseAdmin
        .from("advances")
        .select("amount_paise")
        .eq("company_id", data.companyId),

      supabaseAdmin
        .from("advance_repayments")
        .select("amount_paise")
        .eq("company_id", data.companyId),
    ]);

    const totalEarned = (earnedRes.data ?? [])
      .filter((r) => !r.reversed_at)
      .reduce((s, r) => s + r.amount_paise, 0);

    const totalCollected = (collectedRes.data ?? [])
      .filter((r) => !r.voided_at)
      .reduce((s, r) => s + r.amount_paise, 0);

    const totalAdvances = (advancesRes.data ?? []).reduce((s, r) => s + r.amount_paise, 0);
    const totalRepayments = (repaymentsRes.data ?? []).reduce((s, r) => s + r.amount_paise, 0);

    return {
      total_earned_paise: totalEarned,
      total_collected_paise: totalCollected,
      advance_outstanding_paise: totalAdvances - totalRepayments,
    };
  });
