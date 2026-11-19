import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { DaySelectionCards } from "@/components/money/DaySelectionCards";
import { useDaySelection, type UnpaidDay } from "@/components/money/useDaySelection";
import { AmountForm } from "@/components/money/AmountForm";
import { todayISO } from "@/lib/workers";

describe("DaySelectionCards and useDaySelection", () => {
  const today = todayISO();
  const mockDays: UnpaidDay[] = [
    { id: "day-1", work_date: "2026-11-17", amount: 50000, unpaid: 50000 },
    { id: "day-2", work_date: "2026-11-18", amount: 50000, unpaid: 50000 },
    { id: "day-3", work_date: today, amount: 50000, unpaid: 50000 },
  ];

  it("prefills with total due and selects oldest first in collect mode", () => {
    const { result } = renderHook(() =>
      useDaySelection({
        days: mockDays,
        mode: "total",
        totalDue: 100000, // ₹1,000 due (covers day-1 and day-2)
      }),
    );

    // Prefilled amount with total due: 100000 paise = 1000 rupees
    expect(result.current.amt).toBe("1000");
    // Oldest first: day-1 and day-2 should be selected, day-3 not
    expect(result.current.selectedIds.has("day-1")).toBe(true);
    expect(result.current.selectedIds.has("day-2")).toBe(true);
    expect(result.current.selectedIds.has("day-3")).toBe(false);
  });

  it("prefills with today's due and selects today's card in attendance mode", () => {
    const { result } = renderHook(() =>
      useDaySelection({
        days: mockDays,
        mode: "today",
        totalDue: 150000,
      }),
    );

    // Prefilled with today's due: 50000 paise = 500 rupees
    expect(result.current.amt).toBe("500");
    // Today's card selected by default
    expect(result.current.selectedIds.has("day-3")).toBe(true);
    expect(result.current.selectedIds.has("day-1")).toBe(false);
    expect(result.current.selectedIds.has("day-2")).toBe(false);
  });

  it("adds the sum to amount input when selecting multiple date menu cards", () => {
    const { result } = renderHook(() =>
      useDaySelection({
        days: mockDays,
        mode: "today",
        totalDue: 150000,
      }),
    );

    expect(result.current.amt).toBe("500");

    // Select day-2 as well
    act(() => {
      result.current.handleToggleDay("day-2");
    });

    expect(result.current.selectedIds.has("day-3")).toBe(true);
    expect(result.current.selectedIds.has("day-2")).toBe(true);
    expect(result.current.amt).toBe("1000"); // 500 + 500

    // Select day-1 as well
    act(() => {
      result.current.handleToggleDay("day-1");
    });

    expect(result.current.selectedIds.size).toBe(3);
    expect(result.current.amt).toBe("1500"); // 500 + 500 + 500

    // Deselect day-3
    act(() => {
      result.current.handleToggleDay("day-3");
    });

    expect(result.current.selectedIds.has("day-3")).toBe(false);
    expect(result.current.amt).toBe("1000");
  });

  it("clears selection when amount is cleared", () => {
    const { result } = renderHook(() =>
      useDaySelection({
        days: mockDays,
        mode: "total",
        totalDue: 150000,
      }),
    );

    expect(result.current.selectedIds.size).toBe(3);

    act(() => {
      result.current.handleAmountChange("");
    });

    expect(result.current.amt).toBe("");
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("renders DaySelectionCards with default variant for selected and outline for unselected", () => {
    const onToggle = vi.fn();
    const selected = new Set(["day-3"]);

    render(<DaySelectionCards days={mockDays} selectedIds={selected} onToggleDay={onToggle} />);

    // Today button should be pressed/selected
    const todayBtn = screen.getByRole("button", { name: /today/i });
    expect(todayBtn.getAttribute("aria-pressed")).toBe("true");

    // Click day-1 button
    const day1Btn = screen.getByRole("button", { name: /17-11-2026/i });
    expect(day1Btn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(day1Btn);
    expect(onToggle).toHaveBeenCalledWith("day-1");
  });

  it("AmountForm provides a quick clear icon that resets the amount input", () => {
    const onAmountChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AmountForm
        submitLabel="Save payment"
        amountValue="500"
        onAmountValueChange={onAmountChange}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByLabelText("Amount (₹)") as HTMLInputElement;
    expect(input.value).toBe("500");

    const clearBtn = screen.getByRole("button", { name: "Clear amount" });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onAmountChange).toHaveBeenCalledWith("");
  });
});
