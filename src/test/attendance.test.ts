import { describe, expect, it } from "vitest";
import { addDays, canEditDate, needsReason, summarize } from "@/lib/attendance";

const today = "2026-11-10";

describe("who can mark which dates", () => {
  it("operators can mark today and yesterday only", () => {
    expect(canEditDate("operator", today, today)).toBe(true);
    expect(canEditDate("operator", "2026-11-09", today)).toBe(true);
    expect(canEditDate("operator", "2026-11-08", today)).toBe(false);
  });
  it("managers and owners can mark older dates", () => {
    expect(canEditDate("manager", "2026-10-01", today)).toBe(true);
    expect(canEditDate("owner", "2026-01-01", today)).toBe(true);
  });
  it("nobody can mark a future date", () => {
    expect(canEditDate("owner", "2026-11-11", today)).toBe(false);
  });
  it("accountants cannot mark attendance", () => {
    expect(canEditDate("accountant", today, today)).toBe(false);
  });
});

describe("corrections", () => {
  it("changing a past marked day needs a reason", () => {
    expect(needsReason("worked", "not_worked", "2026-11-09", today)).toBe(true);
  });
  it("first marking or today's change needs no reason", () => {
    expect(needsReason("pending", "worked", "2026-11-09", today)).toBe(false);
    expect(needsReason("worked", "not_worked", today, today)).toBe(false);
  });
});

it("counts unmarked workers as pending", () => {
  expect(summarize(["worked", "worked", "not_worked", "pending"])).toEqual({ total: 4, worked: 2, not_worked: 1, pending: 1 });
});

it("addDays crosses month ends", () => {
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
});
