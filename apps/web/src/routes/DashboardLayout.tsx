import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { WhoAmIResponse } from "@fieldflow/shared-types";
import { ThemeToggle } from "../components/ThemeToggle";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export function DashboardLayout() {
  const { session, loading, signOut } = useAuth();
  const location = useLocation();

  const whoami = useQuery({
    queryKey: ["whoami"],
    queryFn: () => apiFetch<WhoAmIResponse>("/auth/whoami"),
    enabled: Boolean(session),
  });

  if (!loading && !session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (loading || whoami.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  const org = whoami.data?.organization;
  const user = whoami.data?.user;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          {org?.logoUrl && <img src={org.logoUrl} alt="" className="h-8 w-8 rounded object-cover" />}
          <span className="text-lg font-semibold text-foreground">
            {org?.displayName ?? org?.name ?? "FieldFlow"}
          </span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {user?.role === "admin" && (
            <Link to="/settings/organization" className="text-muted-foreground hover:text-foreground">
              Organization Settings
            </Link>
          )}
          <span className="text-muted-foreground">
            {user?.fullName} · {user?.role}
          </span>
          <button onClick={() => void signOut()} className="text-muted-foreground hover:text-foreground">
            Sign out
          </button>
          <ThemeToggle />
        </nav>
      </header>
      <main className="p-6">
        <Outlet context={{ whoami: whoami.data }} />
      </main>
    </div>
  );
}
