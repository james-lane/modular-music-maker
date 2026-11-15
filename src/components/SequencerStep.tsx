import { useRef, type PointerEvent } from 'react';
import { CONFIG } from '../config';
import { SEQUENCER_DEGREES } from '../domain/modules';

export type StepNoteChange = number | 'next';

/** Keep the native button's tap/keyboard activation, but consume the click after a swipe. */
export function SequencerStep({
  degree,
  index,
  label,
  active,
  onChange,
}: {
  degree: number;
  index: number;
  label: string;
  active: boolean;
  onChange: (degree: StepNoteChange, group?: string) => void;
}) {
  const drag = useRef<{
    pointerId: number;
    startY: number;
    degree: number;
    lastDegree: number;
    moved: boolean;
    group: string;
  } | null>(null);
  const suppressClick = useRef(false);

  const cancelDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    suppressClick.current = true;
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = gesture.startY - event.clientY;
    if (Math.abs(distance) >= CONFIG.sequencerGesture.dragThresholdPx) gesture.moved = true;
    if (!gesture.moved) return;

    const sensitivity = event.shiftKey
      ? CONFIG.sequencerGesture.finePixelsPerDegree
      : CONFIG.sequencerGesture.pixelsPerDegree;
    const offset = Math.sign(distance) * Math.round(Math.abs(distance) / sensitivity);
    const next = Math.max(
      SEQUENCER_DEGREES.rest,
      Math.min(SEQUENCER_DEGREES.max, gesture.degree + offset),
    );
    if (next !== gesture.lastDegree) {
      gesture.lastDegree = next;
      onChange(next, gesture.group);
    }
  };

  return (
    <button
      className={`step-button ${active ? 'active' : ''} ${degree < 0 ? 'rest' : ''}`}
      title={`Step ${index + 1}: ${label}. Tap to cycle; drag up/down or use arrow keys to adjust; right-click for a rest. Hold Shift for finer dragging.`}
      aria-label={`Step ${index + 1}: ${label}`}
      onPointerDown={(event) => {
        if (event.button !== 0 || drag.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        suppressClick.current = false;
        drag.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          degree,
          lastDegree: degree,
          moved: false,
          // Every swipe has its own undo group, even when editing the same step twice.
          group: `${event.pointerId}:${event.timeStamp}`,
        };
      }}
      onPointerMove={move}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        move(event);
        suppressClick.current = drag.current.moved;
        drag.current = null;
      }}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
      onClick={(event) => {
        // Keyboard and assistive-technology clicks have no pointer click count.
        if (event.detail !== 0 && suppressClick.current) {
          event.preventDefault();
          return;
        }
        onChange('next');
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        cancelDrag();
        onChange(SEQUENCER_DEGREES.rest);
      }}
      onKeyDown={(event) => {
        const direction = ['ArrowUp', 'ArrowRight'].includes(event.key)
          ? 1
          : ['ArrowDown', 'ArrowLeft'].includes(event.key)
            ? -1
            : 0;
        if (direction) {
          event.preventDefault();
          onChange(
            Math.max(SEQUENCER_DEGREES.rest, Math.min(SEQUENCER_DEGREES.max, degree + direction)),
          );
        }
      }}
    >
      <i />
      <strong>{label}</strong>
      <span>{String(index + 1).padStart(2, '0')}</span>
    </button>
  );
}
