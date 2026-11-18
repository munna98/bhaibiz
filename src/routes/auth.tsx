import { LanguageSelect } from "@/components/LanguageSelect";
import { useT } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signupUser } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { isSuperAdminEmail } from "@/lib/superadmin";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — BhaiBiz" },
      { name: "description", content: "Sign in or create your BhaiBiz account." },
      { property: "og:title", content: "Sign in — BhaiBiz" },
      { property: "og:description", content: "Sign in or create your BhaiBiz account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function resolvePostLoginRoute(email: string | undefined): "/admin" | "/app" {
  return isSuperAdminEmail(email) ? "/admin" : "/app";
}

function AuthPage() {
  const t = useT();
  const navigate = useNavigate();
  const signup = useServerFn(signupUser);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: resolvePostLoginRoute(data.session.user.email) });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: resolvePostLoginRoute(session.user.email) });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const cleanInput = identifier.trim().toLowerCase();
      if (!cleanInput) throw new Error("Please enter your email or username");

      const emailToUse = cleanInput.includes("@")
        ? cleanInput
        : `${cleanInput}@staff.bhaibiz.internal`;

      if (mode === "signup") {
        if (!cleanInput.includes("@")) {
          throw new Error("Please use a valid email address to create a new company account.");
        }
        await signup({
          data: { email: cleanInput, password, fullName: name.trim() },
        });
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });
      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          throw new Error("Invalid username/email or password.");
        }
        throw error;
      }
      navigate({ to: resolvePostLoginRoute(emailToUse) });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-primary">{t("BhaiBiz")}</h1>
          <LanguageSelect />
        </div>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          {mode === "signin" ? t("Sign in to your account") : t("Create your account")}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("Your name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="identifier">
              {mode === "signup" ? t("Email") : t("Email or Username")}
            </Label>
            <Input
              id="identifier"
              type={mode === "signup" ? "email" : "text"}
              placeholder={mode === "signup" ? "name@email.com" : "username or name@email.com"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("Password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-muted-foreground hover:text-foreground focus-visible:text-foreground absolute inset-y-0 right-0 flex items-center px-3 transition-colors focus-visible:outline-none"
                aria-label={showPassword ? t("Hide password") : t("Show password")}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? t("Sign in") : t("Create account")}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin"
            ? t("New here? Create an account")
            : t("Already have an account? Sign in")}
        </button>
      </div>
    </div>
  );
}


