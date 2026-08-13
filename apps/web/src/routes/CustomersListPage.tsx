import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Customer } from "@fieldflow/shared-types";
import { apiFetch } from "../lib/api";

export function CustomersListPage() {
  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiFetch<Customer[]>("/customers"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Customers</h2>
        <Link
          to="/customers/new"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          New Customer
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {customersQuery.isLoading && (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        )}
        {customersQuery.data?.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No customers yet — create your first one to get started.
          </p>
        )}
        <ul className="divide-y divide-border">
          {customersQuery.data?.map((customer) => (
            <li key={customer.id}>
              <Link
                to={`/customers/${customer.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-accent"
              >
                <span className="font-medium text-foreground">{customer.name}</span>
                <span className="text-sm text-muted-foreground">
                  {customer.phone ?? customer.email ?? ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
