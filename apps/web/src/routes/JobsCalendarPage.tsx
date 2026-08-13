import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Customer, JobListItem, UpdateJobRequest, User } from "@fieldflow/shared-types";
import { apiFetch } from "../lib/api";

type ViewMode = "day" | "week";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return addDays(d, diffToMonday);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_LABEL = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

export function JobsCalendarPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));

  const days = useMemo(() => {
    if (viewMode === "day") return [anchorDate];
    const start = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [viewMode, anchorDate]);

  // Fetch a day of padding on each side so local-timezone day boundaries
  // never clip a job that actually belongs in the visible range — the
  // precise bucketing happens client-side via sameDay().
  const rangeFrom = addDays(days[0], -1).toISOString();
  const rangeTo = addDays(days[days.length - 1], 1).toISOString();

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => apiFetch<User[]>("/users") });
  const technicians = (usersQuery.data ?? []).filter((u) => u.role === "technician");

  const customersQuery = useQuery({ queryKey: ["customers"], queryFn: () => apiFetch<Customer[]>("/customers") });
  const customerName = (id: string) => customersQuery.data?.find((c) => c.id === id)?.name ?? "Customer";

  const jobsQuery = useQuery({
    queryKey: ["jobs", "range", rangeFrom, rangeTo],
    queryFn: () => apiFetch<JobListItem[]>(`/jobs?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`),
  });
  const visibleJobs = (jobsQuery.data ?? []).filter(
    (job) => job.scheduledStart && days.some((day) => sameDay(new Date(job.scheduledStart!), day)),
  );

  const unscheduledQuery = useQuery({
    queryKey: ["jobs", "unscheduled"],
    queryFn: () => apiFetch<JobListItem[]>("/jobs?status=unscheduled"),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ jobId, patch }: { jobId: string; patch: UpdateJobRequest }) =>
      apiFetch(`/jobs/${jobId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  function jobsFor(technicianId: string | "unassigned", day: Date): JobListItem[] {
    return visibleJobs.filter((job) => {
      const onDay = job.scheduledStart && sameDay(new Date(job.scheduledStart), day);
      if (!onDay) return false;
      return technicianId === "unassigned" ? job.technicianIds.length === 0 : job.technicianIds.includes(technicianId);
    });
  }

  function handleDrop(job: JobListItem, technicianId: string | "unassigned", day: Date) {
    const previousStart = job.scheduledStart ? new Date(job.scheduledStart) : null;
    const timeOfDayMs = previousStart
      ? previousStart.getHours() * 3600000 + previousStart.getMinutes() * 60000
      : 9 * 3600000; // default 9:00 AM for never-scheduled jobs
    const durationMs =
      previousStart && job.scheduledEnd ? new Date(job.scheduledEnd).getTime() - previousStart.getTime() : 2 * 3600000;

    const newStart = new Date(startOfDay(day).getTime() + timeOfDayMs);
    const newEnd = new Date(newStart.getTime() + durationMs);

    if (technicianId !== "unassigned") {
      const conflict = visibleJobs.some(
        (other) =>
          other.id !== job.id &&
          other.technicianIds.includes(technicianId) &&
          other.scheduledStart &&
          other.scheduledEnd &&
          sameDay(new Date(other.scheduledStart), day) &&
          newStart < new Date(other.scheduledEnd) &&
          newEnd > new Date(other.scheduledStart),
      );
      if (conflict) {
        const proceed = window.confirm(
          "This technician already has a job scheduled that overlaps this time. Assign anyway?",
        );
        if (!proceed) return;
      }
    }

    const patch: UpdateJobRequest = {
      scheduledStart: newStart.toISOString(),
      scheduledEnd: newEnd.toISOString(),
      technicianIds: technicianId === "unassigned" ? [] : [technicianId],
    };
    if (job.status === "unscheduled") patch.status = "scheduled";

    rescheduleMutation.mutate({ jobId: job.id, patch });
  }

  const rows: { key: string; label: string }[] = [
    { key: "unassigned", label: "Unassigned" },
    ...technicians.map((t) => ({ key: t.id, label: t.fullName })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Schedule</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchorDate((d) => addDays(d, viewMode === "week" ? -7 : -1))}
            className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setAnchorDate(startOfDay(new Date()))}
            className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setAnchorDate((d) => addDays(d, viewMode === "week" ? 7 : 1))}
            className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Next →
          </button>
          <div className="ml-2 flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`px-2 py-1 text-sm ${viewMode === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`px-2 py-1 text-sm ${viewMode === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Week
            </button>
          </div>
          <Link
            to="/jobs/new"
            className="ml-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            New Job
          </Link>
        </div>
      </div>

      {(unscheduledQuery.data?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="text-sm font-semibold text-foreground">Unscheduled</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {unscheduledQuery.data!.map((job) => (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", job.id)}
                className="cursor-move rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                title="Drag onto the calendar to schedule"
              >
                {customerName(job.customerId)} — {job.type}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-r border-border bg-card p-2 text-left text-foreground">Technician</th>
              {days.map((day) => (
                <th key={dateKey(day)} className="border-b border-border bg-card p-2 text-left text-foreground">
                  {DAY_LABEL.format(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th className="border-b border-r border-border bg-card p-2 text-left font-medium text-foreground">
                  {row.label}
                </th>
                {days.map((day) => {
                  const cellJobs = row.key === "unassigned" ? jobsFor("unassigned", day) : jobsFor(row.key, day);
                  return (
                    <td
                      key={dateKey(day)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const jobId = e.dataTransfer.getData("text/plain");
                        const job =
                          visibleJobs.find((j) => j.id === jobId) ?? unscheduledQuery.data?.find((j) => j.id === jobId);
                        if (job) handleDrop(job, row.key, day);
                      }}
                      className="min-w-[140px] border-b border-border p-1 align-top"
                    >
                      <div className="flex flex-col gap-1">
                        {cellJobs.map((job) => (
                          <Link
                            key={job.id}
                            to={`/jobs/${job.id}`}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/plain", job.id)}
                            className="cursor-move rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-accent"
                          >
                            <div className="font-medium">{customerName(job.customerId)}</div>
                            <div className="text-muted-foreground">
                              {job.type}
                              {job.scheduledStart &&
                                ` · ${new Date(job.scheduledStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
