import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCustomerNoteRequest,
  CreateEquipmentRequest,
  CreateServiceAddressRequest,
  CustomerDetail,
} from "@fieldflow/shared-types";
import { apiFetch } from "../lib/api";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const customerQuery = useQuery({
    queryKey: ["customer", id],
    queryFn: () => apiFetch<CustomerDetail>(`/customers/${id}`),
    enabled: Boolean(id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["customer", id] });
  }

  const [addressLabel, setAddressLabel] = useState("");
  const [addressText, setAddressText] = useState("");
  const addAddressMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/customers/${id}/addresses`, {
        method: "POST",
        body: JSON.stringify({
          label: addressLabel || undefined,
          address: addressText,
        } satisfies CreateServiceAddressRequest),
      }),
    onSuccess: () => {
      invalidate();
      setAddressLabel("");
      setAddressText("");
    },
  });

  const [equipmentServiceAddressId, setEquipmentServiceAddressId] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [equipmentMake, setEquipmentMake] = useState("");
  const [equipmentModel, setEquipmentModel] = useState("");
  const addEquipmentMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/customers/${id}/equipment`, {
        method: "POST",
        body: JSON.stringify({
          serviceAddressId: equipmentServiceAddressId,
          type: equipmentType,
          make: equipmentMake || undefined,
          model: equipmentModel || undefined,
        } satisfies CreateEquipmentRequest),
      }),
    onSuccess: () => {
      invalidate();
      setEquipmentType("");
      setEquipmentMake("");
      setEquipmentModel("");
    },
  });

  const [noteBody, setNoteBody] = useState("");
  const addNoteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/customers/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: noteBody } satisfies CreateCustomerNoteRequest),
      }),
    onSuccess: () => {
      invalidate();
      setNoteBody("");
    },
  });

  if (customerQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (customerQuery.isError || !customerQuery.data) {
    return <p className="text-sm text-destructive">Customer not found.</p>;
  }

  const customer = customerQuery.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{customer.name}</h2>
        <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
          {customer.phone && <div>Phone: {customer.phone}</div>}
          {customer.email && <div>Email: {customer.email}</div>}
          {customer.billingAddress && <div>Billing address: {customer.billingAddress}</div>}
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Service Addresses</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {customer.serviceAddresses.map((addr) => (
            <li key={addr.id} className="text-foreground">
              {addr.label ? `${addr.label}: ` : ""}
              {addr.address}
            </li>
          ))}
          {customer.serviceAddresses.length === 0 && (
            <li className="text-muted-foreground">No service addresses yet.</li>
          )}
        </ul>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            addAddressMutation.mutate();
          }}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <div>
            <label htmlFor="addressLabel" className="block text-xs font-medium text-foreground">
              Label
            </label>
            <input
              id="addressLabel"
              value={addressLabel}
              onChange={(event) => setAddressLabel(event.target.value)}
              className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="addressText" className="block text-xs font-medium text-foreground">
              Address
            </label>
            <input
              id="addressText"
              required
              value={addressText}
              onChange={(event) => setAddressText(event.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={addAddressMutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Add address
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Equipment</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {customer.equipment.map((eq) => (
            <li key={eq.id} className="text-foreground">
              {eq.type}
              {eq.make || eq.model ? ` — ${[eq.make, eq.model].filter(Boolean).join(" ")}` : ""}
            </li>
          ))}
          {customer.equipment.length === 0 && (
            <li className="text-muted-foreground">No equipment on file yet.</li>
          )}
        </ul>
        {customer.serviceAddresses.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Add a service address before adding equipment.
          </p>
        ) : (
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              addEquipmentMutation.mutate();
            }}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <div>
              <label htmlFor="equipmentAddress" className="block text-xs font-medium text-foreground">
                Address
              </label>
              <select
                id="equipmentAddress"
                required
                value={equipmentServiceAddressId}
                onChange={(event) => setEquipmentServiceAddressId(event.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
              >
                <option value="" disabled>
                  Select…
                </option>
                {customer.serviceAddresses.map((addr) => (
                  <option key={addr.id} value={addr.id}>
                    {addr.label ?? addr.address}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="equipmentType" className="block text-xs font-medium text-foreground">
                Type
              </label>
              <input
                id="equipmentType"
                required
                placeholder="Furnace"
                value={equipmentType}
                onChange={(event) => setEquipmentType(event.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
              />
            </div>
            <div>
              <label htmlFor="equipmentMake" className="block text-xs font-medium text-foreground">
                Make
              </label>
              <input
                id="equipmentMake"
                value={equipmentMake}
                onChange={(event) => setEquipmentMake(event.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
              />
            </div>
            <div>
              <label htmlFor="equipmentModel" className="block text-xs font-medium text-foreground">
                Model
              </label>
              <input
                id="equipmentModel"
                value={equipmentModel}
                onChange={(event) => setEquipmentModel(event.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={addEquipmentMutation.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Add equipment
            </button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Notes</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {customer.notes.map((note) => (
            <li key={note.id} className="text-foreground">
              <span className="text-muted-foreground">
                {new Date(note.createdAt).toLocaleString()} —{" "}
              </span>
              {note.body}
            </li>
          ))}
          {customer.notes.length === 0 && <li className="text-muted-foreground">No notes yet.</li>}
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
        <h3 className="font-semibold text-foreground">Service History</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Job history will appear here once scheduling launches (Phase 3).
        </p>
      </section>
    </div>
  );
}
