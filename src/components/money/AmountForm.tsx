import { useT } from "@/lib/i18n";
import { useId, useState } from "react";
import { METHODS, validMoneyAmount, validMoneyDate, type PayMethod } from "@/lib/money";
import { formatINR, rupeesToPaise, todayISO } from "@/lib/workers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { X } from "lucide-react";

export type AmountValues = { amount: number; date: string; method: PayMethod; text: string };

/** Shared amount + date + method/reference form. `textLabel` is the reference or reason field. */
export function AmountForm({
  submitLabel,
  withMethod = true,
  textLabel = "Reference (optional)",
  textRequired = false,
  busy,
  maximum,
  amountValue,
  onAmountValueChange,
  dayCards,
  onSubmit,
  onAmount,
}: {
  submitLabel: string;
  withMethod?: boolean | undefined;
  textLabel?: string | undefined;
  textRequired?: boolean | undefined;
  busy?: boolean | undefined;
  maximum?: number | undefined;
  amountValue?: string | undefined;
  onAmountValueChange?: ((amt: string) => void) | undefined;
  dayCards?: React.ReactNode | undefined;
  onSubmit: (v: AmountValues) => void;
  onAmount?: ((paise: number | null) => void) | undefined;
}) {
  const t = useT();
  const [internalAmt, setInternalAmt] = useState("");
  const isControlled = amountValue !== undefined;
  const amt = isControlled ? amountValue : internalAmt;

  const handleAmtChange = (newVal: string) => {
    if (!isControlled) {
      setInternalAmt(newVal);
    }
    onAmountValueChange?.(newVal);
    onAmount?.(rupeesToPaise(newVal));
  };

  const handleClear = () => {
    handleAmtChange("");
  };

  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PayMethod>("cash");
  const [text, setText] = useState("");
  const id = useId();
  const paise = rupeesToPaise(amt);
  const today = todayISO();
  const ok =
    validMoneyAmount(paise, maximum) &&
    validMoneyDate(date, today) &&
    (!textRequired || text.trim() !== "");
  const tooMuch = paise !== null && maximum !== undefined && paise > maximum;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && validMoneyAmount(paise, maximum))
          onSubmit({ amount: paise, date, method, text: text.trim() });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${id}-amt`}>{t("Amount (₹)")}</Label>
          <div className="relative">
            <Input
              id={`${id}-amt`}
              required
              aria-invalid={tooMuch}
              inputMode="decimal"
              autoFocus
              value={amt}
              onChange={(e) => handleAmtChange(e.target.value)}
              className="pr-8 text-lg font-semibold"
            />
            {amt ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none"
                aria-label={t("Clear amount")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <Label htmlFor={`${id}-dt`}>{t("Date")}</Label>
          <DateInput
            id={`${id}-dt`}
            required
            max={today}
            value={date}
            onChange={(v) => setDate(v)}
          />
        </div>
      </div>
      {dayCards}
      {withMethod && (
        <div className="flex gap-1">
          {METHODS.map((m) => (
            <Button
              key={m.value}
              type="button"
              variant={method === m.value ? "default" : "outline"}
              onClick={() => setMethod(m.value)}
              aria-pressed={method === m.value}
              className="flex-1 px-2"
            >
              {t(m.label)}
            </Button>
          ))}
        </div>
      )}
      <div>
        <Label htmlFor={`${id}-txt`}>{t(textLabel)}</Label>
        <Input
          id={`${id}-txt`}
          required={textRequired}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {tooMuch && (
        <p role="alert" className="text-sm text-destructive">
          {t("Maximum amount")}: {formatINR(maximum ?? 0)}.
        </p>
      )}
      {paise !== null && maximum !== undefined && paise < maximum && (
        <p className="text-xs text-muted-foreground">
          {t("Still due after this")}: {formatINR(maximum - paise)}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={!ok || busy}>
        {busy ? t("Saving…") : t(submitLabel)}
      </Button>
    </form>
  );
}
