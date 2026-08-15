import { useCallback, useEffect, useState } from "react";
import { Redirect, Stack, useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { JobListItem } from "@fieldflow/shared-types";
import { useAuth } from "../src/lib/auth-context";
import { useSync } from "../src/lib/sync-context";
import * as repo from "../src/db/repo";

function todayRange(): { from: string; to: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

const JOB_TYPE_LABEL: Record<JobListItem["type"], string> = {
  scheduled_service: "Scheduled Service",
  routine_maintenance: "Routine Maintenance",
  new_install: "New Install",
  repair: "Repair",
};

function SyncBanner() {
  const { status, pendingCount } = useSync();
  if (status === "syncing") {
    return (
      <View style={[styles.banner, styles.bannerSyncing]}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.bannerText}>Syncing…</Text>
      </View>
    );
  }
  if (status === "offline") {
    return (
      <View style={[styles.banner, styles.bannerOffline]}>
        <Text style={styles.bannerText}>
          Offline — {pendingCount} change{pendingCount === 1 ? "" : "s"} pending
        </Text>
      </View>
    );
  }
  if (pendingCount > 0) {
    return (
      <View style={[styles.banner, styles.bannerPending]}>
        <Text style={styles.bannerText}>
          {pendingCount} change{pendingCount === 1 ? "" : "s"} pending sync
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.banner, styles.bannerSynced]}>
      <Text style={styles.bannerText}>Synced</Text>
    </View>
  );
}

export default function MyDayScreen() {
  const { session, loading: authLoading, signOut } = useAuth();
  const { triggerSync } = useSync();
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadFromCache = useCallback(async () => {
    const { from, to } = todayRange();
    const list = await repo.getJobsForRange(from, to);
    setJobs(list);
  }, []);

  useEffect(() => {
    if (session) loadFromCache();
  }, [session, loadFromCache]);

  useFocusEffect(
    useCallback(() => {
      if (session) loadFromCache();
    }, [session, loadFromCache]),
  );

  if (!authLoading && !session) {
    return <Redirect href="/login" />;
  }

  async function onRefresh() {
    setRefreshing(true);
    await triggerSync();
    await loadFromCache();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={signOut} hitSlop={8}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          ),
        }}
      />
      <SyncBanner />
      {jobs === null && (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      )}
      {jobs !== null && jobs.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No jobs scheduled for today.</Text>
        </View>
      )}
      {jobs !== null && jobs.length > 0 && (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/job/${item.id}`)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTime}>
                  {item.scheduledStart
                    ? new Date(item.scheduledStart).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Unscheduled"}
                </Text>
                <Text style={styles.cardStatus}>{item.status.replace("_", " ")}</Text>
              </View>
              <Text style={styles.cardType}>{JOB_TYPE_LABEL[item.type]}</Text>
              {item.priority !== "normal" && (
                <Text style={styles.cardPriority}>{item.priority.toUpperCase()} priority</Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardStatus: {
    fontSize: 13,
    color: "#6b7280",
    textTransform: "capitalize",
  },
  cardType: {
    fontSize: 15,
  },
  cardPriority: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#dc2626",
  },
  emptyText: {
    color: "#6b7280",
  },
  signOut: {
    color: "#2563eb",
    fontSize: 15,
  },
  banner: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  bannerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  bannerSyncing: {
    backgroundColor: "#2563eb",
  },
  bannerOffline: {
    backgroundColor: "#dc2626",
  },
  bannerPending: {
    backgroundColor: "#d97706",
  },
  bannerSynced: {
    backgroundColor: "#16a34a",
  },
});
