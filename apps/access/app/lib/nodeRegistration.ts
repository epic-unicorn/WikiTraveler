import { toClientNodeUrl } from "./accessApi";
import { normalizeNodeBaseUrl } from "./safeHttpUrl";

/** Public GET /api/auth/register — whether travelers may self-register on this node. */
export async function fetchOpenRegistration(
  nodeUrl: string,
  signal?: AbortSignal
): Promise<boolean | null> {
  const cleanUrl = normalizeNodeBaseUrl(nodeUrl);
  if (!cleanUrl) return null;

  try {
    const fetchUrl = toClientNodeUrl(cleanUrl);
    const res = await fetch(`${fetchUrl}/api/auth/register`, {
      signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { openRegistration?: boolean };
    return data.openRegistration !== false;
  } catch (err) {
    if (signal?.aborted) return null;
    return null;
  }
}
