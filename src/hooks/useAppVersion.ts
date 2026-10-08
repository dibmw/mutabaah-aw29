import { useCallback, useEffect, useRef, useState } from 'react';

interface VersionPayload {
  version?: string;
  buildTime?: string;
}

function runningVersion(): string {
  try {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  } catch {
    return 'dev';
  }
}

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as VersionPayload;
    return data.version || null;
  } catch {
    return null; // offline / gagal -> fail silent
  }
}

export function useAppVersion(checkIntervalMs: number = 60 * 60 * 1000) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const lastCheckRef = useRef(0);

  const check = useCallback(async () => {
    const now = Date.now();
    // throttle 60 detik agar event focus beruntun tidak spam request
    if (now - lastCheckRef.current < 60 * 1000) return;
    lastCheckRef.current = now;
    const server = await fetchServerVersion();
    if (!server) return;
    setServerVersion(server);
    if (server !== runningVersion()) {
      setUpdateAvailable(true);
    }
  }, []);

  useEffect(() => {
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const onFocus = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => void check(), checkIntervalMs);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [check, checkIntervalMs]);

  const dismiss = useCallback(() => setUpdateAvailable(false), []);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  return { updateAvailable, serverVersion, runningVersion: runningVersion(), check, dismiss, reload };
}
