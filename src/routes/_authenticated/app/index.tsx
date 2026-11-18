import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatINR, todayISO, workersQuery } from "@/lib/workers";
import { formatDate } from "@/lib/dates";
import { attendanceOnQuery, addDays } from "@/lib/attendance";
import { balancesQuery, collectedOnQuery, totalOutstanding } from "@/lib/money";
import { useActiveMembership } from "../app";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { reportsQuery } from "@/lib/reports";
import { workerActiveOn } from "@/lib/report-data";
import { useLanguage } from "@/lib/i18n";
import { PageError, PageMissing } from "@/components/PageFeedback";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Dashboard — BhaiBiz" },
      { name: "description", content: "Today's attendance, commission due and collections." },
      { property: "og:title", content: "Dashboard — BhaiBiz" },
      { property: "og:description", content: "Today's attendance, commission due and collections." },
    ],
  }),
  loader: async ({ context }) => {
    const a = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (!a) return;
    const cid = a.company_id, today = todayISO(), yesterday = addDays(today, -1);
    await Promise.all([
      context.queryClient.ensureQueryData(workersQuery(cid)),
      context.queryClient.ensureQueryData(attendanceOnQuery(cid, today)),
      context.queryClient.ensureQueryData(attendanceOnQuery(cid, yesterday)),
      context.queryClient.ensureQueryData(balancesQuery(cid)),
      context.queryClient.ensureQueryData(collectedOnQuery(cid, today)),
      context.queryClient.ensureQueryData(collectedOnQuery(cid, yesterday)),
      context.queryClient.ensureQueryData(reportsQuery(cid, today)),
    ]);
  },
  component: Dashboard, errorComponent: PageError, notFoundComponent: PageMissing,
});

function Dashboard() {
  const { active } = useActiveMembership();
  const { t, language } = useLanguage();
  const [view, setView] = useState<"today" | "yesterday">("today");

  const today = todayISO();
  const yesterday = addDays(today, -1);
  const selectedDate = view === "today" ? today : yesterday;

  const workers = useSuspenseQuery(workersQuery(active.company_id));
  const attToday = useSuspenseQuery(attendanceOnQuery(active.company_id, today));
  const attYesterday = useSuspenseQuery(attendanceOnQuery(active.company_id, yesterday));
  const bal = useSuspenseQuery(balancesQuery(active.company_id));
  const collToday = useSuspenseQuery(collectedOnQuery(active.company_id, today));
  const collYesterday = useSuspenseQuery(collectedOnQuery(active.company_id, yesterday));
  const { data: report } = useSuspenseQuery(reportsQuery(active.company_id, today));

  const att = view === "today" ? attToday : attYesterday;
  const coll = view === "today" ? collToday : collYesterday;

  const isOperator = active.role === "operator";
  const workerIds = new Set((workers.data ?? []).map((w) => w.id));
  const activeCount = workers.data?.filter((w) => w.status === "active").length;
  const inactiveCount = workers.data?.filter((w) => w.status === "inactive").length;
  const workedCount = workers.data?.filter((w) => att.data.byWorker[w.id] === "worked").length;
  const notWorkedCount = workers.data?.filter((w) => att.data.byWorker[w.id] === "not_worked").length;
  const pendingCount =
    workers.data && att.data
      ? workers.data.filter((w) => workerActiveOn(w, selectedDate, report.history) && !att.data.byWorker[w.id]).length
      : undefined;

  const scopedBalances = bal.data?.filter((b) => workerIds.has(b.worker_id)) ?? [];
  const scopedCollected = report.payments
    .filter((p) => p.paid_on === selectedDate && !p.voided_at && workerIds.has(p.worker_id))
    .reduce((sum, p) => sum + p.amount_paise, 0);

  const baseCards: { label: string; value: string | number | undefined; show?: boolean }[] = [
    { label: "Active workers", value: activeCount },
    { label: "Inactive workers", value: inactiveCount },
    { label: view === "today" ? "Worked today" : "Worked yesterday", value: workedCount },
    { label: view === "today" ? "Not worked today" : "Not worked yesterday", value: notWorkedCount },
    { label: view === "today" ? "Pending today" : "Pending yesterday", value: pendingCount },
    {
      label: view === "today" ? "Commission earned today" : "Commission earned yesterday",
      value: att.data ? formatINR(att.data.earned) : undefined,
    },
    {
      label: view === "today" ? "Collected today" : "Collected yesterday",
      value: formatINR(isOperator ? scopedCollected : (coll.data ?? 0)),
    },
    {
      label: "Total outstanding",
      value: formatINR(totalOutstanding(isOperator ? scopedBalances : (bal.data ?? []))),
    },
    {
      label: "Advance balance",
      value: formatINR(
        (bal.data ?? [])
          .filter((b) => b.status === "active" && (!isOperator || workerIds.has(b.worker_id)))
          .reduce((sum, b) => sum + b.advance, 0)
      ),
      show: !isOperator,
    },
  ];

  const cards = baseCards.filter((c) => c.show !== false);

  const trend = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return {
      date,
      earned: report.commission
        .filter((c) => c.work_date === date && (!isOperator || workerIds.has(c.worker_id)))
        .reduce((sum, c) => sum + c.amount_paise, 0),
      collected: report.payments
        .filter((p) => p.paid_on === date && !p.voided_at && (!isOperator || workerIds.has(p.worker_id)))
        .reduce((sum, p) => sum + p.amount_paise, 0),
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{active.company_name || active.company.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(selectedDate + "T00:00:00+05:30").toLocaleDateString(language === "ml" ? "ml-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border bg-muted p-1">
          <button
            onClick={() => setView("yesterday")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "yesterday" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("Yesterday")}
          </button>
          <button
            onClick={() => setView("today")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "today" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("Today")}
          </button>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="text-xs text-muted-foreground">{t(c.label)}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{c.value ?? "—"}</div>
          </div>
        ))}
      </div>
      <section className="mt-8"><h2 className="text-lg font-semibold">{t("Last 7 days")}</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y"><tr><th className="py-3">{t("Date")}</th><th>{t("Earned")}</th><th>{t("Collected")}</th></tr></thead><tbody>{trend.map(d => <tr className={`border-b ${d.date === selectedDate ? "bg-accent/20 font-medium" : ""}`} key={d.date}><td className="py-3">{formatDate(d.date)}{d.date === today ? <span className="ml-1.5 text-xs text-primary">{t("today")}</span> : d.date === yesterday ? <span className="ml-1.5 text-xs text-muted-foreground">{t("yesterday")}</span> : null}</td><td>{formatINR(d.earned)}</td><td>{formatINR(d.collected)}</td></tr>)}</tbody></table></div></section>
      {workers.data?.length === 0 ? (
        isOperator ? (
          <div className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("No accommodations or workers assigned yet. Please contact your company owner.")}
          </div>
        ) : (
          <div className="mt-6 border-t py-6 text-sm text-muted-foreground">
            {t("No workers yet")} · <Link to="/app/workers" className="font-medium text-primary underline">{t("Add your first worker")}</Link>
          </div>
        )
      ) : pendingCount && view === "today" ? (
        <Link to="/app/attendance" className="mt-6 block rounded-xl border border-accent bg-accent/20 p-4 text-sm font-medium">
          {pendingCount} · {t("Pending today")} — {t("Attendance")} →
        </Link>
      ) : null}
    </div>
  );
}
