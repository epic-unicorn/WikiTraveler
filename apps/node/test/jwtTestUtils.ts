/** Build a minimal three-part JWT for role-decode tests (signature is not verified). */
export function fakeJwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${body}.signature`;
}
