import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BhaiBiz — Commission ledger for labour suppliers" },
      { name: "description", content: "Track daily attendance, commission due and collections for your workers in Kerala." },
      { property: "og:title", content: "BhaiBiz — Commission ledger for labour suppliers" },
      { property: "og:description", content: "Who worked today, what is due, who still owes — in two taps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const t = useT();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
        <span className="font-[family-name:var(--font-display)] text-xl font-bold text-primary">BhaiBiz</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSelect />
          <Button asChild variant="ghost"><Link to="/auth">{t("Sign in")}</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-10">
        <p className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
          {t("For Kerala labour suppliers")}
        </p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight text-foreground md:text-5xl">
          {t("Who worked today, what's due, who still owes.")}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          {t("Mark attendance, and BhaiBiz works out each worker's daily commission and tracks every rupee collected.")}
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/auth">{t("Start free")}</Link></Button>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: CalendarCheck, t: "Daily attendance", d: "Worked, not worked or pending — for every worker." },
            { icon: Wallet, t: "Commission & collection", d: "Due amounts carry over automatically. Receipts for every payment." },
            { icon: Users, t: "Your team", d: "Owner, manager, operator and accountant roles." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{t(f.t)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(f.d)}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
