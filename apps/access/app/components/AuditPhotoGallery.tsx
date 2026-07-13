"use client";

import { useState } from "react";
import type { AuditPhotoInput } from "@wikitraveler/i18n";
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

  return (
    <>
      {photos.length > 0 ? (
        <div className="audit-photo-gallery">
          {photos.map((photo, index) => (
            <div key={index} className="audit-photo-card audit-photo-card--simple">
              <button
                type="button"
                className="audit-photo-card-thumb"
                onClick={() => setLightboxIndex(index)}
                aria-label={`${photoLabel} ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.dataUri} alt="" />
              </button>
              <button
                type="button"
                className="audit-photo-card-remove"
                aria-label={removePhotoLabel}
                onClick={() => onChange(photos.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {showFileInput && onAddFiles && !atCap ? (
        <input
          id={inputId}
          className="audit-photo-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) void onAddFiles(e.target.files);
            e.target.value = "";
          }}
        />
      ) : null}

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
