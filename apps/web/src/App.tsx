import type { Organization } from "@fieldflow/shared-types";

// Placeholder until Phase 1 wires up real auth/org data — this import exists
// to prove the shared-types compile-time link works end to end (Phase 0
// acceptance criteria), not to model real UI state yet.
const placeholderOrg: Pick<Organization, "displayName" | "name"> = {
  displayName: null,
  name: "FieldFlow",
};

export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          {placeholderOrg.displayName ?? placeholderOrg.name}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Phase 0 scaffold — office dashboard boots here.
        </p>
      </div>
    </div>
  );
}
