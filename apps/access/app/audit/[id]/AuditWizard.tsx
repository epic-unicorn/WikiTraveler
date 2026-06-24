"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AUDIT_WIZARD_STEPS,
  fieldsForStep,
  type AuditStepId,
} from "@wikitraveler/core";
import {
  compressPhoto,
  MAX_AUDIT_PHOTOS,
  roomScopeKey,
  type AuditPhotoInput,
} from "@wikitraveler/i18n";
import { ProseFactValue } from "@wikitraveler/ui";
import ExistingDataPanel, { type ExistingFact } from "./ExistingDataPanel";
import { RoomAuditSection } from "./RoomAuditSection";
import { resolveFactDisplay } from "../../lib/factDisplay";
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
}

interface Props {
  propertyId: string;
  token: string;
  nodeUrl: string;
  targetNodeUrl?: string;
  locale: string;
  fieldDefs: FieldDef[];
  loadedFacts: ExistingFact[];
  auditPhotos: import("./ExistingDataPanel").AuditPhotos | null;
  hasAiGuess: boolean;
  onSuccess: () => void;
  onError: (msg: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getTierLabel: (tier: string) => string;
}

const STEP_TITLE_KEY: Record<AuditStepId, string> = {
  building_access: "ui.auditStepBuilding",
  shared_facilities: "ui.auditStepShared",
  rooms: "ui.auditStepRooms",
  review: "ui.auditStepReview",
};

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
    list.map((p) => ({ ...p, scopeKey: p.scopeKey ?? roomScopeKey(typeId) }))
  );
  return [...propertyPhotos, ...room].slice(0, MAX_AUDIT_PHOTOS);
}

const FALLBACK_WIZARD_STEPS: AuditStepId[] = [
  "building_access",
  "shared_facilities",
  "rooms",
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
  auditPhotos,
  hasAiGuess,
  onSuccess,
  onError,
  t,
  getTierLabel,
}: Props) {
  const submitUrl = targetNodeUrl ?? nodeUrl;
  const steps = AUDIT_WIZARD_STEPS?.length ? AUDIT_WIZARD_STEPS : FALLBACK_WIZARD_STEPS;

  const [stepIndex, setStepIndex] = useState(0);
  const [propertyValues, setPropertyValues] = useState<Record<string, string>>({});
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);
  const [roomValues, setRoomValues] = useState<Record<string, string>>({});
  const [roomDescriptions, setRoomDescriptions] = useState<Record<string, string>>({});
  const [confirmedKeys, setConfirmedKeys] = useState<Set<string>>(new Set());
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());
  const [elevatorNa, setElevatorNa] = useState(false);
  const [propertyPhotos, setPropertyPhotos] = useState<AuditPhotoInput[]>([]);
  const [roomPhotos, setRoomPhotos] = useState<Record<string, AuditPhotoInput[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const currentStep = steps[stepIndex] ?? "review";

  const propertyFields = fieldDefs.filter(
    (f) => f.scope === "PROPERTY" && f.fieldName !== "room_types_available"
  );
  const roomFieldDefs = fieldDefs.filter((f) => f.scope === "ROOM");
  const accessibleRoomCountField = fieldDefs.find((f) => f.fieldName === "accessible_room_count");

  const existingByKey = useMemo(() => {
    const map = new Map<string, ExistingFact>();
    for (const f of loadedFacts) {
      const key = factRowKey(f.fieldName, (f as ExistingFact & { scopeKey?: string }).scopeKey ?? "property");
      if (!map.has(key)) map.set(key, f);
    }
    return map;
  }, [loadedFacts]);

  const totalPhotoCount = countPhotos(propertyPhotos, roomPhotos);

  const persistDraft = useCallback(() => {
    const draft: AuditDraft = {
      version: 2,
      step: stepIndex,
      propertyValues,
      selectedRoomTypes,
      roomValues,
      roomDescriptions,
      confirmedKeys: [...confirmedKeys],
      editingKeys: [...editingKeys],
      elevatorNa,
      propertyPhotos,
      roomPhotos,
      updatedAt: new Date().toISOString(),
    };
    saveAuditDraft(propertyId, draft);
  }, [
    stepIndex,
    propertyValues,
    selectedRoomTypes,
    roomValues,
    roomDescriptions,
    confirmedKeys,
    editingKeys,
    elevatorNa,
    propertyPhotos,
    roomPhotos,
    propertyId,
  ]);

  useEffect(() => {
    persistDraft();
  }, [persistDraft]);

  useEffect(() => {
    const draft = loadAuditDraft(propertyId);
    if (draft) {
      setStepIndex(draft.step);
      setPropertyValues(draft.propertyValues);
      setSelectedRoomTypes(draft.selectedRoomTypes);
      setRoomValues(draft.roomValues);
      setRoomDescriptions(draft.roomDescriptions);
      setConfirmedKeys(new Set(draft.confirmedKeys));
      setEditingKeys(new Set(draft.editingKeys));
      setElevatorNa(draft.elevatorNa);
      setPropertyPhotos(draft.propertyPhotos);
      setRoomPhotos(draft.roomPhotos);
      return;
    }

    const propVals: Record<string, string> = {};
    const rooms: string[] = [];
    const rVals: Record<string, string> = {};
    const rDesc: Record<string, string> = {};
    for (const f of loadedFacts) {
      const scope = (f as ExistingFact & { scopeKey?: string }).scopeKey ?? "property";
      if (scope === "property") {
        if (f.fieldName === "room_types_available") {
          rooms.push(...f.value.split(",").map((s) => s.trim()).filter(Boolean));
        } else {
          propVals[f.fieldName] = f.value;
        }
      } else if (f.fieldName === "accessible_room_description") {
        const typeId = scope.replace("room-type:", "");
        rDesc[typeId] = f.value;
      } else {
        rVals[factRowKey(f.fieldName, scope)] = f.value;
      }
    }
    setPropertyValues(propVals);
    setSelectedRoomTypes(rooms);
    setRoomValues(rVals);
    setRoomDescriptions(rDesc);
  }, [propertyId, loadedFacts]);

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

  function markConfirm(fieldName: string, scopeKey = "property") {
    const key = factRowKey(fieldName, scopeKey);
    setConfirmedKeys((prev) => new Set(prev).add(key));
    setEditingKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function markEditing(fieldName: string, scopeKey = "property") {
    const key = factRowKey(fieldName, scopeKey);
    setEditingKeys((prev) => new Set(prev).add(key));
    setConfirmedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function fieldsInStep(step: AuditStepId): FieldDef[] {
    const names = new Set(fieldsForStep(step));
    return propertyFields.filter((f) => names.has(f.fieldName));
  }

  function buildSubmitFacts(): Array<{ fieldName: string; value: string; scopeKey?: string; confirm?: boolean }> {
    const facts: Array<{ fieldName: string; value: string; scopeKey?: string; confirm?: boolean }> = [];

    for (const key of confirmedKeys) {
      const { scopeKey, fieldName } = parseFactRowKey(key);
      const existing = existingByKey.get(key);
      if (!existing) continue;
      facts.push({ fieldName, value: existing.value, scopeKey, confirm: true });
    }

    for (const [fieldName, value] of Object.entries(propertyValues)) {
      if (!value.trim()) continue;
      const key = factRowKey(fieldName);
      if (confirmedKeys.has(key)) continue;
      facts.push({ fieldName, value, scopeKey: "property" });
    }

    if (elevatorNa && !confirmedKeys.has(factRowKey("elevator_present"))) {
      facts.push({ fieldName: "elevator_present", value: "no", scopeKey: "property" });
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
    clearAuditDraft(propertyId);
    onSuccess();
  }

  async function handlePropertyPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const remaining = MAX_AUDIT_PHOTOS - totalPhotoCount;
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    const compressed = await Promise.all(files.map((f) => compressPhoto(f)));
    setPropertyPhotos((prev) =>
      [
        ...prev,
        ...compressed.map((c) => ({ dataUri: c.dataUri, width: c.width, height: c.height })),
      ].slice(0, MAX_AUDIT_PHOTOS)
    );
    e.target.value = "";
  }

  function renderConfirmRow(field: FieldDef, scopeKey = "property") {
    const key = factRowKey(field.fieldName, scopeKey);
    const existing = existingByKey.get(key);
    const isEditing = editingKeys.has(key);
    const isConfirmed = confirmedKeys.has(key);

    if (!existing) {
      return renderInput(field, scopeKey);
    }

    const { displayValue } = resolveFactDisplay({ ...existing, fieldName: field.fieldName }, locale);
    const tierLabel = getTierLabel(existing.tier);

    if (isEditing) {
      return <div key={key} style={{ marginBottom: 12 }}>{renderInput(field, scopeKey)}</div>;
    }

    return (
      <div
        key={key}
        className="fk-confirm-row"
        style={{ marginBottom: 12, padding: 12, border: "1px solid var(--wt-border)", borderRadius: 8 }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>{field.label}</div>
        <div style={{ fontSize: 13, marginTop: 4, color: "var(--wt-text-muted)" }}>
          {(existing as ExistingFact & { machineTranslated?: boolean }).machineTranslated ? (
            <ProseFactValue
              displayValue={(existing as ExistingFact & { displayValue?: string }).displayValue ?? displayValue}
              rawValue={existing.value}
              machineTranslated
              valueLocale={(existing as ExistingFact & { valueLocale?: string }).valueLocale}
            />
          ) : (
            displayValue
          )}{" "}
          · {tierLabel}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className={isConfirmed ? "btn-primary" : "btn-secondary"}
            style={{ fontSize: 12, padding: "6px 12px" }}
            onClick={() => markConfirm(field.fieldName, scopeKey)}
          >
            {t("ui.stillCorrect")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: 12, padding: "6px 12px" }}
            onClick={() => markEditing(field.fieldName, scopeKey)}
          >
            {t("ui.updateValue")}
          </button>
        </div>
      </div>
    );
  }

  function renderInput(field: FieldDef, scopeKey = "property") {
    const type = fieldInputType(field.valueType);
    const val =
      scopeKey === "property"
        ? (propertyValues[field.fieldName] ?? "")
        : (roomValues[factRowKey(field.fieldName, scopeKey)] ?? "");

    const onChange = (v: string) => {
      if (scopeKey === "property") setProp(field.fieldName, v);
      else setRoomValue(scopeKey, field.fieldName, v);
    };

    if (type === "toggle") {
      return (
        <label className="toggle-row" key={`${scopeKey}-${field.fieldName}`} htmlFor={`f-${scopeKey}-${field.fieldName}`}>
          <span className="toggle-label">{field.label}</span>
          <span className="toggle">
            <input
              id={`f-${scopeKey}-${field.fieldName}`}
              type="checkbox"
              checked={val === "yes"}
              onChange={(e) => onChange(e.target.checked ? "yes" : "no")}
            />
            <span className="toggle-slider" />
          </span>
        </label>
      );
    }

    if (type === "textarea") {
      return (
        <div key={`${scopeKey}-${field.fieldName}`}>
          <label htmlFor={`f-${scopeKey}-${field.fieldName}`}>{field.label}</label>
          <textarea
            id={`f-${scopeKey}-${field.fieldName}`}
            value={val}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    }

    return (
      <div key={`${scopeKey}-${field.fieldName}`}>
        <label htmlFor={`f-${scopeKey}-${field.fieldName}`}>
          {field.label}
          {field.unit ? ` (${field.unit})` : ""}
        </label>
        <input
          id={`f-${scopeKey}-${field.fieldName}`}
          type={type === "number" ? "number" : type === "time" ? "time" : "text"}
          value={val}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  function renderStepBody() {
    if (currentStep === "review") {
      const facts = buildSubmitFacts();
      const confirming = facts.filter((f) => f.confirm).length;
      const updating = facts.filter((f) => !f.confirm && existingByKey.has(factRowKey(f.fieldName, f.scopeKey))).length;
      const newCount = facts.length - confirming - updating;
      return (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>{t("ui.reviewSummary")}</h3>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginTop: 8 }}>
            {confirming > 0 ? `${t("ui.reviewConfirming", { count: confirming })} · ` : ""}
            {updating > 0 ? `${t("ui.reviewUpdating", { count: updating })} · ` : ""}
            {newCount > 0 ? t("ui.reviewNew", { count: newCount }) : ""}
          </p>
          {totalPhotoCount === 0 ? (
            <p style={{ fontSize: 12, color: "var(--wt-warning, #b45309)", marginTop: 8 }}>
              {t("ui.reviewGapNoPhotos")}
            </p>
          ) : null}
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={submit} disabled={submitting}>
            {submitting ? t("ui.submitting") : t("ui.submitAudit")}
          </button>
        </div>
      );
    }

    if (currentStep === "rooms") {
      return (
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
          accessibleRoomCount={propertyValues.accessible_room_count ?? ""}
          onAccessibleRoomCountChange={(value) => setProp("accessible_room_count", value)}
          accessibleRoomCountLabel={accessibleRoomCountField?.label ?? "Accessible rooms"}
          roomPhotos={roomPhotos}
          onRoomPhotosChange={(typeId, photos) =>
            setRoomPhotos((prev) => ({ ...prev, [typeId]: photos }))
          }
          totalPhotoCount={totalPhotoCount}
          renderRoomField={(field, scopeKey) =>
            renderConfirmRow({ ...field, scope: "ROOM" }, scopeKey)
          }
        />
      );
    }

    const stepFields = fieldsInStep(currentStep);
    return (
      <div>
        {currentStep === "building_access" && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13 }}>
            <input type="checkbox" checked={elevatorNa} onChange={(e) => setElevatorNa(e.target.checked)} />
            {t("ui.auditElevatorNa")} ({fieldDefs.find((f) => f.fieldName === "elevator_present")?.label})
          </label>
        )}
        {stepFields.map((f) => renderConfirmRow(f))}
        {currentStep === "building_access" && (
          <div style={{ marginTop: 16 }}>
            <label htmlFor="step-photos" style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>
              {t("ui.optionalPhoto")}
            </label>
            {propertyPhotos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {propertyPhotos.map((photo, index) => (
                  <div key={index} style={{ position: "relative" }}>
                    <img
                      src={photo.dataUri}
                      alt=""
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }}
                    />
                    <button
                      type="button"
                      aria-label={t("ui.removePhoto")}
                      onClick={() => setPropertyPhotos((prev) => prev.filter((_, i) => i !== index))}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "none",
                        background: "var(--wt-danger)",
                        color: "#fff",
                        fontSize: 14,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {totalPhotoCount < MAX_AUDIT_PHOTOS && (
              <input
                id="step-photos"
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePropertyPhotoChange}
                style={{ marginTop: 8 }}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  function goNext() {
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
  }

  function goPrev() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  return (
    <>
      <ExistingDataPanel facts={loadedFacts} auditPhotos={auditPhotos} hasAiGuess={hasAiGuess} />

      <div className="card fk-audit-form">
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--wt-text-muted)" }}>
            {t("ui.auditStepOf", { current: stepIndex + 1, total: steps.length })} · {t(STEP_TITLE_KEY[currentStep])}
          </span>
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

        {renderStepBody()}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {stepIndex > 0 ? (
            <button type="button" className="btn-secondary" onClick={goPrev}>
              {t("ui.prevStep")}
            </button>
          ) : null}
          {currentStep !== "review" ? (
            <button type="button" className="btn-primary" onClick={goNext}>
              {t("ui.nextStep")}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
