import { useT } from "@/lib/i18n";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import {
  agreementsQuery, canManageWorkers, formatINR, rateOn, signedPhotoUrls, todayISO, workersQuery,
} from "@/lib/workers";
import { useActiveMembership } from "../../app";
import { StatusBadge, WorkerAvatar } from "@/components/workers/WorkerFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/workers/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Workers — BhaiBiz" },
      { name: "description", content: "All registered workers with their daily rate and status." },
      { property: "og:title", content: "Workers — BhaiBiz" },
      { property: "og:description", content: "All registered workers with their daily rate and status." },
    ],
  }),
  loader: async ({ context }) => {
    const active = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (!active) return;
    if (active.role === "operator") throw redirect({ to: "/app" });
    await Promise.all([
      context.queryClient.ensureQueryData(workersQuery(active.company_id)),
      context.queryClient.ensureQueryData(agreementsQuery(active.company_id)),
    ]);
  },
  component: WorkersPage,
});

type Filter = "active" | "inactive" | "all";

function WorkersPage() {
  const t = useT();
  const { active } = useActiveMembership();
  const cid = active.company_id;
  const { data: workers } = useSuspenseQuery(workersQuery(cid));
  const { data: agreements } = useSuspenseQuery(agreementsQuery(cid));
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const today = todayISO();

  const byWorker = useMemo(() => {
    const m = new Map<string, typeof agreements>();
    for (const a of agreements) m.set(a.worker_id, [...(m.get(a.worker_id) ?? []), a]);
    return m;
  }, [agreements]);

  const counts = {
    active: workers.filter((w) => w.status === "active").length,
    inactive: workers.filter((w) => w.status === "inactive").length,
    all: workers.length,
  };

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return workers.filter((w) => {
      if (filter !== "all" && w.status !== filter) return false;
      if (!s) return true;
      return (
        w.full_name.toLowerCase().includes(s) ||
        w.worker_code.toLowerCase().includes(s) ||
        w.mobile.includes(s.replace(/\s/g, "")) ||
        w.aadhaar_last4 === s
      );
    });
  }, [workers, q, filter]);

  const paths = workers.map((w) => w.photo_path).filter((p): p is string => !!p);
  const photos = useQuery({
    queryKey: ["photo-urls", cid, paths.join("|")],
    queryFn: () => signedPhotoUrls(paths),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("Workers")}</h1>
          <p className="text-sm text-muted-foreground">{counts.active} active · {counts.inactive} {t("inactive")}</p>
        </div>
        {canManageWorkers(active.role) && (
          <Button asChild>
            <Link to="/app/workers/new"><Plus className="mr-1 h-4 w-4" /> {t("Add worker")}</Link>
          </Button>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("Search name, ID, mobile or Aadhaar last 4")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex rounded-lg border bg-card p-1 text-sm">
          {(["active", "inactive", "all"] as const).map((f) => (
            <Button
              variant={filter === f ? "default" : "ghost"}
              size="sm"
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1.5 capitalize",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(f)} ({counts[f]})
            </Button>
          ))}
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed bg-muted/40 p-8 text-center">
          <p className="font-medium">{t("No workers yet")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("Add your first worker with their Aadhaar number and daily rate.")}</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">{t("No workers match.")}</p>
      ) : (
        <ul className="mt-4 divide-y overflow-hidden rounded-xl border bg-card">
          {shown.map((w) => {
            const rate = rateOn(byWorker.get(w.id) ?? [], today);
            return (
              <li key={w.id}>
                <Link
                  to="/app/workers/$workerId"
                  params={{ workerId: w.id }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <WorkerAvatar name={w.full_name} url={w.photo_path ? photos.data?.[w.photo_path] : null} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{w.full_name}</span>
                      {w.status === "inactive" && <StatusBadge status="inactive" />}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {w.worker_code} · {w.mobile}{w.category ? ` · ${w.category}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{rate ? formatINR(rate) : "—"}</div>
                    <div className="text-xs text-muted-foreground">{t("per day")}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
