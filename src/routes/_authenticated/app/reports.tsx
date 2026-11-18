import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  Download,
  Printer,
  RefreshCw,
  Coins,
  CalendarDays,
  TrendingUp,
  ReceiptText,
  HandCoins,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { reportsQuery } from "@/lib/reports";
import { buildReport, canViewReports, excelRows, REPORT_CONFIG_ITEMS, type ReportKind } from "@/lib/report-data";
import { formatINR, todayISO } from "@/lib/workers";
import { formatDate } from "@/lib/dates";
import { validMoneyDate } from "@/lib/money";
import { useActiveMembership } from "../app";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PageError, PageMissing } from "@/components/PageFeedback";
import { DateInput } from "@/components/ui/date-input";

const schema = z.object({
  kind: fallback(z.string(), "outstanding").default("outstanding"),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "active").default("active"),
  worker: fallback(z.string(), "").default(""),
  only_due: fallback(z.string(), "").default(""),
});

const REPORT_ICONS: Record<ReportKind, typeof Coins> = {
  outstanding: Coins,
  attendance: CalendarDays,
  earned: TrendingUp,
  collections: ReceiptText,
  advances: HandCoins,
};

export const REPORT_CONFIG = REPORT_CONFIG_ITEMS.map((item) => ({
  ...item,
  icon: REPORT_ICONS[item.value],
}));

function getPresetDates(today: string) {
  const d = new Date(`${today}T00:00:00Z`);
  const firstOfThisMonth = `${today.slice(0, 7)}-01`;
  const lastOfPrevMonthDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
  const lastOfPrevMonth = lastOfPrevMonthDate.toISOString().slice(0, 10);
  const firstOfPrevMonth = new Date(Date.UTC(lastOfPrevMonthDate.getUTCFullYear(), lastOfPrevMonthDate.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 10);
  const d30 = new Date(d.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const d7 = new Date(d.getTime() - 6 * 86400000).toISOString().slice(0, 10);

  return {
    thisMonth: { from: firstOfThisMonth, to: today },
    lastMonth: { from: firstOfPrevMonth, to: lastOfPrevMonth },
    last30Days: { from: d30, to: today },
    last7Days: { from: d7, to: today },
    today: { from: today, to: today },
    endOfLastMonth: { to: lastOfPrevMonth },
  };
}

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
  const kind = REPORT_CONFIG.find((k) => k.value === search.kind)?.value ?? "outstanding";
  const activeConfig = REPORT_CONFIG.find((k) => k.value === kind) ?? REPORT_CONFIG[0]!;
  const status = ["active", "inactive", "all"].includes(search.status) ? search.status : "active";
  const valid = validMoneyDate(from, today) && validMoneyDate(to, today) && from <= to;
  const rangeTooLong = kind === "attendance" && (new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 365;
  const isRangeKind = kind === "attendance" || kind === "earned" || kind === "collections";
  const isOnlyDue = search.only_due === "1";

  const { data } = useSuspenseQuery(reportsQuery(active.company_id, validMoneyDate(to, today) ? to : today));
  const result =
    valid && !rangeTooLong
      ? buildReport(data, kind, from, to, status, search.worker)
      : { headers: [], rows: [], total: 0, moneyColumns: [] };

  const update = (key: keyof typeof search, value: string) =>
    void navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true });

  const presets = getPresetDates(today);

  // Filter for only with balance if requested
  const displayRows = useMemo(() => {
    if (isOnlyDue) {
      if (kind === "outstanding") {
        return result.rows.filter((r) => Number(r.cells[6]) > 0);
      }
      if (kind === "advances") {
        return result.rows.filter((r) => Number(r.cells[5]) > 0);
      }
    }
    return result.rows;
  }, [result.rows, kind, isOnlyDue]);

  // Column totals for footer row based on displayRows
  const columnSums = useMemo(() => {
    if (kind === "outstanding") {
      const earned = displayRows.reduce((s, r) => s + Math.round(Number(r.cells[3]) * 100), 0);
      const collected = displayRows.reduce((s, r) => s + Math.round(Number(r.cells[4]) * 100), 0);
      const adjusted = displayRows.reduce((s, r) => s + Math.round(Number(r.cells[5]) * 100), 0);
      const due = displayRows.reduce((s, r) => s + Math.round(Number(r.cells[6]) * 100), 0);
      return { earned, collected, adjusted, due };
    }
    if (kind === "advances") {
      const given = displayRows.reduce((s, r) => s + Math.round(Number(r.cells[3]) * 100), 0);
      const repaid = displayRows.reduce((s, r) => s + Math.round(Number(r.cells[4]) * 100), 0);
      const balance = displayRows.reduce((s, r) => s + Math.round(Number(r.cells[5]) * 100), 0);
      return { given, repaid, balance };
    }
    if (kind === "collections") {
      const collected = displayRows.reduce((s, r) => s + r.amount, 0);
      return { collected };
    }
    if (kind === "earned") {
      const earned = displayRows.reduce((s, r) => s + r.amount, 0);
      return { earned };
    }
    if (kind === "attendance") {
      const worked = displayRows.filter((r) => r.cells[3] === "Worked").length;
      return { worked };
    }
    return {};
  }, [displayRows, kind]);

  // Summary KPIs for active kind
  const metrics = useMemo(() => {
    if (kind === "outstanding") {
      const totalDue = result.total;
      const totalEarned = result.rows.reduce((s, r) => s + Math.round(Number(r.cells[3]) * 100), 0);
      const totalCollected = result.rows.reduce((s, r) => s + Math.round(Number(r.cells[4]) * 100), 0);
      const workersWithDue = result.rows.filter((r) => Number(r.cells[6]) > 0).length;
      return [
        { label: "Net Outstanding Due", value: formatINR(totalDue), highlight: true, sub: `${workersWithDue} ${t("workers with balance")}` },
        { label: "Total Commission Earned", value: formatINR(totalEarned), highlight: false, sub: `${t("through")} ${formatDate(to)}` },
        { label: "Total Collected", value: formatINR(totalCollected), highlight: false, sub: `${t("cleared receipts")}` },
        { label: "Workers with Balance", value: `${workersWithDue} / ${result.rows.length}`, highlight: false, sub: `${Math.round((workersWithDue / (result.rows.length || 1)) * 100)}% ${t("of workers")}` },
      ];
    }
    if (kind === "attendance") {
      const workedCount = result.rows.filter((r) => r.cells[3] === "Worked").length;
      const notWorkedCount = result.rows.filter((r) => r.cells[3] === "Not worked").length;
      const pendingCount = result.rows.filter((r) => r.cells[3] === "Pending").length;
      return [
        { label: "Worked Shifts", value: `${workedCount}`, highlight: true, sub: `${t("worked shifts")}` },
        { label: "Not Worked Shifts", value: `${notWorkedCount}`, highlight: false, sub: `${t("absent / off")}` },
        { label: "Pending Attendance", value: `${pendingCount}`, highlight: false, sub: pendingCount > 0 ? t("needs entry") : t("all marked"), warning: pendingCount > 0 },
        { label: "Total Day Records", value: `${result.rows.length}`, highlight: false, sub: `${t("total logged")}` },
      ];
    }
    if (kind === "earned") {
      const totalEarnedPaise = result.total;
      const entryCount = result.rows.length;
      const uniqueWorkers = new Set(result.rows.map((r) => r.workerId)).size;
      const avgPerEntry = entryCount > 0 ? Math.round(totalEarnedPaise / entryCount) : 0;
      return [
        { label: "Total Commission Earned", value: formatINR(totalEarnedPaise), highlight: true, sub: `${formatDate(from)} — ${formatDate(to)}` },
        { label: "Work Shifts Recorded", value: `${entryCount}`, highlight: false, sub: `${t("worked shifts")}` },
        { label: "Average per Shift", value: formatINR(avgPerEntry), highlight: false, sub: `${t("daily rate avg")}` },
        { label: "Active Earning Workers", value: `${uniqueWorkers}`, highlight: false, sub: `${t("unique workers")}` },
      ];
    }
    if (kind === "collections") {
      const totalCollectedPaise = result.total;
      const cashPaise = result.rows
        .filter((r) => String(r.cells[4]).toLowerCase() === "cash")
        .reduce((s, r) => s + r.amount, 0);
      const onlinePaise = totalCollectedPaise - cashPaise;
      return [
        { label: "Total Collected", value: formatINR(totalCollectedPaise), highlight: true, sub: `${formatDate(from)} — ${formatDate(to)}` },
        { label: "Total Receipts", value: `${result.rows.length}`, highlight: false, sub: `${t("payments recorded")}` },
        { label: "Cash Collections", value: formatINR(cashPaise), highlight: false, sub: `${t("cash receipts")}` },
        { label: "UPI & Bank Collections", value: formatINR(onlinePaise), highlight: false, sub: `${t("online / bank")}` },
      ];
    }
    if (kind === "advances") {
      const totalBal = result.total;
      const totalGiven = result.rows.reduce((s, r) => s + Math.round(Number(r.cells[3]) * 100), 0);
      const totalRepaid = result.rows.reduce((s, r) => s + Math.round(Number(r.cells[4]) * 100), 0);
      const workersWithAdv = result.rows.filter((r) => Number(r.cells[5]) > 0).length;
      return [
        { label: "Remaining Advance Balance", value: formatINR(totalBal), highlight: true, sub: `${workersWithAdv} ${t("workers with loan")}` },
        { label: "Total Advances Given", value: formatINR(totalGiven), highlight: false, sub: `${t("disbursed")}` },
        { label: "Total Repayments", value: formatINR(totalRepaid), highlight: false, sub: `${t("repaid")}` },
        { label: "Workers with Advance", value: `${workersWithAdv} / ${result.rows.length}`, highlight: false, sub: `${t("active balances")}` },
      ];
    }
    return [];
  }, [kind, result, from, to, t]);

  async function download() {
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const rows = displayRows.map((r) => ({
        ...r,
        cells: r.cells.map((c, i) => (typeof c === "string" && i > 1 ? t(c) : c)),
      }));
      await writeXlsxFile(excelRows(result.headers.map(t), rows), {
        columns: result.headers.map((_, i) => ({ width: i === 1 ? 28 : 22 })),
      }).toFile(`BhaiBiz-${kind}-${to}.xlsx`);
    } catch {
      toast.error(t("Export failed"));
    }
  }

  // Render formatted cell values with badges, links, and right alignment
  const renderCell = (c: string | number, i: number, r: (typeof result.rows)[number]) => {
    if (i === 0) {
      return <span className="font-mono text-xs text-muted-foreground">{c}</span>;
    }
    if (i === 1) {
      return (
        <Link to="/app/workers/$workerId" params={{ workerId: r.workerId }} className="font-medium text-primary hover:underline">
          {c}
        </Link>
      );
    }
    if (kind === "attendance" && i === 3) {
      if (c === "Worked") {
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 gap-1 font-normal">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            {t("Worked")}
          </Badge>
        );
      }
      if (c === "Not worked") {
        return (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 gap-1 font-normal">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
            {t("Not worked")}
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 gap-1 font-normal">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
          {t("Pending")}
        </Badge>
      );
    }
    if (kind === "collections" && i === 3 && r.receiptId) {
      return (
        <Link to="/app/receipts/$paymentId" params={{ paymentId: r.receiptId }} className="font-mono text-xs font-medium text-primary hover:underline">
          {c}
        </Link>
      );
    }
    if (kind === "collections" && i === 4) {
      const methodStr = String(c).toLowerCase();
      if (methodStr === "cash") {
        return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 font-normal text-xs">{t("Cash")}</Badge>;
      }
      if (methodStr === "upi") {
        return <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300 font-normal text-xs">{t("UPI")}</Badge>;
      }
      return <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300 font-normal text-xs">{t(String(c))}</Badge>;
    }
    if ((kind === "outstanding" || kind === "advances") && i === 2) {
      const isAct = c === "active";
      return (
        <Badge variant="outline" className={`font-normal text-[11px] py-0 ${isAct ? "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300" : "border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400"}`}>
          {t(String(c))}
        </Badge>
      );
    }
    if (typeof c === "number" && result.moneyColumns.includes(i)) {
      if (kind === "outstanding" && i === 6) {
        return (
          <span className={c > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {formatINR(Math.round(c * 100))}
          </span>
        );
      }
      if (kind === "advances" && i === 5) {
        return (
          <span className={c > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {formatINR(Math.round(c * 100))}
          </span>
        );
      }
      return formatINR(Math.round(c * 100));
    }
    if (typeof c === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return formatDate(c);
      return t(c);
    }
    return c;
  };

  return (
    <div className="mx-auto max-w-6xl pb-8">
      {/* Top Header */}
      <div className="report-controls flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("Reports")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("Financial, attendance and worker commission reports")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("Refresh")}
            title={t("Refresh")}
            onClick={() => void qc.invalidateQueries({ queryKey: ["reports", active.company_id] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" disabled={!valid || rangeTooLong || !displayRows.length} onClick={download}>
            <Download className="h-4 w-4 mr-1.5" />
            {t("Excel")}
          </Button>
          <Button variant="outline" disabled={!valid || rangeTooLong} onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" />
            {t("Print / PDF")}
          </Button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="report-controls mt-4 flex flex-wrap items-center gap-1.5 border-b pb-3">
        {REPORT_CONFIG.map((cfg) => {
          const isSelected = cfg.value === kind;
          return (
            <button
              key={cfg.value}
              type="button"
              onClick={() => update("kind", cfg.value)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <cfg.icon className="h-4 w-4" />
              <span>{t(cfg.label)}</span>
            </button>
          );
        })}
      </div>

      {/* Executive Summary Metric Cards */}
      <div className="report-controls mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m, idx) => (
          <Card key={idx} className={m.highlight ? "border-primary/40 bg-primary/[0.03]" : ""}>
            <CardContent className="p-3.5">
              <div className="text-xs font-medium text-muted-foreground">{t(m.label)}</div>
              <div
                className={`mt-1 text-xl font-bold tracking-tight ${
                  m.highlight ? "text-primary" : m.warning ? "text-amber-600 dark:text-amber-400" : ""
                }`}
              >
                {m.value}
              </div>
              {m.sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{m.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Controls */}
      <div className="report-controls mt-4 rounded-xl border bg-card p-4 shadow-xs">
        {/* Quick Date Presets */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b pb-3 text-xs">
          <span className="font-medium text-muted-foreground mr-1">{t("Quick ranges")}:</span>
          {isRangeKind ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => {
                  void navigate({
                    search: (prev) => ({ ...prev, from: presets.thisMonth.from, to: presets.thisMonth.to }),
                    replace: true,
                  });
                }}
              >
                {t("This Month")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => {
                  void navigate({
                    search: (prev) => ({ ...prev, from: presets.lastMonth.from, to: presets.lastMonth.to }),
                    replace: true,
                  });
                }}
              >
                {t("Last Month")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => {
                  void navigate({
                    search: (prev) => ({ ...prev, from: presets.last30Days.from, to: presets.last30Days.to }),
                    replace: true,
                  });
                }}
              >
                {t("Last 30 Days")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => {
                  void navigate({
                    search: (prev) => ({ ...prev, from: presets.last7Days.from, to: presets.last7Days.to }),
                    replace: true,
                  });
                }}
              >
                {t("Last 7 Days")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => {
                  void navigate({
                    search: (prev) => ({ ...prev, from: presets.today.from, to: presets.today.to }),
                    replace: true,
                  });
                }}
              >
                {t("Today")}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => {
                  void navigate({
                    search: (prev) => ({ ...prev, to: presets.today.to }),
                    replace: true,
                  });
                }}
              >
                {t("Today")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => {
                  void navigate({
                    search: (prev) => ({ ...prev, to: presets.endOfLastMonth.to }),
                    replace: true,
                  });
                }}
              >
                {t("End of Last Month")}
              </Button>
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isRangeKind && (
            <div>
              <Label htmlFor="report-from" className="text-xs">{t("From")}</Label>
              <DateInput
                id="report-from"
                value={from}
                max={to}
                onChange={(v) => update("from", v)}
              />
            </div>
          )}
          <div>
            <Label htmlFor="report-to" className="text-xs">{t(isRangeKind ? "To" : "As of")}</Label>
            <DateInput id="report-to" value={to} max={today} onChange={(v) => update("to", v)} />
          </div>
          <div>
            <Label className="text-xs">{t("Status")}</Label>
            <Select value={status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger aria-label={t("Status")}><SelectValue /></SelectTrigger>
              <SelectContent>{["active", "inactive", "all"].map((s) => <SelectItem value={s} key={s}>{t(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("Worker")}</Label>
            <Select value={search.worker || "all"} onValueChange={(v) => update("worker", v === "all" ? "" : v)}>
              <SelectTrigger aria-label={t("Worker")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All workers")}</SelectItem>
                {data.workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name} · {w.worker_code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(kind === "outstanding" || kind === "advances") && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <Checkbox
              id="only-due"
              checked={isOnlyDue}
              onCheckedChange={(checked) => update("only_due", checked ? "1" : "")}
            />
            <Label htmlFor="only-due" className="text-xs cursor-pointer text-foreground/90 font-medium">
              {t("Only with balance (> ₹0)")}
            </Label>
          </div>
        )}
      </div>

      {!valid || rangeTooLong ? (
        <p role="alert" className="mt-5 text-destructive font-medium">
          {t(rangeTooLong ? "Attendance ranges are limited to one year." : "Choose a valid date range.")}
        </p>
      ) : (
        <section className="report-document mt-6 rounded-xl border bg-card p-4 sm:p-6 shadow-xs">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{active.company_name || active.company.name}</h2>
                <span className="text-muted-foreground">·</span>
                <span className="text-lg font-semibold text-primary">{t(activeConfig.label)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {kind === "outstanding" || kind === "advances"
                  ? `${t("As of")} ${formatDate(to)}`
                  : `${formatDate(from)} — ${formatDate(to)}`}
                {" "}· {t(status)}
                {isOnlyDue && ` · ${t("Only with balance (> ₹0)")}`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{t(kind === "attendance" ? "Worked days" : "Total")}</div>
              <div className="text-2xl font-bold tracking-tight text-primary">
                {kind === "attendance"
                  ? columnSums.worked ?? 0
                  : formatINR(
                      kind === "outstanding"
                        ? columnSums.due ?? 0
                        : kind === "advances"
                        ? columnSums.balance ?? 0
                        : kind === "collections"
                        ? columnSums.collected ?? 0
                        : columnSums.earned ?? 0,
                    )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  {result.headers.map((h, i) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-3 py-3 font-semibold ${
                        result.moneyColumns.includes(i) || (kind === "attendance" && i === 3) ? "text-right" : "text-left"
                      }`}
                    >
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayRows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-muted/30">
                    {r.cells.map((c, i) => (
                      <td
                        key={i}
                        className={`whitespace-nowrap px-3 py-3 ${
                          result.moneyColumns.includes(i) || (kind === "attendance" && i === 3) ? "text-right" : "text-left"
                        }`}
                      >
                        {renderCell(c, i, r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {displayRows.length > 0 && (
                <tfoot className="border-t-2 bg-muted/50 font-semibold text-foreground">
                  <tr>
                    {result.headers.map((h, i) => {
                      if (i === 1) {
                        return (
                          <td key={i} className="whitespace-nowrap px-3 py-3 font-bold text-left">
                            {t("Total")}
                          </td>
                        );
                      }
                      if (kind === "outstanding") {
                        if (i === 3) return <td key={i} className="whitespace-nowrap px-3 py-3 text-right">{formatINR(columnSums.earned ?? 0)}</td>;
                        if (i === 4) return <td key={i} className="whitespace-nowrap px-3 py-3 text-right">{formatINR(columnSums.collected ?? 0)}</td>;
                        if (i === 5) return <td key={i} className="whitespace-nowrap px-3 py-3 text-right">{formatINR(columnSums.adjusted ?? 0)}</td>;
                        if (i === 6) return <td key={i} className="whitespace-nowrap px-3 py-3 text-right text-primary font-bold">{formatINR(columnSums.due ?? 0)}</td>;
                      }
                      if (kind === "advances") {
                        if (i === 3) return <td key={i} className="whitespace-nowrap px-3 py-3 text-right">{formatINR(columnSums.given ?? 0)}</td>;
                        if (i === 4) return <td key={i} className="whitespace-nowrap px-3 py-3 text-right">{formatINR(columnSums.repaid ?? 0)}</td>;
                        if (i === 5) return <td key={i} className="whitespace-nowrap px-3 py-3 text-right text-primary font-bold">{formatINR(columnSums.balance ?? 0)}</td>;
                      }
                      if (kind === "collections" && i === 5) {
                        return <td key={i} className="whitespace-nowrap px-3 py-3 text-right text-primary font-bold">{formatINR(columnSums.collected ?? 0)}</td>;
                      }
                      if (kind === "earned" && i === 3) {
                        return <td key={i} className="whitespace-nowrap px-3 py-3 text-right text-primary font-bold">{formatINR(columnSums.earned ?? 0)}</td>;
                      }
                      if (kind === "attendance" && i === 3) {
                        return <td key={i} className="whitespace-nowrap px-3 py-3 text-right text-primary font-bold">{columnSums.worked ?? 0} {t("worked")}</td>;
                      }
                      return <td key={i} className="px-3 py-3"></td>;
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {!displayRows.length && (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Filter className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mt-3 text-sm font-semibold">{t("No records match the selected filters.")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t("Try adjusting the date range or worker filter.")}</p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <p>
              {t("Rows")}: {displayRows.length} {result.rows.length !== displayRows.length && `(${t("of")} ${result.rows.length})`}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
