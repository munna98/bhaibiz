import { useT } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INVITABLE_ROLES, ROLE_HINTS, ROLE_LABELS, type AppRole } from "@/lib/company";
import { useActiveMembership } from "../app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/team")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Team — BhaiBiz" },
      { name: "description", content: "Invite staff and set their roles." },
      { property: "og:title", content: "Team — BhaiBiz" },
      { property: "og:description", content: "Invite staff and set their roles." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const t = useT();
  const { active } = useActiveMembership();
  const { userId } = Route.useRouteContext();
  const cid = active.company_id;
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("operator");

  const members = useQuery({
    queryKey: ["members", cid],
    queryFn: async () => {
      const { data, error } = await supabase.from("memberships").select("id, user_id, role").eq("company_id", cid).order("created_at");
      if (error) throw error;
      const ids = data.map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return data.map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) }));
    },
  });
  const invites = useQuery({
    queryKey: ["invites", cid],
    queryFn: async () => {
      const { data, error } = await supabase.from("invites").select("id, email, role").eq("company_id", cid).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["members", cid] });
    qc.invalidateQueries({ queryKey: ["invites", cid] });
  };

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invites").insert({ company_id: cid, email: email.trim().toLowerCase(), role, invited_by: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invite saved. They join when they sign up with this email.");
      setEmail("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "Already invited" : e.message),
  });

  async function changeRole(id: string, r: AppRole) {
    const { error } = await supabase.from("memberships").update({ role: r }).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  }
  async function removeMember(id: string) {
    if (!confirm("Remove this person from the company?")) return;
    const { error } = await supabase.from("memberships").delete().eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  }
  async function cancelInvite(id: string) {
    const { error } = await supabase.from("invites").delete().eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  }

  if (active.role !== "owner") return <p className="text-muted-foreground">Only the owner can manage the team.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t("Team")}</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}
        className="space-y-3 rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]"
      >
        <h2 className="font-semibold">{t("Invite staff")}</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="email" placeholder="staff@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="flex-1" />
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INVITABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{t(ROLE_LABELS[r])}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={invite.isPending}>{t("Invite")}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t(ROLE_LABELS[role])}: {t(ROLE_HINTS[role])}</p>
      </form>

      <section className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
        <h2 className="border-b px-4 py-3 font-semibold">{t("Members")}</h2>
        <ul className="divide-y">
          {members.data?.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.profile?.full_name || m.profile?.email || "Member"}</div>
                <div className="truncate text-xs text-muted-foreground">{m.profile?.email}</div>
              </div>
              {m.role === "owner" || m.user_id === userId ? (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{t(ROLE_LABELS[m.role])}</span>
              ) : (
                <>
                  <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as AppRole)}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INVITABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{t(ROLE_LABELS[r])}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" aria-label={t("Remove member")} onClick={() => removeMember(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {!!invites.data?.length && (
        <section className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
          <h2 className="border-b px-4 py-3 font-semibold">{t("Pending invites")}</h2>
          <ul className="divide-y">
            {invites.data.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 truncate">{i.email}</div>
                <span className="text-xs text-muted-foreground">{t(ROLE_LABELS[i.role])}</span>
                <Button size="icon" variant="ghost" aria-label={t("Cancel invite")} onClick={() => cancelInvite(i.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
