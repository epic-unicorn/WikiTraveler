"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AUDIT_WIZARD_STEPS,
  fieldsForStep,
  FIELD_AUDIT_STEP,
  type AuditStepId,
} from "@wikitraveler/core";
import {
  compressPhoto,
  MAX_AUDIT_PHOTOS,
  roomScopeKey,
  getRoomTypeLabel,
  getFieldEnumLabel,
  type AuditPhotoInput,
} from "@wikitraveler/i18n";
import { type ExistingFact } from "./ExistingDataPanel";
import { RoomAuditSection } from "./RoomAuditSection";
import { AuditPhotoGallery } from "../../components/AuditPhotoGallery";
import { PhotoLightbox } from "../../components/PhotoLightbox";
import { stepScopeKey, groupPhotosByStepScope } from "../../lib/propertyFacts";
import { invalidateMapPins } from "../../lib/accessApi";
import { propertyHref } from "../../lib/propertyHref";
import {
  loadAuditDraft,
  saveAuditDraft,
  clearAuditDraft,
  factRowKey,
  parseFactRowKey,
  type AuditDraft,
} from "./auditDraft";

interface FieldDef {
  fieldName: string;
  scope: string;
  valueType: string;
  label: string;
  unit?: string | null;
  enumValues?: string[];
}

interface Props {
  propertyId: string;
  token: string;
  nodeUrl: string;
  targetNodeUrl?: string;
  locale: string;
  fieldDefs: FieldDef[];
  loadedFacts: ExistingFact[];
  onSuccess: () => void;
  onError: (msg: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getTierLabel: (tier: string) => string;
}

type PhotoStepId = "entrance" | "mobility" | "bathroom" | "communication";

const STEP_TITLE_KEY: Record<AuditStepId, string> = {
  entrance: "ui.auditStepEntrance",
  mobility: "ui.auditStepMobility",
  room: "ui.auditStepRoom",
  bathroom: "ui.auditStepBathroom",
  communication: "ui.auditStepCommunication",
  review: "ui.auditStepReview",
};

const BOOL_OPTIONS = [
  { value: "yes", labelKey: "ui.yes", className: "fk-bool-pill--yes" },
  { value: "partial", labelKey: "ui.partial", className: "fk-bool-pill--partial" },
  { value: "no", labelKey: "ui.no", className: "fk-bool-pill--no" },
  { value: "n/a", labelKey: "ui.notApplicable", className: "fk-bool-pill--na" },
] as const;

const PHOTO_STEPS = new Set<AuditStepId>(["entrance", "mobility", "bathroom", "communication"]);

const PATH_TO_ENTRANCE_PILL_CLASS: Record<string, string> = {
  step_free: "fk-bool-pill--yes",
  uneven: "fk-bool-pill--partial",
  steep: "fk-bool-pill--no",
};

function normalizeFieldValue(fieldName: string, value: string): string {
  const trimmed = value.trim();
  if (fieldName === "path_to_entrance" && trimmed.includes(",")) {
    return trimmed.split(",")[0]?.trim() ?? trimmed;
  }
  return trimmed;
}

function formValuesFromFacts(facts: ExistingFact[]) {
  const propVals: Record<string, string> = {};
  const rooms: string[] = [];
  const rVals: Record<string, string> = {};
  const rDesc: Record<string, string> = {};
  for (const f of facts) {
    const scope = (f as ExistingFact & { scopeKey?: string }).scopeKey ?? "property";
    if (scope === "property") {
      if (f.fieldName === "room_types_available") {
        rooms.push(...f.value.split(",").map((s) => s.trim()).filter(Boolean));
      } else if (f.fieldName === "notes") {
        // Append-only: do not prefill notes into the editor.
      } else {
        propVals[f.fieldName] = normalizeFieldValue(f.fieldName, f.value);
      }
    } else if (f.fieldName === "accessible_room_description") {
      const typeId = scope.replace("room-type:", "");
      rDesc[typeId] = f.value;
    } else {
      rVals[factRowKey(f.fieldName, scope)] = normalizeFieldValue(f.fieldName, f.value);
    }
  }
  return { propVals, rooms, rVals, rDesc };
}

/** Draft overlay: only non-empty draft values override DB defaults. */
function mergeDraftStringMaps(
  base: Record<string, string>,
  draft: Record<string, string>
): Record<string, string> {
  const merged = { ...base };
  for (const [k, v] of Object.entries(draft)) {
    if (typeof v === "string" && v.trim()) merged[k] = v.trim();
  }
  return merged;
}

function nonEmptyStringMap(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
}

function fieldInputType(valueType: string): "toggle" | "number" | "time" | "textarea" {
  switch (valueType) {
    case "BOOLEAN":
      return "toggle";
    case "NUMBER":
      return "number";
    case "TIME":
      return "time";
    default:
      return "textarea";
  }
}

function countPhotos(
  propertyPhotos: AuditPhotoInput[],
  roomPhotos: Record<string, AuditPhotoInput[]>
): number {
  return propertyPhotos.length + Object.values(roomPhotos).reduce((n, list) => n + list.length, 0);
}

function flattenPhotos(
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

const FALLBACK_WIZARD_STEPS: AuditStepId[] = [
  "entrance",
  "mobility",
  "room",
  "bathroom",
  "communication",
  "review",
];

export function AuditWizard({
  propertyId,
  token,
  nodeUrl,
  targetNodeUrl,
  locale,
  fieldDefs,
  loadedFacts,
  onSuccess,
  onError,
  t,
  getTierLabel,
}: Props) {
  const router = useRouter();
  const submitUrl = targetNodeUrl ?? nodeUrl;
  const steps = AUDIT_WIZARD_STEPS?.length ? AUDIT_WIZARD_STEPS : FALLBACK_WIZARD_STEPS;

  const [stepIndex, setStepIndex] = useState(0);
  const [propertyValues, setPropertyValues] = useState<Record<string, string>>({});
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);
  const [roomValues, setRoomValues] = useState<Record<string, string>>({});
  const [roomDescriptions, setRoomDescriptions] = useState<Record<string, string>>({});
  const [confirmedKeys, setConfirmedKeys] = useState<Set<string>>(new Set());
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());
  const [stepNotes, setStepNotes] = useState<Partial<Record<AuditStepId, string>>>({});
  const [propertyPhotos, setPropertyPhotos] = useState<AuditPhotoInput[]>([]);
  const [roomPhotos, setRoomPhotos] = useState<Record<string, AuditPhotoInput[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [reviewLightbox, setReviewLightbox] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const skipPersistRef = useRef(true);
  const discardDraftRef = useRef(false);
  const persistDraftRef = useRef<() => void>(() => {});

  const currentStep = steps[stepIndex] ?? "review";

  const propertyFields = fieldDefs.filter(
    (f) => f.scope === "PROPERTY" && f.fieldName !== "room_types_available"
  );
  const roomFieldDefs = fieldDefs.filter((f) => f.scope === "ROOM");

  const existingByKey = useMemo(() => {
    const map = new Map<string, ExistingFact>();
    for (const f of loadedFacts) {
      const key = factRowKey(f.fieldName, (f as ExistingFact & { scopeKey?: string }).scopeKey ?? "property");
      if (!map.has(key)) map.set(key, f);
    }
    return map;
  }, [loadedFacts]);

  const existingNotes = existingByKey.get(factRowKey("notes"))?.value ?? "";

  const totalPhotoCount = countPhotos(propertyPhotos, roomPhotos);

  const persistDraft = useCallback(() => {
    if (discardDraftRef.current) return;
    const draft: AuditDraft = {
      version: 2,
      step: stepIndex,
      propertyValues: {
        ...nonEmptyStringMap(propertyValues),
        ...Object.fromEntries(
          Object.entries(stepNotes)
            .filter(([, v]) => v?.trim())
            .map(([k, v]) => [`__note_${k}`, v])
        ),
      },
      selectedRoomTypes,
      roomValues: nonEmptyStringMap(roomValues),
      roomDescriptions: nonEmptyStringMap(roomDescriptions),
      confirmedKeys: [...confirmedKeys],
      editingKeys: [...editingKeys],
      elevatorNa: false,
      propertyPhotos,
      roomPhotos,
      updatedAt: new Date().toISOString(),
    };
    saveAuditDraft(propertyId, draft);
    setDraftSavedAt(draft.updatedAt);
  }, [
    stepIndex,
    propertyValues,
    stepNotes,
    selectedRoomTypes,
    roomValues,
    roomDescriptions,
    confirmedKeys,
    editingKeys,
    propertyPhotos,
    roomPhotos,
    propertyId,
  ]);

  persistDraftRef.current = persistDraft;

  function discardDraft() {
    discardDraftRef.current = true;
    clearAuditDraft(propertyId);
  }

  // Restore draft once per property; do not re-run when loadedFacts refreshes (would reset step).
  useEffect(() => {
    setHydrated(false);
    skipPersistRef.current = true;
    discardDraftRef.current = false;

    const fromFacts = formValuesFromFacts(loadedFacts);
    const draft = loadAuditDraft(propertyId);
    if (draft) {
      setStepIndex(draft.step);
      const restoredNotes: Partial<Record<AuditStepId, string>> = {};
      const rest: Record<string, string> = {};
      for (const [k, v] of Object.entries(draft.propertyValues)) {
        if (k.startsWith("__note_") && typeof v === "string") {
          restoredNotes[k.slice("__note_".length) as AuditStepId] = v;
        } else if (k === "__new_note" && typeof v === "string") {
          restoredNotes.review = v;
        } else {
          rest[k] = v;
        }
      }
      setPropertyValues(mergeDraftStringMaps(fromFacts.propVals, rest));
      setStepNotes(restoredNotes);
      setSelectedRoomTypes(
        draft.selectedRoomTypes.length > 0 ? draft.selectedRoomTypes : fromFacts.rooms
      );
      setRoomValues(mergeDraftStringMaps(fromFacts.rVals, draft.roomValues));
      setRoomDescriptions(mergeDraftStringMaps(fromFacts.rDesc, draft.roomDescriptions));
      setConfirmedKeys(new Set(draft.confirmedKeys));
      setEditingKeys(new Set(draft.editingKeys));
      setPropertyPhotos(draft.propertyPhotos);
      setRoomPhotos(draft.roomPhotos);
    } else {
      setStepIndex(0);
      setPropertyValues(fromFacts.propVals);
      setSelectedRoomTypes(fromFacts.rooms);
      setRoomValues(fromFacts.rVals);
      setRoomDescriptions(fromFacts.rDesc);
      setConfirmedKeys(new Set());
      setEditingKeys(new Set());
      setStepNotes({});
      setPropertyPhotos([]);
      setRoomPhotos({});
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset wizard when switching property
  }, [propertyId]);

  // When accessibility facts load async, fill defaults without overwriting draft/edits or step.
  useEffect(() => {
    if (!hydrated) return;
    const fromFacts = formValuesFromFacts(loadedFacts);
    setPropertyValues((prev) => mergeDraftStringMaps(fromFacts.propVals, prev));
    setRoomValues((prev) => mergeDraftStringMaps(fromFacts.rVals, prev));
    setRoomDescriptions((prev) => mergeDraftStringMaps(fromFacts.rDesc, prev));
    setSelectedRoomTypes((prev) => (prev.length > 0 ? prev : fromFacts.rooms));
  }, [loadedFacts, hydrated]);

  // Auto-save draft (debounced) on any change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => persistDraftRef.current(), 400);
    return () => window.clearTimeout(timer);
  }, [persistDraft, hydrated]);

  // Flush draft when leaving the wizard (unless cancelled or submitted).
  useEffect(() => {
    if (!hydrated) return;
    return () => {
      if (!discardDraftRef.current) {
        persistDraftRef.current();
      }
    };
  }, [hydrated, propertyId]);

  function setProp(name: string, value: string) {
    setPropertyValues((prev) => ({ ...prev, [name]: value }));
    setConfirmedKeys((prev) => {
      const next = new Set(prev);
      next.delete(factRowKey(name));
      return next;
    });
  }

  function setRoomValue(scopeKey: string, fieldName: string, value: string) {
    const key = factRowKey(fieldName, scopeKey);
    setRoomValues((prev) => ({ ...prev, [key]: value }));
    setConfirmedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function fieldsInStep(step: AuditStepId): FieldDef[] {
    const names = new Set(fieldsForStep(step));
    const mapped = propertyFields.filter((f) => names.has(f.fieldName));
    if (step !== "communication") {
      return mapped.filter((f) => f.fieldName !== "notes");
    }
    const unmapped = propertyFields.filter(
      (f) => !FIELD_AUDIT_STEP[f.fieldName] && f.fieldName !== "notes"
    );
    return [...mapped, ...unmapped];
  }

  function buildSubmitFacts(): Array<{ fieldName: string; value: string; scopeKey?: string; confirm?: boolean }> {
    const facts: Array<{ fieldName: string; value: string; scopeKey?: string; confirm?: boolean }> = [];

    const pushIfUnchanged = (
      key: string,
      fieldName: string,
      value: string,
      scopeKey: string
    ): boolean => {
      const existing = existingByKey.get(key);
      if (!existing) return false;
      const normalized = normalizeFieldValue(fieldName, value);
      const existingNormalized = normalizeFieldValue(fieldName, existing.value);
      if (existingNormalized === normalized) {
        facts.push({ fieldName, value: existing.value, scopeKey, confirm: true });
        return true;
      }
      return false;
    };

    for (const key of confirmedKeys) {
      const { scopeKey, fieldName } = parseFactRowKey(key);
      if (fieldName === "notes") continue;
      const existing = existingByKey.get(key);
      if (!existing) continue;
      facts.push({ fieldName, value: existing.value, scopeKey, confirm: true });
    }

    for (const [fieldName, value] of Object.entries(propertyValues)) {
      if (fieldName.startsWith("__")) continue;
      if (!value.trim()) continue;
      if (fieldName === "notes") continue;
      const key = factRowKey(fieldName);
      if (confirmedKeys.has(key)) continue;
      if (pushIfUnchanged(key, fieldName, value, "property")) continue;
      facts.push({ fieldName, value, scopeKey: "property" });
    }

    const noteParts: string[] = [];
    for (const step of steps) {
      if (step === "review") continue;
      const part = stepNotes[step]?.trim();
      if (part) noteParts.push(`[${t(STEP_TITLE_KEY[step])}] ${part}`);
    }
    const reviewNote = stepNotes.review?.trim();
    if (reviewNote) noteParts.push(reviewNote);
    if (noteParts.length > 0) {
      const joined = noteParts.join("\n\n");
      const appended = existingNotes ? `${existingNotes.trim()}\n\n${joined}` : joined;
      facts.push({ fieldName: "notes", value: appended, scopeKey: "property" });
    }

    if (selectedRoomTypes.length > 0) {
      facts.push({
        fieldName: "room_types_available",
        value: selectedRoomTypes.join(","),
        scopeKey: "property",
      });
    }

    for (const typeId of selectedRoomTypes) {
      const scope = roomScopeKey(typeId);
      const desc = roomDescriptions[typeId]?.trim();
      if (desc) facts.push({ fieldName: "accessible_room_description", value: desc, scopeKey: scope });
      for (const [key, value] of Object.entries(roomValues)) {
        if (!key.startsWith(`${scope}::`) || !value.trim()) continue;
        const fieldName = key.slice(scope.length + 2);
        if (confirmedKeys.has(key)) continue;
        if (pushIfUnchanged(key, fieldName, value, scope)) continue;
        facts.push({ fieldName, value, scopeKey: scope });
      }
    }

    return facts;
  }

  async function submit() {
    const facts = buildSubmitFacts();
    if (facts.length === 0) {
      onError(t("ui.fillOneField"));
      return;
    }
    setSubmitting(true);
    const photos = flattenPhotos(propertyPhotos, roomPhotos);
    const res = await fetch(`${submitUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ facts, photos, locale }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = (await res.json()) as { message?: string };
      onError(d.message ?? t("ui.submissionFailed"));
      return;
    }
    discardDraft();
    invalidateMapPins();
    onSuccess();
  }

  async function handleStepPhotoAdd(step: PhotoStepId, files: FileList | File[]) {
    const remaining = MAX_AUDIT_PHOTOS - totalPhotoCount;
    const list = Array.from(files).slice(0, remaining);
    const scope = stepScopeKey(step);
    const compressed = await Promise.all(list.map((f) => compressPhoto(f)));
    setPropertyPhotos((prev) =>
      [
        ...prev,
        ...compressed.map((c) => ({
          dataUri: c.dataUri,
          width: c.width,
          height: c.height,
          scopeKey: scope,
          fieldName: undefined,
        })),
      ].slice(0, MAX_AUDIT_PHOTOS)
    );
  }

  function photosForStep(step: PhotoStepId): AuditPhotoInput[] {
    const scope = stepScopeKey(step);
    return propertyPhotos.filter((p) => (p.scopeKey ?? "") === scope);
  }

  function setPhotosForStep(step: PhotoStepId, next: AuditPhotoInput[]) {
    const scope = stepScopeKey(step);
    const others = propertyPhotos.filter((p) => (p.scopeKey ?? "") !== scope);
    setPropertyPhotos([
      ...others,
      ...next.map((p) => ({ ...p, scopeKey: scope, fieldName: undefined })),
    ]);
  }

  function stepPhotoGroupLabel(scopeKey: string): string {
    if (scopeKey === "step:entrance" || scopeKey === "step:building_access") {
      return t("ui.auditStepEntrance");
    }
    if (scopeKey === "step:mobility") return t("ui.auditStepMobility");
    if (scopeKey === "step:bathroom" || scopeKey === "step:shared_facilities") {
      return t("ui.auditStepBathroom");
    }
    if (scopeKey === "step:communication") return t("ui.auditStepCommunication");
    if (scopeKey.startsWith("room-type:")) {
      return getRoomTypeLabel(scopeKey.slice("room-type:".length), locale);
    }
    return t("ui.propertyAuditPhotos");
  }

  function renderPropertyPhotoSection(step: PhotoStepId) {
    const stepPhotos = photosForStep(step);
    return (
      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600 }}>{t("ui.auditStepPhotos")}</p>
        <p className="existing-data-panel-hint" style={{ marginTop: 4 }}>
          {t("ui.auditStepPhotosHint")}
        </p>
        <AuditPhotoGallery
          photos={stepPhotos}
          onChange={(next) => setPhotosForStep(step, next)}
          photoLabel={t("ui.auditStepPhotos")}
          removePhotoLabel={t("ui.removePhoto")}
          closePhotoLabel={t("ui.closePhoto")}
          prevPhotoLabel={t("ui.photoPrev")}
          nextPhotoLabel={t("ui.photoNext")}
          maxPhotos={MAX_AUDIT_PHOTOS}
          totalPhotoCount={totalPhotoCount}
          onAddFiles={(files) => handleStepPhotoAdd(step, files)}
          inputId={`step-photos-${step}`}
          showFileInput
        />
      </div>
    );
  }

  function renderReviewPhotoSummary() {
    const flat = flattenPhotos(propertyPhotos, roomPhotos);
    if (flat.length === 0) {
      return (
        <p style={{ fontSize: 12, color: "var(--wt-warning, #b45309)", marginTop: 8 }}>
          {t("ui.reviewGapNoPhotos")}
        </p>
      );
    }

    const groups = groupPhotosByStepScope(
      flat.map((p, i) => ({
        id: String(i),
        url: p.dataUri,
        caption: p.caption ?? null,
        scopeKey: p.scopeKey,
        fieldName: p.fieldName,
      }))
    );

    const lightboxPhotos = flat.map((p, i) => ({
      url: p.dataUri,
      alt: `${t("ui.auditStepPhotos")} ${i + 1}`,
    }));

    const indexByUrl = new Map(flat.map((p, i) => [p.dataUri, i]));

    return (
      <section className="photo-step-summary" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>{t("ui.reviewPhotosTitle")}</h3>
        <p className="existing-data-panel-hint">{t("ui.reviewPhotosHint")}</p>
        {groups.map((group) => (
          <div key={group.key} style={{ marginTop: 12 }}>
            <p className="audit-photos-group-title" style={{ fontSize: 12, fontWeight: 600 }}>
              {stepPhotoGroupLabel(group.scopeKey)}
              <span style={{ fontWeight: 400 }}> ({group.photos.length})</span>
            </p>
            <div className="audit-photos-strip">
              {group.photos.map((photo) => {
                const index = indexByUrl.get(photo.url) ?? 0;
                return (
                  <button
                    key={photo.id ?? photo.url}
                    type="button"
                    className="audit-photo-thumb"
                    onClick={() => setReviewLightbox(index)}
                    aria-label={`${stepPhotoGroupLabel(group.scopeKey)} ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <PhotoLightbox
          photos={lightboxPhotos}
          index={reviewLightbox}
          onClose={() => setReviewLightbox(null)}
          onNavigate={setReviewLightbox}
          closeLabel={t("ui.closePhoto")}
          prevLabel={t("ui.photoPrev")}
          nextLabel={t("ui.photoNext")}
        />
      </section>
    );
  }

  function fieldLabel(field: FieldDef, tierLabel?: string) {
    return (
      <span className="fk-field-row__label-text">
        <span className="fk-field-row__label-title">{field.label}</span>
        {tierLabel ? <span className="fk-field-row__tier">{tierLabel}</span> : null}
      </span>
    );
  }

  function renderFieldRow(field: FieldDef, scopeKey = "property") {
    const key = factRowKey(field.fieldName, scopeKey);
    const existing = existingByKey.get(key);
    const tierLabel = existing ? getTierLabel(existing.tier) : undefined;
    return renderInput(field, scopeKey, tierLabel);
  }

  function renderBoolPills(
    field: FieldDef,
    scopeKey: string,
    val: string,
    onChange: (v: string) => void,
    tierLabel?: string
  ) {
    return (
      <div key={`${scopeKey}-${field.fieldName}`} className="fk-field-row">
        <div className="fk-field-row__label">{fieldLabel(field, tierLabel)}</div>
        <div className="fk-field-row__control fk-bool-pills" role="group" aria-label={field.label}>
          {BOOL_OPTIONS.map((opt) => {
            const active = val === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`fk-bool-pill ${opt.className}${active ? " fk-bool-pill--active" : ""}`}
                aria-pressed={active}
                onClick={() => onChange(active ? "" : opt.value)}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderEnumPills(
    field: FieldDef,
    scopeKey: string,
    val: string,
    onChange: (v: string) => void,
    tierLabel?: string
  ) {
    const opts = field.enumValues ?? [];

    return (
      <div key={`${scopeKey}-${field.fieldName}`} className="fk-field-row">
        <div className="fk-field-row__label">{fieldLabel(field, tierLabel)}</div>
        <div className="fk-field-row__control fk-bool-pills" role="group" aria-label={field.label}>
          {opts.map((opt) => {
            const active = val === opt;
            const pillClass =
              field.fieldName === "path_to_entrance"
                ? PATH_TO_ENTRANCE_PILL_CLASS[opt] ?? "fk-bool-pill--yes"
                : "fk-bool-pill--yes";
            return (
              <button
                key={opt}
                type="button"
                className={`fk-bool-pill ${pillClass}${active ? " fk-bool-pill--active" : ""}`}
                aria-pressed={active}
                onClick={() => onChange(active ? "" : opt)}
              >
                {getFieldEnumLabel(field.fieldName, opt, locale)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderInput(field: FieldDef, scopeKey = "property", tierLabel?: string) {
    const type = fieldInputType(field.valueType);
    const key = factRowKey(field.fieldName, scopeKey);
    let val =
      scopeKey === "property"
        ? (propertyValues[field.fieldName] ?? "")
        : (roomValues[key] ?? "");
    val = normalizeFieldValue(field.fieldName, val);

    const onChange = (v: string) => {
      if (scopeKey === "property") setProp(field.fieldName, v);
      else setRoomValue(scopeKey, field.fieldName, v);
    };

    if (field.valueType === "ENUM" && field.enumValues && field.enumValues.length > 0 && field.enumValues.length <= 6) {
      return renderEnumPills(field, scopeKey, val, onChange, tierLabel);
    }

    if (field.valueType === "ENUM" && field.enumValues && field.enumValues.length > 0) {
      return (
        <div key={`${scopeKey}-${field.fieldName}`} className="fk-field-row">
          <label className="fk-field-row__label" htmlFor={`f-${scopeKey}-${field.fieldName}`}>
            {fieldLabel(field, tierLabel)}
          </label>
          <div className="fk-field-row__control">
            <select
              id={`f-${scopeKey}-${field.fieldName}`}
              value={val}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">{t("ui.selectOption")}</option>
              {field.enumValues.map((opt) => (
                <option key={opt} value={opt}>
                  {getFieldEnumLabel(field.fieldName, opt, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    if (type === "toggle") {
      return renderBoolPills(field, scopeKey, val, onChange, tierLabel);
    }

    if (type === "textarea") {
      return (
        <div key={`${scopeKey}-${field.fieldName}`} className="fk-field-stack">
          <label htmlFor={`f-${scopeKey}-${field.fieldName}`}>{fieldLabel(field, tierLabel)}</label>
          <textarea
            id={`f-${scopeKey}-${field.fieldName}`}
            value={val}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    }

    return (
      <div key={`${scopeKey}-${field.fieldName}`} className="fk-field-row">
        <label className="fk-field-row__label" htmlFor={`f-${scopeKey}-${field.fieldName}`}>
          {fieldLabel(field, tierLabel)}
        </label>
        <div className="fk-field-row__control fk-field-row__control--input">
          <input
            id={`f-${scopeKey}-${field.fieldName}`}
            type={type === "number" ? "number" : type === "time" ? "time" : "text"}
            value={val}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.unit ? <span className="fk-field-unit">{field.unit}</span> : null}
        </div>
      </div>
    );
  }

  function renderStepNotes() {
    if (currentStep === "review") return null;
    const note = stepNotes[currentStep] ?? "";
    return (
      <div className="fk-field-stack" style={{ marginTop: 16 }}>
        <label htmlFor={`step-note-${currentStep}`}>{t("ui.notes")}</label>
        <textarea
          id={`step-note-${currentStep}`}
          value={note}
          onChange={(e) =>
            setStepNotes((prev) => ({ ...prev, [currentStep]: e.target.value }))
          }
          placeholder={t("ui.auditAppendNotePlaceholder")}
          rows={3}
        />
      </div>
    );
  }

  function renderStepBody() {
    if (currentStep === "review") {
      const reviewFields = fieldsInStep("review").filter((f) => f.fieldName !== "notes");
      const facts = buildSubmitFacts();
      const confirming = facts.filter((f) => f.confirm).length;
      const updating = facts.filter((f) => !f.confirm && existingByKey.has(factRowKey(f.fieldName, f.scopeKey))).length;
      const newCount = facts.length - confirming - updating;
      return (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>{t("ui.reviewSummary")}</h3>
          {reviewFields.map((f) => renderFieldRow(f))}
          {renderStepNotes()}
          {existingNotes ? (
            <p className="existing-data-panel-hint" style={{ marginTop: 8 }}>
              {t("ui.auditExistingNotesHint")}
            </p>
          ) : null}
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginTop: 8 }}>
            {confirming > 0 ? `${t("ui.reviewConfirming", { count: confirming })} · ` : ""}
            {updating > 0 ? `${t("ui.reviewUpdating", { count: updating })} · ` : ""}
            {newCount > 0 ? t("ui.reviewNew", { count: newCount }) : ""}
          </p>
          {renderReviewPhotoSummary()}
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={submit} disabled={submitting}>
            {submitting ? t("ui.submitting") : t("ui.submitAudit")}
          </button>
        </div>
      );
    }

    if (currentStep === "room") {
      return (
        <div>
          <RoomAuditSection
            roomFields={roomFieldDefs}
            selectedTypes={selectedRoomTypes}
            onTypesChange={setSelectedRoomTypes}
            roomValues={roomValues}
            onRoomValueChange={setRoomValue}
            roomDescriptions={roomDescriptions}
            onRoomDescriptionChange={(typeId, value) =>
              setRoomDescriptions((prev) => ({ ...prev, [typeId]: value }))
            }
            hideBathroomFields
            roomPhotos={roomPhotos}
            onRoomPhotosChange={(typeId, photos) =>
              setRoomPhotos((prev) => ({
                ...prev,
                [typeId]: photos.map((p) => ({
                  ...p,
                  fieldName: undefined,
                  scopeKey: roomScopeKey(typeId),
                })),
              }))
            }
            totalPhotoCount={totalPhotoCount}
            photoLabel={t("ui.auditStepPhotos")}
            closePhotoLabel={t("ui.closePhoto")}
            prevPhotoLabel={t("ui.photoPrev")}
            nextPhotoLabel={t("ui.photoNext")}
            removePhotoLabel={t("ui.removePhoto")}
            renderRoomField={(field, scopeKey) =>
              renderFieldRow({ ...field, scope: "ROOM" }, scopeKey)
            }
          />
          {renderStepNotes()}
        </div>
      );
    }

    if (currentStep === "bathroom") {
      const propertyBathroom = propertyFields.filter((f) => f.fieldName === "accessible_bathroom");
      return (
        <div>
          {propertyBathroom.map((f) => renderFieldRow(f))}
          {selectedRoomTypes.length > 0 ? (
            <RoomAuditSection
              roomFields={roomFieldDefs}
              selectedTypes={selectedRoomTypes}
              onTypesChange={setSelectedRoomTypes}
              roomValues={roomValues}
              onRoomValueChange={setRoomValue}
              roomDescriptions={roomDescriptions}
              onRoomDescriptionChange={(typeId, value) =>
                setRoomDescriptions((prev) => ({ ...prev, [typeId]: value }))
              }
              bathroomOnly
              showTypePicker={false}
              renderRoomField={(field, scopeKey) =>
                renderFieldRow({ ...field, scope: "ROOM" }, scopeKey)
              }
            />
          ) : (
            <p className="existing-data-panel-hint" style={{ marginTop: 12 }}>
              {t("ui.auditBathroomNoRooms")}
            </p>
          )}
          {renderPropertyPhotoSection("bathroom")}
          {renderStepNotes()}
        </div>
      );
    }

    const stepFields = fieldsInStep(currentStep);
    return (
      <div>
        {stepFields.map((f) => renderFieldRow(f))}
        {PHOTO_STEPS.has(currentStep)
          ? renderPropertyPhotoSection(currentStep as PhotoStepId)
          : null}
        {renderStepNotes()}
      </div>
    );
  }

  function scrollFormToTop() {
    const main = document.querySelector(".fk-main");
    if (main instanceof HTMLElement) {
      main.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function goNext() {
    if (stepIndex >= steps.length - 1) return;
    setStepIndex((i) => i + 1);
    scrollFormToTop();
  }

  function goPrev() {
    if (stepIndex <= 0) return;
    setStepIndex((i) => i - 1);
    scrollFormToTop();
  }

  function cancelAudit() {
    discardDraft();
    router.push(propertyHref(propertyId, submitUrl, nodeUrl));
  }

  return (
    <>
      <div className="card fk-audit-form">
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontSize: 12, color: "var(--wt-text-muted)" }}>
            {t("ui.auditStepOf", { current: stepIndex + 1, total: steps.length })} · {t(STEP_TITLE_KEY[currentStep])}
          </span>
          {draftSavedAt ? (
            <span style={{ fontSize: 11, color: "var(--wt-text-muted)" }}>{t("ui.auditDraftSaved")}</span>
          ) : null}
        </div>

        <div style={{ height: 4, background: "var(--wt-border)", borderRadius: 2, marginBottom: 16 }}>
          <div
            style={{
              width: `${((stepIndex + 1) / steps.length) * 100}%`,
              height: "100%",
              background: "var(--wt-primary)",
              borderRadius: 2,
            }}
          />
        </div>

        {hydrated ? renderStepBody() : (
          <p className="existing-data-panel-hint" style={{ margin: "8px 0 16px" }}>
            {t("ui.loading")}
          </p>
        )}

        <div className="fk-audit-wizard-nav" role="navigation" aria-label={t(STEP_TITLE_KEY[currentStep])}>
          <div className="fk-audit-wizard-nav__start">
            {stepIndex > 0 ? (
              <button type="button" className="btn-secondary fk-audit-wizard-nav__btn" onClick={goPrev}>
                {t("ui.prevStep")}
              </button>
            ) : null}
            <button type="button" className="btn-secondary fk-audit-wizard-nav__btn" onClick={cancelAudit}>
              {t("ui.cancel")}
            </button>
          </div>
          {currentStep !== "review" ? (
            <button type="button" className="btn-primary fk-audit-wizard-nav__btn fk-audit-wizard-nav__btn--next" onClick={goNext}>
              {t("ui.nextStep")}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
