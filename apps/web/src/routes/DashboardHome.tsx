import { useOutletContext } from "react-router-dom";
import type { WhoAmIResponse } from "@fieldflow/shared-types";

export function DashboardHome() {
  const { whoami } = useOutletContext<{ whoami?: WhoAmIResponse }>();

  return (
    <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">
        Welcome{whoami ? `, ${whoami.user.fullName}` : ""}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Phase 1 scaffold — customer/job management arrives in later phases.
      </p>
    </div>
  );
}
