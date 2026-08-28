import { describe, expect, it } from "vitest";
import {
  extractAuditNotes,
  mergeAuditPhotosBySlot,
  photoSlotKey,
  type EvidenceSubmission,
} from "./auditEvidence";

function photo(
  id: string,
  opts: { scopeKey?: string | null; fieldName?: string | null } = {}
) {
  return {
    id,
    url: `https://photos.example/${id}.jpg`,
    caption: null,
    fieldName: opts.fieldName ?? null,
    scopeKey: opts.scopeKey ?? null,
    width: null,
    height: null,
  };
}

function sub(
  id: string,
  createdAt: string,
  photos: EvidenceSubmission["photos"],
  facts: unknown = [],
  auditorToken: string | null = "alice@node"
): EvidenceSubmission {
  return { id, createdAt, auditorToken, facts, photos };
}

describe("photoSlotKey", () => {
  it("prefers scopeKey, then fieldName, else unscoped", () => {
    expect(photoSlotKey({ scopeKey: "step:entrance", fieldName: "x" })).toBe("step:entrance");
    expect(photoSlotKey({ scopeKey: null, fieldName: "door_width_cm" })).toBe("field:door_width_cm");
    expect(photoSlotKey({ scopeKey: null, fieldName: null })).toBe("unscoped");
  });
});

describe("mergeAuditPhotosBySlot", () => {
  it("keeps entrance from audit 1 when audit 2 only photographed the bathroom", () => {
    const older = sub("a1", "2026-01-01T10:00:00.000Z", [
      photo("front", { scopeKey: "step:entrance" }),
    ]);
    const newer = sub("a2", "2026-02-01T10:00:00.000Z", [
      photo("bath", { scopeKey: "step:bathroom" }),
    ]);

    const merged = mergeAuditPhotosBySlot([older, newer]);
    const liveIds = merged.live.map((p) => p.id).sort();
    expect(liveIds).toEqual(["bath", "front"]);
    expect(merged.history).toEqual([]);
    expect(merged.newestSubmissionId).toBe("a2");
  });

  it("overwrites a slot only when the later audit attached photos there", () => {
    const older = sub("a1", "2026-01-01T10:00:00.000Z", [
      photo("front-old", { scopeKey: "step:entrance" }),
      photo("bath-old", { scopeKey: "step:bathroom" }),
    ]);
    const newer = sub("a2", "2026-02-01T10:00:00.000Z", [
      photo("front-new", { scopeKey: "step:entrance" }),
    ]);

    const merged = mergeAuditPhotosBySlot([older, newer]);
    expect(merged.live.map((p) => p.id).sort()).toEqual(["bath-old", "front-new"]);
    expect(merged.history).toHaveLength(1);
    expect(merged.history[0]?.photos.map((p) => p.id)).toEqual(["front-old"]);
  });

  it("treats an empty later audit as no overwrite", () => {
    const older = sub("a1", "2026-01-01T10:00:00.000Z", [
      photo("front", { scopeKey: "step:entrance" }),
    ]);
    const newer = sub("a2", "2026-02-01T10:00:00.000Z", []);

    const merged = mergeAuditPhotosBySlot([older, newer]);
    expect(merged.live.map((p) => p.id)).toEqual(["front"]);
    expect(merged.history).toEqual([]);
  });
});

describe("extractAuditNotes", () => {
  it("returns one note per visit, newest first, without concatenating", () => {
    const older = sub(
      "a1",
      "2026-01-01T10:00:00.000Z",
      [],
      [{ fieldName: "notes", value: "First visit" }]
    );
    const newer = sub(
      "a2",
      "2026-02-01T10:00:00.000Z",
      [],
      [{ fieldName: "notes", value: "Second visit" }]
    );

    expect(extractAuditNotes([older, newer]).map((n) => n.text)).toEqual([
      "Second visit",
      "First visit",
    ]);
  });

  it("skips submissions without notes", () => {
    const withNote = sub("a1", "2026-01-01T10:00:00.000Z", [], [
      { fieldName: "step_free_entrance", value: "yes" },
    ]);
    expect(extractAuditNotes([withNote])).toEqual([]);
  });
});
