import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const usernameRegex = /^[a-z0-9_]{3,30}$/;

const createStaffSchema = z.object({
  companyId: z.string().uuid(),
  fullName: z.string().trim().min(1, "Name is required").max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      usernameRegex,
      "Username must be 3-30 characters (lowercase letters, numbers, and underscore only)"
    ),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: z.enum(["manager", "operator", "accountant"]),
});

const resetPasswordSchema = z.object({
  companyId: z.string().uuid(),
  memberUserId: z.string().uuid(),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(100),
});

export const createStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => createStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    // 1. Verify caller has owner role for this company
    const { data: callerMember, error: callerErr } = await context.supabase
      .from("memberships")
      .select("role")
      .eq("company_id", data.companyId)
      .eq("user_id", context.userId)
      .single();

    if (callerErr || !callerMember || callerMember.role !== "owner") {
      throw new Error("Only the owner can add team members.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Check if username is already taken in profiles table
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();

    if (existingProfile) {
      throw new Error("This username is already taken. Please choose another username.");
    }

    // 3. Create the user in Supabase Auth with synthetic internal email and pre-confirmed status
    const internalEmail = `${data.username}@staff.bhaibiz.internal`;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        username: data.username,
      },
    });

    if (createError) {
      const msg = createError.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("unique")) {
        throw new Error("This username is already taken. Please choose another username.");
      }
      throw new Error(createError.message);
    }

    if (!created?.user) {
      throw new Error("Failed to create user account.");
    }

    const newUserId = created.user.id;

    // 4. Link the new user to the company via add_team_member RPC (runs with caller's security context)
    try {
      const { error: rpcError } = await context.supabase.rpc("add_team_member", {
        _company: data.companyId,
        _user: newUserId,
        _role: data.role as AppRole,
      });

      if (rpcError) {
        // Rollback created auth user if company link fails
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        throw new Error(rpcError.message);
      }

      // 5. Ensure profile has username and full_name set
      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: newUserId,
          full_name: data.fullName,
          email: internalEmail,
          username: data.username,
        });

      return {
        ok: true,
        userId: newUserId,
        username: data.username,
        fullName: data.fullName,
        role: data.role,
      };
    } catch (err) {
      // Ensure cleanup if unexpected error occurs
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw err;
    }
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => resetPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    // 1. Verify caller has owner role for this company
    const { data: callerMember, error: callerErr } = await context.supabase
      .from("memberships")
      .select("role")
      .eq("company_id", data.companyId)
      .eq("user_id", context.userId)
      .single();

    if (callerErr || !callerMember || callerMember.role !== "owner") {
      throw new Error("Only the owner can reset member passwords.");
    }

    // 2. Verify target user is a member of this company and not an owner
    const { data: targetMember, error: targetErr } = await context.supabase
      .from("memberships")
      .select("role")
      .eq("company_id", data.companyId)
      .eq("user_id", data.memberUserId)
      .single();

    if (targetErr || !targetMember) {
      throw new Error("Member not found in this company.");
    }

    if (targetMember.role === "owner") {
      throw new Error("Owner password cannot be reset from team management.");
    }

    // 3. Update password via Supabase Admin API
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      data.memberUserId,
      {
        password: data.newPassword,
      }
    );

    if (updateError) {
      throw new Error(updateError.message);
    }

    return { ok: true };
  });
