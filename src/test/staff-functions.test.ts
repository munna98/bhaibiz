import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreateUser = vi.fn();
const mockUpdateUserById = vi.fn();
const mockDeleteUser = vi.fn();
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockSelect = vi.fn();
const mockRpc = vi.fn();

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      validator: (validatorFn: (data: unknown) => unknown) => ({
        handler: (handlerFn: (ctx: { data: unknown; context: unknown }) => unknown) => {
          return async (payload: { data: unknown }) => {
            const validated = validatorFn(payload?.data);
            return handlerFn({
              data: validated,
              context: {
                userId: "owner-user-id",
                supabase: {
                  from: (table: string) => ({
                    select: (...cols: unknown[]) => ({
                      eq: (field1: string, val1: string) => ({
                        eq: (field2: string, val2: string) => ({
                          single: () => mockSelect(table, field1, val1, field2, val2),
                        }),
                      }),
                    }),
                  }),
                  rpc: (...args: unknown[]) => mockRpc(...args),
                },
              },
            });
          };
        },
      }),
    }),
  }),
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    }),
  },
}));

describe("staff.functions server functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates username format strictly", async () => {
    const { createStaffMember } = await import("@/lib/staff.functions");
    await expect(
      (createStaffMember as any)({
        data: {
          companyId: "a0000000-0000-0000-0000-000000000001",
          fullName: "Test User",
          username: "AB", // too short, uppercase
          password: "password123",
          role: "operator",
        },
      })
    ).rejects.toThrow();
  });

  it("creates staff member with internal email and links to company via RPC", async () => {
    mockSelect.mockResolvedValueOnce({
      data: { role: "owner" },
      error: null,
    });
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "new-staff-id" } },
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ error: null });

    const { createStaffMember } = await import("@/lib/staff.functions");
    const result = await (createStaffMember as any)({
      data: {
        companyId: "a0000000-0000-0000-0000-000000000001",
        fullName: "Kiran Kumar",
        username: "kiran_k",
        password: "password123",
        role: "operator",
      },
    });

    expect(result).toEqual({
      ok: true,
      userId: "new-staff-id",
      username: "kiran_k",
      fullName: "Kiran Kumar",
      role: "operator",
    });

    expect(mockCreateUser).toHaveBeenCalledWith({
      email: "kiran_k@staff.bhaibiz.internal",
      password: "password123",
      email_confirm: true,
      user_metadata: {
        full_name: "Kiran Kumar",
        username: "kiran_k",
      },
    });

    expect(mockRpc).toHaveBeenCalledWith("add_team_member", {
      _company: "a0000000-0000-0000-0000-000000000001",
      _user: "new-staff-id",
      _role: "operator",
    });
  });

  it("resets password for staff member", async () => {
    // 1. Caller is owner
    mockSelect.mockResolvedValueOnce({
      data: { role: "owner" },
      error: null,
    });
    // 2. Target member exists and is operator
    mockSelect.mockResolvedValueOnce({
      data: { role: "operator" },
      error: null,
    });
    mockUpdateUserById.mockResolvedValueOnce({
      data: { user: { id: "staff-id" } },
      error: null,
    });

    const { resetStaffPassword } = await import("@/lib/staff.functions");
    const result = await (resetStaffPassword as any)({
      data: {
        companyId: "a0000000-0000-0000-0000-000000000001",
        memberUserId: "a0000000-0000-0000-0000-000000000002",
        newPassword: "newsecretpassword",
      },
    });

    expect(result).toEqual({ ok: true });
    expect(mockUpdateUserById).toHaveBeenCalledWith(
      "a0000000-0000-0000-0000-000000000002",
      { password: "newsecretpassword" }
    );
  });
});
