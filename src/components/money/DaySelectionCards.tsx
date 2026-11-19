import { useT } from "@/lib/i18n";
import { formatDate, formatINR, todayISO } from "@/lib/workers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UnpaidDay } from "./useDaySelection";

export type { UnpaidDay } from "./useDaySelection";

export function DaySelectionCards({
  days,
  selectedIds,
  onToggleDay,
}: {
  days: UnpaidDay[];
  selectedIds: Set<string>;
  onToggleDay: (id: string) => void;
}) {
  const t = useT();
  const today = todayISO();

  if (days.length === 0) return null;

  return (
    <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto py-0.5">
      {days.map((d) => {
        const isSelected = selectedIds.has(d.id);
        const isToday = d.work_date === today;
        return (
          <Button
            key={d.id}
            type="button"
            variant={isSelected ? "default" : "outline"}
            aria-pressed={isSelected}
            onClick={() => onToggleDay(d.id)}
            className={cn(
              "h-auto flex-col items-center px-2.5 py-1 text-xs transition-colors",
              isSelected && "font-semibold shadow-sm",
            )}
          >
            <span className="leading-tight">{isToday ? t("Today") : formatDate(d.work_date)}</span>
            <span
              className={cn(
                "text-[11px] leading-tight",
                isSelected ? "opacity-90" : "text-muted-foreground",
              )}
            >
              {formatINR(d.unpaid)}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
