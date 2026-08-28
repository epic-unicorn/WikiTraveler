"use client";

import { useEffect, useState } from "react";
import {
  compressPhoto,
  MAX_AUDIT_PHOTOS,
  STANDARD_ROOM_TYPES,
  roomScopeKey,
  getRoomTypeLabel,
  type AuditPhotoInput,
} from "@wikitraveler/i18n";
import { useLocale } from "@wikitraveler/ui";
import { AuditPhotoGallery } from "../../components/AuditPhotoGallery";
import { ExistingStepPhotos } from "../../components/ExistingStepPhotos";
import { photosForRoomScope, type AuditPhotoRef } from "../../lib/propertyFacts";
import { isStandardRoomType } from "./roomTypes";

export interface RoomFieldDef {
  fieldName: string;
  label: string;
  valueType: string;
  unit?: string | null;
}

const BATHROOM_FIELDS = new Set(["roll_in_shower", "grab_bars_bathroom"]);

interface Props {
  roomFields: RoomFieldDef[];
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  /** Custom type ids to keep as chips even when unselected. */
  knownCustomTypes?: string[];
  roomValues: Record<string, string>;
  onRoomValueChange: (scopeKey: string, fieldName: string, value: string) => void;
  roomDescriptions: Record<string, string>;
  onRoomDescriptionChange: (roomType: string, value: string) => void;
  /** When true, only bathroom room fields are shown (bathroom wizard step). */
  bathroomOnly?: boolean;
  /** When true, hide bathroom fields (room wizard step). */
  hideBathroomFields?: boolean;
  roomPhotos?: Record<string, AuditPhotoInput[]>;
  existingPhotos?: AuditPhotoRef[];
  onRoomPhotosChange?: (typeId: string, photos: AuditPhotoInput[]) => void;
  totalPhotoCount?: number;
  photoLabel?: string;
  closePhotoLabel?: string;
  prevPhotoLabel?: string;
  nextPhotoLabel?: string;
  removePhotoLabel?: string;
  renderRoomField?: (field: RoomFieldDef, scopeKey: string) => React.ReactNode;
  showTypePicker?: boolean;
}

function slugifyCustomType(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `custom_${Date.now().toString(36)}`;
}

export function RoomAuditSection({
  roomFields,
  selectedTypes,
  onTypesChange,
  knownCustomTypes = [],
  roomValues,
  onRoomValueChange,
  roomDescriptions,
  onRoomDescriptionChange,
  bathroomOnly = false,
  hideBathroomFields = false,
  roomPhotos = {},
  existingPhotos = [],
  onRoomPhotosChange,
  totalPhotoCount = 0,
  photoLabel,
  closePhotoLabel,
  prevPhotoLabel,
  nextPhotoLabel,
  removePhotoLabel,
  renderRoomField,
  showTypePicker = true,
}: Props) {
  const { locale, t } = useLocale();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const useCollapsible = selectedTypes.length > 1;

  useEffect(() => {
    if (selectedTypes.length <= 1) {
      setExpanded(null);
      return;
    }
    setExpanded((current) =>
      current && selectedTypes.includes(current) ? current : null
    );
  }, [selectedTypes]);

  function toggleType(typeId: string) {
    if (selectedTypes.includes(typeId)) {
      onTypesChange(selectedTypes.filter((type) => type !== typeId));
    } else {
      onTypesChange([...selectedTypes, typeId]);
    }
  }

  function addCustomType() {
    const label = customLabel.trim();
    if (!label) return;
    let id = slugifyCustomType(label);
    if (isStandardRoomType(id)) {
      id = `${id}_${Date.now().toString(36)}`;
    } else if (knownCustomTypes.includes(id) || selectedTypes.includes(id)) {
      if (!selectedTypes.includes(id)) onTypesChange([...selectedTypes, id]);
      setCustomLabel("");
      return;
    }
    onTypesChange([...selectedTypes, id]);
    setCustomLabel("");
  }

  async function handlePhotoAdd(typeId: string, files: FileList | File[]) {
    if (!onRoomPhotosChange) return;
    const remaining = MAX_AUDIT_PHOTOS - totalPhotoCount;
    if (remaining <= 0) return;
    const list = Array.from(files).slice(0, remaining);
    const compressed = await Promise.all(list.map((f) => compressPhoto(f)));
    const scope = roomScopeKey(typeId);
    const next = [
      ...(roomPhotos[typeId] ?? []),
      ...compressed.map((c) => ({
        dataUri: c.dataUri,
        width: c.width,
        height: c.height,
        scopeKey: scope,
        fieldName: undefined,
      })),
    ];
    onRoomPhotosChange(typeId, next);
  }

  function renderDefaultField(field: RoomFieldDef, scope: string) {
    const key = `${scope}::${field.fieldName}`;
    if (field.valueType === "BOOLEAN") {
      return (
        <label className="toggle-row" key={key} htmlFor={`room-${key}`}>
          <span className="toggle-label">{field.label}</span>
          <span className="toggle">
            <input
              id={`room-${key}`}
              type="checkbox"
              checked={roomValues[key] === "yes"}
              onChange={(e) =>
                onRoomValueChange(scope, field.fieldName, e.target.checked ? "yes" : "no")
              }
            />
            <span className="toggle-slider" />
          </span>
        </label>
      );
    }

    return (
      <div key={key}>
        <label htmlFor={`room-input-${key}`}>
          {field.label}
          {field.unit && (
            <span style={{ fontWeight: 400, color: "var(--wt-text-muted)" }}> ({field.unit})</span>
          )}
        </label>
        <input
          id={`room-input-${key}`}
          type={field.valueType === "NUMBER" ? "number" : "text"}
          value={roomValues[key] ?? ""}
          onChange={(e) => onRoomValueChange(scope, field.fieldName, e.target.value)}
        />
      </div>
    );
  }

  const generalFields = hideBathroomFields
    ? roomFields.filter((f) => !BATHROOM_FIELDS.has(f.fieldName))
    : bathroomOnly
      ? roomFields.filter((f) => BATHROOM_FIELDS.has(f.fieldName))
      : roomFields.filter((f) => !BATHROOM_FIELDS.has(f.fieldName));
  const bathroomFields =
    hideBathroomFields || bathroomOnly
      ? []
      : roomFields.filter((f) => BATHROOM_FIELDS.has(f.fieldName));
  const fieldsForType = bathroomOnly
    ? roomFields.filter((f) => BATHROOM_FIELDS.has(f.fieldName))
    : [...generalFields, ...bathroomFields];

  function renderTypeFields(typeId: string, scope: string, typePhotos: AuditPhotoInput[]) {
    return (
      <div className="fk-room-type-fields">
        {!bathroomOnly && (
          <>
            <label htmlFor={`desc-${typeId}`} style={{ fontSize: 13 }}>
              {t("ui.roomDescription")}
            </label>
            <textarea
              id={`desc-${typeId}`}
              placeholder={t("ui.roomDescPlaceholder")}
              value={roomDescriptions[typeId] ?? ""}
              onChange={(e) => onRoomDescriptionChange(typeId, e.target.value)}
            />
          </>
        )}

        {(bathroomOnly ? fieldsForType : generalFields).map((field) =>
          renderRoomField ? renderRoomField(field, scope) : renderDefaultField(field, scope)
        )}

        {!bathroomOnly && bathroomFields.length > 0 && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 8 }}>
              {t("ui.roomBathroomSection")}
            </p>
            {bathroomFields.map((field) =>
              renderRoomField ? renderRoomField(field, scope) : renderDefaultField(field, scope)
            )}
          </>
        )}

        {onRoomPhotosChange && !bathroomOnly && (
          <div style={{ marginTop: 12 }}>
            <ExistingStepPhotos photos={photosForRoomScope(existingPhotos, roomScopeKey(typeId))} />
            <label htmlFor={`photos-${typeId}`} style={{ fontSize: 13, fontWeight: 600 }}>
              {t("ui.auditStepPhotos")}
            </label>
            <p className="existing-data-panel-hint" style={{ marginTop: 4 }}>
              {t("ui.auditStepPhotosHint")}
            </p>
            <AuditPhotoGallery
              photos={typePhotos}
              onChange={(photos) =>
                onRoomPhotosChange(
                  typeId,
                  photos.map((p) => ({
                    ...p,
                    fieldName: undefined,
                    scopeKey: roomScopeKey(typeId),
                  }))
                )
              }
              photoLabel={photoLabel ?? t("ui.auditStepPhotos")}
              removePhotoLabel={removePhotoLabel ?? t("ui.removePhoto")}
              closePhotoLabel={closePhotoLabel ?? t("ui.closePhoto")}
              prevPhotoLabel={prevPhotoLabel ?? t("ui.photoPrev")}
              nextPhotoLabel={nextPhotoLabel ?? t("ui.photoNext")}
              maxPhotos={MAX_AUDIT_PHOTOS}
              totalPhotoCount={totalPhotoCount}
              onAddFiles={(files) => handlePhotoAdd(typeId, files)}
              inputId={`photos-${typeId}`}
              showFileInput
            />
          </div>
        )}
      </div>
    );
  }

  const customChips = [
    ...knownCustomTypes,
    ...selectedTypes.filter((id) => !isStandardRoomType(id)),
  ].filter((id, index, all) => all.indexOf(id) === index);

  return (
    <div>
      {showTypePicker && (
        <>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 12 }}>
            {t("ui.roomTypesOnProperty")}
          </p>

          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="wt-sr-only">{t("ui.roomTypesOnProperty")}</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STANDARD_ROOM_TYPES.map((typeId) => (
                <button
                  key={typeId}
                  type="button"
                  onClick={() => toggleType(typeId)}
                  aria-pressed={selectedTypes.includes(typeId)}
                  className={`fk-room-type-chip${selectedTypes.includes(typeId) ? " fk-room-type-chip--active" : ""}`}
                >
                  {getRoomTypeLabel(typeId, locale)}
                </button>
              ))}
              {customChips.map((typeId) => {
                const selected = selectedTypes.includes(typeId);
                return (
                  <button
                    key={typeId}
                    type="button"
                    onClick={() => toggleType(typeId)}
                    aria-pressed={selected}
                    className={`fk-room-type-chip${selected ? " fk-room-type-chip--active" : ""}`}
                  >
                    {getRoomTypeLabel(typeId, locale)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="fk-custom-room-row">
            <label htmlFor="custom-room-type">{t("ui.customRoomType")}</label>
            <div className="fk-custom-room-row__inputs">
              <input
                id="custom-room-type"
                type="text"
                className="fk-custom-room-input"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomType())}
                placeholder={t("ui.customRoomTypePlaceholder")}
              />
              <button type="button" className="btn-secondary" onClick={addCustomType}>
                {t("ui.addCustomRoomType")}
              </button>
            </div>
          </div>
        </>
      )}

      {selectedTypes.map((typeId) => {
        const scope = roomScopeKey(typeId);
        const typePhotos = roomPhotos[typeId] ?? [];
        const label = getRoomTypeLabel(typeId, locale);
        const isOpen = !useCollapsible || expanded === typeId;

        return (
          <div key={typeId} className="fk-room-type-panel">
            {useCollapsible ? (
              <button
                type="button"
                className="fk-room-type-toggle"
                onClick={() => setExpanded(isOpen ? null : typeId)}
                aria-expanded={isOpen}
              >
                {label} {isOpen ? "▾" : "▸"}
              </button>
            ) : (
              <h3 className="fk-room-type-heading">{label}</h3>
            )}

            {isOpen && renderTypeFields(typeId, scope, typePhotos)}
          </div>
        );
      })}
    </div>
  );
}
