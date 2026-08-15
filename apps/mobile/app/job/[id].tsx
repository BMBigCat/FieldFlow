import { useCallback, useEffect, useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { JobDetail, JobNote, JobPhoto, JobSignature, JobTimeEntry, WhoAmIResponse } from "@fieldflow/shared-types";
import { apiFetch } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { useSync } from "../../src/lib/sync-context";
import { SignaturePad } from "../../src/components/SignaturePad";
import * as repo from "../../src/db/repo";
import {
  addNoteOffline,
  addPhotoOffline,
  addSignatureOffline,
  clockInOffline,
  clockOutOffline,
  setJobStatusOffline,
} from "../../src/lib/offline-actions";

async function cacheJobDetailPieces(detail: JobDetail): Promise<void> {
  await repo.upsertJobs([
    {
      id: detail.id,
      orgId: detail.orgId,
      customerId: detail.customerId,
      serviceAddressId: detail.serviceAddressId,
      equipmentId: detail.equipmentId,
      type: detail.type,
      status: detail.status,
      priority: detail.priority,
      description: detail.description,
      scheduledStart: detail.scheduledStart,
      scheduledEnd: detail.scheduledEnd,
      actualStart: detail.actualStart,
      actualEnd: detail.actualEnd,
      createdBy: detail.createdBy,
      createdAt: detail.createdAt,
      localVersion: detail.localVersion,
      updatedAt: detail.updatedAt,
      technicianIds: detail.assignedTechnicians.map((t) => t.id),
    },
  ]);
  await repo.upsertNotes(detail.notes);
  await repo.upsertPhotos(detail.photos);
  await repo.upsertSignatures(detail.signatures);
  await repo.upsertTimeEntries(detail.timeEntries);
}

export default function JobDetailScreen() {
  const { session, loading: authLoading } = useAuth();
  const { refreshPendingCount, triggerSync } = useSync();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const detail = await apiFetch<JobDetail>(`/jobs/${id}`);
      await cacheJobDetailPieces(detail);
      setJob(detail);
    } catch {
      const cachedUser = currentUser ?? (await repo.getCachedCurrentUser());
      if (cachedUser) {
        const cached = await repo.getCachedJobDetail(id, cachedUser);
        if (cached) {
          setJob(cached);
          return;
        }
      }
      setError("This job isn't available offline yet — reconnect once to cache it.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let cached = currentUser;
    (async () => {
      if (!cached) {
        cached = await repo.getCachedCurrentUser();
        if (!cached) {
          const who = await apiFetch<WhoAmIResponse>("/auth/whoami").catch(() => null);
          if (who) {
            cached = { id: who.user.id, fullName: who.user.fullName };
            await repo.setCachedCurrentUser(cached);
          }
        }
        if (cached) setCurrentUser(cached);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  if (!authLoading && !session) {
    return <Redirect href="/login" />;
  }

  async function afterMutation() {
    await refreshPendingCount();
    triggerSync();
  }

  async function handleAddNote() {
    if (!job || !currentUser || !noteText.trim()) return;
    setBusy(true);
    const note = await addNoteOffline(job.id, currentUser.id, noteText.trim());
    setNoteText("");
    setJob((j) => j && { ...j, notes: [...j.notes, note] });
    await afterMutation();
    setBusy(false);
  }

  async function handleAddPhoto() {
    if (!job) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setBusy(true);
    const photo = await addPhotoOffline(job.id, asset.uri, asset.mimeType ?? "image/jpeg");
    setJob((j) => j && { ...j, photos: [...j.photos, photo] });
    await afterMutation();
    setBusy(false);
  }

  async function handleSaveSignature(localUri: string) {
    if (!job || !currentUser) return;
    setShowSignaturePad(false);
    setBusy(true);
    const signature = await addSignatureOffline(job.id, localUri, "image/png", currentUser.fullName);
    setJob((j) => j && { ...j, signatures: [...j.signatures, signature] });
    await afterMutation();
    setBusy(false);
  }

  const openTimeEntry = job?.timeEntries.find((t) => t.technicianId === currentUser?.id && !t.clockOutAt) ?? null;

  async function handleClockIn() {
    if (!job || !currentUser) return;
    setBusy(true);
    const entry = await clockInOffline(job.id, currentUser.id);
    setJob((j) => j && { ...j, timeEntries: [...j.timeEntries, entry] });
    await afterMutation();
    setBusy(false);
  }

  async function handleClockOut() {
    if (!job || !openTimeEntry) return;
    setBusy(true);
    const entry = await clockOutOffline(job.id, openTimeEntry);
    setJob((j) => j && { ...j, timeEntries: j.timeEntries.map((t) => (t.clientGeneratedId === entry.clientGeneratedId ? entry : t)) });
    await afterMutation();
    setBusy(false);
  }

  async function handleMarkComplete() {
    if (!job) return;
    setBusy(true);
    await setJobStatusOffline(job.id, job.localVersion, "completed");
    setJob((j) => j && { ...j, status: "completed" });
    await afterMutation();
    setBusy(false);
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const canComplete = job.status !== "completed" && job.status !== "canceled" && job.status !== "invoiced";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Customer">
        <Text style={styles.value}>{job.customer.name}</Text>
      </Section>

      <Section title="Service Address">
        <Text style={styles.value}>{job.serviceAddress.address}</Text>
      </Section>

      {job.equipment && (
        <Section title="Equipment">
          <Text style={styles.value}>
            {[job.equipment.make, job.equipment.model].filter(Boolean).join(" ") || "Unknown make/model"}{" "}
            ({job.equipment.type})
          </Text>
          {job.equipment.serialNumber && (
            <Text style={styles.subvalue}>Serial: {job.equipment.serialNumber}</Text>
          )}
        </Section>
      )}

      <Section title="Status">
        <Text style={[styles.value, styles.capitalize]}>{job.status.replace("_", " ")}</Text>
        {canComplete && (
          <Pressable style={[styles.primaryButton, styles.sectionButton]} onPress={handleMarkComplete} disabled={busy}>
            <Text style={styles.primaryButtonText}>Mark Complete</Text>
          </Pressable>
        )}
      </Section>

      <Section title="Schedule">
        <Text style={styles.value}>
          {job.scheduledStart ? new Date(job.scheduledStart).toLocaleString() : "Unscheduled"}
          {job.scheduledEnd ? ` – ${new Date(job.scheduledEnd).toLocaleTimeString()}` : ""}
        </Text>
      </Section>

      {job.description && (
        <Section title="Description">
          <Text style={styles.value}>{job.description}</Text>
        </Section>
      )}

      <Section title="Time Tracking">
        {job.timeEntries.length === 0 && <Text style={styles.subvalue}>No clock-ins yet.</Text>}
        {job.timeEntries.map((entry) => (
          <TimeEntryRow key={entry.clientGeneratedId} entry={entry} />
        ))}
        <Pressable
          style={[openTimeEntry ? styles.dangerButton : styles.primaryButton, styles.sectionButton]}
          onPress={openTimeEntry ? handleClockOut : handleClockIn}
          disabled={busy || !currentUser}
        >
          <Text style={openTimeEntry ? styles.dangerButtonText : styles.primaryButtonText}>
            {openTimeEntry ? "Clock Out" : "Clock In"}
          </Text>
        </Pressable>
      </Section>

      <Section title={`Notes (${job.notes.length})`}>
        {job.notes.length === 0 && <Text style={styles.subvalue}>No notes yet.</Text>}
        {job.notes.map((note) => (
          <NoteRow key={note.clientGeneratedId} note={note} />
        ))}
        <View style={styles.noteInputRow}>
          <TextInput
            style={styles.noteInput}
            placeholder="Add a note…"
            value={noteText}
            onChangeText={setNoteText}
            multiline
          />
          <Pressable style={styles.primaryButton} onPress={handleAddNote} disabled={busy || !noteText.trim()}>
            <Text style={styles.primaryButtonText}>Add</Text>
          </Pressable>
        </View>
      </Section>

      <Section title={`Photos (${job.photos.length})`}>
        {job.photos.length === 0 && <Text style={styles.subvalue}>No photos yet.</Text>}
        {job.photos.map((photo) => (
          <PhotoRow key={photo.clientGeneratedId} photo={photo} />
        ))}
        <Pressable style={[styles.primaryButton, styles.sectionButton]} onPress={handleAddPhoto} disabled={busy}>
          <Text style={styles.primaryButtonText}>Add Photo</Text>
        </Pressable>
      </Section>

      <Section title={`Signatures (${job.signatures.length})`}>
        {job.signatures.length === 0 && <Text style={styles.subvalue}>None captured yet.</Text>}
        {job.signatures.map((sig) => (
          <SignatureRow key={sig.clientGeneratedId} signature={sig} />
        ))}
        {showSignaturePad ? (
          <SignaturePad onCapture={handleSaveSignature} onCancel={() => setShowSignaturePad(false)} />
        ) : (
          <Pressable
            style={[styles.primaryButton, styles.sectionButton]}
            onPress={() => setShowSignaturePad(true)}
            disabled={busy}
          >
            <Text style={styles.primaryButtonText}>Capture Signature</Text>
          </Pressable>
        )}
      </Section>
    </ScrollView>
  );
}

function TimeEntryRow({ entry }: { entry: JobTimeEntry }) {
  return (
    <Text style={styles.subvalue}>
      {new Date(entry.clockInAt).toLocaleTimeString()} –{" "}
      {entry.clockOutAt ? new Date(entry.clockOutAt).toLocaleTimeString() : "in progress"}
    </Text>
  );
}

function NoteRow({ note }: { note: JobNote }) {
  return (
    <View style={styles.listItem}>
      <Text style={styles.value}>{note.body}</Text>
      <Text style={styles.subvalue}>{new Date(note.createdAt).toLocaleString()}</Text>
    </View>
  );
}

function PhotoRow({ photo }: { photo: JobPhoto & { localUri?: string | null } }) {
  return <Text style={styles.subvalue}>{photo.caption || photo.storagePath || "Photo pending sync"}</Text>;
}

function SignatureRow({ signature }: { signature: JobSignature }) {
  return (
    <Text style={styles.subvalue}>
      {signature.signedByName} — {new Date(signature.signedAt).toLocaleString()}
    </Text>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
  },
  capitalize: {
    textTransform: "capitalize",
  },
  subvalue: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  listItem: {
    marginBottom: 8,
  },
  error: {
    color: "#dc2626",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  sectionButton: {
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  noteInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    alignItems: "flex-end",
  },
  noteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 40,
  },
});
