import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatINR, todayISO, workersQuery } from "@/lib/workers";
import { attendanceOnQuery } from "@/lib/attendance";
import { balancesQuery, collectedOnQuery, totalOutstanding } from "@/lib/money";
import { useActiveMembership } from "../app";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { reportsQuery } from "@/lib/reports";
import { workerActiveOn } from "@/lib/report-data";
import { addDays } from "@/lib/attendance";
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
    const cid = a.company_id, today = todayISO();
    await Promise.all([context.queryClient.ensureQueryData(workersQuery(cid)), context.queryClient.ensureQueryData(attendanceOnQuery(cid, today)), context.queryClient.ensureQueryData(balancesQuery(cid)), context.queryClient.ensureQueryData(collectedOnQuery(cid, today)), context.queryClient.ensureQueryData(reportsQuery(cid, today))]);
  },
  component: Dashboard, errorComponent: PageError, notFoundComponent: PageMissing,
});

function Dashboard() {
  const { active } = useActiveMembership();
  const { t, language } = useLanguage();
  const workers = useSuspenseQuery(workersQuery(active.company_id));
  const att = useSuspenseQuery(attendanceOnQuery(active.company_id, todayISO()));
  const bal = useSuspenseQuery(balancesQuery(active.company_id));
  const coll = useSuspenseQuery(collectedOnQuery(active.company_id, todayISO()));
  const { data: report } = useSuspenseQuery(reportsQuery(active.company_id, todayISO()));
  const activeCount = workers.data?.filter((w) => w.status === "active").length;
  const inactiveCount = workers.data?.filter((w) => w.status === "inactive").length;
  const marks = Object.values(att.data.byWorker);
  const workedToday = marks?.filter((m) => m === "worked").length;
  const pendingToday =
    workers.data && att.data
      ? workers.data.filter((w) => workerActiveOn(w, todayISO(), report.history) && !att.data.byWorker[w.id]).length
      : undefined;
  const cards: { label: string; value: string | number | undefined }[] = [
    { label: "Active workers", value: activeCount },
    { label: "Inactive workers", value: inactiveCount },
    { label: "Worked today", value: workedToday },
    { label: "Not worked today", value: marks.filter(m => m === "not_worked").length },
    { label: "Pending today", value: pendingToday },
    { label: "Commission earned today", value: att.data ? formatINR(att.data.earned) : undefined },
    { label: "Collected today", value: coll.data !== undefined ? formatINR(coll.data) : undefined },
    { label: "Total outstanding", value: bal.data ? formatINR(totalOutstanding(bal.data)) : undefined },
    { label: "Advance balance", value: formatINR(bal.data.filter(b => b.status === "active").reduce((sum, b) => sum + b.advance, 0)) },
  ];
  const trend = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(todayISO(), i - 6);
    return { date, earned: report.commission.filter(c => c.work_date === date).reduce((sum, c) => sum + c.amount_paise, 0), collected: report.payments.filter(p => p.paid_on === date && !p.voided_at).reduce((sum, p) => sum + p.amount_paise, 0) };
  });
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">{active.company.name}</h1>
      <p className="text-sm text-muted-foreground">
        {new Date().toLocaleDateString(language === "ml" ? "ml-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="text-xs text-muted-foreground">{t(c.label)}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{c.value ?? "—"}</div>
          </div>
        ))}
      </div>
      <section className="mt-8"><h2 className="text-lg font-semibold">{t("Last 7 days")}</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y"><tr><th className="py-3">{t("Date")}</th><th>{t("Earned")}</th><th>{t("Collected")}</th></tr></thead><tbody>{trend.map(d => <tr className="border-b" key={d.date}><td className="py-3">{d.date}</td><td>{formatINR(d.earned)}</td><td>{formatINR(d.collected)}</td></tr>)}</tbody></table></div></section>
      {workers.data?.length === 0 ? (
        <div className="mt-6 border-t py-6 text-sm text-muted-foreground">
          {t("No workers yet")} · <Link to="/app/workers" className="font-medium text-primary underline">{t("Add your first worker")}</Link>
        </div>
      ) : pendingToday ? (
        <Link to="/app/attendance" className="mt-6 block rounded-xl border border-accent bg-accent/20 p-4 text-sm font-medium">
          {pendingToday} · {t("Pending today")} — {t("Attendance")} →
        </Link>
      ) : null}
    </div>
  );
}
