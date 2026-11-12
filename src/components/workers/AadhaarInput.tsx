import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatAadhaar, normalizeAadhaar } from "@/lib/aadhaar";

export interface AadhaarInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClearError?: (() => void) | undefined;
}

/**
 * Finds the cursor index in the formatted string corresponding to `digitCount` digits from the start.
 */
export function getCursorPositionAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i];
    if (ch && /\d/.test(ch)) {
      seen++;
      if (seen === digitCount) {
        // If next char is a space, move past it so the next keystroke starts in the new block
        if (i + 1 < formatted.length && formatted[i + 1] === " ") {
          return i + 2;
        }
        return i + 1;
      }
    }
  }
  return formatted.length;
}

export const AadhaarInput = React.forwardRef<HTMLInputElement, AadhaarInputProps>(
  ({ value, onChange, onClearError, className, onKeyDown, ...props }, ref) => {
    const internalRef = React.useRef<HTMLInputElement | null>(null);
    const cursorRef = React.useRef<number | null>(null);

    React.useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);

    const raw = normalizeAadhaar(value ?? "").slice(0, 12);
    const displayValue = formatAadhaar(raw);

    React.useLayoutEffect(() => {
      if (cursorRef.current !== null && internalRef.current) {
        const pos = cursorRef.current;
        cursorRef.current = null;
        internalRef.current.setSelectionRange(pos, pos);
      }
    });

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;

      const input = e.currentTarget;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;

      if (e.key === "Backspace") {
        onClearError?.();
        // If cursor is right after a space (e.g. "2332 |4354"):
        // The character at start - 1 is ' '. Native backspace would just delete the space,
        // which leaves the digits unchanged, so the formatter immediately puts the space back.
        // Instead, delete the digit before the space.
        if (start === end && start > 0 && input.value[start - 1] === " ") {
          e.preventDefault();
          const digitsBefore = input.value.slice(0, start - 1).replace(/\D/g, "");
          const newDigitsBefore = digitsBefore.slice(0, -1);
          const digitsAfter = input.value.slice(start).replace(/\D/g, "");
          const newRaw = (newDigitsBefore + digitsAfter).slice(0, 12);
          const newFormatted = formatAadhaar(newRaw);
          const targetPos = getCursorPositionAfterDigits(newFormatted, newDigitsBefore.length);
          cursorRef.current = targetPos;
          onChange(newRaw);
          return;
        }
      }

      if (e.key === "Delete") {
        onClearError?.();
        // If cursor is right before a space (e.g. "2332| 4354"):
        // Deleting forward would delete the space, which re-appears. Delete the digit after space.
        if (start === end && input.value[start] === " ") {
          e.preventDefault();
          const digitsBefore = input.value.slice(0, start).replace(/\D/g, "");
          const digitsAfter = input.value.slice(start + 1).replace(/\D/g, "").slice(1);
          const newRaw = (digitsBefore + digitsAfter).slice(0, 12);
          const newFormatted = formatAadhaar(newRaw);
          const targetPos = getCursorPositionAfterDigits(newFormatted, digitsBefore.length);
          cursorRef.current = targetPos;
          onChange(newRaw);
          return;
        }
      }

      if (e.key === " ") {
        e.preventDefault();
        onClearError?.();
        if (start === end && input.value[start] === " ") {
          input.setSelectionRange(start + 1, start + 1);
        }
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onClearError?.();
      const input = e.currentTarget;
      const val = input.value;
      const cursorPos = input.selectionStart ?? val.length;

      // Count digits before cursor in the new input value
      const digitsBefore = val.slice(0, cursorPos).replace(/\D/g, "").length;

      const newRaw = val.replace(/\D/g, "").slice(0, 12);
      const newFormatted = formatAadhaar(newRaw);

      const targetPos = getCursorPositionAfterDigits(newFormatted, Math.min(digitsBefore, newRaw.length));
      cursorRef.current = targetPos;

      onChange(newRaw);
    };

    return (
      <Input
        {...props}
        ref={internalRef}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        inputMode="numeric"
        className={className}
      />
    );
  },
);

AadhaarInput.displayName = "AadhaarInput";
