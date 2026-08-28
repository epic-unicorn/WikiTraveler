"use client";

import { useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { PhotoLightbox } from "./PhotoLightbox";

export type ExistingStepPhoto = {
  url: string;
  caption?: string | null;
};

interface Props {
  photos: ExistingStepPhoto[];
}

export function ExistingStepPhotos({ photos }: Props) {
  const { t } = useLocale();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (photos.length === 0) return null;

  const label = t("ui.auditExistingPhotos");

  return (
    <div className="audit-existing-photos">
      <p className="audit-existing-photos__title">{label}</p>
      <p className="existing-data-panel-hint">{t("ui.auditExistingPhotosHint")}</p>
      <div className="audit-photo-strip" aria-label={label}>
        {photos.map((photo, index) => (
          <div key={`${photo.url}-${index}`} className="audit-photo-tile">
            <button
              type="button"
              className="audit-photo-tile__thumb"
              onClick={() => setLightboxIndex(index)}
              aria-label={t("ui.propertyOpenPhoto")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? ""} />
            </button>
          </div>
        ))}
      </div>
      <PhotoLightbox
        photos={photos.map((p, i) => ({
          url: p.url,
          caption: p.caption ?? null,
          alt: `${label} ${i + 1}`,
        }))}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
        closeLabel={t("ui.closePhoto")}
        prevLabel={t("ui.photoPrev")}
        nextLabel={t("ui.photoNext")}
      />
    </div>
  );
}
