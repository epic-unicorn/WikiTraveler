export function factRowKey(fieldName: string, scopeKey = "property"): string {
  return `${scopeKey}::${fieldName}`;
}

export function parseFactRowKey(key: string): { scopeKey: string; fieldName: string } {
  const sep = key.indexOf("::");
  if (sep < 0) return { scopeKey: "property", fieldName: key };
  return { scopeKey: key.slice(0, sep), fieldName: key.slice(sep + 2) };
}
