import { useT } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Camera, ShieldCheck } from "lucide-react";
import { formatAadhaar, validateAadhaar } from "@/lib/aadhaar";
import { AadhaarInput } from "@/components/workers/AadhaarInput";
import { AadhaarCopyPicker, type AadhaarFiles } from "@/components/workers/AadhaarCopyPicker";
import { canManageWorkers, formatINR, nonNegativeRupeesToPaise, rupeesToPaise } from "@/lib/workers";
import { accommodationsQuery } from "@/lib/accommodations";
import { createWorker } from "@/lib/workers.functions";
import { uploadAadhaarDoc, uploadWorkerPhoto } from "@/lib/worker-uploads";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { useActiveMembership } from "../../app";
import {
  checkPersonal, emptyPersonal, Field, WorkerPersonalFields, type PersonalErrors,
} from "@/components/workers/WorkerFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/workers/new")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Add worker — BhaiBiz" },
      { name: "description", content: "Register a worker with Aadhaar and daily rate." },
      { property: "og:title", content: "Add worker — BhaiBiz" },
      { property: "og:description", content: "Register a worker with Aadhaar and daily rate." },
    ],
  }),
  loader: async ({ context }) => {
    const active = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (!active) return;
    if (active.role === "operator") throw redirect({ to: "/app" });
  },
  component: NewWorkerPage,
});

const STEPS = ["Personal", "Identity", "Daily rate"];

function NewWorkerPage() {
  const t = useT();
  const { active } = useActiveMembership();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createWorker);
  const accQuery = useQuery(accommodationsQuery(active.company_id));

  const [step, setStep] = useState(0);
  const [personal, setPersonal] = useState(emptyPersonal);
  const [errors, setErrors] = useState<PersonalErrors>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [aadhaar, setAadhaar] = useState("");
  const [aadhaarErr, setAadhaarErr] = useState<string | null>(null);
  const [docs, setDocs] = useState<AadhaarFiles>({ front: null, back: null });
  const [rate, setRate] = useState("");
  const [rateFrom, setRateFrom] = useState("");
  const [rateErr, setRateErr] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingErr, setOpeningErr] = useState<string | null>(null);
  const [monthlyRent, setMonthlyRent] = useState("");
  const [monthlyRentErr, setMonthlyRentErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentAcc = accQuery.data?.find((a) => a.id === personal.accommodation_id);

  if (!canManageWorkers(active.role)) {
    return <p className="text-muted-foreground">{t("Only owners and managers can add workers.")}</p>;
  }

  function next() {
    if (step === 0) {
      const { errors: e, value } = checkPersonal(personal);
      setErrors(e);
      if (Object.keys(e).length) return;
      setPersonal(value);
      if (!rateFrom) setRateFrom(value.joining_date);
    }
    if (step === 1) {
      const e = validateAadhaar(aadhaar);
      setAadhaarErr(e);
      if (e) return;
    }
    setStep((s) => s + 1);
  }

  async function save() {
    const paise = rupeesToPaise(rate);
    if (!paise) { setRateErr("Enter the daily commission in rupees."); return; }
    if (!rateFrom) { setRateErr("Pick the date this rate starts."); return; }
    setRateErr(null);
    const openingPaise = nonNegativeRupeesToPaise(openingBalance);
    if (openingPaise === null) {
      setOpeningErr("Enter a valid opening balance or 0.");
      return;
    }
    setOpeningErr(null);
    const rentPaise = nonNegativeRupeesToPaise(monthlyRent);
    if (rentPaise === null) {
      setMonthlyRentErr("Enter a valid monthly rent or 0.");
      return;
    }
    setMonthlyRentErr(null);
    setBusy(true);
    try {
      const { id } = await create({
        data: {
          companyId: active.company_id,
          worker: personal,
          aadhaar,
          ratePaise: paise,
          rateFrom,
          openingBalancePaise: openingPaise,
          monthlyRentPaise: rentPaise,
        },
      });
      const problems: string[] = [];
      if (photo) await uploadWorkerPhoto(active.company_id, id, photo).catch(() => problems.push("photo"));
      if (docs.front) await uploadAadhaarDoc(active.company_id, id, docs.front, "Front").catch(() => problems.push("Aadhaar front copy"));
      if (docs.back) await uploadAadhaarDoc(active.company_id, id, docs.back, "Back").catch(() => problems.push("Aadhaar back copy"));
      await qc.invalidateQueries({ queryKey: ["workers", active.company_id] });
      await qc.invalidateQueries({ queryKey: ["balances", active.company_id] });
      await qc.invalidateQueries({ queryKey: ["agreements", active.company_id] });
      await qc.invalidateQueries({ queryKey: ["reports"] });
      if (problems.length) toast.warning(`Worker saved, but the ${problems.join(" and ")} didn't upload. Try again from their profile.`);
      else toast.success(t("Worker added"));
      navigate({ to: "/app/workers/$workerId", params: { workerId: id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save";
      if (msg.toLowerCase().includes("aadhaar")) { setAadhaarErr(msg); setStep(1); }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/app/workers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> {t("Workers")}</Link>
      <h1 className="mt-2 text-2xl font-bold">{t("Add worker")}</h1>

      <ol className="mt-4 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            <div className={cn("mt-1 text-xs", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{i + 1}. {t(s)}</div>
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
        {step === 0 && (
          <div className="space-y-5">
            <PhotoPicker file={photo} onChange={setPhoto} />
            <WorkerPersonalFields
              value={personal}
              onChange={setPersonal}
              errors={errors}
              companyId={active.company_id}
              onAccommodationChange={(acc) => {
                if (acc && acc.monthly_rent_paise > 0) {
                  setMonthlyRent((acc.monthly_rent_paise / 100).toString());
                } else if (!acc) {
                  setMonthlyRent("");
                }
              }}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <Field label="Aadhaar number" required error={aadhaarErr ?? undefined}>
              <AadhaarInput
                value={aadhaar}
                onChange={(val) => {
                  setAadhaar(val);
                  if (aadhaarErr) setAadhaarErr(null);
                }}
                onClearError={() => {
                  if (aadhaarErr) setAadhaarErr(null);
                }}
                inputMode="numeric"
                placeholder="1234 5678 9012"
                className="font-mono tracking-wider"
                autoComplete="off"
              />
            </Field>
            <div className="flex gap-2 rounded-lg bg-secondary p-3 text-xs text-secondary-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {t("Stored encrypted. Staff see only the last 4 digits; only the owner can view the full number.")}
            </div>
            <Field label="Aadhaar copy (optional)" asDiv>
              <AadhaarCopyPicker value={docs} onChange={setDocs} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Daily commission (₹)" required error={rateErr ?? undefined}>
                <Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="150" />
              </Field>
              <Field label="Rate starts from" required>
                <DateInput value={rateFrom} onChange={(v) => setRateFrom(v)} />
              </Field>
            </div>
            <Field label="Opening balance owed to business (₹)" error={openingErr ?? undefined}>
              <Input
                value={openingBalance}
                onChange={(e) => {
                  setOpeningBalance(e.target.value);
                  if (openingErr) setOpeningErr(null);
                }}
                inputMode="decimal"
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground">
                {t("Any previous balance this worker owes to the business before starting on BhaiBiz.")}
              </span>
            </Field>
            <Field label="Monthly room rent (₹)" error={monthlyRentErr ?? undefined}>
              <div className="space-y-1.5">
                <Input
                  value={monthlyRent}
                  onChange={(e) => {
                    setMonthlyRent(e.target.value);
                    if (monthlyRentErr) setMonthlyRentErr(null);
                  }}
                  inputMode="decimal"
                  placeholder="0"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {t("Monthly rent collected from this worker for accommodation (leave blank or 0 if none).")}
                  </span>
                  {currentAcc && currentAcc.monthly_rent_paise > 0 && (
                    <button
                      type="button"
                      onClick={() => setMonthlyRent((currentAcc.monthly_rent_paise / 100).toString())}
                      className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                    >
                      {t("Default for")} {currentAcc.name}: {formatINR(currentAcc.monthly_rent_paise)} / {t("month")} ({t("Use default")})
                    </button>
                  )}
                </div>
              </div>
            </Field>
            <div className="rounded-lg bg-muted p-4 text-sm">
              <div className="font-semibold">{personal.full_name}</div>
              <div className="text-muted-foreground">{personal.mobile} · Aadhaar XXXX XXXX {aadhaar.slice(-4)}</div>
              {(docs.front || docs.back) && (
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  {docs.front && (
                    <div>
                      {t("Aadhaar front attached")}: <span className="font-medium text-foreground">{docs.front.name}</span>
                    </div>
                  )}
                  {docs.back && (
                    <div>
                      {t("Aadhaar back attached")}: <span className="font-medium text-foreground">{docs.back.name}</span>
                    </div>
                  )}
                </div>
              )}
              {rupeesToPaise(rate) && (
                <div className="mt-2">{t("Earns")} <b>{formatINR(rupeesToPaise(rate) ?? 0)}</b> {t("commission for every day marked Worked.")}</div>
              )}
              {Boolean(nonNegativeRupeesToPaise(openingBalance)) && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {t("Opening balance owed to business")}: <b className="text-foreground">{formatINR(nonNegativeRupeesToPaise(openingBalance) ?? 0)}</b>
                </div>
              )}
              {Boolean(nonNegativeRupeesToPaise(monthlyRent)) && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {t("Monthly rent")}: <b className="text-foreground">{formatINR(nonNegativeRupeesToPaise(monthlyRent) ?? 0)} / {t("month")}</b>
                  {currentAcc && (
                    <span> ({currentAcc.name}{currentAcc.monthly_rent_paise !== nonNegativeRupeesToPaise(monthlyRent) ? ` · ${t("Custom rate")}` : ""})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between gap-3">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}>{t("Back")}</Button>
          {step < 2 ? (
            <Button onClick={next}>{t("Next")}</Button>
          ) : (
            <Button onClick={save} disabled={busy}>{busy ? t("Saving…") : t("Save worker")}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoPicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const t = useT();
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="flex items-center gap-4">
      <label className="flex cursor-pointer items-center gap-4">
        {preview ? (
          <img src={preview} alt={t("Worker")} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Camera className="h-7 w-7" />
          </div>
        )}
        <div className="text-sm">
          <div className="font-medium">{file ? t("Change photo") : t("Add photo")}</div>
          <div className="text-muted-foreground">{t("Optional")}</div>
        </div>
        <input
          type="file"
          accept="image/*"
          capture="user"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onChange(f);
          }}
        />
      </label>
      {file && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onChange(null)}
        >
          {t("Remove")}
        </Button>
      )}
    </div>
  );
}
