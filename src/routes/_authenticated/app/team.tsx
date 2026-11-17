import { useT } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, KeyRound, Copy, Check, Share2, Sparkles, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INVITABLE_ROLES, ROLE_HINTS, ROLE_LABELS, type AppRole } from "@/lib/company";
import { createStaffMember, resetStaffPassword } from "@/lib/staff.functions";
import { useActiveMembership } from "../app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/team")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Team — BhaiBiz" },
      { name: "description", content: "Manage team members and roles." },
      { property: "og:title", content: "Team — BhaiBiz" },
      { property: "og:description", content: "Manage team members and roles." },
    ],
  }),
  component: TeamPage,
});

function generateRandomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

interface CreatedCredentials {
  fullName: string;
  username: string;
  password: string;
  role: AppRole;
}

function TeamPage() {
  const t = useT();
  const { active } = useActiveMembership();
  const { userId } = Route.useRouteContext();
  const cid = active.company_id;
  const qc = useQueryClient();

  const createMemberFn = useServerFn(createStaffMember);
  const resetPasswordFn = useServerFn(resetStaffPassword);

  // Add Member form state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("operator");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Created credentials modal state
  const [createdCreds, setCreatedCreds] = useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState<{ userId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const members = useQuery({
    queryKey: ["members", cid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, user_id, role")
        .eq("company_id", cid)
        .order("created_at");
      if (error) throw error;
      const ids = data.map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, username")
        .in("id", ids);
      return data.map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) }));
    },
  });

  const invites = useQuery({
    queryKey: ["invites", cid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("id, email, role")
        .eq("company_id", cid)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["members", cid] });
    qc.invalidateQueries({ queryKey: ["invites", cid] });
  };

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanPass = password.trim();

    if (!cleanName) {
      toast.error("Please enter member name");
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      toast.error("Username must be 3-30 characters (letters, numbers, underscore only)");
      return;
    }
    if (cleanPass.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      await createMemberFn({
        data: {
          companyId: cid,
          fullName: cleanName,
          username: cleanUsername,
          password: cleanPass,
          role: role as "manager" | "operator" | "accountant",
        },
      });

      // Show credentials dialog
      setCreatedCreds({
        fullName: cleanName,
        username: cleanUsername,
        password: cleanPass,
        role,
      });

      // Reset form
      setFullName("");
      setUsername("");
      setPassword("");
      setRole("operator");
      toast.success(t("Member added"));
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    const cleanPass = newPassword.trim();
    if (cleanPass.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsResetting(true);
    try {
      await resetPasswordFn({
        data: {
          companyId: cid,
          memberUserId: resetTarget.userId,
          newPassword: cleanPass,
        },
      });
      toast.success(t("Password reset successfully!"));
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsResetting(false);
    }
  }

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

  function copyCredentials(creds: CreatedCredentials) {
    const text = `BhaiBiz Login Credentials\nName: ${creds.fullName}\nUsername: ${creds.username}\nPassword: ${creds.password}\nRole: ${creds.role}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t("Credentials copied!"));
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp(creds: CreatedCredentials) {
    const msg = `Hello ${creds.fullName},\nHere are your BhaiBiz login credentials:\nUsername: ${creds.username}\nPassword: ${creds.password}\nRole: ${creds.role}\nSign in at: ${window.location.origin}/auth`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (active.role !== "owner") return <p className="text-muted-foreground">Only the owner can manage the team.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t("Team")}</h1>

      {/* Add Member Form */}
      <form
        onSubmit={handleAddMember}
        className="space-y-4 rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-base">{t("Add team member")}</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="memberName">{t("Name")}</Label>
            <Input
              id="memberName"
              placeholder="e.g. Kiran Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="memberUsername">{t("Username")}</Label>
            <Input
              id="memberUsername"
              placeholder="e.g. kiran_k"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="memberPassword">{t("Password")}</Label>
              <button
                type="button"
                onClick={() => setPassword(generateRandomPassword())}
                className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                {t("Generate password")}
              </button>
            </div>
            <Input
              id="memberPassword"
              type="text"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("Role") || "Role"}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(ROLE_LABELS[r])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            {t(ROLE_LABELS[role])}: {t(ROLE_HINTS[role])}
          </p>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("Saving…") : t("Add member")}
          </Button>
        </div>
      </form>

      {/* Members List */}
      <section className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
        <h2 className="border-b px-4 py-3 font-semibold">{t("Members")}</h2>
        <ul className="divide-y">
          {members.data?.map((m) => {
            const hasUsername = Boolean(m.profile?.username);
            const isSelf = m.user_id === userId;
            const isOwner = m.role === "owner";
            const displayName = m.profile?.full_name || (hasUsername ? `@${m.profile?.username}` : m.profile?.email) || "Member";
            const subtitle = hasUsername
              ? `@${m.profile?.username}`
              : m.profile?.email && !m.profile.email.endsWith("@staff.bhaibiz.internal")
                ? m.profile.email
                : "";

            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{displayName}</div>
                  {subtitle && (
                    <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
                  )}
                </div>

                {isOwner || isSelf ? (
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {t(ROLE_LABELS[m.role])}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as AppRole)}>
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVITABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {t(ROLE_LABELS[r])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      size="icon"
                      variant="ghost"
                      title={t("Reset password")}
                      aria-label={t("Reset password")}
                      onClick={() => {
                        setResetTarget({ userId: m.user_id, name: displayName });
                        setNewPassword(generateRandomPassword());
                      }}
                    >
                      <KeyRound className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("Remove member")}
                      onClick={() => removeMember(m.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Legacy Pending Invites (if any exist) */}
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

      {/* Credentials Created Dialog */}
      <Dialog open={!!createdCreds} onOpenChange={(open) => !open && setCreatedCreds(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("Member added")}</DialogTitle>
            <DialogDescription>
              Share these login details with your staff member. They can sign in immediately with username and password.
            </DialogDescription>
          </DialogHeader>

          {createdCreds && (
            <div className="space-y-3 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">{t("Name")}:</span>
                <span className="font-semibold text-foreground">{createdCreds.fullName}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">{t("Username")}:</span>
                <span className="font-semibold text-primary">{createdCreds.username}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">{t("Password")}:</span>
                <span className="font-semibold text-foreground">{createdCreds.password}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Role:</span>
                <span className="font-semibold">{t(ROLE_LABELS[createdCreds.role])}</span>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => createdCreds && copyCredentials(createdCreds)}
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {t("Copy credentials")}
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white"
              onClick={() => createdCreds && shareWhatsApp(createdCreds)}
            >
              <Share2 className="h-4 w-4" />
              {t("Share on WhatsApp")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleResetPassword}>
            <DialogHeader>
              <DialogTitle>{t("Reset staff password")}</DialogTitle>
              <DialogDescription>
                Set a new password for <strong>{resetTarget?.name}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="newPassword">{t("New password")}</Label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateRandomPassword())}
                    className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    {t("Generate password")}
                  </button>
                </div>
                <Input
                  id="newPassword"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={isResetting}>
                {isResetting ? t("Saving…") : t("Save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
