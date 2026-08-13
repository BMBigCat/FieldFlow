import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Customer,
  CustomerDetail,
  CreateJobRequest,
  Job,
  JobPriority,
  JobType,
  User,
} from "@fieldflow/shared-types";
import { apiFetch } from "../lib/api";

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: "scheduled_service", label: "Scheduled Service" },
  { value: "routine_maintenance", label: "Routine Maintenance" },
  { value: "new_install", label: "New Install" },
  { value: "repair", label: "Repair" },
];

const JOB_PRIORITIES: JobPriority[] = ["low", "normal", "high", "urgent"];

export function NewJobPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiFetch<Customer[]>("/customers"),
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/users"),
  });
  const technicians = (usersQuery.data ?? []).filter((u) => u.role === "technician");

  const [customerId, setCustomerId] = useState("");
  const customerDetailQuery = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => apiFetch<CustomerDetail>(`/customers/${customerId}`),
    enabled: Boolean(customerId),
  });

  const [serviceAddressId, setServiceAddressId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [type, setType] = useState<JobType>("repair");
  const [priority, setPriority] = useState<JobPriority>("normal");
  const [description, setDescription] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [technicianId, setTechnicianId] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<Job>("/jobs", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          serviceAddressId,
          equipmentId: equipmentId || undefined,
          type,
          priority,
          description: description || undefined,
          scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : undefined,
          technicianIds: technicianId ? [technicianId] : undefined,
        } satisfies CreateJobRequest),
      }),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      navigate(`/jobs/${job.id}`);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-lg font-semibold text-foreground">New Job</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-lg border border-border bg-card p-6">
        <div>
          <label htmlFor="customer" className="block text-sm font-medium text-foreground">
            Customer
          </label>
          <select
            id="customer"
            required
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value);
              setServiceAddressId("");
              setEquipmentId("");
            }}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="" disabled>
              Select…
            </option>
            {customersQuery.data?.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="serviceAddress" className="block text-sm font-medium text-foreground">
            Service address
          </label>
          <select
            id="serviceAddress"
            required
            disabled={!customerId}
            value={serviceAddressId}
            onChange={(event) => setServiceAddressId(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
          >
            <option value="" disabled>
              {customerId ? "Select…" : "Select a customer first"}
            </option>
            {customerDetailQuery.data?.serviceAddresses.map((addr) => (
              <option key={addr.id} value={addr.id}>
                {addr.label ?? addr.address}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="equipment" className="block text-sm font-medium text-foreground">
            Equipment (optional)
          </label>
          <select
            id="equipment"
            disabled={!customerId}
            value={equipmentId}
            onChange={(event) => setEquipmentId(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
          >
            <option value="">None</option>
            {customerDetailQuery.data?.equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.type}
                {eq.make ? ` — ${eq.make}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-foreground">
              Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(event) => setType(event.target.value as JobType)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {JOB_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-foreground">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as JobPriority)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {JOB_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="scheduledStart" className="block text-sm font-medium text-foreground">
              Scheduled (optional)
            </label>
            <input
              id="scheduledStart"
              type="datetime-local"
              value={scheduledStart}
              onChange={(event) => setScheduledStart(event.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="technician" className="block text-sm font-medium text-foreground">
              Assign technician (optional)
            </label>
            <select
              id="technician"
              value={technicianId}
              onChange={(event) => setTechnicianId(event.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Unassigned</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {createMutation.isError && (
          <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
        )}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating…" : "Create job"}
        </button>
      </form>
    </div>
  );
}
