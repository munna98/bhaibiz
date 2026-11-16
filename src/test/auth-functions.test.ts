import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreateUser = vi.fn();

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator: (validatorFn: (data: unknown) => unknown) => ({
      handler: (handlerFn: (ctx: { data: unknown }) => unknown) => {
        return async (payload: { data: unknown }) => {
          const validated = validatorFn(payload?.data);
          return handlerFn({ data: validated });
        };
      },
    }),
  }),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
      },
    },
  },
}));

describe("signupUser server function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates account with email_confirm: true and does not send activation email", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "test-user-id", email: "newuser@example.com" } },
      error: null,
    });

    const { signupUser } = await import("@/lib/auth.functions");

    // createServerFn in real execution or via handler
    const result = await (signupUser as any)({
      data: {
        email: "newuser@example.com",
        password: "secretpassword",
        fullName: "New User",
      },
    });

    expect(result).toEqual({ ok: true });
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: "newuser@example.com",
      password: "secretpassword",
      email_confirm: true,
      user_metadata: {
        full_name: "New User",
      },
    });
  });

  it("throws user-friendly error when email is already registered", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: new Error("A user with this email address has already been registered"),
    });

    const { signupUser } = await import("@/lib/auth.functions");

    await expect(
      (signupUser as any)({
        data: {
          email: "existing@example.com",
          password: "secretpassword",
          fullName: "Existing User",
        },
      }),
    ).rejects.toThrow("A user with this email address has already been registered.");
  });

  it("throws generic error when supabase admin fails", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: new Error("Database connection failure"),
    });

    const { signupUser } = await import("@/lib/auth.functions");

    await expect(
      (signupUser as any)({
        data: {
          email: "user@example.com",
          password: "secretpassword",
          fullName: "User",
        },
      }),
    ).rejects.toThrow("Database connection failure");
  });

  it("rejects invalid input data via schema validator", async () => {
    const { signupUser } = await import("@/lib/auth.functions");

    await expect(
      (signupUser as any)({
        data: {
          email: "invalid-email",
          password: "123", // too short
          fullName: "",
        },
      }),
    ).rejects.toThrow();
  });
});
