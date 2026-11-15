import { CheckCircle2, Download, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useState } from 'react';
import type { useOffline } from '../hooks/useOffline';
import { Modal } from './Dialogs';
import { UpdateActions } from './UpdateNotice';

export type OfflineState = ReturnType<typeof useOffline>;

export function OfflineIndicator({
  offline,
  onOpen,
}: {
  offline: OfflineState;
  onOpen: () => void;
}) {
  const label = offline.updateReady
    ? 'Update ready'
    : offline.status === 'ready'
      ? offline.online
        ? 'Offline ready'
        : 'Working offline'
      : offline.status === 'preparing'
        ? 'Preparing offline…'
        : 'Use offline';
  return (
    <button className="offline-indicator" onClick={onOpen} aria-haspopup="dialog">
      {offline.status === 'ready' ? <CheckCircle2 size={12} /> : <Download size={12} />}
      <span aria-live="polite">{label}</span>
    </button>
  );
}

export function OfflineDialog({
  offline,
  onClose,
  onApply,
  blockedReason,
}: {
  offline: OfflineState;
  onClose: () => void;
  onApply: () => void;
  blockedReason: string;
}) {
  const [storageMessage, setStorageMessage] = useState('');
  const [requesting, setRequesting] = useState(false);
  const keepStorage = async () => {
    setRequesting(true);
    try {
      const granted = await navigator.storage.persist();
      setStorageMessage(
        granted
          ? 'Storage protection is enabled. Keep exports of work you want to keep permanently.'
          : 'Your browser manages storage automatically. Keep patch exports and recording downloads as backups.',
      );
    } catch {
      setStorageMessage(
        'Storage protection is unavailable. Export patches and download recordings as backups.',
      );
    } finally {
      setRequesting(false);
    }
  };
  return (
    <Modal title="Your studio, wherever you are." eyebrow="USE OFFLINE" onClose={onClose}>
      <div className={`offline-readiness ${offline.status}`} role="status">
        <WifiOff size={22} />
        <div>
          <strong>
            {offline.status === 'ready'
              ? 'Ready to use offline'
              : offline.status === 'preparing'
                ? 'Saving the studio to this device…'
                : offline.status === 'error'
                  ? 'Offline setup needs another try'
                  : 'Offline setup needs a secure, built app'}
          </strong>
          <p>
            {offline.status === 'ready'
              ? 'You can disconnect now. Instruments, examples, guides, patch saving, and recordings work on this device.'
              : offline.status === 'preparing'
                ? 'Keep this page open and stay connected until the studio is ready.'
                : offline.status === 'error'
                  ? 'Reconnect and try again. Check that this browser allows website storage.'
                  : 'Open the hosted app over HTTPS. For local testing, use the production preview on localhost; development mode does not save an offline copy.'}
          </p>
        </div>
      </div>
      {offline.status === 'error' && (
        <button className="button" onClick={offline.retry}>
          <RefreshCw size={15} /> Try offline setup again
        </button>
      )}
      <section className="offline-update">
        <h3>{offline.updateReady ? 'An update is ready' : 'App updates'}</h3>
        {offline.updateReady ? (
          <>
            <p>
              Refresh here to use it, including from a home-screen app. Your saved patches and takes
              stay on this device.
            </p>
            <UpdateActions offline={offline} blockedReason={blockedReason} onApply={onApply} />
          </>
        ) : (
          <p>
            Updates download when connected. You choose when to refresh; playback and recording are
            never interrupted automatically.
          </p>
        )}
        <button
          className="button"
          disabled={
            !offline.online ||
            offline.status === 'unavailable' ||
            offline.checking === 'checking' ||
            offline.applying
          }
          onClick={() => void offline.checkUpdates()}
        >
          <RefreshCw size={15} />{' '}
          {offline.checking === 'checking' ? 'Checking for updates…' : 'Check for updates'}
        </button>
        <p role="status">
          {!offline.online
            ? 'Reconnect to check for updates.'
            : offline.checking === 'error'
              ? 'Could not download an update. Your current studio is still available; try again when connected.'
              : offline.checking === 'current' && !offline.updateReady
                ? 'You’re using the latest available version.'
                : ''}
        </p>
      </section>
      <div className="offline-instructions">
        <section>
          <h3>On iPad or iPhone</h3>
          <p>
            Open Patchwork in Safari, tap <strong>Share → Add to Home Screen</strong>, then tap{' '}
            <strong>Add</strong>. Leave <strong>Open as Web App</strong> on if shown. Open the new
            home-screen icon while connected and wait for <strong>Offline ready</strong> before
            using Airplane Mode.
          </p>
        </section>
        <section>
          <h3>On desktop or Android</h3>
          <p>
            Use your browser’s <strong>Install app</strong>, <strong>Add to Home Screen</strong>, or{' '}
            <strong>Add to Dock</strong> option. The browser tab also works offline once ready.
          </p>
        </section>
        <section>
          <h3>Keep your work with you</h3>
          <p>
            Patches and takes stay on this device. Export patches and download recordings for a
            backup or to move them between devices. A home-screen app may have a separate library
            from the browser tab. Clearing website data removes both saves and the offline copy.
          </p>
          {typeof navigator.storage?.persist === 'function' && (
            <button className="button" onClick={() => void keepStorage()} disabled={requesting}>
              <ShieldCheck size={15} />{' '}
              {requesting ? 'Checking storage…' : 'Protect device storage'}
            </button>
          )}
          {storageMessage && <p role="status">{storageMessage}</p>}
        </section>
      </div>
      <p className="dialog-footnote">
        You can also close every Patchwork window and reopen to apply a downloaded update. Keep the
        app open while playing or recording; iPadOS can pause audio in the background.
      </p>
    </Modal>
  );
}
