"use client";

import { useEffect } from "react";

export type LightboxPhoto = {
  url: string;
  caption?: string | null;
  alt?: string;
};

interface Props {
  photos: LightboxPhoto[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  closeLabel: string;
  prevLabel: string;
  nextLabel: string;
}

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  closeLabel,
  prevLabel,
  nextLabel,
}: Props) {
  const open = index != null && index >= 0 && index < photos.length;
  const current = open ? photos[index!] : null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index != null && index > 0) onNavigate(index - 1);
      if (e.key === "ArrowRight" && index != null && index < photos.length - 1) {
        onNavigate(index + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onClose, onNavigate]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !current) return null;

  return (
    <div
      className="wt-photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={current.alt ?? closeLabel}
      onClick={onClose}
    >
      <button type="button" className="wt-photo-lightbox-close" onClick={onClose} aria-label={closeLabel}>
        ×
      </button>
      {index! > 0 ? (
        <button
          type="button"
          className="wt-photo-lightbox-nav wt-photo-lightbox-prev"
          aria-label={prevLabel}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index! - 1);
          }}
        >
          ‹
        </button>
      ) : null}
      {index! < photos.length - 1 ? (
        <button
          type="button"
          className="wt-photo-lightbox-nav wt-photo-lightbox-next"
          aria-label={nextLabel}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index! + 1);
          }}
        >
          ›
        </button>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.alt ?? ""}
        className="wt-photo-lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
      {current.caption ? <p className="wt-photo-lightbox-caption">{current.caption}</p> : null}
    </div>
  );
}
