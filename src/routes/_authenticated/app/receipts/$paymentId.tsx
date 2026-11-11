import { useT } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatINR } from "@/lib/workers";
import { invalidateMoney, methodLabel, paymentQuery } from "@/lib/money";
import { useActiveMembership } from "../../app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/receipts/$paymentId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Receipt — BhaiBiz" },
      { name: "description", content: "Payment receipt for a worker's commission." },
      { property: "og:title", content: "Receipt — BhaiBiz" },
      { property: "og:description", content: "Payment receipt for a worker's commission." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(paymentQuery(params.paymentId)),
  component: ReceiptPage,
});

function ReceiptPage() {
  const t = useT();
  const { paymentId } = Route.useParams();
  const { data: p } = useSuspenseQuery(paymentQuery(paymentId));
  const { active } = useActiveMembership();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const days = [...(p.allocations ?? [])].sort((a, b) => (a.entry?.work_date ?? "").localeCompare(b.entry?.work_date ?? ""));
  const text = `${p.company?.name}\nReceipt ${p.receipt_no}\nDate: ${formatDate(p.paid_on)}\nWorker: ${p.worker?.full_name} (${p.worker?.worker_code})\nAmount: ${formatINR(p.amount_paise)} by ${methodLabel(p.method)}${p.voided_at ? "\nVOID" : ""}`;

  const voidIt = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("void_payment", { _payment: p.id, _reason: reason }); if (error) throw error; },
    onSuccess: () => { invalidateMoney(qc); toast.success(t("Payment voided")); setVoiding(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function share() {
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } }
    else window.open(`https://wa.me/91${p.worker?.mobile ?? ""}?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="receipt-document rounded-lg border bg-card p-6 print:border-0">
        <div className="text-center">
          <div className="text-lg font-bold">{p.company?.name}</div>
          {p.company?.address && <div className="text-xs text-muted-foreground">{p.company.address}</div>}
          {p.company?.phone && <div className="text-xs text-muted-foreground">{p.company.phone}</div>}
        </div>
        <div className="mt-4 flex justify-between border-y py-2 text-sm">
          <span className="font-semibold">{p.receipt_no}</span><span>{formatDate(p.paid_on)}</span>
        </div>
        {p.voided_at && <div className="mt-3 rounded-md bg-destructive/10 p-2 text-center text-sm font-semibold text-destructive">VOID — {p.void_reason}</div>}
        <div className="mt-4 text-sm">{t("Received from")}<b>{p.worker?.full_name}</b> ({p.worker?.worker_code})</div>
        <div className="mt-2 text-3xl font-bold">{formatINR(p.amount_paise)}</div>
        <div className="text-sm text-muted-foreground">{methodLabel(p.method)}{p.reference ? ` · ${p.reference}` : ""}</div>
        {days.length > 0 && (
          <div className="mt-4 text-sm">
            <div className="mb-1 font-medium">{t("Days paid")}</div>
            {days.map((d, i) => (
              <div key={i} className="flex justify-between"><span>{formatDate(d.entry?.work_date)}</span><span>{formatINR(d.amount_paise)}</span></div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-2 print:hidden">
        <Button className="flex-1" onClick={share}><Share2 className="mr-1 h-4 w-4" /> {t("Share")}</Button>
        <Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> {t("Print")}</Button>
      </div>
      <div className="mt-3 flex justify-between text-sm print:hidden">
        <Link to="/app/collect" className="text-primary underline">{t("Collect another")}</Link>
        {active.role === "owner" && !p.voided_at && <Button variant="link" className="h-auto p-0 text-destructive" onClick={() => setVoiding(true)}>{t("Void payment")}</Button>}
      </div>
      {voiding && (
        <div className="mt-3 flex gap-2 print:hidden">
          <Input placeholder={t("Reason for voiding")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="destructive" disabled={!reason.trim() || voidIt.isPending} onClick={() => voidIt.mutate()}>{t("Void")}</Button>
        </div>
      )}
    </div>
  );
}
