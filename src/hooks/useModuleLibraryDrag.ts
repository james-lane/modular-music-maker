import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { CONFIG } from '../config';
import type { ModuleType } from '../domain/types';

/** Screen coordinates stay outside patch data; Workspace owns zoom and rack placement. */
export interface ModuleLibraryDrag {
  type: ModuleType;
  clientX: number;
  clientY: number;
  released: boolean;
}

export function useModuleLibraryDrag(
  onChange: (drag: ModuleLibraryDrag | null) => void,
  open: boolean,
) {
  const gesture = useRef<{
    type: ModuleType;
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const latestChange = useRef(onChange);
  latestChange.current = onChange;
  const suppressClick = useRef(false);
  const cancel = () => {
    gesture.current = null;
    latestChange.current(null);
  };

  useEffect(() => {
    if (!open) cancel();
  }, [open]);

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) cancel();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    // Capture before the drawer handles Escape and stops propagation.
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('keydown', escape, true);
    };
  }, []);

  return {
    start: (event: PointerEvent<HTMLDivElement>, type: ModuleType) => {
      // Rows scroll normally on touch screens; only the grip takes ownership of a swipe.
      if (
        !event.isPrimary ||
        event.button !== 0 ||
        (event.target as Element).closest('button') ||
        (event.pointerType !== 'mouse' &&
          !(event.target as Element).closest('.library-drag-handle'))
      )
        return;
      suppressClick.current = false;
      gesture.current = {
        type,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    move: (event: PointerEvent<HTMLDivElement>) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (
        !current.dragging &&
        Math.hypot(event.clientX - current.startX, event.clientY - current.startY) <
          CONFIG.moduleLibrary.dragThresholdPx
      )
        return;
      current.dragging = true;
      suppressClick.current = true;
      onChange({
        type: current.type,
        clientX: event.clientX,
        clientY: event.clientY,
        released: false,
      });
    },
    end: (event: PointerEvent<HTMLDivElement>) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      // Clear before lostpointercapture: a successful release must not cancel its pending drop.
      gesture.current = null;
      if (current.dragging)
        onChange({
          type: current.type,
          clientX: event.clientX,
          clientY: event.clientY,
          released: true,
        });
    },
    cancel: (event: PointerEvent<HTMLDivElement>) => {
      if (gesture.current?.pointerId === event.pointerId) cancel();
    },
    click: (event: MouseEvent<HTMLDivElement>) => {
      if (!suppressClick.current || (event.target as Element).closest('button')) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
