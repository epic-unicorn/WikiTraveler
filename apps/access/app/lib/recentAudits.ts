export const RECENT_AUDITS_KEY = "wt_recent_audits";

export interface RecentAuditItem {
  id: string;
  name: string;
  location: string;
  auditedAt: string;
  nodeUrl?: string;
}

export function readRecentAudits(): RecentAuditItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_AUDITS_KEY) ?? "[]") as RecentAuditItem[];
  } catch {
    return [];
  }
}

export function findRecentAudit(id: string): RecentAuditItem | undefined {
  return readRecentAudits().find((e) => e.id === id);
}

export function upsertRecentAudit(item: RecentAuditItem) {
  const existing = readRecentAudits();
  const updated = [item, ...existing.filter((e) => e.id !== item.id)].slice(0, 10);
  localStorage.setItem(RECENT_AUDITS_KEY, JSON.stringify(updated));
}

export function removeRecentAudit(id: string) {
  const updated = readRecentAudits().filter((e) => e.id !== id);
  if (updated.length === 0) localStorage.removeItem(RECENT_AUDITS_KEY);
  else localStorage.setItem(RECENT_AUDITS_KEY, JSON.stringify(updated));
}

export function clearRecentAudits() {
  localStorage.removeItem(RECENT_AUDITS_KEY);
}
