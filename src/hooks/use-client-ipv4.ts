import { useCallback, useRef } from "react";

const ENDPOINT = "https://api.ipify.org?format=json";
const TIMEOUT_MS = 1500;

/**
 * Fetches the visitor's IPv4 from an IPv4-only endpoint.
 * - No call on page load.
 * - `trigger()` starts the fetch once (call on first form interaction).
 * - `getIpv4()` ensures the fetch ran and resolves with the value (or "").
 * Non-blocking: failures/timeouts resolve to "".
 */
export function useClientIpv4() {
  const valueRef = useRef("");
  const inFlightRef = useRef<Promise<string> | null>(null);

  const trigger = useCallback((): Promise<string> => {
    if (inFlightRef.current) return inFlightRef.current;
    const p = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(ENDPOINT, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data?.ip) valueRef.current = String(data.ip);
        }
      } catch {
        /* ignore — IPv4 may be unavailable (timeout / IPv6-only) */
      } finally {
        clearTimeout(timer);
      }
      return valueRef.current;
    })();
    inFlightRef.current = p;
    return p;
  }, []);

  const getIpv4 = useCallback(async (): Promise<string> => {
    if (valueRef.current) return valueRef.current;
    return trigger();
  }, [trigger]);

  return { trigger, getIpv4 };
}

export default useClientIpv4;