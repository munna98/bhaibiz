import { useT } from "@/lib/i18n";
import { useId, useState } from "react";
import { METHODS, validMoneyAmount, validMoneyDate, type PayMethod } from "@/lib/money";
import { formatINR, rupeesToPaise, todayISO } from "@/lib/workers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AmountValues = { amount: number; date: string; method: PayMethod; text: string };

/** Shared amount + date + method/reference form. `textLabel` is the reference or reason field. */
export function AmountForm({ submitLabel, withMethod = true, textLabel = "Reference (optional)", textRequired = false, busy, maximum, onSubmit, onAmount }: {
  submitLabel: string; withMethod?: boolean; textLabel?: string; textRequired?: boolean; busy?: boolean;
  maximum?: number | undefined;
  onSubmit: (v: AmountValues) => void; onAmount?: (paise: number | null) => void;
}) {
  const t = useT();
  const [amt, setAmt] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PayMethod>("cash");
  const [text, setText] = useState("");
  const id = useId();
  const paise = rupeesToPaise(amt);
  const today = todayISO();
  const ok = validMoneyAmount(paise, maximum) && validMoneyDate(date, today) && (!textRequired || text.trim() !== "");
  const tooMuch = paise !== null && maximum !== undefined && paise > maximum;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (ok && validMoneyAmount(paise, maximum)) onSubmit({ amount: paise, date, method, text: text.trim() }); }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${id}-amt`}>{t("Amount (₹)")}</Label>
          <Input id={`${id}-amt`} required aria-invalid={tooMuch} inputMode="decimal" autoFocus value={amt} onChange={(e) => { setAmt(e.target.value); onAmount?.(rupeesToPaise(e.target.value)); }} className="text-lg font-semibold" />
        </div>
        <div>
          <Label htmlFor={`${id}-dt`}>{t("Date")}</Label>
          <Input id={`${id}-dt`} required type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {withMethod && (
        <div className="flex gap-1">
          {METHODS.map((m) => (
            <Button key={m.value} type="button" variant={method === m.value ? "default" : "outline"} onClick={() => setMethod(m.value)} aria-pressed={method === m.value} className="flex-1 px-2">
              {t(m.label)}
            </Button>
          ))}
        </div>
      )}
      <div>
        <Label htmlFor={`${id}-txt`}>{t(textLabel)}</Label>
        <Input id={`${id}-txt`} required={textRequired} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {tooMuch && <p role="alert" className="text-sm text-destructive">{t("Maximum amount")}: {formatINR(maximum ?? 0)}.</p>}
      <Button type="submit" className="w-full" disabled={!ok || busy}>{busy ? t("Saving…") : t(submitLabel)}</Button>
    </form>
  );
}
