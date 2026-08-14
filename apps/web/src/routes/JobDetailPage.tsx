import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateJobNoteRequest, JobDetail, JobStatus, UpdateJobRequest, User } from "@fieldflow/shared-types";
import { apiFetch } from "../lib/api";

const STATUS_LABEL: Record<JobStatus, string> = {
  unscheduled: "Unscheduled",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  invoiced: "Invoiced",
  canceled: "Canceled",
};

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const jobQuery = useQuery({
    queryKey: ["job", id],
    queryFn: () => apiFetch<JobDetail>(`/jobs/${id}`),
    enabled: Boolean(id),
  });

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => apiFetch<User[]>("/users") });
  const technicians = (usersQuery.data ?? []).filter((u) => u.role === "technician");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["job", id] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  }

  const patchMutation = useMutation({
    mutationFn: (patch: UpdateJobRequest) =>
      apiFetch(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });

  const [technicianId, setTechnicianId] = useState("");
  const reassignMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ technicianIds: technicianId ? [technicianId] : [] } satisfies UpdateJobRequest),
      }),
    onSuccess: () => {
      invalidate();
      setTechnicianId("");
    },
  });

  const [noteBody, setNoteBody] = useState("");
  const addNoteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/jobs/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: noteBody } satisfies CreateJobNoteRequest),
      }),
    onSuccess: () => {
      invalidate();
      setNoteBody("");
    },
  });

  const addPhotoMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch(`/jobs/${id}/photos`, { method: "POST", body: formData });
    },
    onSuccess: invalidate,
  });

  if (jobQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (jobQuery.isError || !jobQuery.data) {
    return <p className="text-sm text-destructive">Job not found.</p>;
  }

  const job = jobQuery.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {job.type.replace(/_/g, " ")} —{" "}
            <Link to={`/customers/${job.customer.id}`} className="underline hover:no-underline">
              {job.customer.name}
            </Link>
          </h2>
          <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
            {STATUS_LABEL[job.status]}
          </span>
        </div>
        <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div>Address: {job.serviceAddress.address}</div>
          {job.equipment && <div>Equipment: {job.equipment.type}</div>}
          <div>Priority: {job.priority}</div>
          {job.description && <div>Description: {job.description}</div>}
          {job.scheduledStart && <div>Scheduled: {new Date(job.scheduledStart).toLocaleString()}</div>}
          <div>
            Assigned:{" "}
            {job.assignedTechnicians.length > 0
              ? job.assignedTechnicians.map((t) => t.fullName).join(", ")
              : "Unassigned"}
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {job.status === "unscheduled" && (
            <button
              type="button"
              onClick={() => patchMutation.mutate({ status: "scheduled" })}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Mark Scheduled
            </button>
          )}
          {job.status === "scheduled" && (
            <button
              type="button"
              onClick={() =>
                patchMutation.mutate({ status: "in_progress", actualStart: new Date().toISOString() })
              }
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Start Job
            </button>
          )}
          {job.status === "in_progress" && (
            <button
              type="button"
              onClick={() =>
                patchMutation.mutate({ status: "completed", actualEnd: new Date().toISOString() })
              }
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Complete Job
            </button>
          )}
          {(job.status === "unscheduled" || job.status === "scheduled" || job.status === "in_progress") && (
            <button
              type="button"
              onClick={() => patchMutation.mutate({ status: "canceled" })}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel Job
            </button>
          )}
        </div>

        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            reassignMutation.mutate();
          }}
          className="mt-4 flex items-end gap-2"
        >
          <div>
            <label htmlFor="technician" className="block text-xs font-medium text-foreground">
              Reassign technician
            </label>
            <select
              id="technician"
              value={technicianId}
              onChange={(event) => setTechnicianId(event.target.value)}
              className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
            >
              <option value="">Unassigned</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.fullName}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={reassignMutation.isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Update assignment
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Notes</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {job.notes.map((note) => (
            <li key={note.id} className="text-foreground">
              <span className="text-muted-foreground">{new Date(note.createdAt).toLocaleString()} — </span>
              {note.body}
            </li>
          ))}
          {job.notes.length === 0 && <li className="text-muted-foreground">No notes yet.</li>}
        </ul>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            addNoteMutation.mutate();
          }}
          className="mt-4 flex items-end gap-2"
        >
          <div className="flex-1">
            <label htmlFor="noteBody" className="block text-xs font-medium text-foreground">
              Add a note
            </label>
            <input
              id="noteBody"
              required
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={addNoteMutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Add note
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Photos</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {job.photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.storagePath}
              alt=""
              className="h-20 w-20 rounded object-cover"
            />
          ))}
          {job.photos.length === 0 && <p className="text-sm text-muted-foreground">No photos yet.</p>}
        </div>
        <label className="mt-4 block text-sm">
          <span className="block font-medium text-foreground">Upload a photo</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) addPhotoMutation.mutate(file);
            }}
            className="mt-1 block text-sm"
          />
        </label>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Signatures</h3>
        <div className="mt-2 flex flex-wrap gap-4">
          {job.signatures.map((signature) => (
            <div key={signature.id} className="text-center">
              <img
                src={signature.storagePath}
                alt={`Signature of ${signature.signedByName}`}
                className="h-16 w-32 rounded border border-border object-contain bg-white"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {signature.signedByName} — {new Date(signature.signedAt).toLocaleString()}
              </p>
            </div>
          ))}
          {job.signatures.length === 0 && <p className="text-sm text-muted-foreground">No signatures yet.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Clock in / out</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {job.timeEntries.map((entry) => (
            <li key={entry.id} className="text-foreground">
              {new Date(entry.clockInAt).toLocaleString()} —{" "}
              {entry.clockOutAt ? new Date(entry.clockOutAt).toLocaleString() : "still clocked in"}
            </li>
          ))}
          {job.timeEntries.length === 0 && <li className="text-muted-foreground">No time entries yet.</li>}
        </ul>
      </section>
    </div>
  );
}
