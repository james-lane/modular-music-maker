import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { CONFIG } from '../config';
import {
  clampZoom,
  touchPair,
  viewAtAnchor,
  worldPoint,
  type Point,
  type WorkspaceView,
} from '../components/workspace-geometry';
import type { Size } from '../domain/workspace';
import { FramePublisher } from '../utils/frame-publisher';

/** The rack owns touch navigation; browser magnification remains available outside it. */
export function useWorkspaceGestures(
  viewport: RefObject<HTMLDivElement | null>,
  cancelEdit: () => void,
  frameIntervalMs = 0,
) {
  const [view, setViewState] = useState<WorkspaceView>({
    x: 0,
    y: 0,
    zoom: CONFIG.canvas.defaultZoom,
  });
  const currentView = useRef(view);
  const [viewPublisher] = useState(() => new FramePublisher(setViewState));
  const publicationInterval = useRef(frameIntervalMs);
  publicationInterval.current = frameIntervalMs;
  useEffect(() => () => viewPublisher.cancel(), [viewPublisher]);
  const [size, setSize] = useState<Size>({ width: 1, height: 1 });
  const updateView = useCallback(
    (next: WorkspaceView, immediate: boolean) => {
      const bounded = {
        x: Math.max(-CONFIG.canvas.maxCoordinate, Math.min(CONFIG.canvas.maxCoordinate, next.x)),
        y: Math.max(-CONFIG.canvas.maxCoordinate, Math.min(CONFIG.canvas.maxCoordinate, next.y)),
        // Fit may need a much wider overview than ordinary hand zooming.
        zoom: clampZoom(next.zoom, CONFIG.canvas.minFitZoom),
      };
      currentView.current = bounded;
      if (immediate) {
        viewPublisher.cancel();
        setViewState(bounded);
      } else viewPublisher.queue(bounded, publicationInterval.current);
    },
    [viewPublisher],
  );
  const setView = useCallback((next: WorkspaceView) => updateView(next, true), [updateView]);
  const panByScreen = useCallback(
    (x: number, y: number) => {
      const current = currentView.current;
      updateView(
        { ...current, x: current.x + x / current.zoom, y: current.y + y / current.zoom },
        false,
      );
    },
    [updateView],
  );
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewport.current?.getBoundingClientRect();
      return worldPoint(currentView.current, {
        x: clientX - (rect?.left ?? 0),
        y: clientY - (rect?.top ?? 0),
      });
    },
    [viewport],
  );
  const touches = useRef(new Map<number, { point: Point; target: Element }>());
  const pinch = useRef<{ distance: number; zoom: number; anchor: Point } | null>(null);
  const navigating = useRef(false);
  const suppressClick = useRef(false);
  const syntheticCancel = useRef(false);

  const applyZoom = (value: number, anchor: Point, midpoint: Point) => {
    updateView(
      viewAtAnchor(
        anchor,
        midpoint,
        clampZoom(value, Math.min(CONFIG.canvas.minZoom, currentView.current.zoom)),
      ),
      false,
    );
  };
  const zoomAt = (value: number, midpoint?: Point) => {
    const element = viewport.current;
    if (!element) return;
    const centre = midpoint ?? { x: element.clientWidth / 2, y: element.clientHeight / 2 };
    applyZoom(value, worldPoint(currentView.current, centre), centre);
  };
  const latest = useRef({ zoomAt, cancelEdit, panByScreen });
  latest.current = { zoomAt, cancelEdit, panByScreen };

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // WebKit's gesture events and trackpad wheel zoom must not magnify the app shell.
    const preventGesture = (event: Event) => event.preventDefault();
    const wheel = (event: WheelEvent) => {
      // The camera owns trackpad/wheel panning as well as zoom; no browser-sized
      // scroll surface or artificial scroll border participates in world geometry.
      event.preventDefault();
      if (!event.ctrlKey) {
        const unit =
          event.deltaMode === 1
            ? CONFIG.canvas.wheelLinePixels
            : event.deltaMode === 2
              ? element.clientHeight
              : 1;
        latest.current.panByScreen(
          (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * unit,
          (event.shiftKey && !event.deltaX ? 0 : event.deltaY) * unit,
        );
        return;
      }
      const rect = element.getBoundingClientRect();
      latest.current.zoomAt(
        currentView.current.zoom * Math.exp(-event.deltaY * CONFIG.canvas.wheelZoomSpeed),
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
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    window.addEventListener('blur', resetTouches);
    document.addEventListener('visibilitychange', visibility);
    element.addEventListener('gesturestart', preventGesture, { passive: false });
    element.addEventListener('gesturechange', preventGesture, { passive: false });
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
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
    view,
    size,
    zoom: view.zoom,
    setView,
    zoomAt,
    screenToWorld,
    panByScreen,
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
        zoom: currentView.current.zoom,
        anchor: worldPoint(currentView.current, pair.midpoint),
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
          zoom: currentView.current.zoom,
          anchor: worldPoint(currentView.current, pair.midpoint),
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
