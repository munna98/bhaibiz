import { useT } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatReceiptNo } from "@/lib/company";
import { useActiveMembership } from "../app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Company settings — BhaiBiz" },
      { name: "description", content: "Company profile and receipt settings." },
      { property: "og:title", content: "Company settings — BhaiBiz" },
      { property: "og:description", content: "Company profile and receipt settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const t = useT();
  const { active } = useActiveMembership();
  const qc = useQueryClient();
  const c = active.company;
  const [name, setName] = useState(c.name);
  const [phone, setPhone] = useState(c.phone ?? "");
  const [address, setAddress] = useState(c.address ?? "");
  const [prefix, setPrefix] = useState(c.receipt_prefix);
  const [busy, setBusy] = useState(false);

  if (active.role !== "owner") return <p className="text-muted-foreground">{t("Only the owner can edit company settings.")}</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("companies")
      .update({ name: name.trim(), phone, address, receipt_prefix: prefix.trim().toUpperCase() || "RCPT" })
      .eq("id", c.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("Saved"));
    qc.invalidateQueries({ queryKey: ["my-memberships"] });
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t("Company")}</h1>
      <div className="space-y-4 rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="space-y-1.5"><Label htmlFor="n">{t("Name")}</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label htmlFor="p">{t("Phone")}</Label><Input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="a">{t("Address")}</Label><Textarea id="a" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="r">{t("Receipt prefix")}</Label>
          <Input id="r" value={prefix} maxLength={8} onChange={(e) => setPrefix(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {t("Receipt example")}: {formatReceiptNo((prefix || "RCPT").toUpperCase(), new Date().getFullYear(), 1)} · {t("Sequence restarts each year.")}
          </p>
        </div>
        <Button type="submit" disabled={busy}>{t("Save")}</Button>
      </div>
    </form>
  );
}
