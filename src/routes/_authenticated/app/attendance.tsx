import { useT } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Circle, LayoutGrid, LayoutList, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { myMembershipsQuery, pickActive } from "@/lib/company";
import { formatDate, formatINR, signedPhotoUrls, todayISO, workersQuery } from "@/lib/workers";
import {
  addDays, attendanceOnQuery, canEditDate, needsReason, nextTileStatus, summarize, type AttendanceStatus, type Mark,
} from "@/lib/attendance";
import { useActiveMembership } from "../app";
import { WorkerAvatar } from "@/components/workers/WorkerFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { reportsQuery } from "@/lib/reports";
import { workerActiveOn } from "@/lib/report-data";
import { invalidateMoney } from "@/lib/money";
import { DateInput } from "@/components/ui/date-input";

export const Route = createFileRoute("/_authenticated/app/attendance")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Attendance — BhaiBiz" },
      { name: "description", content: "Mark who worked each day; commission is added automatically." },
      { property: "og:title", content: "Attendance — BhaiBiz" },
      { property: "og:description", content: "Mark who worked each day; commission is added automatically." },
    ],
  }),
  loader: async ({ context }) => {
    const active = pickActive(await context.queryClient.ensureQueryData(myMembershipsQuery()));
    if (active) await context.queryClient.ensureQueryData(workersQuery(active.company_id));
  },
  component: AttendancePage,
});

const LABEL: Record<Mark, string> = { worked: "Worked", not_worked: "Not worked", pending: "Pending" };
type ViewMode = "list" | "tile";
const VIEW_STORAGE_KEY = "bhaibiz.attendance-view";

function getInitialView(): ViewMode {
  if (typeof window === "undefined") return "tile";
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "tile";
}

function AttendancePage() {
  const t = useT();
  const { active } = useActiveMembership();
  const cid = active.company_id;
  const role = active.role;
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [view, setView] = useState<ViewMode>(getInitialView);
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState<{ workerId: string; name: string; status: AttendanceStatus } | null>(null);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();

  const setViewMode = (mode: ViewMode) => {
    setView(mode);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  };

  const { data: workers } = useSuspenseQuery(workersQuery(cid));
  const att = useQuery(attendanceOnQuery(cid, date));
  const history = useQuery(reportsQuery(cid, today));
  const marks = att.data?.byWorker ?? {};
  const editable = canEditDate(role, date, today);

  const list = useMemo(
    () => workers.filter((w) => w.joining_date <= date && (workerActiveOn(w, date, history.data?.history ?? []) || marks[w.id])),
    [workers, date, marks, history.data],
  );
  const markOf = (id: string): Mark => marks[id] ?? "pending";
  const sum = summarize(list.map((w) => markOf(w.id)));
  const shown = list.filter((w) => {
    const s = q.trim().toLowerCase();
    return !s || w.full_name.toLowerCase().includes(s) || w.worker_code.toLowerCase().includes(s) || w.mobile.includes(s);
  });

  const paths = list.map((w) => w.photo_path).filter((p): p is string => !!p);
  const photos = useQuery({ queryKey: ["photos", paths], queryFn: () => signedPhotoUrls(paths), staleTime: 50 * 60 * 1000 });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["attendance", cid, date] });
    qc.invalidateQueries({ queryKey: ["worker-attendance"] });
    invalidateMoney(qc);
  };

  const mark = useMutation({
    mutationFn: async (v: { workerId: string; status: AttendanceStatus; reason?: string }) => {
      const { error } = await supabase.rpc("mark_attendance", {
        _worker: v.workerId, _date: date, _status: v.status, ...(v.reason ? { _reason: v.reason } : {}),
      });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: async (status: AttendanceStatus) => {
      const ids = list.filter((w) => markOf(w.id) === "pending").map((w) => w.id);
      const { data, error } = await supabase.rpc("mark_attendance_bulk", { _workers: ids, _date: date, _status: status });
      if (error) throw error;
      return data;
    },
    onSuccess: (n, status) => { toast.success(`${n} · ${t(LABEL[status])}`); refresh(); },
    onError: (e: Error) => { toast.error(e.message); refresh(); },
  });

  function tap(workerId: string, name: string, status: AttendanceStatus) {
    const cur = markOf(workerId);
    if (cur === status) return;
    if (needsReason(cur, status, date, today)) { setReason(""); setAsk({ workerId, name, status }); return; }
    mark.mutate({ workerId, status });
  }

  function toggleTile(workerId: string, name: string) {
    if (!editable) return;
    const cur = markOf(workerId);
    const next = nextTileStatus(cur);
    if (needsReason(cur, next, date, today)) {
      setReason("");
      setAsk({ workerId, name, status: next });
      return;
    }
    mark.mutate({ workerId, status: next });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">{t("Attendance")}</h1>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t("Previous day")} onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <DateInput value={date} max={today} onChange={(v) => v && setDate(v)} className="w-52" />
        <Button variant="outline" size="icon" aria-label={t("Next day")} disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {date !== today && <Button variant="ghost" size="sm" onClick={() => setDate(today)}>{t("Today")}</Button>}
      </div>
      {!editable && (
        <p className="mt-2 text-sm text-muted-foreground">
          {role === "accountant" ? t("You can view attendance but not change it.") : `${t("Cannot edit attendance on")} ${formatDate(date)}.`}
        </p>
      )}

      <div className="sticky top-0 z-10 -mx-4 mt-4 grid grid-cols-5 gap-1 border-y bg-background/95 px-4 py-3 text-center backdrop-blur md:mx-0 md:rounded-xl md:border">
        <Stat label="Active" value={sum.total} />
        <Stat label="Worked" value={sum.worked} className="text-primary" />
        <Stat label="Not worked" value={sum.not_worked} className="text-destructive" />
        <Stat label="Pending" value={sum.pending} className="text-accent-foreground" />
        <Stat label="Earned" value={att.data ? formatINR(att.data.earned) : "—"} />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("Search name, ID or mobile")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center justify-end gap-2">
          {editable && sum.pending > 0 && (
            <div className="flex gap-2">
              <Button size="sm" disabled={bulk.isPending} onClick={() => bulk.mutate("worked")}>{t("All pending → Worked")}</Button>
              <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate("not_worked")}>{t("→ Not worked")}</Button>
            </div>
          )}
          <div className="hidden sm:flex items-center rounded-lg border bg-muted p-0.5 shrink-0" role="group" aria-label={t("View layout")}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("List view")}
              aria-pressed={view === "list"}
              className={cn("h-8 w-8 rounded-md p-0", view === "list" && "bg-background text-foreground shadow-sm")}
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("Tile view")}
              aria-pressed={view === "tile"}
              className={cn("h-8 w-8 rounded-md p-0", view === "tile" && "bg-background text-foreground shadow-sm")}
              onClick={() => setViewMode("tile")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {view === "list" ? (
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {shown.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{t("No workers for this date.")}</li>}
          {shown.map((w) => {
            const m = markOf(w.id);
            return (
              <li key={w.id} className="flex items-center gap-3 p-3">
                <WorkerAvatar name={w.full_name} url={w.photo_path ? photos.data?.[w.photo_path] : null} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{w.full_name}</div>
                  <div className="text-xs text-muted-foreground">{w.worker_code} · {t(LABEL[m])}</div>
                </div>
                <div className="flex gap-1">
                  <MarkBtn label="Worked" active={m === "worked"} tone="worked" disabled={!editable || mark.isPending} onClick={() => tap(w.id, w.full_name, "worked")}>
                    <Check className="h-4 w-4" />
                  </MarkBtn>
                  <MarkBtn label="Not worked" active={m === "not_worked"} tone="not" disabled={!editable || mark.isPending} onClick={() => tap(w.id, w.full_name, "not_worked")}>
                    <X className="h-4 w-4" />
                  </MarkBtn>
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", m === "pending" ? "text-accent-foreground" : "text-muted-foreground/30")} aria-label={t("Pending")}>
                    <Circle className="h-3 w-3 fill-current" />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4">
          {shown.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              {t("No workers for this date.")}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 lg:grid-cols-6">
              {shown.map((w) => {
                const m = markOf(w.id);
                const isMutating = mark.isPending && mark.variables?.workerId === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={!editable || isMutating}
                    onClick={() => toggleTile(w.id, w.full_name)}
                    aria-label={`${w.full_name}: ${t(LABEL[m])}`}
                    className={cn(
                      "group relative flex flex-col items-center justify-center rounded-xl border-2 p-2 sm:p-2.5 text-center transition-all select-none min-h-[86px]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "disabled:pointer-events-none disabled:opacity-60",
                      editable && "cursor-pointer active:scale-[0.97]",
                      m === "worked" && "border-primary bg-primary/5 hover:bg-primary/10",
                      m === "not_worked" && "border-destructive bg-destructive/5 hover:bg-destructive/10",
                      m === "pending" && "border-border/80 bg-card hover:border-muted-foreground/30 hover:bg-accent/30",
                    )}
                  >
                    <div className="absolute right-1.5 top-1.5">
                      {m === "worked" && (
                        <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3]" />
                        </span>
                      )}
                      {m === "not_worked" && (
                        <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
                          <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3]" />
                        </span>
                      )}
                      {m === "pending" && (
                        <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/40">
                          <Circle className="h-1.5 w-1.5 sm:h-2 sm:w-2 fill-current" />
                        </span>
                      )}
                    </div>

                    <WorkerAvatar name={w.full_name} url={w.photo_path ? photos.data?.[w.photo_path] : null} size="sm" />

                    <div className="mt-1.5 w-full min-w-0">
                      <div className="truncate text-xs font-semibold text-foreground sm:text-sm" title={w.full_name}>
                        {w.full_name}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground sm:text-xs">
                        {w.worker_code}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!ask} onOpenChange={(o) => !o && setAsk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Change attendance")}: {ask?.name} · {ask ? t(LABEL[ask.status]) : ""} · {formatDate(date)}?</DialogTitle>
          </DialogHeader>
          <Textarea placeholder={t("Reason for the correction")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsk(null)}>{t("Cancel")}</Button>
            <Button
              disabled={!reason.trim() || mark.isPending}
              onClick={() => { if (ask) mark.mutate({ ...ask, reason }, { onSuccess: () => setAsk(null) }); }}
            >
              {t("Save correction")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  const t = useT();
  return (
    <div>
      <div className={cn("text-lg font-bold leading-tight", className)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{t(label)}</div>
    </div>
  );
}

function MarkBtn({ label, active, tone, disabled, onClick, children }: {
  label: string; active: boolean; tone: "worked" | "not"; disabled: boolean; onClick: () => void; children: React.ReactNode;
}) {
  const t = useT();
  return (
    <Button
      variant="outline"
      size="icon"
      type="button"
      aria-label={t(label)}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:opacity-50",
        active && tone === "worked" && "border-primary bg-primary text-primary-foreground",
        active && tone === "not" && "border-destructive bg-destructive text-destructive-foreground",
        !active && "bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </Button>
  );
}
