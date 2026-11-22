import { useT } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Home, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatINR } from "@/lib/workers";
import { methodLabel } from "@/lib/money";
import { formatPeriod, invalidateRent, rentPaymentQuery, voidRentPayment } from "@/lib/rent";
import { capitalizeWords } from "@/lib/utils";
import { useActiveMembership } from "../../../app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/receipts/rent/$rentPaymentId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Rent Receipt — BhaiBiz" },
      { name: "description", content: "Payment receipt for a worker's room rent." },
      { property: "og:title", content: "Rent Receipt — BhaiBiz" },
      { property: "og:description", content: "Payment receipt for a worker's room rent." },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(rentPaymentQuery(params.rentPaymentId)),
  component: RentReceiptPage,
});

function RentReceiptPage() {
  const t = useT();
  const { rentPaymentId } = Route.useParams();
  const { data: p } = useSuspenseQuery(rentPaymentQuery(rentPaymentId));
  const { active } = useActiveMembership();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  const accName = (p.worker as any)?.accommodation?.name;
  const periodLabel = formatPeriod(p.period);

  const text = `${p.company?.name}\nRent Receipt ${p.receipt_no}\nMonth: ${periodLabel}\nDate: ${formatDate(
    p.paid_on
  )}\nWorker: ${capitalizeWords(p.worker?.full_name ?? "")} (${p.worker?.worker_code})${
    accName ? `\nAccommodation: ${accName}` : ""
  }\nAmount: ${formatINR(p.amount_paise)} by ${methodLabel(p.method)}${
    p.voided_at ? "\nVOID" : ""
  }`;

  const voidIt = useMutation({
    mutationFn: async () => {
      await voidRentPayment(p.id, reason);
    },
    onSuccess: () => {
      invalidateRent(qc);
      toast.success(t("Rent payment voided"));
      setVoiding(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* cancelled */
      }
    } else {
      window.open(
        `https://wa.me/91${p.worker?.mobile ?? ""}?text=${encodeURIComponent(text)}`,
        "_blank"
      );
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="receipt-document rounded-lg border bg-card p-6 print:border-0 shadow-sm">
        <div className="text-center">
          <div className="text-lg font-bold">{p.company?.name}</div>
          {p.company?.address && (
            <div className="text-xs text-muted-foreground">{p.company.address}</div>
          )}
          {p.company?.phone && (
            <div className="text-xs text-muted-foreground">{p.company.phone}</div>
          )}
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Home className="h-3 w-3" />
            {t("Rent Receipt")}
          </div>
        </div>

        <div className="mt-4 flex justify-between border-y py-2 text-sm">
          <span className="font-semibold">{p.receipt_no}</span>
          <span>{formatDate(p.paid_on)}</span>
        </div>

        {p.voided_at && (
          <div className="mt-3 rounded-md bg-destructive/10 p-2 text-center text-sm font-semibold text-destructive">
            VOID — {p.void_reason}
          </div>
        )}

        <div className="mt-4 text-sm">
          {t("Received from")} <b className="capitalize">{p.worker?.full_name}</b> (
          {p.worker?.worker_code})
        </div>

        <div className="mt-2 text-3xl font-bold">{formatINR(p.amount_paise)}</div>
        <div className="text-sm text-muted-foreground">
          {methodLabel(p.method)}
          {p.reference ? ` · ${p.reference}` : ""}
        </div>

        <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("Rent period")}:</span>
            <span className="font-medium">{periodLabel}</span>
          </div>
          {accName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Accommodation")}:</span>
              <span className="font-medium capitalize">{accName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2 print:hidden">
        <Button className="flex-1" onClick={share}>
          <Share2 className="mr-1 h-4 w-4" /> {t("Share")}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" /> {t("Print")}
        </Button>
      </div>

      <div className="mt-3 flex justify-between text-sm print:hidden">
        <Link to="/app/collect" className="text-primary underline">
          {t("Collect another")}
        </Link>
        {active.role === "owner" && !p.voided_at && (
          <Button
            variant="link"
            className="h-auto p-0 text-destructive"
            onClick={() => setVoiding(true)}
          >
            {t("Void payment")}
          </Button>
        )}
      </div>

      {voiding && (
        <div className="mt-3 flex gap-2 print:hidden">
          <Input
            placeholder={t("Reason for voiding")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="destructive"
            disabled={!reason.trim() || voidIt.isPending}
            onClick={() => voidIt.mutate()}
          >
            {t("Void")}
          </Button>
        </div>
      )}
    </div>
  );
}
