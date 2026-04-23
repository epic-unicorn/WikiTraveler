"use client";

import { useState } from "react";
import { MapView } from "./MapView";
import { SearchSection } from "./SearchSection";

type MapPin = { id: string; name: string; lat: number; lon: number };

interface Props {
  propertyCount: number;
}

export function SearchMapLayout({ propertyCount }: Props) {
  const [focusPins, setFocusPins] = useState<MapPin[] | null>(null);
  const [auditedOnly, setAuditedOnly] = useState(false);

  return (
    <>
      {propertyCount > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              onClick={() => setAuditedOnly((v) => !v)}
              style={{
                background: auditedOnly ? "#1e3a5f" : "#f3f4f6",
                color: auditedOnly ? "#fff" : "#374151",
                border: "1px solid " + (auditedOnly ? "#1e3a5f" : "#d1d5db"),
                borderRadius: 20,
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✅ Audited only
            </button>
          </div>
          <MapView focusPins={focusPins} auditedOnly={auditedOnly} />
        </div>
      )}
      <SearchSection onResults={setFocusPins} />
    </>
  );
}
