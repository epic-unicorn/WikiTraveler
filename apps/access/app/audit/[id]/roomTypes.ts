import { STANDARD_ROOM_TYPES } from "@wikitraveler/i18n";

export function isStandardRoomType(id: string): boolean {
  return (STANDARD_ROOM_TYPES as readonly string[]).includes(id);
}

/** Custom chips stay visible after deselect; merge ids from facts, draft, and this session. */
export function mergeKnownCustomRoomTypes(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const id of list) {
      const trimmed = id.trim();
      if (!trimmed || isStandardRoomType(trimmed) || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}
