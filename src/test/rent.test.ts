import { describe, expect, it } from "vitest";
import {
  currentPeriod,
  formatPeriod,
  recentPeriods,
  workerPeriodsSinceJoining,
  computeWorkerRentBreakdown,
} from "@/lib/rent";
import { formatINR, nonNegativeRupeesToPaise, rupeesToPaise, canManageWorkers } from "@/lib/workers";
import { canRecordPayment } from "@/lib/money";
import type { AppRole } from "@/lib/company";

describe("Worker Monthly Rent", () => {
  it("formats periods into human-readable month and year", () => {
    expect(formatPeriod("2026-11")).toBe("November 2026");
    expect(formatPeriod("2026-01")).toBe("January 2026");
    expect(formatPeriod("2025-12")).toBe("December 2025");
    expect(formatPeriod("invalid")).toBe("invalid");
  });

  it("calculates currentPeriod from ISO date or defaults to current year-month", () => {
    expect(currentPeriod("2026-11-23")).toBe("2026-11");
    expect(currentPeriod("2025-05-15")).toBe("2025-05");
    expect(currentPeriod()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("generates recent periods list for period selection", () => {
    const list = recentPeriods(6);
    expect(list).toHaveLength(6);
    expect(list[0].period).toMatch(/^\d{4}-\d{2}$/);
    expect(list[0].label).toBeTruthy();
  });

  it("generates worker periods since joining down to joining month", () => {
    const periods = workerPeriodsSinceJoining("2026-08-15", "2026-11-23");
    expect(periods).toEqual(["2026-11", "2026-10", "2026-09", "2026-08"]);

    // Future join date yields empty periods
    const future = workerPeriodsSinceJoining("2027-01-01", "2026-11-23");
    expect(future).toEqual([]);

    // Same month join date yields 1 period
    const sameMonth = workerPeriodsSinceJoining("2026-11-10", "2026-11-23");
    expect(sameMonth).toEqual(["2026-11"]);
  });

  it("automatically accrues monthly rent without manual charges", () => {
    const result = computeWorkerRentBreakdown({
      joiningDate: "2026-09-10",
      monthlyRentPaise: 150000, // ₹1,500/mo
      charges: [], // no manual charges entered
      payments: [
        { period: "2026-09", amount_paise: 150000, voided_at: null },
      ],
      toDate: "2026-11-23",
    });

    // 3 active months: 2026-11, 2026-10, 2026-09
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown.map((b) => b.period)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(result.breakdown[0].charged).toBe(150000);
    expect(result.breakdown[0].due).toBe(150000);
    expect(result.breakdown[0].isOverride).toBe(false);

    // 2026-09 was fully paid
    const sep = result.breakdown.find((b) => b.period === "2026-09")!;
    expect(sep.charged).toBe(150000);
    expect(sep.paid).toBe(150000);
    expect(sep.due).toBe(0);

    // Total: 3 months * 1500 = 4500 charged, 1500 paid, 3000 due
    expect(result.totalCharged).toBe(450000);
    expect(result.totalPaid).toBe(150000);
    expect(result.totalDue).toBe(300000);
  });

  it("supports custom charge overrides for discounts or prorations", () => {
    const result = computeWorkerRentBreakdown({
      joiningDate: "2026-09-20",
      monthlyRentPaise: 150000, // ₹1,500/mo
      charges: [
        {
          period: "2026-09",
          amount_paise: 50000, // ₹500 override for 10 days proration
          notes: "Prorated 10 days",
          due_date: "2026-09-20",
        },
      ],
      payments: [
        { period: "2026-09", amount_paise: 50000, voided_at: null },
      ],
      toDate: "2026-11-23",
    });

    const sep = result.breakdown.find((b) => b.period === "2026-09")!;
    expect(sep.charged).toBe(50000);
    expect(sep.isOverride).toBe(true);
    expect(sep.notes).toBe("Prorated 10 days");
    expect(sep.due).toBe(0);

    // Total charged: 1500 + 1500 + 500 = ₹3,500
    expect(result.totalCharged).toBe(350000);
    expect(result.totalPaid).toBe(50000);
    expect(result.totalDue).toBe(300000);
  });

  it("handles workers with 0 monthly rent correctly", () => {
    const result = computeWorkerRentBreakdown({
      joiningDate: "2026-01-01",
      monthlyRentPaise: 0,
      charges: [],
      payments: [],
      toDate: "2026-11-23",
    });

    expect(result.breakdown).toHaveLength(0);
    expect(result.totalCharged).toBe(0);
    expect(result.totalPaid).toBe(0);
    expect(result.totalDue).toBe(0);
  });

  it("parses non-negative rupee rent inputs into paise correctly", () => {
    expect(nonNegativeRupeesToPaise("1500")).toBe(150000);
    expect(nonNegativeRupeesToPaise("2000.50")).toBe(200050);
    expect(nonNegativeRupeesToPaise("0")).toBe(0);
    expect(nonNegativeRupeesToPaise("")).toBe(0);
    expect(nonNegativeRupeesToPaise("-500")).toBeNull();
    expect(nonNegativeRupeesToPaise("abc")).toBeNull();
  });

  it("calculates rent balance correctly (charged - collected = due)", () => {
    const charges = [
      { period: "2026-10", amount_paise: 150000 },
      { period: "2026-11", amount_paise: 150000 },
    ];
    const payments = [
      { period: "2026-10", amount_paise: 150000, voided_at: null },
      { period: "2026-11", amount_paise: 50000, voided_at: null },
      { period: "2026-11", amount_paise: 100000, voided_at: "2026-11-10T00:00:00Z" }, // voided, should be excluded
    ];

    const totalCharged = charges.reduce((s, c) => s + c.amount_paise, 0);
    const totalCollected = payments.filter((p) => !p.voided_at).reduce((s, p) => s + p.amount_paise, 0);
    const rentDue = Math.max(0, totalCharged - totalCollected);

    expect(totalCharged).toBe(300000); // ₹3,000
    expect(totalCollected).toBe(200000); // ₹1,500 + ₹500 = ₹2,000
    expect(rentDue).toBe(100000); // ₹1,000 due
    expect(formatINR(rentDue)).toBe("₹1,000");
  });

  it("allows operators, accountants, managers and owners to collect rent", () => {
    const roles: AppRole[] = ["owner", "manager", "accountant", "operator"];
    for (const r of roles) {
      expect(canRecordPayment(r)).toBe(true);
    }
  });

  it("reserves managing rent charges and settings for managers and owners", () => {
    expect(canManageWorkers("owner")).toBe(true);
    expect(canManageWorkers("manager")).toBe(true);
    expect(canManageWorkers("operator")).toBe(false);
    expect(canManageWorkers("accountant")).toBe(false);
  });
});
