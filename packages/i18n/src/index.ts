import en from "./locales/en.json";
import nl from "./locales/nl.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";

export type Locale = "en" | "nl" | "de" | "fr";

export const SUPPORTED_LOCALES: Locale[] = ["en", "nl", "de", "fr"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "wt_locale";
export const MAX_AUDIT_PHOTOS = 8;
export const AI_VISION_PHOTO_BUDGET = 3;


export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
  de: "Deutsch",
  fr: "Français",
};

type Catalog = typeof en;
type CatalogInput = {
  fields: Partial<Catalog["fields"]> & Record<string, string>;
  tier: Partial<Catalog["tier"]> & Record<string, string>;
  source: Partial<Catalog["source"]> & Record<string, string>;
  roomTypes: Partial<Catalog["roomTypes"]> & Record<string, string>;
  photoSlots: Partial<Catalog["photoSlots"]> & Record<string, string>;
  ui: Partial<Catalog["ui"]> & Record<string, string>;
};

const localeInputs: Record<Locale, CatalogInput> = { en, nl, de, fr };

function mergeCatalog(primary: CatalogInput, fallback: Catalog): Catalog {
  return {
    fields: { ...fallback.fields, ...primary.fields },
    tier: { ...fallback.tier, ...primary.tier },
    source: { ...fallback.source, ...primary.source },
    roomTypes: { ...fallback.roomTypes, ...primary.roomTypes },
    photoSlots: { ...fallback.photoSlots, ...primary.photoSlots },
    ui: { ...fallback.ui, ...primary.ui },
  };
}

function getCatalog(locale: string): Catalog {
  const loc = locale as Locale;
  const primary = localeInputs[loc];
  if (!primary || loc === "en") return en;
  return mergeCatalog(primary, en);
}

/** Resolve locale from user preference, Accept-Language, node default, or fallback. */
export function resolveLocale(
  options: {
    stored?: string | null;
    acceptLanguage?: string | null;
    nodeDefault?: string | null;
  } = {}
): Locale {
  const { stored, acceptLanguage, nodeDefault } = options;
  if (stored && isSupportedLocale(stored)) return stored;
  if (acceptLanguage) {
    const preferred = parseAcceptLanguage(acceptLanguage);
    if (preferred) return preferred;
  }
  if (nodeDefault && isSupportedLocale(nodeDefault)) return nodeDefault;
  return DEFAULT_LOCALE;
}

export function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function parseAcceptLanguage(header: string): Locale | null {
  const parts = header.split(",").map((p) => p.trim().split(";")[0]?.toLowerCase());
  for (const part of parts) {
    if (!part) continue;
    if (isSupportedLocale(part)) return part;
    const base = part.split("-")[0];
    if (base && isSupportedLocale(base)) return base;
  }
  return null;
}

/** Dot-path translation lookup with optional `{param}` interpolation. */
export function t(key: string, locale: string = DEFAULT_LOCALE, params?: Record<string, string | number>): string {
  const catalog = getCatalog(locale);
  const parts = key.split(".");
  let current: unknown = catalog;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== "string") return key;
  if (!params) return current;
  return current.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function getFieldLabel(fieldName: string, locale: string = DEFAULT_LOCALE): string {
  const label = getCatalog(locale).fields[fieldName as keyof Catalog["fields"]];
  if (label) return label;
  return fieldName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getTierLabel(tier: string, locale: string = DEFAULT_LOCALE): string {
  return getCatalog(locale).tier[tier as keyof Catalog["tier"]] ?? tier;
}

export function getSourceLabel(source: string, locale: string = DEFAULT_LOCALE): string {
  return getCatalog(locale).source[source as keyof Catalog["source"]] ?? source;
}

export function getRoomTypeLabel(roomType: string, locale: string = DEFAULT_LOCALE): string {
  return getCatalog(locale).roomTypes[roomType as keyof Catalog["roomTypes"]] ?? roomType.replace(/_/g, " ");
}

export function getPhotoSlotLabel(slot: string, locale: string = DEFAULT_LOCALE): string {
  return getCatalog(locale).photoSlots[slot as keyof Catalog["photoSlots"]] ?? slot;
}

export const STANDARD_ROOM_TYPES = [
  "double",
  "twin",
  "single",
  "accessible_king",
  "accessible_queen",
  "suite",
  "family",
] as const;

export type RoomTypeId = (typeof STANDARD_ROOM_TYPES)[number];

export function roomScopeKey(roomTypeId: string): string {
  return `room-type:${roomTypeId}`;
}

export function parseRoomScopeKey(scopeKey: string): string | null {
  if (!scopeKey.startsWith("room-type:")) return null;
  return scopeKey.slice("room-type:".length);
}

export interface CompressedPhoto {
  dataUri: string;
  width: number;
  height: number;
}

/** Client-side resize: max edge 1920px, JPEG ~85% quality. */
export async function compressPhoto(
  file: File | Blob,
  maxEdge = 1920,
  quality = 0.85
): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUri = canvas.toDataURL("image/jpeg", quality);
  return { dataUri, width, height };
}

export interface AuditPhotoInput {
  dataUri: string;
  caption?: string;
  fieldName?: string;
  scopeKey?: string;
  width?: number;
  height?: number;
}

export interface AuditPhotoDisplay {
  id?: string;
  url: string;
  caption?: string | null;
  fieldName?: string | null;
  scopeKey?: string | null;
  width?: number | null;
  height?: number | null;
}
