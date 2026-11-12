import type { AppRole } from "./company";

export const canViewReports = (role: AppRole) => role !== "operator";
export const canViewAudit = (role: AppRole) => role === "owner";
export type ReportKind = "attendance" | "earned" | "collections" | "outstanding" | "advances";

export type ReportConfigItem = {
  value: ReportKind;
  label: string;
  badge: string;
  explanation: string;
  formula?: string;
  note?: string;
};

export const REPORT_CONFIG_ITEMS: ReportConfigItem[] = [
  {
    value: "outstanding",
    label: "Outstanding dues",
    badge: "Balances",
    explanation:
      "Calculates the net balance for each worker by subtracting collections and adjustments from total commission earned.",
    formula: "Commission Earned − Collected Payments ± Adjustments = Net Due",
    note: "Balances include all history through the selected date. Inactive workers with outstanding balances remain trackable until settled.",
  },
  {
    value: "attendance",
    label: "Attendance",
    badge: "Daily Log",
    explanation:
      "Detailed daily attendance register showing shifts marked as Worked, Not worked, or still Pending for each worker across the period.",
    note: "Worked shifts generate daily commission according to active rate agreements. Pending shifts require supervisor attendance entry.",
  },
  {
    value: "earned",
    label: "Commission earned",
    badge: "Work Commission",
    explanation:
      "Daily breakdown of labour commission earned by workers for worked attendance shifts.",
    note: "Rate changes apply from their effective start date and never alter past earned days.",
  },
  {
    value: "collections",
    label: "Collections",
    badge: "Receipts",
    explanation:
      "Complete transaction log of payments collected from workers with receipt numbers, dates, and payment modes.",
    note: "Voided payment receipts are automatically excluded from report totals and ledgers.",
  },
  {
    value: "advances",
    label: "Advances",
    badge: "Loans",
    explanation:
      "Tracks company loans and advances given to workers and repayments received towards the advance loan.",
    formula: "Advances Given − Repayments Received = Net Advance Balance",
    note: "Advance balances are kept strictly separate from regular daily attendance commission dues.",
  },
];
export type ReportWorker = { id: string; full_name: string; worker_code: string; status: string; joining_date: string };
export type ReportData = {
  workers: ReportWorker[];
  attendance: { id: string; worker_id: string; work_date: string; status: string }[];
  commission: { id: string; worker_id: string; work_date: string; amount_paise: number }[];
  payments: { id: string; worker_id: string; paid_on: string; amount_paise: number; method: string; receipt_no: string; voided_at: string | null }[];
  adjustments: { id: string; worker_id: string; on_date: string; amount_paise: number; kind: string }[];
  advances: { id: string; worker_id: string; given_on: string; amount_paise: number }[];
  repayments: { id: string; worker_id: string; paid_on: string; amount_paise: number }[];
  history: { id: string; worker_id: string; status: string; effective_date: string; changed_at: string }[];
};
export type ReportRow = { id: string; workerId: string; receiptId?: string; cells: (string | number)[]; amount: number };
export type ReportResult = { headers: string[]; rows: ReportRow[]; total: number; moneyColumns: number[] };

export async function readAllPages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = 500): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await read(offset, offset + pageSize - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) return all;
  }
}

export function workerActiveOn(w: ReportWorker, date: string, history: ReportData["history"]): boolean {
  if (date < w.joining_date) return false;
  const latest = history.filter(h => h.worker_id === w.id && h.effective_date <= date)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date) || b.changed_at.localeCompare(a.changed_at))[0];
  return (latest?.status ?? w.status) === "active";
}

export function buildReport(data: ReportData, kind: ReportKind, from: string, to: string, status = "active", workerId = ""): ReportResult {
  const workers = data.workers.filter(w => (!workerId || w.id === workerId) && (status === "all" || w.status === status));
  const byId = new Map(workers.map(w => [w.id, w]));
  const during = (date: string) => date >= from && date <= to;
  const rows: ReportRow[] = [];
  const prefix = (id: string) => { const w = byId.get(id); return [w?.worker_code ?? "", w?.full_name ?? ""]; };
  let headers: string[] = [], moneyColumns: number[] = [];
  if (kind === "attendance") {
    headers = ["Worker ID", "Worker", "Date", "Status"];
    const marks = new Map(data.attendance.map(a => [`${a.worker_id}:${a.work_date}`, a]));
    for (let date = from; date <= to;) {
      for (const w of workers) {
        const mark = marks.get(`${w.id}:${date}`);
        if (!mark && !workerActiveOn(w, date, data.history)) continue;
        rows.push({ id: `${w.id}:${date}`, workerId: w.id, cells: [...prefix(w.id), date, mark?.status === "worked" ? "Worked" : mark ? "Not worked" : "Pending"], amount: mark?.status === "worked" ? 1 : 0 });
      }
      const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); date = next.toISOString().slice(0, 10);
    }
  } else if (kind === "earned") {
    headers = ["Worker ID", "Worker", "Date", "Commission (₹)"]; moneyColumns = [3];
    const sums = new Map<string, number>();
    for (const c of data.commission) if (byId.has(c.worker_id) && during(c.work_date)) {
      const key = `${c.worker_id}:${c.work_date}`; sums.set(key, (sums.get(key) ?? 0) + c.amount_paise);
    }
    for (const [key, amount] of sums) { const [id = "", date = ""] = key.split(":"); rows.push({ id: key, workerId: id, cells: [...prefix(id), date, amount / 100], amount }); }
  } else if (kind === "collections") {
    headers = ["Worker ID", "Worker", "Date", "Receipt", "Method", "Collected (₹)"]; moneyColumns = [5];
    for (const p of data.payments) if (byId.has(p.worker_id) && during(p.paid_on) && !p.voided_at) rows.push({ id: p.id, workerId: p.worker_id, receiptId: p.id, cells: [...prefix(p.worker_id), p.paid_on, p.receipt_no, p.method, p.amount_paise / 100], amount: p.amount_paise });
  } else {
    headers = kind === "outstanding" ? ["Worker ID", "Worker", "Status", "Earned (₹)", "Collected (₹)", "Adjustments (₹)", "Due (₹)"] : ["Worker ID", "Worker", "Status", "Given (₹)", "Repaid (₹)", "Advance balance (₹)"];
    moneyColumns = kind === "outstanding" ? [3, 4, 5, 6] : [3, 4, 5];
    for (const w of workers) {
      if (kind === "outstanding") {
        const earned = data.commission.filter(c => c.worker_id === w.id && c.work_date <= to).reduce((s, c) => s + c.amount_paise, 0);
        const collected = data.payments.filter(p => p.worker_id === w.id && p.paid_on <= to && !p.voided_at).reduce((s, p) => s + p.amount_paise, 0);
        const adjusted = data.adjustments.filter(a => a.worker_id === w.id && a.on_date <= to).reduce((s, a) => s + (a.kind === "debit" ? -a.amount_paise : a.amount_paise), 0);
        const amount = earned - collected - adjusted;
        rows.push({ id: w.id, workerId: w.id, cells: [...prefix(w.id), w.status, earned / 100, collected / 100, adjusted / 100, amount / 100], amount: Math.max(0, amount) });
      } else {
        const given = data.advances.filter(a => a.worker_id === w.id && a.given_on <= to).reduce((s, a) => s + a.amount_paise, 0);
        const repaid = data.repayments.filter(r => r.worker_id === w.id && r.paid_on <= to).reduce((s, r) => s + r.amount_paise, 0);
        rows.push({ id: w.id, workerId: w.id, cells: [...prefix(w.id), w.status, given / 100, repaid / 100, (given - repaid) / 100], amount: given - repaid });
      }
    }
  }
  return { headers, rows, total: rows.reduce((s, r) => s + r.amount, 0), moneyColumns };
}

/** Excel cells are explicitly String/Number, never formulas from user-entered names. */
export function excelRows(headers: string[], rows: ReportRow[]) {
  return [headers.map(value => ({ value, type: String, fontWeight: "bold" as const })), ...rows.map(r => r.cells.map(value => typeof value === "number" ? { value, type: Number, format: "#,##0.00" } : { value, type: String }))];
}