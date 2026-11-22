import { describe, expect, it } from "vitest";
import { currentPeriod, formatPeriod, recentPeriods } from "@/lib/rent";
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
