/**
 * Live audit evidence vs visit trail.
 *
 * Photos: the newest submission that actually attached photos for a slot
 * (step / room-type / unscoped) wins that slot. Older photos for the same
 * slot stay in history. Empty slots are not treated as an overwrite.
 *
 * Notes: one text blob per submission that included a `notes` fact.
 */

export type EvidencePhoto = {
  id: string;
  url: string;
  caption: string | null;
  fieldName: string | null;
  scopeKey: string | null;
  width: number | null;
  height: number | null;
};

export type EvidenceSubmission = {
  id: string;
  createdAt: Date | string;
  auditorToken: string | null;
  facts: unknown;
  photos: EvidencePhoto[];
};

export type LiveAuditPhoto = EvidencePhoto & { submissionId: string };

export type AuditPhotoHistoryGroup = {
  submissionId: string;
  capturedAt: string;
  auditorToken: string | null;
  photos: EvidencePhoto[];
};

export type AuditNoteEntry = {
  submissionId: string;
  createdAt: string;
  auditorToken: string | null;
  text: string;
};

export function photoSlotKey(photo: Pick<EvidencePhoto, "fieldName" | "scopeKey">): string {
  const scope = photo.scopeKey?.trim();
  if (scope) return scope;
  const field = photo.fieldName?.trim();
  if (field) return `field:${field}`;
  return "unscoped";
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function notesValueFromFacts(facts: unknown): string | null {
  if (!Array.isArray(facts)) return null;
  for (const row of facts) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { fieldName?: unknown; value?: unknown };
    if (rec.fieldName !== "notes") continue;
    if (typeof rec.value !== "string") continue;
    const text = rec.value.trim();
    if (text) return rec.value.trim();
  }
  return null;
}

export function extractAuditNotes(submissions: EvidenceSubmission[]): AuditNoteEntry[] {
  const newestFirst = [...submissions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const notes: AuditNoteEntry[] = [];
  for (const sub of newestFirst) {
    const text = notesValueFromFacts(sub.facts);
    if (!text) continue;
    notes.push({
      submissionId: sub.id,
      createdAt: iso(sub.createdAt),
      auditorToken: sub.auditorToken,
      text,
    });
  }
  return notes;
}

export function mergeAuditPhotosBySlot(submissions: EvidenceSubmission[]): {
  live: LiveAuditPhoto[];
  history: AuditPhotoHistoryGroup[];
  newestSubmissionId: string | null;
  newestCapturedAt: string | null;
} {
  const newestFirst = [...submissions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const claimed = new Set<string>();
  const live: LiveAuditPhoto[] = [];
  const history: AuditPhotoHistoryGroup[] = [];

  for (const sub of newestFirst) {
    if (sub.photos.length === 0) continue;
    const bySlot = new Map<string, EvidencePhoto[]>();
    for (const photo of sub.photos) {
      const slot = photoSlotKey(photo);
      const list = bySlot.get(slot) ?? [];
      list.push(photo);
      bySlot.set(slot, list);
    }

    const superseded: EvidencePhoto[] = [];
    for (const [slot, photos] of bySlot) {
      if (claimed.has(slot)) {
        superseded.push(...photos);
        continue;
      }
      claimed.add(slot);
      for (const photo of photos) {
        live.push({ ...photo, submissionId: sub.id });
      }
    }

    if (superseded.length > 0) {
      history.push({
        submissionId: sub.id,
        capturedAt: iso(sub.createdAt),
        auditorToken: sub.auditorToken,
        photos: superseded,
      });
    }
  }

  const newestWithPhotos = newestFirst.find((s) => s.photos.length > 0) ?? null;

  return {
    live,
    history,
    newestSubmissionId: newestWithPhotos?.id ?? null,
    newestCapturedAt: newestWithPhotos ? iso(newestWithPhotos.createdAt) : null,
  };
}
