import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Customer, CreateCustomerRequest } from "@fieldflow/shared-types";
import { apiFetch } from "../lib/api";

export function NewCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: phone || undefined,
          email: email || undefined,
          billingAddress: billingAddress || undefined,
        } satisfies CreateCustomerRequest),
      }),
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate(`/customers/${customer.id}`);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-lg font-semibold text-foreground">New Customer</h2>
      <form
        onSubmit={handleSubmit}
        className="mt-4 space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-foreground">
            Phone
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="billingAddress" className="block text-sm font-medium text-foreground">
            Billing address
          </label>
          <input
            id="billingAddress"
            value={billingAddress}
            onChange={(event) => setBillingAddress(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        {createMutation.isError && (
          <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
        )}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating…" : "Create customer"}
        </button>
      </form>
    </div>
  );
}
