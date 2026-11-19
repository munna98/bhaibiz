import { useT } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/company";
import { formatDate, formatINR } from "@/lib/workers";
import { balancesQuery, canAdjust, canHandleMoney, invalidateMoney, ledgerQuery, methodLabel } from "@/lib/money";
import { AmountForm } from "./AmountForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Row = { key: string; date: string; at: string; label: string; detail?: string; amount: number; struck?: boolean; link?: string };

export function WorkerLedger({ workerId, companyId, role }: { workerId: string; companyId: string; role: AppRole }) {
  const t = useT();
  const led = useQuery(ledgerQuery(workerId));
  const bal = useQuery(balancesQuery(companyId)).data?.find((b) => b.worker_id === workerId);
  const [open, setOpen] = useState<null | "waiver" | "credit" | "debit">(null);
  const qc = useQueryClient();
  const adj = useMutation({
    mutationFn: async (v: { kind: string; amount: number; date: string; text: string }) => {
      const { error } = await supabase.rpc("add_adjustment", { _worker: workerId, _kind: v.kind, _amount: v.amount, _on_date: v.date, _reason: v.text });
      if (error) throw error;
    },
    onSuccess: () => { invalidateMoney(qc); setOpen(null); toast.success(t("Saved")); },
    onError: (e: Error) => toast.error(e.message),
  });
  const d = led.data;
  const rows: Row[] = d ? [
    ...d.commission
      .filter((c) => c.kind === "earn" && !("reversed_at" in c && c.reversed_at))
      .map((c) => ({ key: c.id, date: c.work_date, at: c.created_at, label: "Worked — commission", amount: c.amount_paise })),
    ...d.payments.map((p) => ({ key: p.id, date: p.paid_on, at: p.created_at, label: `${t("Paid")} ${t(methodLabel(p.method))} · ${p.receipt_no}`, ...(p.voided_at ? { detail: `Void: ${p.void_reason}` } : {}), amount: -p.amount_paise, struck: !!p.voided_at, link: p.id })),
    ...d.adjustments.map((a) => ({ key: a.id, date: a.on_date, at: a.created_at, label: a.kind === "waiver" ? "Waiver" : a.kind === "credit" ? "Credit adjustment" : "Debit adjustment", detail: a.reason, amount: a.kind === "debit" ? a.amount_paise : -a.amount_paise })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at)) : [];

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Box label="Earned" value={bal ? formatINR(bal.earned) : "—"} />
        <Box label="Collected" value={bal ? formatINR(bal.collected) : "—"} />
        <Box label="Due" value={bal ? formatINR(Math.max(0, bal.outstanding)) : "—"} strong />
      </div>
      <div className="flex flex-wrap gap-2">
        {canHandleMoney(role) && <Button asChild size="sm"><Link to="/app/collect">{t("Collect payment")}</Link></Button>}
        {canAdjust(role) && <>
          <Button size="sm" variant="outline" onClick={() => setOpen("waiver")}>{t("Waive")}</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen("credit")}>{t("Credit")}</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen("debit")}>{t("Debit")}</Button>
        </>}
      </div>
      <ul className="divide-y rounded-xl border bg-card text-sm">
        {rows.length === 0 && <li className="p-4 text-center text-muted-foreground">{t("No entries yet.")}</li>}
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className={cn(r.struck && "line-through opacity-60")}>
                {r.link ? <Link to="/app/receipts/$paymentId" params={{ paymentId: r.link }} className="underline">{r.label}</Link> : t(r.label)}
              </div>
              <div className="text-xs text-muted-foreground">{formatDate(r.date)}{r.detail ? ` · ${r.detail}` : ""}</div>
            </div>
            <div className={cn("shrink-0 font-medium", r.amount < 0 ? "text-primary" : "", r.struck && "line-through opacity-60")}>
              {r.amount < 0 ? "−" : "+"}{formatINR(Math.abs(r.amount))}
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{open === "waiver" ? t("Waive dues") : open === "credit" ? t("Credit (reduce dues)") : t("Debit (increase dues)")}</DialogTitle></DialogHeader>
          {open && <AmountForm withMethod={false} maximum={open === "debit" ? undefined : Math.max(0, bal?.outstanding ?? 0)} textLabel="Reason" textRequired submitLabel="Save" busy={adj.isPending} onSubmit={(v) => adj.mutate({ kind: open, ...v })} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WorkerAdvances({ workerId, companyId, role }: { workerId: string; companyId: string; role: AppRole }) {
  const t = useT();
  const led = useQuery(ledgerQuery(workerId));
  const bal = useQuery(balancesQuery(companyId)).data?.find((b) => b.worker_id === workerId);
  const [open, setOpen] = useState<null | "give" | "repay">(null);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (v: { amount: number; date: string; method: "cash" | "upi" | "bank" | "other"; text: string }) => {
      const r = open === "give"
        ? await supabase.rpc("give_advance", { _worker: workerId, _amount: v.amount, _given_on: v.date, _reason: v.text })
        : await supabase.rpc("repay_advance", { _worker: workerId, _amount: v.amount, _paid_on: v.date, _method: v.method, _reference: v.text });
      if (r.error) throw r.error;
    },
    onSuccess: () => { invalidateMoney(qc); setOpen(null); toast.success(t("Saved")); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = led.data ? [
    ...led.data.advances.map((a) => ({ key: a.id, date: a.given_on, at: a.created_at, label: "Advance given", detail: a.reason, amount: a.amount_paise })),
    ...led.data.repayments.map((r) => ({ key: r.id, date: r.paid_on, at: r.created_at, label: `${t("Repaid")} ${t(methodLabel(r.method))}`, detail: r.reference, amount: -r.amount_paise })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at)) : [];
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs text-muted-foreground">{t("Advance balance (kept separate from commission)")}</div>
        <div className="text-2xl font-bold">{bal ? formatINR(bal.advance) : "—"}</div>
      </div>
      {canHandleMoney(role) && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setOpen("give")}>{t("Give advance")}</Button>
          <Button size="sm" variant="outline" disabled={!bal || bal.advance <= 0} onClick={() => setOpen("repay")}>{t("Record repayment")}</Button>
        </div>
      )}
      <ul className="divide-y rounded-xl border bg-card text-sm">
        {rows.length === 0 && <li className="p-4 text-center text-muted-foreground">{t("No advances.")}</li>}
        {rows.map((r) => (
          <li key={r.key} className="flex justify-between gap-2 p-3">
            <div><div>{r.label}</div><div className="text-xs text-muted-foreground">{formatDate(r.date)}{r.detail ? ` · ${r.detail}` : ""}</div></div>
            <div className="font-medium">{r.amount < 0 ? "−" : "+"}{formatINR(Math.abs(r.amount))}</div>
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{open === "give" ? t("Give advance") : t("Advance repayment")}</DialogTitle></DialogHeader>
          {open && <AmountForm withMethod={open === "repay"} maximum={open === "repay" ? Math.max(0, bal?.advance ?? 0) : undefined} textLabel={open === "give" ? t("Reason (optional)") : t("Reference (optional)")} submitLabel="Save" busy={save.isPending} onSubmit={(v) => save.mutate(v)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Box({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useT();
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{t(label)}</div>
      <div className={cn("font-bold", strong ? "text-xl text-primary" : "text-lg")}>{value}</div>
    </div>
  );
}
