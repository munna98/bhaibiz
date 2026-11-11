import { LanguageSelect } from "@/components/LanguageSelect";
import { useT } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setActiveCompanyId } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/onboarding")({
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_company", { _name: name, _phone: phone, _address: address });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setActiveCompanyId(data as string);
    await qc.invalidateQueries({ queryKey: ["my-memberships"] });
    navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div>
          <LanguageSelect />
          <h1 className="text-2xl font-bold">{t("Set up your company")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You'll be the owner. If a company invited you, ask them to add this email in Team.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cname">{t("Company name")}</Label>
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cphone">{t("Phone")}</Label>
          <Input id="cphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="caddr">{t("Address")}</Label>
          <Textarea id="caddr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{t("Create company")}</Button>
      </form>
    </div>
  );
}
