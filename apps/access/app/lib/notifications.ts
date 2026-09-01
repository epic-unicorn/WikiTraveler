import { isStringArray, readUserScoped, writeUserScoped } from "./userScopedStorage";

const STORAGE_KEY = "wt_dismissed_notifications";

export function readDismissedNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  return new Set(readUserScoped<string[]>(STORAGE_KEY, [], isStringArray));
}

export function dismissNotification(id: string): void {
  if (typeof window === "undefined") return;
  const next = readDismissedNotificationIds();
  next.add(id);
  writeUserScoped(STORAGE_KEY, [...next]);
}
