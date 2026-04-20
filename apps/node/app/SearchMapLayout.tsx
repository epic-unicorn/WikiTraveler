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

  return (
    <>
      {propertyCount > 0 && (
        <div style={{ marginBottom: 32 }}>
          <MapView focusPins={focusPins} />
        </div>
      )}
      <SearchSection onResults={setFocusPins} />
    </>
  );
}
