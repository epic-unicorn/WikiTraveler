"use client";

import { useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { STANDARD_ROOM_TYPES, roomScopeKey, getRoomTypeLabel } from "@wikitraveler/i18n";

export interface RoomFieldDef {
  fieldName: string;
  label: string;
  valueType: string;
  unit?: string | null;
}

interface Props {
  roomFields: RoomFieldDef[];
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  roomValues: Record<string, string>;
  onRoomValueChange: (scopeKey: string, fieldName: string, value: string) => void;
  roomDescriptions: Record<string, string>;
  onRoomDescriptionChange: (roomType: string, value: string) => void;
}

export function RoomAuditSection({
  roomFields,
  selectedTypes,
  onTypesChange,
  roomValues,
  onRoomValueChange,
  roomDescriptions,
  onRoomDescriptionChange,
}: Props) {
  const { locale, t } = useLocale();
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleType(typeId: string) {
    if (selectedTypes.includes(typeId)) {
      onTypesChange(selectedTypes.filter((type) => type !== typeId));
    } else {
      onTypesChange([...selectedTypes, typeId]);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t("ui.roomsSection")}</h2>
      <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 12 }}>
        {t("ui.roomTypesOnProperty")}
      </p>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          {t("ui.roomTypesOnProperty")}
        </legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {STANDARD_ROOM_TYPES.map((typeId) => (
            <button
              key={typeId}
              type="button"
              onClick={() => toggleType(typeId)}
              aria-pressed={selectedTypes.includes(typeId)}
              style={{
                borderRadius: 20,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid var(--wt-border)",
                background: selectedTypes.includes(typeId) ? "var(--wt-primary)" : "var(--wt-bg-elevated)",
                color: selectedTypes.includes(typeId) ? "var(--wt-primary-contrast)" : "var(--wt-text)",
              }}
            >
              {getRoomTypeLabel(typeId, locale)}
            </button>
          ))}
        </div>
      </fieldset>

      {selectedTypes.map((typeId) => {
        const scope = roomScopeKey(typeId);
        const isOpen = expanded === typeId;
        return (
          <div key={typeId} style={{ marginTop: 12, borderTop: "1px solid var(--wt-border)", paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : typeId)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                color: "var(--wt-text)",
                padding: "4px 0",
              }}
            >
              {getRoomTypeLabel(typeId, locale)} {isOpen ? "▾" : "▸"}
            </button>

            {isOpen && (
              <div style={{ marginTop: 8 }}>
                <label htmlFor={`desc-${typeId}`} style={{ fontSize: 13 }}>
                  {t("ui.roomDescription")}
                </label>
                <textarea
                  id={`desc-${typeId}`}
                  placeholder={t("ui.roomDescPlaceholder")}
                  value={roomDescriptions[typeId] ?? ""}
                  onChange={(e) => onRoomDescriptionChange(typeId, e.target.value)}
                />

                {roomFields.map((field) => {
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
                          <span style={{ fontWeight: 400, color: "var(--wt-text-muted)" }}>
                            {" "}({field.unit})
                          </span>
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
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
