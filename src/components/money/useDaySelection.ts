import { formatDate, formatINR, rupeesToPaise, todayISO } from "@/lib/workers";
import { useEffect, useMemo, useRef, useState } from "react";

export type UnpaidDay = {
  id: string;
  work_date: string;
  amount: number;
  unpaid: number;
};

export function useDaySelection({
  days,
  mode,
  totalDue,
  targetDate,
  onAmountChange,
}: {
  days: UnpaidDay[] | undefined;
  mode: "today" | "total";
  totalDue: number;
  targetDate?: string | undefined;
  onAmountChange?: ((paise: number | null) => void) | undefined;
}) {
  const [amt, setAmt] = useState(
    mode === "total" && totalDue > 0 ? (totalDue / 100).toString() : "",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const unpaidDays = useMemo(
    () =>
      (days ?? [])
        .filter((d) => d.unpaid > 0)
        .sort((a, b) => a.work_date.localeCompare(b.work_date)),
    [days],
  );

  useEffect(() => {
    if (initializedRef.current || !days) return;
    initializedRef.current = true;

    if (mode === "today") {
      const today = todayISO();
      const todayDay =
        unpaidDays.find((d) => d.work_date === today) ??
        (targetDate ? unpaidDays.find((d) => d.work_date === targetDate) : undefined);
      if (todayDay) {
        setSelectedIds(new Set([todayDay.id]));
        const val = (todayDay.unpaid / 100).toString();
        setAmt(val);
        onAmountChange?.(todayDay.unpaid);
      }
    } else {
      // Total due mode: prefill all oldest first days covering totalDue
      const ids = new Set<string>();
      let left = totalDue;
      for (const d of unpaidDays) {
        if (left <= 0) break;
        ids.add(d.id);
        left -= d.unpaid;
      }
      setSelectedIds(ids);
      if (totalDue > 0) {
        onAmountChange?.(totalDue);
      }
    }
  }, [days, unpaidDays, mode, totalDue, targetDate, onAmountChange]);

  const handleToggleDay = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    const sum = unpaidDays.filter((d) => next.has(d.id)).reduce((acc, d) => acc + d.unpaid, 0);
    const val = sum > 0 ? (sum / 100).toString() : "";
    setAmt(val);
    onAmountChange?.(sum > 0 ? sum : null);
  };

  const handleAmountChange = (newVal: string) => {
    setAmt(newVal);
    const paise = rupeesToPaise(newVal);
    onAmountChange?.(paise);

    if (!paise || paise <= 0) {
      setSelectedIds(new Set());
      return;
    }

    const curSum = unpaidDays
      .filter((d) => selectedIds.has(d.id))
      .reduce((acc, d) => acc + d.unpaid, 0);
    if (curSum === paise) return;

    // If today mode and entered amount equals today's due, keep today
    const today = todayISO();
    const todayDay =
      unpaidDays.find((d) => d.work_date === today) ??
      (targetDate ? unpaidDays.find((d) => d.work_date === targetDate) : undefined);
    if (mode === "today" && todayDay && todayDay.unpaid === paise) {
      setSelectedIds(new Set([todayDay.id]));
      return;
    }

    // Default FIFO allocation for cards
    const ids = new Set<string>();
    let left = paise;
    for (const d of unpaidDays) {
      if (left <= 0) break;
      if (left >= d.unpaid) {
        ids.add(d.id);
        left -= d.unpaid;
      } else {
        break;
      }
    }
    setSelectedIds(ids);
  };

  return {
    amt,
    setAmt,
    selectedIds,
    unpaidDays,
    handleToggleDay,
    handleAmountChange,
  };
}
