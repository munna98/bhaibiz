import { describe, expect, it } from "vitest";
import { formatReceiptNo } from "@/lib/company";

describe("receipt numbering", () => {
  it("uses PREFIX-YEAR-5 digit sequence", () => {
    expect(formatReceiptNo("RCPT", 2026, 1)).toBe("RCPT-2026-00001");
    expect(formatReceiptNo("ABC", 2027, 123)).toBe("ABC-2027-00123");
  });
});
