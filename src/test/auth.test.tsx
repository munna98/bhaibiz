import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Route as AuthRoute } from "@/routes/auth";
import { Route as ConfirmRoute } from "@/routes/auth_.confirm";
import { supabase } from "@/integrations/supabase/client";

const mockNavigate = vi.fn();
const mockSignupServerFn = vi.fn().mockResolvedValue({ ok: true });

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => mockSignupServerFn,
  createServerFn: () => ({
    validator: () => ({
      handler: (fn: unknown) => fn,
    }),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      verifyOtp: vi.fn(),
    },
  },
}));

describe("AuthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles password visibility when the eye button is clicked", () => {
    const Component = AuthRoute.options.component!;
    render(<Component />);

    const passwordInput = screen.getByLabelText(/^Password/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", { name: /Show password/i });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: /Hide password/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Hide password/i }));

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /Show password/i })).toBeInTheDocument();
  });

  it("calls signup server function and logs in when submitting signup form", async () => {
    const Component = AuthRoute.options.component!;
    render(<Component />);

    // Switch to signup mode
    fireEvent.click(screen.getByText(/New here\? Create an account/i));

    fireEvent.change(screen.getByLabelText(/^Your name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: "test@bhaibiz.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    await waitFor(() => {
      expect(mockSignupServerFn).toHaveBeenCalledWith({
        data: {
          email: "test@bhaibiz.com",
          password: "password123",
          fullName: "Test User",
        },
      });
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@bhaibiz.com",
        password: "password123",
      });
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/app" });
    });
  });

  it("signs in directly when in signin mode", async () => {
    const Component = AuthRoute.options.component!;
    render(<Component />);

    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: "existing@bhaibiz.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    await waitFor(() => {
      expect(mockSignupServerFn).not.toHaveBeenCalled();
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "existing@bhaibiz.com",
        password: "password123",
      });
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/app" });
    });
  });
});

describe("AuthConfirmPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error when token_hash is missing", async () => {
    ConfirmRoute.useSearch = vi.fn().mockReturnValue({});
    const Component = ConfirmRoute.options.component!;
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByText(/Confirmation failed/i)).toBeInTheDocument();
      expect(
        screen.getByText(/This confirmation link is invalid or has expired/i),
      ).toBeInTheDocument();
    });
  });

  it("verifies token_hash and navigates on success", async () => {
    ConfirmRoute.useSearch = vi.fn().mockReturnValue({
      token_hash: "valid-token-hash",
      type: "signup",
    });
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: { session: {} as any, user: {} as any },
      error: null,
    });

    const Component = ConfirmRoute.options.component!;
    render(<Component />);

    await waitFor(() => {
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: "valid-token-hash",
        type: "signup",
      });
      expect(screen.getByText(/Account confirmed! Redirecting…/i)).toBeInTheDocument();
    });
  });

  it("shows error when verifyOtp fails", async () => {
    ConfirmRoute.useSearch = vi.fn().mockReturnValue({
      token_hash: "invalid-token",
      type: "signup",
    });
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error("Token has expired") as any,
    });

    const Component = ConfirmRoute.options.component!;
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByText(/Confirmation failed/i)).toBeInTheDocument();
      expect(screen.getByText(/Token has expired/i)).toBeInTheDocument();
    });
  });
});
