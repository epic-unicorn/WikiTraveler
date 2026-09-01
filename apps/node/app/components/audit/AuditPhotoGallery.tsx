"use client";

import { useState } from "react";
import type { AuditPhotoInput } from "@wikitraveler/i18n";
import { useLocale } from "@wikitraveler/ui";
import { PhotoLightbox } from "./PhotoLightbox";

interface Props {
  photos: AuditPhotoInput[];
  onChange: (photos: AuditPhotoInput[]) => void;
  photoLabel: string;
  removePhotoLabel: string;
  closePhotoLabel: string;
  prevPhotoLabel: string;
  nextPhotoLabel: string;
  maxPhotos?: number;
  totalPhotoCount?: number;
  onAddFiles?: (files: FileList | File[]) => void | Promise<void>;
  inputId?: string;
  showFileInput?: boolean;
}

export function AuditPhotoGallery({
  photos,
  onChange,
  photoLabel,
  removePhotoLabel,
  closePhotoLabel,
  prevPhotoLabel,
  nextPhotoLabel,
  maxPhotos,
  totalPhotoCount,
  onAddFiles,
  inputId,
  showFileInput = false,
}: Props) {
  const { t } = useLocale();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const atCap =
    maxPhotos != null &&
    totalPhotoCount != null &&
    totalPhotoCount >= maxPhotos;

  const lightboxPhotos = photos.map((p, i) => ({
    url: p.dataUri,
    caption: p.caption ?? null,
    alt: `${photoLabel} ${i + 1}`,
  }));

  const baseId = inputId ?? "audit-photos";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) void onAddFiles?.(e.target.files);
    e.target.value = "";
  }

  return (
    <>
      <div className="audit-photo-strip" aria-label={photoLabel}>
        {photos.map((photo, index) => (
          <div key={index} className="audit-photo-tile">
            <button
              type="button"
              className="audit-photo-tile__thumb"
              onClick={() => setLightboxIndex(index)}
              aria-label={`${photoLabel} ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.dataUri} alt="" />
            </button>
            <button
              type="button"
              className="audit-photo-tile__remove"
              aria-label={removePhotoLabel}
              onClick={() => onChange(photos.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        ))}

        {showFileInput && onAddFiles && !atCap ? (
          <div className="audit-photo-add">
            <label className="audit-photo-add__btn" htmlFor={`${baseId}-gallery`}>
              <span className="audit-photo-add__plus" aria-hidden="true">
                +
              </span>
              <span>{t("ui.photoAdd")}</span>
              <input
                id={`${baseId}-gallery`}
                className="wt-sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={handleChange}
              />
            </label>
            <label className="audit-photo-add__camera" htmlFor={`${baseId}-camera`}>
              {t("ui.photoTake")}
              <input
                id={`${baseId}-camera`}
                className="wt-sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleChange}
              />
            </label>
          </div>
        ) : null}
      </div>

      <PhotoLightbox
        photos={lightboxPhotos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
        closeLabel={closePhotoLabel}
        prevLabel={prevPhotoLabel}
        nextLabel={nextPhotoLabel}
      />
    </>
  );
}
