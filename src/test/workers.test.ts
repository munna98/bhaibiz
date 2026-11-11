import { describe, expect, it } from "vitest";
import { maskAadhaar, validateAadhaar, verhoeffCheckDigit } from "@/lib/aadhaar";
import { decryptAadhaar, encryptAadhaar, hashAadhaar } from "@/lib/aadhaar-crypto";
import { formatINR, normalizeMobile, rateOn, rupeesToPaise } from "@/lib/workers";

const withCheck = (eleven: string) => eleven + verhoeffCheckDigit(eleven);
const VALID = withCheck("23456789012");

describe("Aadhaar number is mandatory and validated", () => {
  it("rejects an empty number", () => {
    expect(validateAadhaar("")).not.toBeNull();
  });
  it("rejects numbers that are not 12 digits", () => {
    expect(validateAadhaar("12345")).toBe("Aadhaar number must be 12 digits.");
  });
  it("rejects numbers starting with 0 or 1", () => {
    expect(validateAadhaar(withCheck("12345678901"))).toBe("Aadhaar number cannot start with 0 or 1.");
  });
  it("rejects a typo that breaks the check digit", () => {
    const typo = VALID.slice(0, 11) + String((Number(VALID[11]) + 1) % 10);
    expect(validateAadhaar(typo)).toBe("This Aadhaar number is not valid. Please check the digits.");
  });
  it("accepts a valid number with spaces", () => {
    expect(validateAadhaar(VALID.replace(/(\d{4})/g, "$1 "))).toBeNull();
  });
  it("staff see only the last 4 digits", () => {
    expect(maskAadhaar("9012")).toBe("XXXX XXXX 9012");
  });
});

describe("Aadhaar encryption", () => {
  it("round-trips and never stores the plain number", async () => {
    const c = await encryptAadhaar(VALID, "test-secret");
    expect(c).not.toContain(VALID);
    expect(await decryptAadhaar(c, "test-secret")).toBe(VALID);
  });
  it("same number gives the same duplicate-check hash", async () => {
    expect(await hashAadhaar(VALID, "k")).toBe(await hashAadhaar(VALID, "k"));
  });
});

describe("Daily rate with effective dates", () => {
  const agreements = [
    { daily_rate_paise: 10000, effective_from: "2026-01-01" },
    { daily_rate_paise: 15000, effective_from: "2026-03-15" },
  ];
  it("old days keep the old rate after a change", () => {
    expect(rateOn(agreements, "2026-03-14")).toBe(10000);
  });
  it("new rate applies from its start date", () => {
    expect(rateOn(agreements, "2026-03-15")).toBe(15000);
  });
  it("no rate before the first agreement", () => {
    expect(rateOn(agreements, "2025-12-31")).toBeNull();
  });
});

describe("Money and phone input", () => {
  it("₹150 is stored as 15000 paise", () => {
    expect(rupeesToPaise("150")).toBe(15000);
  });
  it("rejects zero or negative rates", () => {
    expect(rupeesToPaise("0")).toBeNull();
    expect(rupeesToPaise("-5")).toBeNull();
  });
  it("formats rupees in Indian style", () => {
    expect(formatINR(12345600)).toBe("₹1,23,456");
  });
  it("normalises +91 mobile numbers to 10 digits", () => {
    expect(normalizeMobile("+91 98765 43210")).toBe("9876543210");
    expect(normalizeMobile("12345")).toBeNull();
  });
});
