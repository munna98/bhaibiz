import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState } from "react";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { canViewAudit } from "@/lib/report-data";
import { auditQuery } from "@/lib/reports";
import { todayISO, formatINR } from "@/lib/workers";
import { formatDate, formatDateTime } from "@/lib/dates";
import { validMoneyDate } from "@/lib/money";
import { useT } from "@/lib/i18n";
import { useActiveMembership } from "../app";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageError, PageMissing } from "@/components/PageFeedback";
import { DateInput } from "@/components/ui/date-input";

const schema = z.object({
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  action: fallback(z.string(), "").default(""),
});

const safeDates = (from: string, to: string) => ({
  from: validMoneyDate(from, todayISO()) ? from : `${todayISO().slice(0, 7)}-01`,
  to: validMoneyDate(to, todayISO()) ? to : todayISO(),
});

export const Route = createFileRoute("/_authenticated/app/audit")({
  validateSearch: zodValidator(schema),
  loaderDeps: ({ search }) => safeDates(search.from, search.to),
  loader: async ({ context, deps }) => {
    const a = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (a && canViewAudit(a.role)) await context.queryClient.ensureQueryData(auditQuery(a.company_id, deps.from, deps.to));
  },
  head: () => ({
    meta: [
      { title: "Audit history — BhaiBiz" },
      { name: "description", content: "Owner-only history of company changes, attendance and financial records." },
      { property: "og:title", content: "Audit history — BhaiBiz" },
      { property: "og:description", content: "Review who changed company records and when." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
  errorComponent: PageError,
  notFoundComponent: PageMissing,
});

function AuditPage() {
  const { active } = useActiveMembership();
  const t = useT();
  return canViewAudit(active.role) ? <AuditContent /> : <p>{t("Only the owner can view audit history.")}</p>;
}

function AuditContent() {
  const { active } = useActiveMembership();
  const t = useT();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const dates = safeDates(search.from, search.to);
  const [limit, setLimit] = useState(100);

  const { data } = useSuspenseQuery(auditQuery(active.company_id, dates.from, dates.to));
  const rows = data.filter((r) => !search.action || r.action === search.action);

  const update = (key: keyof typeof search, value: string) => {
    setLimit(100);
    void navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true });
  };

  const actionLabel = (a: string) =>
    t(
      ({
        worker_created: "Worker created",
        worker_updated: "Worker updated",
        payment_recorded: "Payment recorded",
        payment_voided: "Payment voided",
        advance_recorded: "Advance recorded",
        repayment_recorded: "Repayment recorded",
        adjustment_recorded: "Adjustment recorded",
        attendance_changed: "Attendance changed",
        status_changed: "Status changed",
        rate_added: "Rate added",
        company_updated: "Company updated",
        member_added: "Member added",
        member_updated: "Member updated",
        member_removed: "Member removed",
        invite_added: "Invite added",
        invite_updated: "Invite updated",
        invite_removed: "Invite removed",
        aadhaar_viewed: "Aadhaar viewed",
        aadhaar_changed: "Aadhaar corrected",
        document_uploaded: "Document uploaded",
        aadhaar_doc_viewed: "Aadhaar document viewed",
      } as Record<string, string>)[a] ?? a.replaceAll("_", " "),
    );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">{t("Audit history")}</h1>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="audit-from">{t("From")}</Label>
          <DateInput id="audit-from" max={dates.to} value={dates.from} onChange={(v) => update("from", v)} />
        </div>
        <div>
          <Label htmlFor="audit-to">{t("To")}</Label>
          <DateInput id="audit-to" max={todayISO()} value={dates.to} onChange={(v) => update("to", v)} />
        </div>
        <div>
          <Label>{t("Action")}</Label>
          <Select value={search.action || "all"} onValueChange={(v) => update("action", v === "all" ? "" : v)}>
            <SelectTrigger aria-label={t("Action")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All actions")}</SelectItem>
              {[...new Set(data.map((r) => r.action))].map((a) => (
                <SelectItem value={a} key={a}>{actionLabel(a)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ul className="mt-6 divide-y border-y">
        {rows.slice(0, limit).map((r) => {
          const details = r.details && typeof r.details === "object" && !Array.isArray(r.details) ? r.details : {};
          const amount = typeof details["amount_paise"] === "number" ? details["amount_paise"] : null;
          return (
            <li key={r.id} className="flex flex-col justify-between gap-2 py-4 sm:flex-row">
              <div>
                <p className="font-medium">{actionLabel(r.action)}</p>
                <p className="text-sm text-muted-foreground">{t("Entity")}: {t(r.entity)} · {r.entity_id?.slice(0, 8) ?? "—"}</p>
                {amount !== null && <p className="text-sm">{t("Amount")}: {formatINR(amount)}</p>}
                {typeof details["reason"] === "string" && <p className="text-sm">{details["reason"]}</p>}
                {typeof details["work_date"] === "string" && (
                  <p className="text-sm">
                    {formatDate(details["work_date"])} · {typeof details["status"] === "string" ? t(details["status"] === "worked" ? "Worked" : details["status"] === "not_worked" ? "Not worked" : details["status"]) : ""}
                  </p>
                )}
              </div>
              <div className="text-sm text-muted-foreground sm:text-right">
                <p>{formatDateTime(r.at)}</p>
                <p>{t("Recorded by")}: {r.actor_id.slice(0, 8)}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {!rows.length && <p className="py-8 text-muted-foreground">{t("No records for these filters.")}</p>}
      {rows.length > limit && (
        <Button className="mt-4" variant="outline" onClick={() => setLimit((n) => n + 100)}>{t("Load more")}</Button>
      )}
    </div>
  );
}
