import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InviteResponse, Organization, UserRole } from "@fieldflow/shared-types";
import { apiFetch } from "../lib/api";

const ROLE_OPTIONS: UserRole[] = ["office", "technician", "admin"];

export function OrganizationSettingsPage() {
  const queryClient = useQueryClient();

  const orgQuery = useQuery({
    queryKey: ["organization"],
    queryFn: () => apiFetch<Organization>("/organizations/me"),
  });

  const [displayName, setDisplayName] = useState("");
  const [brandColor, setBrandColor] = useState("#0f172a");

  useEffect(() => {
    if (orgQuery.data) {
      setDisplayName(orgQuery.data.displayName ?? "");
      setBrandColor(orgQuery.data.brandPrimaryColor ?? "#0f172a");
    }
  }, [orgQuery.data]);

  function invalidateBranding() {
    queryClient.invalidateQueries({ queryKey: ["organization"] });
    queryClient.invalidateQueries({ queryKey: ["whoami"] });
  }

  const updateOrgMutation = useMutation({
    mutationFn: () =>
      apiFetch<Organization>("/organizations/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName, brandPrimaryColor: brandColor }),
      }),
    onSuccess: invalidateBranding,
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<Organization>("/organizations/me/logo", { method: "POST", body: formData });
    },
    onSuccess: invalidateBranding,
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("technician");
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null);

  const inviteMutation = useMutation({
    mutationFn: () =>
      apiFetch<InviteResponse>("/auth/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, fullName: inviteFullName, role: inviteRole }),
      }),
    onSuccess: (data) => {
      setLastInvite(data);
      setInviteEmail("");
      setInviteFullName("");
    },
  });

  function handleBrandingSubmit(event: FormEvent) {
    event.preventDefault();
    updateOrgMutation.mutate();
  }

  function handleInviteSubmit(event: FormEvent) {
    event.preventDefault();
    inviteMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Branding</h2>
        <form onSubmit={handleBrandingSubmit} className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            {orgQuery.data?.logoUrl && (
              <img src={orgQuery.data.logoUrl} alt="" className="h-12 w-12 rounded object-cover" />
            )}
            <label className="text-sm">
              <span className="block font-medium text-foreground">Logo</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) logoMutation.mutate(file);
                }}
                className="mt-1 block text-sm"
              />
            </label>
          </div>
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-foreground">
              Display name
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="brandColor" className="block text-sm font-medium text-foreground">
              Brand color
            </label>
            <input
              id="brandColor"
              type="color"
              value={brandColor}
              onChange={(event) => setBrandColor(event.target.value)}
              className="mt-1 h-9 w-16 rounded border border-input bg-background"
            />
          </div>
          <button
            type="submit"
            disabled={updateOrgMutation.isPending}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {updateOrgMutation.isPending ? "Saving…" : "Save branding"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Invite a teammate</h2>
        <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="inviteFullName" className="block text-sm font-medium text-foreground">
              Full name
            </label>
            <input
              id="inviteFullName"
              required
              value={inviteFullName}
              onChange={(event) => setInviteFullName(event.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="inviteEmail" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="inviteEmail"
              type="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="inviteRole" className="block text-sm font-medium text-foreground">
              Role
            </label>
            <select
              id="inviteRole"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as UserRole)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {inviteMutation.isPending ? "Inviting…" : "Send invite"}
          </button>
          {inviteMutation.isError && (
            <p className="text-sm text-destructive">{(inviteMutation.error as Error).message}</p>
          )}
        </form>
        {lastInvite && (
          <p className="mt-4 break-all rounded-md bg-muted p-3 text-xs text-muted-foreground">
            No email provider is wired up yet (Phase 5) — share this link with {lastInvite.user.fullName} to set
            their password: {lastInvite.actionLink}
          </p>
        )}
      </section>
    </div>
  );
}
