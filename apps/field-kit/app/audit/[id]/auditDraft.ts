import type { AuditPhotoInput } from "@wikitraveler/i18n";

export interface AuditDraft {
  version: 2;
  step: number;
  propertyValues: Record<string, string>;
  selectedRoomTypes: string[];
  roomValues: Record<string, string>;
  roomDescriptions: Record<string, string>;
  confirmedKeys: string[];
  editingKeys: string[];
  elevatorNa: boolean;
  propertyPhotos: AuditPhotoInput[];
  roomPhotos: Record<string, AuditPhotoInput[]>;
  updatedAt: string;
}

interface LegacyAuditDraft {
  version: 1;
  step: number;
  propertyValues: Record<string, string>;
  selectedRoomTypes: string[];
  roomValues: Record<string, string>;
  roomDescriptions: Record<string, string>;
  confirmedKeys: string[];
  editingKeys: string[];
  elevatorNa: boolean;
  photos?: AuditPhotoInput[];
}

export function draftStorageKey(propertyId: string): string {
  return `wt_audit_draft_v2_${propertyId}`;
}

export function loadAuditDraft(propertyId: string): AuditDraft | null {
  try {
    const raw =
      sessionStorage.getItem(draftStorageKey(propertyId)) ??
      sessionStorage.getItem(`wt_audit_draft_v1_${propertyId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuditDraft | LegacyAuditDraft;
    if (parsed.version === 2) return parsed;
    if (parsed.version === 1) {
      return {
        version: 2,
        step: parsed.step,
        propertyValues: parsed.propertyValues,
        selectedRoomTypes: parsed.selectedRoomTypes,
        roomValues: parsed.roomValues,
        roomDescriptions: parsed.roomDescriptions,
        confirmedKeys: parsed.confirmedKeys,
        editingKeys: parsed.editingKeys,
        elevatorNa: parsed.elevatorNa,
        propertyPhotos: parsed.photos ?? [],
        roomPhotos: {},
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAuditDraft(propertyId: string, draft: AuditDraft): void {
  try {
    sessionStorage.setItem(
      draftStorageKey(propertyId),
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() })
    );
  } catch {
    /* quota */
  }
}

export function clearAuditDraft(propertyId: string): void {
  sessionStorage.removeItem(draftStorageKey(propertyId));
  sessionStorage.removeItem(`wt_audit_draft_v1_${propertyId}`);
}

export function factRowKey(fieldName: string, scopeKey = "property"): string {
  return `${scopeKey}::${fieldName}`;
}

export function parseFactRowKey(key: string): { scopeKey: string; fieldName: string } {
  const sep = key.indexOf("::");
  if (sep < 0) return { scopeKey: "property", fieldName: key };
  return { scopeKey: key.slice(0, sep), fieldName: key.slice(sep + 2) };
}
