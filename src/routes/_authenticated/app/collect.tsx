import { useT } from "@/lib/i18n";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { formatDate, formatINR, workersQuery } from "@/lib/workers";
import { balancesQuery, canRecordPayment, invalidateMoney, unpaidDaysQuery } from "@/lib/money";
import { useActiveMembership } from "../app";
import { WorkerAvatar, StatusBadge } from "@/components/workers/WorkerFields";
import { AmountForm } from "@/components/money/AmountForm";
import { DaySelectionCards } from "@/components/money/DaySelectionCards";
import { useDaySelection } from "@/components/money/useDaySelection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/collect")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Collect — BhaiBiz" },
      { name: "description", content: "Record a commission payment and issue a receipt." },
      { property: "og:title", content: "Collect — BhaiBiz" },
      { property: "og:description", content: "Record a commission payment and issue a receipt." },
    ],
  }),
  loader: async ({ context }) => {
    const a = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (a)
      await Promise.all([
        context.queryClient.ensureQueryData(workersQuery(a.company_id)),
        context.queryClient.ensureQueryData(balancesQuery(a.company_id)),
      ]);
  },
  component: CollectPage,
});

function CollectPage() {
  const t = useT();
  const { active } = useActiveMembership();
  const cid = active.company_id;
  const { data: workers } = useSuspenseQuery(workersQuery(cid));
  const { data: balances } = useSuspenseQuery(balancesQuery(cid));
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const due = useMemo(
    () => Object.fromEntries(balances.map((b) => [b.worker_id, b.outstanding])),
    [balances],
  );

  if (!canRecordPayment(active.role))
    return <p className="text-muted-foreground">{t("Your role can't record payments.")}</p>;
  const worker = workers.find((w) => w.id === sel);
  if (worker)
    return <CollectFor worker={worker} due={due[worker.id] ?? 0} onBack={() => setSel(null)} />;

  const s = q.trim().toLowerCase();
  const list = workers
    .filter(
      (w) =>
        !s ||
        w.full_name.toLowerCase().includes(s) ||
        w.worker_code.toLowerCase().includes(s) ||
        w.mobile.includes(s),
    )
    .filter((w) => s || (due[w.id] ?? 0) > 0)
    .sort((a, b) => (due[b.id] ?? 0) - (due[a.id] ?? 0));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{t("Collect")}</h1>
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("Search name, ID or mobile")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>
      {!s && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("Workers with money due, highest first.")}
        </p>
      )}
      <ul className="mt-2 divide-y rounded-xl border bg-card">
        {list.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">
            {s ? t("No match.") : t("Nobody owes anything right now.")}
          </li>
        )}
        {list.map((w) => (
          <li key={w.id}>
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-none p-3 text-left"
              onClick={() => setSel(w.id)}
            >
              <WorkerAvatar name={w.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{w.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {w.worker_code} {w.status === "inactive" && <StatusBadge status="inactive" />}
                </div>
              </div>
              <div className="text-right font-semibold">
                {formatINR(Math.max(0, due[w.id] ?? 0))}
              </div>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CollectFor({
  worker,
  due,
  onBack,
}: {
  worker: { id: string; full_name: string; worker_code: string };
  due: number;
  onBack: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const days = useQuery(unpaidDaysQuery(worker.id));
  const [amount, setAmount] = useState<number | null>(due > 0 ? due : null);
  const { amt, selectedIds, unpaidDays, handleToggleDay, handleAmountChange } = useDaySelection({
    days: days.data,
    mode: "total",
    totalDue: Math.max(0, due),
    onAmountChange: setAmount,
  });

  const pay = useMutation({
    mutationFn: async (v: {
      amount: number;
      date: string;
      method: "cash" | "upi" | "bank" | "other";
      text: string;
    }) => {
      const { data, error } = await supabase.rpc("record_payment", {
        _worker: worker.id,
        _amount: v.amount,
        _paid_on: v.date,
        _method: v.method,
        _reference: v.text,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (id) => {
      invalidateMoney(qc);
      toast.success(t("Payment saved"));
      navigate({ to: "/app/receipts/$paymentId", params: { paymentId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-md">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {t("Back")}
      </Button>
      <div className="mt-2 rounded-xl border bg-card p-4">
        <div className="font-semibold">
          {worker.full_name}{" "}
          <span className="text-sm text-muted-foreground">{worker.worker_code}</span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{t("Due now")}</div>
        <div className="text-3xl font-bold">{formatINR(Math.max(0, due))}</div>
      </div>
      <div className="mt-4">
        <AmountForm
          submitLabel="Save payment"
          maximum={Math.max(0, due)}
          busy={pay.isPending}
          amountValue={amt}
          onAmountValueChange={handleAmountChange}
          dayCards={
            <DaySelectionCards
              days={unpaidDays}
              selectedIds={selectedIds}
              onToggleDay={handleToggleDay}
            />
          }
          onSubmit={(v) => pay.mutate(v)}
        />
      </div>
    </div>
  );
}
