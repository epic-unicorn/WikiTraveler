export function decodeAuthCookie(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}
