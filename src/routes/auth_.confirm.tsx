import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";

export const Route = createFileRoute("/auth_/confirm")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token_hash: typeof search["token_hash"] === "string" ? search["token_hash"] : undefined,
    type: typeof search["type"] === "string" ? search["type"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Confirm account — BhaiBiz" },
      { name: "description", content: "Confirm your BhaiBiz account." },
      { property: "og:title", content: "Confirm account — BhaiBiz" },
      { property: "og:description", content: "Confirm your BhaiBiz account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthConfirmPage,
});

function AuthConfirmPage() {
  const { token_hash, type } = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token_hash) {
        setStatus("error");
        setErrorMessage(t("This confirmation link is invalid or has expired."));
        return;
      }

      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: (type as EmailOtpType) || "signup",
        });

        if (error) throw error;
        if (cancelled) return;

        setStatus("success");
        setTimeout(() => {
          navigate({ to: "/app" });
        }, 1500);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(
          (err as Error).message || t("This confirmation link is invalid or has expired."),
        );
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [token_hash, type, navigate, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)] text-center">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-primary">{t("BhaiBiz")}</h1>
          <LanguageSelect />
        </div>

        {status === "loading" && (
          <div className="py-8 space-y-4 flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("Confirming your account…")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-8 space-y-4 flex flex-col items-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="text-lg font-semibold">{t("Account confirmed! Redirecting…")}</h2>
            <p className="text-xs text-muted-foreground">{t("Taking you to your workspace…")}</p>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 space-y-4 flex flex-col items-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">{t("Confirmation failed")}</h2>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button asChild className="w-full mt-2">
              <Link to="/auth">{t("Go to Sign in")}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
