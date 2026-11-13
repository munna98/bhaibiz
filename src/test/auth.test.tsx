import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Route } from "@/routes/auth";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

describe("AuthPage password field", () => {
  it("toggles password visibility when the eye button is clicked", () => {
    const Component = Route.options.component!;
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
});
