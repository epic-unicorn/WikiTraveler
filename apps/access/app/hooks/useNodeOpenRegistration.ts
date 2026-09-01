import { useEffect, useState } from "react";
import { fetchOpenRegistration } from "../lib/nodeRegistration";

/**
 * Polls the node's public registration flag when the URL changes.
 * Returns null while loading or when the node cannot be reached.
 */
export function useNodeOpenRegistration(nodeUrl: string): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    setOpen(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchOpenRegistration(nodeUrl, controller.signal).then(setOpen);
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [nodeUrl]);

  return open;
}
