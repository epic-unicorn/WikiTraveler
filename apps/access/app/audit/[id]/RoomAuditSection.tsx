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
  roomValues: Record<string, string>;
  onRoomValueChange: (scopeKey: string, fieldName: string, value: string) => void;
  roomDescriptions: Record<string, string>;
  onRoomDescriptionChange: (roomType: string, value: string) => void;
  accessibleRoomCount?: string;
  onAccessibleRoomCountChange?: (value: string) => void;
  accessibleRoomCountLabel?: string;
  roomPhotos?: Record<string, AuditPhotoInput[]>;
  onRoomPhotosChange?: (typeId: string, photos: AuditPhotoInput[]) => void;
  totalPhotoCount?: number;
  renderRoomField?: (field: RoomFieldDef, scopeKey: string) => React.ReactNode;
}

export function RoomAuditSection({
  roomFields,
  selectedTypes,
  onTypesChange,
  roomValues,
  onRoomValueChange,
  roomDescriptions,
  onRoomDescriptionChange,
  accessibleRoomCount,
  onAccessibleRoomCountChange,
  accessibleRoomCountLabel,
  roomPhotos = {},
  onRoomPhotosChange,
  totalPhotoCount = 0,
  renderRoomField,
}: Props) {
  const { locale, t } = useLocale();
  const [expanded, setExpanded] = useState<string | null>(null);
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

  async function handlePhotoAdd(typeId: string, e: React.ChangeEvent<HTMLInputElement>) {
    if (!onRoomPhotosChange) return;
    const remaining = MAX_AUDIT_PHOTOS - totalPhotoCount;
    if (remaining <= 0) return;
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    const compressed = await Promise.all(files.map((f) => compressPhoto(f)));
    const next = [
      ...(roomPhotos[typeId] ?? []),
      ...compressed.map((c) => ({
        dataUri: c.dataUri,
        width: c.width,
        height: c.height,
        scopeKey: roomScopeKey(typeId),
      })),
    ];
    onRoomPhotosChange(typeId, next);
    e.target.value = "";
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

  const generalFields = roomFields.filter((f) => !BATHROOM_FIELDS.has(f.fieldName));
  const bathroomFields = roomFields.filter((f) => BATHROOM_FIELDS.has(f.fieldName));

  function renderTypeFields(typeId: string, scope: string, typePhotos: AuditPhotoInput[]) {
    return (
      <div className="fk-room-type-fields">
        <label htmlFor={`desc-${typeId}`} style={{ fontSize: 13 }}>
          {t("ui.roomDescription")}
        </label>
        <textarea
          id={`desc-${typeId}`}
          placeholder={t("ui.roomDescPlaceholder")}
          value={roomDescriptions[typeId] ?? ""}
          onChange={(e) => onRoomDescriptionChange(typeId, e.target.value)}
        />

        {generalFields.map((field) =>
          renderRoomField ? renderRoomField(field, scope) : renderDefaultField(field, scope)
        )}

        {bathroomFields.length > 0 && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 8 }}>
              {t("ui.roomBathroomSection")}
            </p>
            {bathroomFields.map((field) =>
              renderRoomField ? renderRoomField(field, scope) : renderDefaultField(field, scope)
            )}
          </>
        )}

        {onRoomPhotosChange && (
          <div style={{ marginTop: 12 }}>
            <label htmlFor={`photos-${typeId}`} style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>
              {t("ui.roomPhotos")}
            </label>
            {typePhotos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {typePhotos.map((photo, index) => (
                  <div key={index} style={{ position: "relative" }}>
                    <img
                      src={photo.dataUri}
                      alt=""
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }}
                    />
                    <button
                      type="button"
                      aria-label={t("ui.removePhoto")}
                      onClick={() =>
                        onRoomPhotosChange(
                          typeId,
                          typePhotos.filter((_, i) => i !== index)
                        )
                      }
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
                id={`photos-${typeId}`}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={(e) => handlePhotoAdd(typeId, e)}
                style={{ marginTop: 8 }}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
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
        </div>
      </fieldset>

      {onAccessibleRoomCountChange && accessibleRoomCountLabel && (
        <div style={{ marginTop: 16 }}>
          <label htmlFor="accessible-room-count">{accessibleRoomCountLabel}</label>
          <input
            id="accessible-room-count"
            type="number"
            min={0}
            value={accessibleRoomCount ?? ""}
            onChange={(e) => onAccessibleRoomCountChange(e.target.value)}
          />
        </div>
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
