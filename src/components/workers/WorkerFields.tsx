import { useT } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES, WORKER_CATEGORIES, normalizeMobile, todayISO, type Worker } from "@/lib/workers";
import { cn } from "@/lib/utils";
import { DateInput } from "@/components/ui/date-input";

export type PersonalForm = {
  full_name: string;
  mobile: string;
  alt_mobile: string;
  native_state: string;
  native_address: string;
  kerala_address: string;
  emergency_name: string;
  emergency_phone: string;
  category: string;
  joining_date: string;
  notes: string;
};

export function emptyPersonal(): PersonalForm {
  return {
    full_name: "", mobile: "", alt_mobile: "", native_state: "", native_address: "", kerala_address: "",
    emergency_name: "", emergency_phone: "", category: "", joining_date: todayISO(), notes: "",
  };
}

export function personalFromWorker(w: Worker): PersonalForm {
  return {
    full_name: w.full_name, mobile: w.mobile, alt_mobile: w.alt_mobile ?? "", native_state: w.native_state ?? "",
    native_address: w.native_address ?? "", kerala_address: w.kerala_address ?? "", emergency_name: w.emergency_name ?? "",
    emergency_phone: w.emergency_phone ?? "", category: w.category ?? "", joining_date: w.joining_date, notes: w.notes ?? "",
  };
}

export type PersonalErrors = Partial<Record<keyof PersonalForm, string>>;

/** Validates and returns cleaned values (mobile normalised to 10 digits). */
export function checkPersonal(f: PersonalForm): { errors: PersonalErrors; value: PersonalForm } {
  const errors: PersonalErrors = {};
  if (!f.full_name.trim()) errors.full_name = "Name is required.";
  const mobile = normalizeMobile(f.mobile);
  if (!mobile) errors.mobile = "Enter a valid 10-digit mobile number.";
  if (f.alt_mobile.trim() && !normalizeMobile(f.alt_mobile)) errors.alt_mobile = "Enter a valid mobile number or leave blank.";
  if (f.emergency_phone.trim() && f.emergency_phone.replace(/\D/g, "").length < 10) errors.emergency_phone = "Enter a valid phone number.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.joining_date)) errors.joining_date = "Joining date is required.";
  return {
    errors,
    value: {
      ...f,
      full_name: f.full_name.trim(),
      mobile: mobile ?? f.mobile,
      alt_mobile: f.alt_mobile.trim() ? normalizeMobile(f.alt_mobile) ?? f.alt_mobile : "",
    },
  };
}

export function Field({ label, error, required, children, className }: { label: string; error?: string | undefined; required?: boolean; children: React.ReactNode; className?: string | undefined }) {
  const t = useT();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="flex flex-col items-stretch gap-1.5">
        <span>
          {t(label)}
          {required && <span className="text-destructive"> *</span>}
        </span>
        {children}
      </Label>
      {error && <p className="text-xs text-destructive">{t(error)}</p>}
    </div>
  );
}

export function WorkerPersonalFields({ value, onChange, errors }: { value: PersonalForm; onChange: (v: PersonalForm) => void; errors: PersonalErrors }) {
  const t = useT();
  const set = (k: keyof PersonalForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" required error={errors.full_name} className="sm:col-span-2">
        <Input value={value.full_name} onChange={set("full_name")} autoComplete="off" />
      </Field>
      <Field label="Mobile" required error={errors.mobile}>
        <Input value={value.mobile} onChange={set("mobile")} inputMode="tel" placeholder="98765 43210" />
      </Field>
      <Field label="Other mobile" error={errors.alt_mobile}>
        <Input value={value.alt_mobile} onChange={set("alt_mobile")} inputMode="tel" />
      </Field>
      <Field label="Work type">
        <Input value={value.category} onChange={set("category")} list="bb-categories" placeholder="Helper, Mason…" />
        <datalist id="bb-categories">{WORKER_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Joining date" required error={errors.joining_date}>
        <DateInput value={value.joining_date} onChange={(v) => onChange({ ...value, joining_date: v })} max={todayISO()} />
      </Field>
      <Field label="Home state">
        <Input value={value.native_state} onChange={set("native_state")} list="bb-states" placeholder="West Bengal" />
        <datalist id="bb-states">{INDIAN_STATES.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Home address">
        <Input value={value.native_address} onChange={set("native_address")} />
      </Field>
      <Field label="Address in Kerala" className="sm:col-span-2">
        <Input value={value.kerala_address} onChange={set("kerala_address")} />
      </Field>
      <Field label="Emergency contact name">
        <Input value={value.emergency_name} onChange={set("emergency_name")} />
      </Field>
      <Field label="Emergency contact phone" error={errors.emergency_phone}>
        <Input value={value.emergency_phone} onChange={set("emergency_phone")} inputMode="tel" />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea value={value.notes} onChange={set("notes")} rows={2} />
      </Field>
    </div>
  );
}

export function WorkerAvatar({ name, url, size = "md" }: { name: string; url?: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  const t = useT();
  const dims = size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return url ? (
    <img src={url} alt={name} className={cn("shrink-0 rounded-full object-cover", dims)} />
  ) : (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground", dims)}>
      {initials || "?"}
    </div>
  );
}

export function StatusBadge({ status }: { status: "active" | "inactive" }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {status === "active" ? t("Active") : t("Inactive")}
    </span>
  );
}
