import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import NetInfo from "@react-native-community/netinfo";
import type { WhoAmIResponse } from "@fieldflow/shared-types";
import { runSync } from "./sync-engine";
import { apiFetch } from "./api";
import { useAuth } from "./auth-context";
import * as repo from "../db/repo";

type SyncStatus = "idle" | "syncing" | "offline";

interface SyncContextValue {
  status: SyncStatus;
  pendingCount: number;
  lastError: string | null;
  triggerSync: () => Promise<void>;
  /** Call after enqueueing a local mutation so the "N pending" badge updates immediately. */
  refreshPendingCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await repo.countPendingOutbox());
  }, []);

  const triggerSync = useCallback(async () => {
    if (!session || syncingRef.current) return;
    syncingRef.current = true;
    setStatus("syncing");
    setLastError(null);
    try {
      await runSync();
      await refreshPendingCount();
      setStatus("idle");
    } catch (err) {
      // Most common cause is simply being offline — that's expected, not an
      // error state; the outbox just stays queued for the next reconnect.
      await refreshPendingCount();
      setStatus(isOnline ? "idle" : "offline");
      setLastError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      syncingRef.current = false;
    }
  }, [session, isOnline, refreshPendingCount]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      setIsOnline(online);
      if (online) triggerSync();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session) return;
    apiFetch<WhoAmIResponse>("/auth/whoami")
      .then((who) => repo.setCachedCurrentUser({ id: who.user.id, fullName: who.user.fullName }))
      .catch(() => {});
    triggerSync();
    refreshPendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <SyncContext.Provider value={{ status, pendingCount, lastError, triggerSync, refreshPendingCount }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
