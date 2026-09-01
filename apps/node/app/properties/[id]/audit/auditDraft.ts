import type { AuditPhotoInput } from "@wikitraveler/i18n";
import { factRowKey, parseFactRowKey } from "@wikitraveler/audit";

export type { AuditPhotoInput };
export { factRowKey, parseFactRowKey };

export interface AuditDraft {
  version: 2;
  step: number;
  propertyValues: Record<string, string>;
  selectedRoomTypes: string[];
  knownCustomRoomTypes?: string[];
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
  return `wt_node_audit_draft_v2_${propertyId}`;
}

export function loadAuditDraft(propertyId: string): AuditDraft | null {
  try {
    const raw = sessionStorage.getItem(draftStorageKey(propertyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuditDraft | LegacyAuditDraft;
    if (parsed.version === 2) return parsed;
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
}
