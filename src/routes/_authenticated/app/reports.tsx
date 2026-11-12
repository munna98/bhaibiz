import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Download, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { reportsQuery } from "@/lib/reports";
import { buildReport, canViewReports, excelRows, type ReportKind } from "@/lib/report-data";
import { formatINR, todayISO } from "@/lib/workers";
import { formatDate } from "@/lib/dates";
import { validMoneyDate } from "@/lib/money";
import { useActiveMembership } from "../app";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageError, PageMissing } from "@/components/PageFeedback";
import { DateInput } from "@/components/ui/date-input";

const schema = z.object({
  kind: fallback(z.string(), "outstanding").default("outstanding"),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "active").default("active"),
  worker: fallback(z.string(), "").default(""),
});

const KINDS: { value: ReportKind; label: string }[] = [
  { value: "outstanding", label: "Outstanding dues" },
  { value: "attendance", label: "Attendance" },
  { value: "earned", label: "Commission earned" },
  { value: "collections", label: "Collections" },
  { value: "advances", label: "Advances" },
];

export const Route = createFileRoute("/_authenticated/app/reports")({
  validateSearch: zodValidator(schema),
  loaderDeps: ({ search }) => ({ to: search.to }),
  loader: async ({ context, deps }) => {
    const active = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (active && canViewReports(active.role))
      await context.queryClient.ensureQueryData(
        reportsQuery(active.company_id, validMoneyDate(deps.to, todayISO()) ? deps.to : todayISO()),
      );
  },
  head: () => ({
    meta: [
      { title: "Reports — BhaiBiz" },
      { name: "description", content: "Attendance, daily commission, collections, dues and advance reports." },
      { property: "og:title", content: "Reports — BhaiBiz" },
      { property: "og:description", content: "Filtered labour commission reports with Excel and printable exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
  errorComponent: PageError,
  notFoundComponent: PageMissing,
});

function ReportsPage() {
  const { active } = useActiveMembership();
  const t = useT();
  if (!canViewReports(active.role)) return <p>{t("Your role can't view reports.")}</p>;
  return <ReportContent />;
}

function ReportContent() {
  const { active } = useActiveMembership();
  const t = useT();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();

  const today = todayISO();
  const to = search.to || today;
  const from = search.from || `${today.slice(0, 7)}-01`;
  const kind = KINDS.find((k) => k.value === search.kind)?.value ?? "outstanding";
  const status = ["active", "inactive", "all"].includes(search.status) ? search.status : "active";
  const valid = validMoneyDate(from, today) && validMoneyDate(to, today) && from <= to;
  const rangeTooLong = kind === "attendance" && (new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 365;

  const { data } = useSuspenseQuery(reportsQuery(active.company_id, validMoneyDate(to, today) ? to : today));
  const result =
    valid && !rangeTooLong
      ? buildReport(data, kind, from, to, status, search.worker)
      : { headers: [], rows: [], total: 0, moneyColumns: [] };

  const update = (key: keyof typeof search, value: string) =>
    void navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true });

  async function download() {
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const rows = result.rows.map((r) => ({ ...r, cells: r.cells.map((c, i) => (typeof c === "string" && i > 1 ? t(c) : c)) }));
      await writeXlsxFile(excelRows(result.headers.map(t), rows), {
        columns: result.headers.map((_, i) => ({ width: i === 1 ? 28 : 22 })),
      }).toFile(`BhaiBiz-${kind}-${to}.xlsx`);
    } catch {
      toast.error(t("Export failed"));
    }
  }

  // Helper: for a report cell value, determine if it's a date string (YYYY-MM-DD) to format
  const renderCell = (c: string | number, i: number, r: (typeof result.rows)[number]) => {
    if (i === 1) {
      return (
        <Link to="/app/workers/$workerId" params={{ workerId: r.workerId }} className="text-primary underline">
          {c}
        </Link>
      );
    }
    if (i === 3 && r.receiptId) {
      return (
        <Link to="/app/receipts/$paymentId" params={{ paymentId: r.receiptId }} className="text-primary underline">
          {c}
        </Link>
      );
    }
    if (typeof c === "number" && result.moneyColumns.includes(i)) {
      return formatINR(Math.round(c * 100));
    }
    if (typeof c === "string") {
      // Format ISO dates in table cells (attendance dates, collection dates, etc.)
      if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return formatDate(c);
      return t(c);
    }
    return c;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="report-controls flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("Reports")}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("Refresh")}
            title={t("Refresh")}
            onClick={() => void qc.invalidateQueries({ queryKey: ["reports", active.company_id] })}
          >
            <RefreshCw />
          </Button>
          <Button variant="outline" disabled={!valid || rangeTooLong || !result.rows.length} onClick={download}>
            <Download />{t("Excel")}
          </Button>
          <Button variant="outline" disabled={!valid || rangeTooLong} onClick={() => window.print()}>
            <Printer />{t("Print / PDF")}
          </Button>
        </div>
      </div>

      <div className="report-controls mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label>{t("Reports")}</Label>
          <Select value={kind} onValueChange={(v) => update("kind", v)}>
            <SelectTrigger aria-label={t("Reports")}><SelectValue /></SelectTrigger>
            <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{t(k.label)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="report-from">{t("From")}</Label>
          <DateInput
            id="report-from"
            value={from}
            max={to}
            disabled={kind === "outstanding" || kind === "advances"}
            onChange={(v) => update("from", v)}
          />
        </div>
        <div>
          <Label htmlFor="report-to">{t(kind === "outstanding" || kind === "advances" ? "As of" : "To")}</Label>
          <DateInput id="report-to" value={to} max={today} onChange={(v) => update("to", v)} />
        </div>
        <div>
          <Label>{t("Status")}</Label>
          <Select value={status} onValueChange={(v) => update("status", v)}>
            <SelectTrigger aria-label={t("Status")}><SelectValue /></SelectTrigger>
            <SelectContent>{["active", "inactive", "all"].map((s) => <SelectItem value={s} key={s}>{t(s)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("Worker")}</Label>
          <Select value={search.worker || "all"} onValueChange={(v) => update("worker", v === "all" ? "" : v)}>
            <SelectTrigger aria-label={t("Worker")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All workers")}</SelectItem>
              {data.workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name} · {w.worker_code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!valid || rangeTooLong ? (
        <p role="alert" className="mt-5 text-destructive">
          {t(rangeTooLong ? "Attendance ranges are limited to one year." : "Choose a valid date range.")}
        </p>
      ) : (
        <section className="report-document mt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-xl font-semibold">{active.company.name} · {t(KINDS.find((k) => k.value === kind)?.label ?? "Reports")}</h2>
              <p className="text-sm text-muted-foreground">
                {kind === "outstanding" || kind === "advances"
                  ? `${t("As of")} ${formatDate(to)}`
                  : `${formatDate(from)} — ${formatDate(to)}`}
                {" "}· {t(status)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{t(kind === "attendance" ? "Worked days" : "Total")}</div>
              <div className="text-2xl font-bold">{kind === "attendance" ? result.total : formatINR(result.total)}</div>
            </div>
          </div>
          {(kind === "outstanding" || kind === "advances") && (
            <p className="mb-3 text-sm text-muted-foreground">{t("Balances include all entries through the selected date.")}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y bg-muted">
                <tr>{result.headers.map((h) => <th className="whitespace-nowrap px-3 py-3 font-medium" key={h}>{t(h)}</th>)}</tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} className="border-b">
                    {r.cells.map((c, i) => (
                      <td key={i} className="whitespace-nowrap px-3 py-3">{renderCell(c, i, r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!result.rows.length && <p className="py-10 text-center text-muted-foreground">{t("No records for these filters.")}</p>}
          <p className="mt-3 text-xs text-muted-foreground">{t("Rows")}: {result.rows.length}</p>
        </section>
      )}
    </div>
  );
}
