import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config';

export type OfflineStatus = 'preparing' | 'ready' | 'unavailable' | 'error';
type UpdateCheck = 'idle' | 'checking' | 'current' | 'error';

function workerRequest(worker: ServiceWorker, type: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = () => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error('The update did not respond. Try again.'));
    }, CONFIG.offline.statusTimeoutMs);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      finish();
      resolve(event.data);
    };
    try {
      worker.postMessage({ type }, [channel.port2]);
    } catch (error) {
      finish();
      reject(error);
    }
  });
}

function isReady(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'ready' in data && data.ready === true;
}

/** Caching never interrupts a session. Only a deliberate, idle-window update may reload it. */
export function useOffline() {
  const supported = import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator;
  const [status, setStatus] = useState<OfflineStatus>(supported ? 'preparing' : 'unavailable');
  const [online, setOnline] = useState(navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [checking, setChecking] = useState<UpdateCheck>('idle');
  const [applying, setApplying] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const applyingRef = useRef(false);
  const lastCheck = useRef(0);
  const checkPending = useRef(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const checkUpdates = useCallback(async (manual = true) => {
    const current = registration.current;
    if (!current || !navigator.onLine || checkPending.current) return;
    if (!manual && Date.now() - lastCheck.current < CONFIG.offline.minCheckIntervalMs) return;
    lastCheck.current = Date.now();
    checkPending.current = true;
    setChecking('checking');
    try {
      await current.update();
      // update() resolves before the release download has necessarily finished.
      const installing = current.installing;
      if (installing) {
        await new Promise<void>((resolve, reject) => {
          const finish = () => {
            clearTimeout(timer);
            installing.removeEventListener('statechange', changed);
          };
          const changed = () => {
            if (installing.state === 'installed' || installing.state === 'activated') {
              finish();
              resolve();
            } else if (installing.state === 'redundant') {
              finish();
              reject(new Error('Update download failed.'));
            }
          };
          const timer = setTimeout(() => {
            finish();
            reject(new Error('Update download timed out.'));
          }, CONFIG.offline.updateDownloadTimeoutMs);
          installing.addEventListener('statechange', changed);
          changed();
        });
      }
      setUpdateReady(Boolean(current.waiting));
      setChecking('current');
    } catch {
      // A failed update must not mark the existing offline release as unusable.
      setChecking('error');
    } finally {
      checkPending.current = false;
    }
  }, []);

  useEffect(() => {
    const connectionChanged = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        if (registration.current) void checkUpdates(false);
        else setAttempt((value) => value + 1);
      }
    };
    const visible = () => {
      if (document.visibilityState === 'visible') void checkUpdates(false);
    };
    const periodic = setInterval(visible, CONFIG.offline.updateCheckIntervalMs);
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(periodic);
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [checkUpdates]);

  useEffect(() => {
    if (!supported) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const inspect = async (current: ServiceWorkerRegistration) => {
      if (disposed) return;
      setUpdateReady(Boolean(current.waiting));
      if (current.active) {
        try {
          const ready = isReady(await workerRequest(current.active, 'PATCHWORK_OFFLINE_STATUS'));
          if (!disposed) setStatus(ready ? 'ready' : 'error');
        } catch {
          if (!disposed) setStatus((value) => (value === 'ready' ? value : 'error'));
        }
      }
    };
    const controllerChanged = () => {
      if (applyingRef.current) {
        // Other tabs never reload on controllerchange, nor does first installation.
        clearTimeout(reloadTimer.current);
        window.location.reload();
      } else if (registration.current) void inspect(registration.current);
    };
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
    const watch = (current: ServiceWorkerRegistration) => {
      registration.current = current;
      const watchInstalling = () => {
        const worker = current.installing;
        if (!worker) return;
        const changed = () => {
          if (worker.state === 'redundant' && !current.active && !disposed) setStatus('error');
          void inspect(current);
        };
        worker.addEventListener('statechange', changed);
        cleanups.push(() => worker.removeEventListener('statechange', changed));
      };
      current.addEventListener('updatefound', watchInstalling);
      cleanups.push(() => current.removeEventListener('updatefound', watchInstalling));
      watchInstalling();
      void inspect(current);
    };
    void (async () => {
      const existing = await navigator.serviceWorker.getRegistration('/');
      if (existing) await inspect(existing);
      const current = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      if (!disposed) {
        watch(current);
        void checkUpdates(false);
      }
    })().catch(() => {
      if (!disposed) setStatus((current) => (current === 'ready' ? current : 'error'));
    });
    return () => {
      disposed = true;
      clearTimeout(reloadTimer.current);
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [attempt, supported, checkUpdates]);

  const applyUpdate = async (savePatch: () => void) => {
    if (applyingRef.current) return;
    const waiting = registration.current?.waiting;
    if (!waiting) {
      setUpdateError('No update is ready yet. Check for updates again.');
      return;
    }
    setUpdateError('');
    try {
      // Flush the current edit before activation, including the autosave debounce window.
      savePatch();
    } catch {
      setUpdateError('Your patch could not be saved. Export it before refreshing.');
      return;
    }
    applyingRef.current = true;
    setApplying(true);
    const fail = (message: string) => {
      applyingRef.current = false;
      setApplying(false);
      setUpdateError(message);
      clearTimeout(reloadTimer.current);
    };
    reloadTimer.current = setTimeout(
      () => fail('The update did not finish. Try again.'),
      CONFIG.offline.activationTimeoutMs,
    );
    try {
      const reply = await workerRequest(waiting, 'PATCHWORK_APPLY_UPDATE');
      if (!isReady(reply)) {
        const otherWindows =
          typeof reply === 'object' &&
          reply !== null &&
          'reason' in reply &&
          reply.reason === 'other-windows';
        fail(
          otherWindows
            ? 'Close other Patchwork windows, then try Refresh now again.'
            : 'The update is not fully saved on this device. Reconnect and check for updates.',
        );
      }
      // controllerchange, rather than a timer, reloads only after the new worker takes over.
    } catch {
      fail('The update did not respond. Try again, or close every Patchwork window and reopen.');
    }
  };

  return {
    status,
    online,
    updateReady,
    checking,
    applying,
    updateError,
    applyUpdate,
    checkUpdates,
    retry: () => {
      setStatus('preparing');
      setAttempt((value) => value + 1);
    },
  };
}
