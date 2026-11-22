import { useT } from "@/lib/i18n";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Receipt, Wallet, AlertCircle, CheckCircle2, Sliders } from "lucide-react";
import type { AppRole } from "@/lib/company";
import { canHandleMoney, canRecordPayment, methodLabel, type PayMethod } from "@/lib/money";
import { canManageWorkers, formatDate, formatINR, nonNegativeRupeesToPaise, rupeesToPaise } from "@/lib/workers";
import {
  currentPeriod,
  formatPeriod,
  recentPeriods,
  workerRentQuery,
  recordRentPayment,
  chargeWorkerRent,
  invalidateRent,
  computeWorkerRentBreakdown,
} from "@/lib/rent";
import { AmountForm } from "@/components/money/AmountForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DateInput } from "@/components/ui/date-input";

export function WorkerRent({
  workerId,
  companyId,
  role,
  monthlyRentPaise,
  joiningDate,
}: {
  workerId: string;
  companyId: string;
  role: AppRole;
  monthlyRentPaise: number;
  joiningDate?: string | null;
}) {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(workerRentQuery(workerId));

  const [collectOpen, setCollectOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(() => currentPeriod());
  const [collectAmount, setCollectAmount] = useState<number | null>(null);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargePeriod, setChargePeriod] = useState(() => currentPeriod());
  const [chargeAmountRupees, setChargeAmountRupees] = useState(() =>
    monthlyRentPaise > 0 ? (monthlyRentPaise / 100).toString() : ""
  );
  const [chargeDueDate, setChargeDueDate] = useState(() => `${currentPeriod()}-01`);
  const [chargeNotes, setChargeNotes] = useState("");
  const [chargeErr, setChargeErr] = useState<string | null>(null);

  const periods = recentPeriods(12);

  // Group by period with automatic accrual
  const { breakdown: periodSummary, totalCharged, totalPaid, totalDue } = useMemo(() => {
    return computeWorkerRentBreakdown({
      joiningDate,
      monthlyRentPaise,
      charges: data?.charges ?? [],
      payments: data?.payments ?? [],
    });
  }, [joiningDate, monthlyRentPaise, data]);

  const payMutation = useMutation({
    mutationFn: async (v: {
      amount: number;
      date: string;
      method: "cash" | "upi" | "bank" | "other";
      text: string;
    }) => {
      return await recordRentPayment({
        workerId,
        period: selectedPeriod,
        amountPaise: v.amount,
        paidOn: v.date,
        method: v.method,
        reference: v.text,
      });
    },
    onSuccess: (paymentId) => {
      invalidateRent(qc);
      toast.success(t("Rent payment recorded"));
      setCollectOpen(false);
      navigate({ to: "/app/receipts/rent/$rentPaymentId", params: { rentPaymentId: paymentId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chargeMutation = useMutation({
    mutationFn: async () => {
      const paise = nonNegativeRupeesToPaise(chargeAmountRupees);
      if (paise === null || paise < 0) {
        throw new Error(t("Enter a valid rent charge amount above 0."));
      }
      return await chargeWorkerRent({
        workerId,
        period: chargePeriod,
        amountPaise: paise,
        dueDate: chargeDueDate,
        notes: chargeNotes,
      });
    },
    onSuccess: () => {
      invalidateRent(qc);
      toast.success(t("Rent charge saved"));
      setChargeOpen(false);
      setChargeNotes("");
    },
    onError: (e: Error) => {
      setChargeErr(e.message);
      toast.error(e.message);
    },
  });

  function openCollectForPeriod(period: string, dueAmount: number) {
    setSelectedPeriod(period);
    setCollectAmount(dueAmount > 0 ? dueAmount : monthlyRentPaise > 0 ? monthlyRentPaise : null);
    setCollectOpen(true);
  }

  function openAdjustChargeForPeriod(item: {
    period: string;
    charged: number;
    dueDate?: string;
    notes?: string | null;
  }) {
    setChargePeriod(item.period);
    setChargeAmountRupees((item.charged / 100).toString());
    setChargeDueDate(item.dueDate || `${item.period}-01`);
    setChargeNotes(item.notes || "");
    setChargeErr(null);
    setChargeOpen(true);
  }

  const isOperator = role === "operator";
  const canCollect = canRecordPayment(role);
  const canManage = canManageWorkers(role);

  return (
    <div className="mt-4 space-y-6">
      {/* Overview Stat Boxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box
          label="Monthly rent setting"
          value={monthlyRentPaise > 0 ? `${formatINR(monthlyRentPaise)} / mo` : t("None")}
        />
        <Box label="Total charged" value={formatINR(totalCharged)} />
        <Box label="Total collected" value={formatINR(totalPaid)} />
        <Box
          label="Total rent due"
          value={formatINR(totalDue)}
          strong
          highlight={totalDue > 0}
        />
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {canCollect && (
            <Button
              size="sm"
              onClick={() => {
                const currentMonthDue =
                  periodSummary.find((p) => p.period === currentPeriod())?.due ?? monthlyRentPaise;
                openCollectForPeriod(currentPeriod(), currentMonthDue);
              }}
              className="gap-1.5"
            >
              <Wallet className="h-4 w-4" />
              {t("Collect rent")}
            </Button>
          )}
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setChargePeriod(currentPeriod());
                setChargeAmountRupees(
                  monthlyRentPaise > 0 ? (monthlyRentPaise / 100).toString() : ""
                );
                setChargeDueDate(`${currentPeriod()}-01`);
                setChargeNotes("");
                setChargeErr(null);
                setChargeOpen(true);
              }}
              className="gap-1.5"
            >
              <Sliders className="h-4 w-4" />
              {t("Adjust month rent")}
            </Button>
          )}
        </div>
      </div>

      {/* Monthly Billing Breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("Monthly rent breakdown")}</h3>
        {periodSummary.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("No rent charges or payments recorded yet for this worker.")}
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-card">
            {periodSummary.map((item) => {
              const isPaid = item.charged > 0 && item.paid >= item.charged;
              const isPartial = item.paid > 0 && item.paid < item.charged;
              const isPending = item.charged > 0 && item.paid === 0;

              return (
                <div
                  key={item.period}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {formatPeriod(item.period)}
                      </span>
                      {item.isOverride && (
                        <Badge
                          variant="outline"
                          className="border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 text-[10px] py-0 px-1.5"
                        >
                          {t("Custom charge")}
                        </Badge>
                      )}
                      {isPaid && (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {t("Paid")}
                        </Badge>
                      )}
                      {isPartial && (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          {t("Partially paid")}
                        </Badge>
                      )}
                      {isPending && (
                        <Badge variant="destructive">
                          {t("Pending")}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t("Charged")}: {formatINR(item.charged)} · {t("Collected")}: {formatINR(item.paid)}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("Due")}</div>
                      <div className={cn("text-base font-bold", item.due > 0 ? "text-destructive" : "text-foreground")}>
                        {formatINR(item.due)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openAdjustChargeForPeriod(item)}
                          className="h-8 text-xs"
                        >
                          {t("Adjust")}
                        </Button>
                      )}
                      {canCollect && (
                        <Button
                          size="sm"
                          variant={item.due > 0 ? "default" : "outline"}
                          onClick={() => openCollectForPeriod(item.period, item.due)}
                          className="h-8 text-xs gap-1"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          {t("Collect")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Receipts History */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("Rent collection receipts")}</h3>
        {(!data?.payments || data.payments.length === 0) ? (
          <div className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
            {t("No rent receipts recorded yet.")}
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {data.payments.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "flex items-center justify-between gap-3 p-3.5",
                  p.voided_at && "opacity-60"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/app/receipts/rent/$rentPaymentId"
                      params={{ rentPaymentId: p.id }}
                      className="font-medium underline hover:text-primary"
                    >
                      {p.receipt_no}
                    </Link>
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      {formatPeriod(p.period)}
                    </Badge>
                    {p.voided_at && (
                      <Badge variant="destructive" className="text-[10px]">
                        VOID
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(p.paid_on)} · {t(methodLabel(p.method))}
                    {p.reference ? ` · ${p.reference}` : ""}
                    {p.voided_at ? ` · Void: ${p.void_reason}` : ""}
                  </div>
                </div>
                <div className={cn("font-semibold", p.voided_at && "line-through")}>
                  {formatINR(p.amount_paise)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dialog: Collect Rent */}
      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("Collect rent")} — {formatPeriod(selectedPeriod)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("Rent month / period")}</Label>
              <Select value={selectedPeriod} onValueChange={(p) => setSelectedPeriod(p)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.period} value={p.period}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AmountForm
              submitLabel="Save rent payment"
              maximum={undefined}
              busy={payMutation.isPending}
              amountValue={collectAmount !== null ? (collectAmount / 100).toString() : ""}
              onAmountValueChange={(v) => {
                const p = nonNegativeRupeesToPaise(v);
                setCollectAmount(p);
              }}
              onSubmit={(v) => payMutation.mutate(v)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Monthly Charge */}
      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              chargeMutation.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("Adjust month rent")}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t("Override the automatic rent charge for a specific month (e.g., proration, waiver, or special fee).")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>{t("Month / Period")}</Label>
                <Select
                  value={chargePeriod}
                  onValueChange={(p) => {
                    setChargePeriod(p);
                    setChargeDueDate(`${p}-01`);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.period} value={p.period}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rent-charge-amount">{t("Amount (₹)")} *</Label>
                <Input
                  id="rent-charge-amount"
                  value={chargeAmountRupees}
                  onChange={(e) => {
                    setChargeAmountRupees(e.target.value);
                    if (chargeErr) setChargeErr(null);
                  }}
                  inputMode="decimal"
                  placeholder="1500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("Due date")}</Label>
                <DateInput value={chargeDueDate} onChange={setChargeDueDate} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rent-charge-notes">{t("Notes (optional)")}</Label>
                <Input
                  id="rent-charge-notes"
                  value={chargeNotes}
                  onChange={(e) => setChargeNotes(e.target.value)}
                  placeholder="e.g. Full month, Prorated 15 days"
                />
              </div>

              {chargeErr && <p className="text-xs text-destructive">{chargeErr}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChargeOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={chargeMutation.isPending || !chargeAmountRupees.trim()}>
                {chargeMutation.isPending ? t("Saving…") : t("Save adjustment")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Box({
  label,
  value,
  strong,
  highlight,
}: {
  label: string;
  value: string;
  strong?: boolean;
  highlight?: boolean;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3.5",
        highlight && "border-destructive/30 bg-destructive/5"
      )}
    >
      <div className="text-xs text-muted-foreground">{t(label)}</div>
      <div
        className={cn(
          "font-bold mt-0.5",
          strong ? "text-lg text-foreground" : "text-base",
          highlight && "text-destructive"
        )}
      >
        {value}
      </div>
    </div>
  );
}
