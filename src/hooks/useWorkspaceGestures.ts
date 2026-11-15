import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { CONFIG } from '../config';
import { clampZoom, touchPair, zoomScroll, type Point } from '../components/workspace-geometry';

/** The rack owns touch navigation; browser magnification remains available outside it. */
export function useWorkspaceGestures(
  viewport: RefObject<HTMLDivElement | null>,
  cancelEdit: () => void,
) {
  const [zoom, setZoom] = useState<number>(CONFIG.canvas.defaultZoom);
  const currentZoom = useRef(zoom);
  const nextScroll = useRef<Point | null>(null);
  const touches = useRef(new Map<number, { point: Point; target: Element }>());
  const pinch = useRef<{ distance: number; zoom: number; anchor: Point } | null>(null);
  const navigating = useRef(false);
  const suppressClick = useRef(false);
  const syntheticCancel = useRef(false);

  const applyZoom = (value: number, anchor: Point, midpoint: Point) => {
    const next = clampZoom(value);
    const scroll = zoomScroll(anchor, midpoint, next);
    nextScroll.current = scroll;
    currentZoom.current = next;
    setZoom(next);
    // A clamped pinch can still pan without changing the React zoom value.
    if (next === zoom && viewport.current) {
      viewport.current.scrollTo(scroll.x, scroll.y);
      nextScroll.current = null;
    }
  };
  useLayoutEffect(() => {
    if (nextScroll.current && viewport.current) {
      viewport.current.scrollTo(nextScroll.current.x, nextScroll.current.y);
      nextScroll.current = null;
    }
  }, [zoom, viewport]);

  const zoomAt = (value: number, midpoint?: Point) => {
    const element = viewport.current;
    if (!element) return;
    const center = midpoint ?? { x: element.clientWidth / 2, y: element.clientHeight / 2 };
    applyZoom(
      value,
      {
        x: (element.scrollLeft + center.x) / currentZoom.current,
        y: (element.scrollTop + center.y) / currentZoom.current,
      },
      center,
    );
  };

  const latest = useRef({ zoomAt, cancelEdit });
  latest.current = { zoomAt, cancelEdit };

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // WebKit's gesture events and trackpad wheel zoom must not magnify the app shell.
    const preventGesture = (event: Event) => event.preventDefault();
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      latest.current.zoomAt(
        currentZoom.current * Math.exp(-event.deltaY * CONFIG.canvas.wheelZoomSpeed),
        {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        },
      );
    };
    const resetTouches = () => {
      touches.current.clear();
      pinch.current = null;
      navigating.current = false;
      latest.current.cancelEdit();
    };
    const visibility = () => {
      if (document.hidden) resetTouches();
    };
    window.addEventListener('blur', resetTouches);
    document.addEventListener('visibilitychange', visibility);
    element.addEventListener('gesturestart', preventGesture, { passive: false });
    element.addEventListener('gesturechange', preventGesture, { passive: false });
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      window.removeEventListener('blur', resetTouches);
      document.removeEventListener('visibilitychange', visibility);
      element.removeEventListener('gesturestart', preventGesture);
      element.removeEventListener('gesturechange', preventGesture);
      element.removeEventListener('wheel', wheel);
    };
  }, [viewport]);

  const localPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const points = () => [...touches.current.values()].map((touch) => touch.point);

  return {
    zoom,
    zoomAt,
    setZoom: (value: number) => {
      currentZoom.current = clampZoom(value);
      setZoom(currentZoom.current);
    },
    onPointerDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!touches.current.size) suppressClick.current = false;
      if (event.pointerType !== 'touch') return;
      touches.current.set(event.pointerId, {
        point: localPoint(event),
        target: event.target as Element,
      });
      if (touches.current.size < 2) return;
      // Two fingers on performance surfaces are musical input, including keys plus pads.
      if (
        !navigating.current &&
        [...touches.current.values()].every(({ target }) =>
          target.closest('.piano-keybed, .performance-pads'),
        )
      )
        return;
      if (!navigating.current) {
        // Cancel the first finger's knob/drag/note before navigation takes ownership.
        cancelEdit();
        for (const [id, { target }] of touches.current) {
          if (id === event.pointerId) continue;
          let owner: Element | null = target;
          while (owner && !owner.hasPointerCapture(id)) owner = owner.parentElement;
          syntheticCancel.current = true;
          (owner ?? target).dispatchEvent(
            new PointerEvent('pointercancel', {
              bubbles: true,
              pointerId: id,
              pointerType: 'touch',
            }),
          );
          syntheticCancel.current = false;
          owner?.releasePointerCapture(id);
          event.currentTarget.setPointerCapture(id);
        }
        navigating.current = true;
        suppressClick.current = true;
      }
      const pair = touchPair(points());
      pinch.current = {
        distance: pair.distance,
        zoom: currentZoom.current,
        anchor: {
          x: (event.currentTarget.scrollLeft + pair.midpoint.x) / currentZoom.current,
          y: (event.currentTarget.scrollTop + pair.midpoint.y) / currentZoom.current,
        },
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.stopPropagation();
      event.preventDefault();
    },
    onPointerMoveCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      const touch = touches.current.get(event.pointerId);
      if (touch) touch.point = localPoint(event);
      if (!navigating.current) return;
      event.stopPropagation();
      event.preventDefault();
      if (touches.current.size < 2 || !pinch.current) return;
      const pair = touchPair(points());
      applyZoom(
        (pinch.current.zoom * pair.distance) / pinch.current.distance,
        pinch.current.anchor,
        pair.midpoint,
      );
    },
    endTouch: (event: ReactPointerEvent<HTMLDivElement>) => {
      // Synthetic cancellation above belongs to the control, not the physical touch.
      if (syntheticCancel.current) return;
      touches.current.delete(event.pointerId);
      if (!navigating.current) return;
      event.stopPropagation();
      event.preventDefault();
      if (!touches.current.size) navigating.current = false;
      if (touches.current.size >= 2) {
        const pair = touchPair(points());
        pinch.current = {
          distance: pair.distance,
          zoom: currentZoom.current,
          anchor: {
            x: (event.currentTarget.scrollLeft + pair.midpoint.x) / currentZoom.current,
            y: (event.currentTarget.scrollTop + pair.midpoint.y) / currentZoom.current,
          },
        };
      } else pinch.current = null;
      cancelEdit();
    },
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
      if (suppressClick.current && event.detail !== 0) {
        event.stopPropagation();
        event.preventDefault();
        suppressClick.current = false;
      }
    },
  };
}
