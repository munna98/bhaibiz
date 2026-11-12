import { useT } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Camera, Eye, FileText, FileUp, Pencil, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { formatAadhaar, maskAadhaar, validateAadhaar } from "@/lib/aadhaar";
import {
  agreementsQuery, BUCKET, canChangeRate, canManageWorkers, canSeeAadhaar, documentsQuery, formatDate, formatINR,
  rateOn, rupeesToPaise, signedPhotoUrls, statusHistoryQuery, todayISO, workersQuery, type Worker,
} from "@/lib/workers";
import { changeAadhaar, revealAadhaar } from "@/lib/workers.functions";
import { uploadAadhaarDoc, uploadWorkerPhoto } from "@/lib/worker-uploads";
import { useActiveMembership } from "../../app";
import { Field, StatusBadge, WorkerAvatar } from "@/components/workers/WorkerFields";
import { AadhaarInput } from "@/components/workers/AadhaarInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkerAdvances, WorkerLedger } from "@/components/money/WorkerMoney";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";

export const Route = createFileRoute("/_authenticated/app/workers/$workerId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Worker profile — BhaiBiz" },
      { name: "description", content: "Worker details, Aadhaar, daily rate history and status." },
      { property: "og:title", content: "Worker profile — BhaiBiz" },
      { property: "og:description", content: "Worker details, Aadhaar, daily rate history and status." },
    ],
  }),
  loader: async ({ context }) => {
    const active = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (!active) return;
    await Promise.all([
      context.queryClient.ensureQueryData(workersQuery(active.company_id)),
      context.queryClient.ensureQueryData(agreementsQuery(active.company_id)),
    ]);
  },
  component: WorkerProfile,
});

function WorkerProfile() {
  const t = useT();
  const { workerId } = Route.useParams();
  const { active } = useActiveMembership();
  const { data: workers } = useSuspenseQuery(workersQuery(active.company_id));
  const worker = workers.find((w) => w.id === workerId);
  if (!worker) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-muted-foreground">{t("Worker not found.")}</p>
        <Link to="/app/workers" className="text-sm text-primary underline">{t("Back to workers")}</Link>
      </div>
    );
  }
  return <Profile key={worker.id} worker={worker} />;
}

function Profile({ worker }: { worker: Worker }) {
  const t = useT();
  const { active } = useActiveMembership();
  const role = active.role;
  const cid = active.company_id;
  const qc = useQueryClient();
  const { data: allAgreements } = useSuspenseQuery(agreementsQuery(cid));
  const agreements = allAgreements.filter((a) => a.worker_id === worker.id);
  const today = todayISO();
  const rate = rateOn(agreements, today);
  const photo = useQuery({
    queryKey: ["photo-url", worker.photo_path],
    queryFn: async () => (worker.photo_path ? (await signedPhotoUrls([worker.photo_path]))[worker.photo_path] : null),
    staleTime: 30 * 60 * 1000,
  });
  const photoInput = useRef<HTMLInputElement>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    try {
      await uploadWorkerPhoto(cid, worker.id, f);
      await qc.invalidateQueries({ queryKey: ["workers", cid] });
      toast.success(t("Photo updated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/workers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> {t("Workers")}</Link>

      <div className="mt-3 rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative">
            <WorkerAvatar name={worker.full_name} url={photo.data} size="lg" />
            {canManageWorkers(role) && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  aria-label={t("Change photo")}
                  onClick={() => photoInput.current?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full border bg-card p-1.5 shadow"
                >
                  <Camera className="h-3.5 w-3.5" />
                </Button>
                <input ref={photoInput} type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{worker.full_name}</h1>
              <StatusBadge status={worker.status} />
            </div>
            <div className="text-sm text-muted-foreground">
              {worker.worker_code}{worker.category ? ` · ${worker.category}` : ""} · {t("Joined")} {formatDate(worker.joining_date)}
            </div>
            <a href={`tel:${worker.mobile}`} className="mt-1 inline-flex items-center gap-1 text-sm text-primary">
              <Phone className="h-3.5 w-3.5" /> {worker.mobile}
            </a>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{t("Today's rate")}</div>
            <div className="text-2xl font-bold text-primary">{rate ? formatINR(rate) : "—"}</div>
            <div className="text-xs text-muted-foreground">{t("per worked day")}</div>
          </div>
        </div>
        {canManageWorkers(role) && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/workers/$workerId/edit" params={{ workerId: worker.id }}><Pencil className="mr-1 h-3.5 w-3.5" /> {t("Edit details")}</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}>
              {worker.status === "active" ? t("Mark inactive") : t("Mark active again")}
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="details" className="mt-5">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="details">{t("Details")}</TabsTrigger>
          <TabsTrigger value="ledger">{t("Ledger")}</TabsTrigger>
          <TabsTrigger value="advances">{t("Advances")}</TabsTrigger>
          <TabsTrigger value="identity">{t("Aadhaar")}</TabsTrigger>
          <TabsTrigger value="rates">{t("Rate history")}</TabsTrigger>
          <TabsTrigger value="status">{t("Status history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="details"><Details worker={worker} /></TabsContent>
        <TabsContent value="ledger"><WorkerLedger workerId={worker.id} companyId={cid} role={active.role} /></TabsContent>
        <TabsContent value="advances"><WorkerAdvances workerId={worker.id} companyId={cid} role={active.role} /></TabsContent>
        <TabsContent value="identity"><Identity worker={worker} /></TabsContent>
        <TabsContent value="rates"><Rates worker={worker} agreements={agreements} today={today} /></TabsContent>
        <TabsContent value="status"><StatusHistory workerId={worker.id} /></TabsContent>
      </Tabs>

      <StatusDialog worker={worker} open={statusOpen} onOpenChange={setStatusOpen} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const t = useT();
  return (
    <div className="py-2.5">
      <div className="text-xs text-muted-foreground">{t(label)}</div>
      <div className="text-sm">{value?.trim() ? value : "—"}</div>
    </div>
  );
}

function Details({ worker }: { worker: Worker }) {
  const t = useT();
  return (
    <div className="grid rounded-xl border bg-card px-5 py-2 sm:grid-cols-2 sm:gap-x-6">
      <Row label="Mobile" value={worker.mobile} />
      <Row label="Other mobile" value={worker.alt_mobile} />
      <Row label="Home state" value={worker.native_state} />
      <Row label="Home address" value={worker.native_address} />
      <Row label="Address in Kerala" value={worker.kerala_address} />
      <Row label="Work type" value={worker.category} />
      <Row label="Emergency contact" value={[worker.emergency_name, worker.emergency_phone].filter(Boolean).join(" · ")} />
      <Row label="Joining date" value={formatDate(worker.joining_date)} />
      <div className="sm:col-span-2"><Row label="Notes" value={worker.notes} /></div>
    </div>
  );
}

function Identity({ worker }: { worker: Worker }) {
  const t = useT();
  const { active } = useActiveMembership();
  const cid = active.company_id;
  const owner = canSeeAadhaar(active.role);
  const qc = useQueryClient();
  const reveal = useServerFn(revealAadhaar);
  const change = useServerFn(changeAadhaar);
  const docs = useQuery(documentsQuery(worker.id));
  const [full, setFull] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [newNo, setNewNo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const docInput = useRef<HTMLInputElement>(null);

  async function show() {
    try {
      const r = await reveal({ data: { workerId: worker.id } });
      setFull(r.aadhaar);
      setTimeout(() => setFull(null), 30_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not show number");
    }
  }

  async function saveNew() {
    const v = validateAadhaar(newNo);
    setErr(v);
    if (v) return;
    setBusy(true);
    try {
      await change({ data: { workerId: worker.id, aadhaar: newNo } });
      await qc.invalidateQueries({ queryKey: ["workers", cid] });
      toast.success(t("Aadhaar number updated"));
      setChangeOpen(false);
      setNewNo("");
      setFull(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  async function openDoc(path: string) {
    const win = window.open("", "_blank");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data) { win?.close(); toast.error("Could not open the document"); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { win?.close(); return; }
    const { error: auditError } = await supabase.from("audit_log").insert({ company_id: cid, entity: "worker", entity_id: worker.id, action: "aadhaar_doc_viewed", actor_id: auth.user.id });
    if (auditError) { win?.close(); toast.error(t("Could not open the document")); return; }
    if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  }

  async function onDoc(f: File | undefined) {
    if (!f) return;
    try {
      await uploadAadhaarDoc(cid, worker.id, f);
      await qc.invalidateQueries({ queryKey: ["worker-documents", worker.id] });
      toast.success(t("Aadhaar copy uploaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="text-xs text-muted-foreground">{t("Aadhaar number")}</div>
        <div className="mt-1 font-mono text-lg tracking-wider">{full ?? maskAadhaar(worker.aadhaar_last4)}</div>
        {owner ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {!full && <Button size="sm" variant="outline" onClick={show}><Eye className="mr-1 h-3.5 w-3.5" /> {t("Show full number")}</Button>}
            <Button size="sm" variant="ghost" onClick={() => { setChangeOpen(true); setErr(null); }}>{t("Correct number")}</Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{t("Only the owner can see the full number.")}</p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="font-medium">{t("Aadhaar copies")}</div>
          {canManageWorkers(active.role) && (
            <>
              <Button size="sm" variant="outline" onClick={() => docInput.current?.click()}><FileUp className="mr-1 h-3.5 w-3.5" /> {t("Upload")}</Button>
              <input ref={docInput} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => onDoc(e.target.files?.[0])} />
            </>
          )}
        </div>
        {docs.data && docs.data.length > 0 ? (
          <ul className="mt-3 divide-y">
            {docs.data.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{d.file_name ?? "Aadhaar copy"} · {formatDate(d.uploaded_at)}</span>
                {owner && <Button size="sm" variant="ghost" onClick={() => openDoc(d.storage_path)}>{t("View")}</Button>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("No copy uploaded. This is optional.")}</p>
        )}
      </div>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Correct Aadhaar number")}</DialogTitle>
            <DialogDescription>{t("Use this only if the number was entered wrongly. The change is recorded.")}</DialogDescription>
          </DialogHeader>
          <Field label="New Aadhaar number" required error={err ?? undefined}>
            <AadhaarInput
              value={newNo}
              onChange={(val) => {
                setNewNo(val);
                if (err) setErr(null);
              }}
              onClearError={() => {
                if (err) setErr(null);
              }}
              inputMode="numeric"
              placeholder="1234 5678 9012"
              className="font-mono tracking-wider"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={saveNew} disabled={busy}>{busy ? t("Saving…") : t("Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Rates({ worker, agreements, today }: { worker: Worker; agreements: { id: string; daily_rate_paise: number; effective_from: string; note: string | null }[]; today: string }) {
  const t = useT();
  const { active } = useActiveMembership();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(() => {
    if (!agreements.some((a) => a.effective_from === today)) return today;
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sorted = [...agreements].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  const current = sorted.find((a) => a.effective_from <= today);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const paise = rupeesToPaise(amount);
    if (!paise) { setErr("Enter the new daily commission in rupees."); return; }
    if (!from) { setErr("Pick the start date."); return; }
    setErr(null);
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(false); return; }
    const { error } = await supabase.from("commission_agreements").insert({
      company_id: worker.company_id, worker_id: worker.id, daily_rate_paise: paise, effective_from: from,
      note: note.trim() || null, created_by: u.user.id,
    });
    setBusy(false);
    if (error) {
      setErr(error.code === "23505" ? "A rate already starts on that date. Pick another date." : error.message);
      return;
    }
    toast.success(t("New rate saved"));
    setAmount(""); setNote("");
    qc.invalidateQueries({ queryKey: ["agreements", worker.company_id] });
    qc.invalidateQueries({ queryKey: ["reports"] });
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-xl border bg-card">
        {sorted.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div>
              <div className="font-semibold">{formatINR(a.daily_rate_paise)} <span className="text-xs font-normal text-muted-foreground">{t("per day")}</span></div>
              <div className="text-xs text-muted-foreground">{t("From")}{formatDate(a.effective_from)}{a.note ? ` · ${a.note}` : ""}</div>
            </div>
            {a.id === current?.id && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t("Current")}</span>}
            {a.effective_from > today && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground">{t("Upcoming")}</span>}
          </li>
        ))}
      </ul>

      {canChangeRate(active.role) ? (
        <form onSubmit={add} className="rounded-xl border bg-card p-5">
          <div className="font-medium">{t("Change rate")}</div>
          <p className="text-xs text-muted-foreground">{t("Days before the start date keep their old rate.")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="New daily commission (₹)" error={err ?? undefined}>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Starts from">
              <DateInput value={from} onChange={(v) => setFrom(v)} />
            </Field>
            <Field label="Note">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Optional")} />
            </Field>
          </div>
          <Button type="submit" className="mt-4" disabled={busy}>{busy ? t("Saving…") : t("Save new rate")}</Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">{t("Only the owner can change rates.")}</p>
      )}
    </div>
  );
}

function StatusHistory({ workerId }: { workerId: string }) {
  const t = useT();
  const { data } = useQuery(statusHistoryQuery(workerId));
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {(data ?? []).map((h) => (
        <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3">
          <div>
            <StatusBadge status={h.status} />
            <div className="mt-1 text-xs text-muted-foreground">{h.reason ?? t("No reason given")}</div>
          </div>
          <div className="text-sm">{t("From")}{formatDate(h.effective_date)}</div>
        </li>
      ))}
    </ul>
  );
}

function StatusDialog({ worker, open, onOpenChange }: { worker: Worker; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const qc = useQueryClient();
  const toInactive = worker.status === "active";
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("set_worker_status", {
      _worker: worker.id, _status: toInactive ? "inactive" : "active", _date: date, _reason: reason,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(toInactive ? "Marked inactive" : "Marked active");
    setReason("");
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["workers", worker.company_id] });
    qc.invalidateQueries({ queryKey: ["worker-status-history", worker.id] });
    qc.invalidateQueries({ queryKey: ["reports"] });
    qc.invalidateQueries({ queryKey: ["balances"] });
    qc.invalidateQueries({ queryKey: ["attendance"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{toInactive ? `${t("Mark inactive")}: ${worker.full_name}` : `${t("Mark active again")}: ${worker.full_name}`}</DialogTitle>
          <DialogDescription>
            {toInactive
              ? "They leave the daily attendance list and stop earning commission. Unpaid dues stay on record."
              : "They come back on the daily attendance list. Old dues are still visible."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="From date"><DateInput value={date} min={worker.joining_date} max={todayISO()} onChange={(v) => setDate(v)} /></Field>
          <Field label="Reason"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={toInactive ? "Went home for 2 months" : "Returned"} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel")}</Button>
          <Button onClick={save} disabled={busy}>{busy ? t("Saving…") : t("Confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
