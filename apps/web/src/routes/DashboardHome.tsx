import { useOutletContext } from "react-router-dom";
import type { WhoAmIResponse } from "@fieldflow/shared-types";

export function DashboardHome() {
  const { whoami } = useOutletContext<{ whoami?: WhoAmIResponse }>();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Welcome{whoami ? `, ${whoami.user.fullName}` : ""}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Phase 1 scaffold — customer/job management arrives in later phases.
      </p>
    </div>
  );
}
