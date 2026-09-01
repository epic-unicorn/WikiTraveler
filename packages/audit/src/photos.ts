import {
  MAX_AUDIT_PHOTOS,
  roomScopeKey,
  type AuditPhotoInput,
} from "@wikitraveler/i18n";

export type AuditPhotoStepScope =
  | "step:entrance"
  | "step:mobility"
  | "step:bathroom"
  | "step:communication"
  | "step:building_access"
  | "step:shared_facilities";

export function stepScopeKey(
  step: "entrance" | "mobility" | "bathroom" | "communication" | "building_access" | "shared_facilities"
): AuditPhotoStepScope {
  if (step === "building_access") return "step:building_access";
  if (step === "shared_facilities") return "step:shared_facilities";
  return `step:${step}` as AuditPhotoStepScope;
}

export function countAuditPhotos(
  propertyPhotos: AuditPhotoInput[],
  roomPhotos: Record<string, AuditPhotoInput[]>
): number {
  return propertyPhotos.length + Object.values(roomPhotos).reduce((n, list) => n + list.length, 0);
}

export function flattenAuditPhotos(
  propertyPhotos: AuditPhotoInput[],
  roomPhotos: Record<string, AuditPhotoInput[]>
): AuditPhotoInput[] {
  const room = Object.entries(roomPhotos).flatMap(([typeId, list]) =>
    list.map((p) => ({
      ...p,
      fieldName: undefined,
      scopeKey: p.scopeKey ?? roomScopeKey(typeId),
    }))
  );
  return [
    ...propertyPhotos.map((p) => ({ ...p, fieldName: undefined })),
    ...room,
  ].slice(0, MAX_AUDIT_PHOTOS);
}
