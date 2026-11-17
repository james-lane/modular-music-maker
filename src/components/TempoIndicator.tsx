import { useId } from 'react';
import { Zap } from 'lucide-react';

/** A printed metronome marking shared by the tempo control, instruments and Help. */
export function TempoSymbol() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 21 9 3h6l4 18H5Z" />
      <path d="m12 17 5-11M9 17h6m0-8 3 1" />
    </svg>
  );
}

/** An indicator, with touch/keyboard discovery, never a sync toggle or audio action. */
export function TempoIndicator({ source = 'tempo' }: { source?: 'tempo' | 'trigger' }) {
  const description = useId();
  const triggered = source === 'trigger';
  return (
    <span
      className="tempo-indicator"
      data-clock-source={source}
      role="img"
      tabIndex={0}
      aria-label={triggered ? 'Follows trigger input' : 'Follows studio tempo'}
      aria-describedby={description}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus({ preventScroll: true });
      }}
      onClick={(event) => {
        // A marking inside a label must not activate its neighbouring number/select input.
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus({ preventScroll: true });
      }}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {triggered ? <Zap size={14} aria-hidden="true" /> : <TempoSymbol />}
      <span className="tempo-indicator-tip" role="tooltip" id={description}>
        {triggered
          ? 'Hits at TRIGGER IN choose new values. Unplug the trigger cable to follow studio tempo.'
          : 'Follows the BPM setting in the top bar during playback.'}
      </span>
    </span>
  );
}
