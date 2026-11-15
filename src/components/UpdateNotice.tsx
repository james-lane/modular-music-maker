import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import type { OfflineState } from './OfflineDialog';

interface Props {
  offline: OfflineState;
  blockedReason: string;
  onApply: () => void;
}

export function UpdateActions({ offline, blockedReason, onApply }: Props) {
  return (
    <div className="update-actions">
      <button
        className="button primary"
        disabled={Boolean(blockedReason) || offline.applying}
        onClick={onApply}
      >
        <RefreshCw size={15} /> {offline.applying ? 'Refreshing…' : 'Refresh now'}
      </button>
      {blockedReason && <p>{blockedReason}</p>}
      {offline.updateError && <p role="alert">{offline.updateError}</p>}
    </div>
  );
}

/** A waiting release stays optional; dismissing this notice leaves it in the offline menu. */
export function UpdateNotice(props: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (!props.offline.updateReady || (dismissed && !props.offline.applying)) return null;
  return (
    <aside className="update-notice" aria-label="App update">
      <div role="status">
        <strong>Patchwork has an update</strong>
        <p>It’s downloaded and ready. Refresh to use the latest studio.</p>
      </div>
      <UpdateActions {...props} />
      {!props.offline.applying && (
        <button className="update-later" onClick={() => setDismissed(true)}>
          Later <X size={13} />
        </button>
      )}
    </aside>
  );
}
