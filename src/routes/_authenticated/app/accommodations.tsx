import { useT } from "@/lib/i18n";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, Users, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { workersQuery } from "@/lib/workers";
import {
  accommodationsQuery,
  createAccommodation,
  updateAccommodation,
  deleteAccommodation,
  operatorAccommodationsQuery,
  type Accommodation,
} from "@/lib/accommodations";
import { useActiveMembership } from "../app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/accommodations")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Accommodations — BhaiBiz" },
      { name: "description", content: "Manage worker accommodations and operator assignments." },
      { property: "og:title", content: "Accommodations — BhaiBiz" },
      { property: "og:description", content: "Manage worker accommodations and operator assignments." },
    ],
  }),
  loader: async ({ context }) => {
    const active = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (!active) return;
    if (active.role === "operator") throw redirect({ to: "/app" });
    await Promise.all([
      context.queryClient.ensureQueryData(accommodationsQuery(active.company_id)),
      context.queryClient.ensureQueryData(workersQuery(active.company_id)),
    ]);
  },
  component: AccommodationsPage,
});

function AccommodationsPage() {
  const t = useT();
  const { active } = useActiveMembership();
  const cid = active.company_id;
  const qc = useQueryClient();

  const { data: accommodations } = useSuspenseQuery(accommodationsQuery(cid));
  const { data: workers } = useSuspenseQuery(workersQuery(cid));
  const opAccs = useQuery(operatorAccommodationsQuery(cid));

  // Fetch profiles for operators
  const members = useQuery({
    queryKey: ["members", cid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, user_id, role")
        .eq("company_id", cid)
        .eq("role", "operator");
      if (error) throw error;
      const ids = data.map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", ids);
      return data.map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) }));
    },
  });

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<Accommodation | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editing, setEditing] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Accommodation | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await createAccommodation({
        companyId: cid,
        name: createName,
        address: createAddress,
      });
      await qc.invalidateQueries({ queryKey: ["accommodations", cid] });
      toast.success(t("Accommodation created"));
      setCreateName("");
      setCreateAddress("");
      setCreateOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create accommodation");
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !editName.trim()) return;
    setEditing(true);
    try {
      await updateAccommodation({
        id: editTarget.id,
        name: editName,
        address: editAddress,
      });
      await qc.invalidateQueries({ queryKey: ["accommodations", cid] });
      toast.success(t("Accommodation updated"));
      setEditTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update accommodation");
    } finally {
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAccommodation(deleteTarget.id);
      await qc.invalidateQueries({ queryKey: ["accommodations", cid] });
      await qc.invalidateQueries({ queryKey: ["workers", cid] });
      await qc.invalidateQueries({ queryKey: ["operator-accommodations", cid] });
      toast.success(t("Accommodation deleted"));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete accommodation");
    } finally {
      setDeleting(false);
    }
  }

  const isManager = active.role === "owner" || active.role === "manager";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("Accommodations")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Manage worker camps and hostels, and assign them to operators.")}
          </p>
        </div>
        {isManager && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            {t("Add accommodation")}
          </Button>
        )}
      </div>

      {accommodations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t("No accommodations yet")}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t(
              "Create accommodations to group workers by where they stay and assign operators to manage them."
            )}
          </p>
          {isManager && (
            <Button onClick={() => setCreateOpen(true)} className="mt-5 gap-2">
              <Plus className="h-4 w-4" />
              {t("Add accommodation")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accommodations.map((acc) => {
            const assignedWorkers = workers.filter((w) => w.accommodation_id === acc.id);
            const assignedOpIds =
              opAccs.data?.filter((oa) => oa.accommodation_id === acc.id).map((oa) => oa.user_id) ?? [];
            const assignedOps = members.data?.filter((m) => assignedOpIds.includes(m.user_id)) ?? [];

            return (
              <div
                key={acc.id}
                className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <h2 className="text-base font-semibold text-foreground">{acc.name}</h2>
                    </div>
                    {isManager && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditTarget(acc);
                            setEditName(acc.name);
                            setEditAddress(acc.address ?? "");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(acc)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {acc.address && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{acc.address}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary" className="flex items-center gap-1 font-normal">
                      <Users className="h-3.5 w-3.5" />
                      <span>
                        {assignedWorkers.length} {t("workers")}
                      </span>
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1 font-normal">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>
                        {assignedOps.length} {t("operators")}
                      </span>
                    </Badge>
                  </div>

                  {assignedOps.length > 0 && (
                    <div className="mt-3 border-t pt-2.5">
                      <div className="text-[11px] font-medium text-muted-foreground">
                        {t("Assigned operators")}:
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {assignedOps.map((op) => (
                          <span
                            key={op.id}
                            className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
                          >
                            {op.profile?.full_name || op.profile?.username || "Operator"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>{t("Add accommodation")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="acc-name">{t("Name")} *</Label>
                <Input
                  id="acc-name"
                  placeholder="e.g. Camp 1, Room 102"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-address">{t("Address / Location")}</Label>
                <Textarea
                  id="acc-address"
                  placeholder="e.g. Near City Center, Building B"
                  value={createAddress}
                  onChange={(e) => setCreateAddress(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={creating || !createName.trim()}>
                {creating ? t("Saving…") : t("Save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>{t("Edit accommodation")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-acc-name">{t("Name")} *</Label>
                <Input
                  id="edit-acc-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-acc-address">{t("Address / Location")}</Label>
                <Textarea
                  id="edit-acc-address"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={editing || !editName.trim()}>
                {editing ? t("Saving…") : t("Save changes")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete accommodation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Are you sure you want to delete this accommodation? Workers assigned to it will become unassigned."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("Deleting…") : t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
