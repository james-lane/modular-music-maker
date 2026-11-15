import { useEffect, useState } from 'react';
import { CONFIG } from '../config';

export type OfflineStatus = 'preparing' | 'ready' | 'unavailable' | 'error';

function cachedRelease(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(ready);
    };
    const timer = setTimeout(() => finish(false), CONFIG.offline.statusTimeoutMs);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      finish(typeof data === 'object' && data !== null && 'ready' in data && data.ready === true);
    };
    try {
      worker.postMessage({ type: 'PATCHWORK_OFFLINE_STATUS' }, [channel.port2]);
    } catch {
      // The browser may retire a worker while a closed window is being restored.
      finish(false);
    }
  });
}

/** App caching is independent of patches/audio. Updates never reload a running studio. */
export function useOffline() {
  const supported = import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator;
  const [status, setStatus] = useState<OfflineStatus>(supported ? 'preparing' : 'unavailable');
  const [online, setOnline] = useState(navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const connectionChanged = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) setAttempt((value) => value + 1);
    };
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    return () => {
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
    };
  }, []);

  useEffect(() => {
    if (!supported) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const inspect = async (registration: ServiceWorkerRegistration) => {
      if (disposed) return;
      setUpdateReady(Boolean(registration.waiting));
      if (registration.active) {
        const ready = await cachedRelease(registration.active);
        if (!disposed) setStatus(ready ? 'ready' : 'error');
      }
    };
    const watch = (registration: ServiceWorkerRegistration) => {
      const watchInstalling = () => {
        const worker = registration.installing;
        if (!worker) return;
        const changed = () => {
          if (worker.state === 'redundant' && !registration.active && !disposed) setStatus('error');
          void inspect(registration);
        };
        worker.addEventListener('statechange', changed);
        cleanups.push(() => worker.removeEventListener('statechange', changed));
      };
      registration.addEventListener('updatefound', watchInstalling);
      cleanups.push(() => registration.removeEventListener('updatefound', watchInstalling));
      watchInstalling();
      void inspect(registration);
    };
    void (async () => {
      // An already installed release can confirm readiness even with no network.
      const existing = await navigator.serviceWorker.getRegistration('/');
      if (existing) await inspect(existing);
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      if (!disposed) watch(registration);
    })().catch(() => {
      if (!disposed) setStatus((current) => (current === 'ready' ? current : 'error'));
    });
    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [attempt, supported]);

  return {
    status,
    online,
    updateReady,
    retry: () => {
      setStatus('preparing');
      setAttempt((value) => value + 1);
    },
  };
}
