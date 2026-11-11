import { useT } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { canManageWorkers, workersQuery, type Worker } from "@/lib/workers";
import { useActiveMembership } from "../../app";
import {
  checkPersonal, personalFromWorker, WorkerPersonalFields, type PersonalErrors,
} from "@/components/workers/WorkerFields";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/workers/$workerId_/edit")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Edit worker — BhaiBiz" },
      { name: "description", content: "Update a worker's personal details." },
      { property: "og:title", content: "Edit worker — BhaiBiz" },
      { property: "og:description", content: "Update a worker's personal details." },
    ],
  }),
  loader: async ({ context }) => {
    const active = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (active) await context.queryClient.ensureQueryData(workersQuery(active.company_id));
  },
  component: EditWorkerPage,
});

function EditWorkerPage() {
  const t = useT();
  const { workerId } = Route.useParams();
  const { active } = useActiveMembership();
  const { data: workers } = useSuspenseQuery(workersQuery(active.company_id));
  const worker = workers.find((w) => w.id === workerId);
  if (!worker) return <p className="text-muted-foreground">{t("Worker not found.")}</p>;
  if (!canManageWorkers(active.role)) return <p className="text-muted-foreground">{t("Only owners and managers can edit workers.")}</p>;
  return <EditForm key={worker.id} worker={worker} />;
}

function EditForm({ worker }: { worker: Worker }) {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(() => personalFromWorker(worker));
  const [errors, setErrors] = useState<PersonalErrors>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const { errors: e, value } = checkPersonal(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const blank = (s: string) => (s.trim() ? s.trim() : null);
    const { error } = await supabase
      .from("workers")
      .update({
        full_name: value.full_name,
        mobile: value.mobile,
        alt_mobile: blank(value.alt_mobile),
        native_state: blank(value.native_state),
        native_address: blank(value.native_address),
        kerala_address: blank(value.kerala_address),
        emergency_name: blank(value.emergency_name),
        emergency_phone: blank(value.emergency_phone),
        category: blank(value.category),
        joining_date: value.joining_date,
        notes: blank(value.notes),
      })
      .eq("id", worker.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["workers", worker.company_id] });
    qc.invalidateQueries({ queryKey: ["reports"] });
    toast.success(t("Saved"));
    navigate({ to: "/app/workers/$workerId", params: { workerId: worker.id } });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/app/workers/$workerId" params={{ workerId: worker.id }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> {worker.full_name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{t("Edit details")} {worker.worker_code}</h1>
      <div className="mt-5 rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
        <WorkerPersonalFields value={form} onChange={setForm} errors={errors} />
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link to="/app/workers/$workerId" params={{ workerId: worker.id }}>{t("Cancel")}</Link>
          </Button>
          <Button onClick={save} disabled={busy}>{busy ? t("Saving…") : t("Save changes")}</Button>
        </div>
      </div>
    </div>
  );
}
