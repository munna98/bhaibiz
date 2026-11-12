"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ddmmyyyyToISO, formatAsDDMMYYYYInput, isoToDDMMYYYY } from "@/lib/dates";

export interface DateInputProps {
  id?: string;
  name?: string;
  /** YYYY-MM-DD */
  value?: string;
  /** Called with YYYY-MM-DD or "" when empty */
  onChange?: (isoDate: string) => void;
  /** YYYY-MM-DD */
  min?: string;
  /** YYYY-MM-DD */
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  autoFocus?: boolean;
}

function isoToLocalDate(iso: string | undefined): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      id,
      name,
      value = "",
      onChange,
      min,
      max,
      disabled = false,
      required = false,
      className,
      placeholder = "DD-MM-YYYY",
      "aria-label": ariaLabel,
      autoFocus,
    },
    ref,
  ) => {
    // Keep local text formatted as DD-MM-YYYY
    const [text, setText] = React.useState(() => isoToDDMMYYYY(value));
    const [open, setOpen] = React.useState(false);

    // Synchronize local display text when parent value prop changes
    React.useEffect(() => {
      const formatted = isoToDDMMYYYY(value);
      setText((current) => {
        // If current text parses to the same value, avoid resetting user's typing in progress
        const parsed = ddmmyyyyToISO(current);
        if (parsed === value && current.length === 10) return current;
        return formatted;
      });
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputVal = e.target.value;
      if (!inputVal.trim()) {
        setText("");
        onChange?.("");
        return;
      }

      const formatted = formatAsDDMMYYYYInput(inputVal);
      setText(formatted);

      if (formatted.length === 10) {
        const iso = ddmmyyyyToISO(formatted);
        if (iso) {
          if (min && iso < min) return;
          if (max && iso > max) return;
          onChange?.(iso);
        }
      }
    };

    const handleBlur = () => {
      if (!text.trim()) {
        if (value) onChange?.("");
        return;
      }
      const iso = ddmmyyyyToISO(text);
      if (iso) {
        if (min && iso < min) {
          setText(isoToDDMMYYYY(value));
          return;
        }
        if (max && iso > max) {
          setText(isoToDDMMYYYY(value));
          return;
        }
        if (iso !== value) onChange?.(iso);
      } else {
        // Revert to valid prop value if typed text was invalid
        setText(isoToDDMMYYYY(value));
      }
    };

    const selectedDate = isoToLocalDate(value);
    const minDate = isoToLocalDate(min);
    const maxDate = isoToLocalDate(max);

    return (
      <div className={cn("relative flex items-center", className)}>
        <Input
          ref={ref}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={text}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel ?? placeholder}
          onChange={handleTextChange}
          onBlur={handleBlur}
          className="pr-10 font-mono tracking-wider"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="absolute right-0 h-full w-9 rounded-l-none text-muted-foreground hover:text-foreground"
              aria-label="Pick date from calendar"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) {
                  const iso = dateToISO(d);
                  setText(isoToDDMMYYYY(iso));
                  onChange?.(iso);
                  setOpen(false);
                }
              }}
              disabled={(d) => {
                const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                if (minDate && dayDate < minDate) return true;
                if (maxDate && dayDate > maxDate) return true;
                return false;
              }}
              defaultMonth={selectedDate ?? maxDate ?? new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);

DateInput.displayName = "DateInput";
