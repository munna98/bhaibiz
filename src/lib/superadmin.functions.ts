import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { getSubscriptionStatus } from "@/lib/subscription";

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
      .select("id, name, phone, address, receipt_prefix, created_at, created_by, trial_ends_at, subscription_expires_at, subscription_notes")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch owner memberships for all companies
    const { data: ownerMembers } = await supabaseAdmin
      .from("memberships")
      .select("company_id, user_id")
      .eq("role", "owner");

    const ownerByCompany: Record<string, string> = {};
    for (const m of ownerMembers ?? []) {
      if (!ownerByCompany[m.company_id]) {
        ownerByCompany[m.company_id] = m.user_id;
      }
    }

    // Collect all owner user IDs
    const allOwnerUserIds = Array.from(
      new Set([
        ...Object.values(ownerByCompany),
        ...(companies ?? []).map((c) => c.created_by).filter(Boolean),
      ])
    );

    // Fetch profiles for all owners
    const { data: profiles } = allOwnerUserIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name, username")
          .in("id", allOwnerUserIds)
      : { data: [] };

    const profileMap: Record<string, { email: string | null; full_name: string | null }> = {};
    for (const p of profiles ?? []) {
      profileMap[p.id] = { email: p.email, full_name: p.full_name || p.username };
    }

    // Also fetch auth users to guarantee we have their real email even if profile is incomplete
    const authUsersRes = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }).catch(() => null);
    const authEmailMap: Record<string, string> = {};
    for (const u of authUsersRes?.data?.users ?? []) {
      if (u.email) authEmailMap[u.id] = u.email;
    }

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

    return (companies ?? []).map((c) => {
      const ownerUserId = ownerByCompany[c.id] || c.created_by;
      const ownerEmail =
        (ownerUserId ? authEmailMap[ownerUserId] : null) ||
        (ownerUserId ? profileMap[ownerUserId]?.email : null) ||
        null;
      const ownerName = ownerUserId ? profileMap[ownerUserId]?.full_name || null : null;
      const subStatus = getSubscriptionStatus(c);

      return {
        ...c,
        owner_id: ownerUserId || null,
        owner_email: ownerEmail,
        owner_name: ownerName,
        subscription_status: subStatus,
        member_count: memberCounts[c.id] ?? 0,
        worker_count: workerCounts[c.id] ?? 0,
        active_worker_count: activeWorkerCounts[c.id] ?? 0,
      };
    });
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
        .select("id, name, phone, address, receipt_prefix, created_at, created_by, trial_ends_at, subscription_expires_at, subscription_notes")
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

    const ownerMember = members.find((m) => m.role === "owner");
    let ownerEmail = ownerMember?.profile.email || null;
    let ownerName = ownerMember?.profile.full_name || ownerMember?.profile.username || null;

    if (!ownerEmail && (ownerMember?.user_id || companyRes.data.created_by)) {
      const targetUserId = ownerMember?.user_id || companyRes.data.created_by;
      const authUser = await supabaseAdmin.auth.admin.getUserById(targetUserId).catch(() => null);
      if (authUser?.data?.user?.email) {
        ownerEmail = authUser.data.user.email;
      }
    }

    return {
      company: {
        ...companyRes.data,
        owner_email: ownerEmail,
        owner_name: ownerName,
        subscription_status: getSubscriptionStatus(companyRes.data),
      },
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

// ---------------------------------------------------------------------------
// activateCompanySubscription — activates paid annual plan for a tenant
// ---------------------------------------------------------------------------
export const activateCompanySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null || !("companyId" in input)) {
      throw new Error("companyId is required");
    }
    return input as { companyId: string; months?: number; notes?: string };
  })
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const months = data.months && data.months > 0 ? data.months : 12; // default 1 year
    const newExpiresAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from("companies")
      .update({
        subscription_expires_at: newExpiresAt,
        subscription_notes:
          data.notes ||
          `Activated for ${months} months by Super Admin on ${new Date().toLocaleDateString("en-IN")}`,
      })
      .eq("id", data.companyId);

    if (error) throw new Error(error.message);
    return { ok: true, expiresAt: newExpiresAt };
  });

// ---------------------------------------------------------------------------
// extendCompanyTrial — extends or resets free trial for a tenant
// ---------------------------------------------------------------------------
export const extendCompanyTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null || !("companyId" in input)) {
      throw new Error("companyId is required");
    }
    return input as { companyId: string; days?: number; notes?: string };
  })
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const days = data.days && data.days > 0 ? data.days : 14;
    const newTrialEnds = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from("companies")
      .update({
        trial_ends_at: newTrialEnds,
        subscription_expires_at: null,
        subscription_notes:
          data.notes ||
          `Trial extended by ${days} days by Super Admin on ${new Date().toLocaleDateString("en-IN")}`,
      })
      .eq("id", data.companyId);

    if (error) throw new Error(error.message);
    return { ok: true, trialEndsAt: newTrialEnds };
  });
