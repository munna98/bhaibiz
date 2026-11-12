import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";
import {
  formatDate,
  formatDateTime,
  isoToDDMMYYYY,
  ddmmyyyyToISO,
  formatAsDDMMYYYYInput,
  todayISO,
  todayDDMMYYYY,
} from "@/lib/dates";
import { DateInput } from "@/components/ui/date-input";

describe("Date utilities in DD-MM-YYYY format", () => {
  it("formatDate formats YYYY-MM-DD to DD-MM-YYYY", () => {
    expect(formatDate("2026-11-09")).toBe("09-11-2026");
    expect(formatDate("2026-01-05")).toBe("05-01-2026");
  });

  it("formatDate preserves already formatted DD-MM-YYYY", () => {
    expect(formatDate("09-11-2026")).toBe("09-11-2026");
    expect(formatDate("25-12-2025")).toBe("25-12-2025");
  });

  it("formatDate returns dash for empty, null, or undefined", () => {
    expect(formatDate("")).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("formatDate formats Date instances correctly in Asia/Kolkata", () => {
    const d = new Date("2026-11-09T00:00:00+05:30");
    expect(formatDate(d)).toBe("09-11-2026");
  });

  it("formatDateTime formats timestamp to DD-MM-YYYY, hh:mm a", () => {
    const ts = "2026-11-09T14:30:00+05:30";
    const formatted = formatDateTime(ts);
    expect(formatted).toContain("09-11-2026");
    expect(formatted).toMatch(/09-11-2026,\s+\d{1,2}:\d{2}\s+(?:am|pm|AM|PM)/i);
  });

  it("isoToDDMMYYYY converts correctly and safely", () => {
    expect(isoToDDMMYYYY("2026-11-09")).toBe("09-11-2026");
    expect(isoToDDMMYYYY("invalid")).toBe("");
    expect(isoToDDMMYYYY("")).toBe("");
  });

  it("ddmmyyyyToISO validates and parses real calendar dates", () => {
    expect(ddmmyyyyToISO("09-11-2026")).toBe("2026-11-09");
    expect(ddmmyyyyToISO("09/11/2026")).toBe("2026-11-09");
    // Leap year check
    expect(ddmmyyyyToISO("29-02-2024")).toBe("2024-02-29");
    expect(ddmmyyyyToISO("29-02-2025")).toBeNull();
    // Non-existent day in month
    expect(ddmmyyyyToISO("31-04-2026")).toBeNull();
    expect(ddmmyyyyToISO("invalid")).toBeNull();
  });

  it("formatAsDDMMYYYYInput formats typed numbers into DD-MM-YYYY mask", () => {
    expect(formatAsDDMMYYYYInput("0")).toBe("0");
    expect(formatAsDDMMYYYYInput("09")).toBe("09");
    expect(formatAsDDMMYYYYInput("091")).toBe("09-1");
    expect(formatAsDDMMYYYYInput("0911")).toBe("09-11");
    expect(formatAsDDMMYYYYInput("09112")).toBe("09-11-2");
    expect(formatAsDDMMYYYYInput("09112026")).toBe("09-11-2026");
  });

  it("todayDDMMYYYY returns today in DD-MM-YYYY", () => {
    const today = todayDDMMYYYY();
    expect(/^\d{2}-\d{2}-\d{4}$/.test(today)).toBe(true);
  });
});

describe("DateInput component", () => {
  function TestWrapper({ initial = "2026-11-09", onChange }: { initial?: string; onChange?: (v: string) => void }) {
    const [val, setVal] = useState(initial);
    return (
      <DateInput
        id="test-date"
        value={val}
        onChange={(v) => {
          setVal(v);
          onChange?.(v);
        }}
      />
    );
  }

  it("displays the date in DD-MM-YYYY format", () => {
    render(<TestWrapper initial="2026-11-09" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("09-11-2026");
  });

  it("updates value when valid DD-MM-YYYY is typed", () => {
    const handleChange = vi.fn();
    render(<TestWrapper initial="2026-11-09" onChange={handleChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "15-11-2026" } });
    expect(handleChange).toHaveBeenCalledWith("2026-11-15");
  });

  it("reverts invalid date on blur", () => {
    render(<TestWrapper initial="2026-11-09" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "31-02-2026" } });
    fireEvent.blur(input);
    expect(input.value).toBe("09-11-2026");
  });
});
