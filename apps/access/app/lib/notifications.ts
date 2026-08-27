const STORAGE_KEY = "wt_dismissed_notifications";

export function readDismissedNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function dismissNotification(id: string): void {
  if (typeof window === "undefined") return;
  const next = readDismissedNotificationIds();
  next.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
}
