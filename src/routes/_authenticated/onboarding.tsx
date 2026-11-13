import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myMembershipsQuery, getActiveCompanyId, setActiveCompanyId } from "@/lib/company";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Set up your company — BhaiBiz" },
      { name: "description", content: "Create your labour supply company in BhaiBiz." },
      { property: "og:title", content: "Set up your company — BhaiBiz" },
      { property: "og:description", content: "Create your labour supply company in BhaiBiz." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: memberships } = useQuery(myMembershipsQuery());

  useEffect(() => {
    if (memberships && memberships.length > 0) {
      if (!getActiveCompanyId()) {
        setActiveCompanyId(memberships[0].company_id);
      }
      supabase.auth.signOut().then(() => {
        qc.clear();
        toast.success(t("Company created! Please sign in to continue."));
        navigate({ to: "/auth" });
      });
    }
  }, [memberships, navigate, qc, t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("Company name is required."));
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_company", {
        _name: name.trim(),
        _phone: phone.trim(),
        _address: address.trim(),
      });
      if (error) throw error;
      setActiveCompanyId(data as string);
      await supabase.auth.signOut();
      qc.clear();
      toast.success(t("Company created! Please sign in to continue."));
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]"
      >
        <div>
          <LanguageSelect />
          <h1 className="text-2xl font-bold">{t("Set up your company")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "You'll be the owner. If a company invited you, ask them to add this email in Team.",
            )}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cname">{t("Company name")}</Label>
          <Input
            id="cname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cphone">{t("Phone")}</Label>
          <Input
            id="cphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="caddr">{t("Address")}</Label>
          <Textarea
            id="caddr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={busy}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("Creating company…")}
            </>
          ) : (
            t("Create company")
          )}
        </Button>
      </form>
    </div>
  );
}
