import { useEffect, type RefObject } from 'react';

/** Keep browser gestures from magnifying the fixed studio or interrupting held notes. */
export function useStudioTouch(app: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = app.current;
    if (!element) return;
    const isPerformanceSurface = (target: EventTarget | null) =>
      target instanceof Element && target.closest('.piano-keybed, .performance-pads') !== null;
    const preventGesture = (event: Event) => event.preventDefault();
    const touchStart = (event: TouchEvent) => {
      // Pointer events already own keys/pads. Cancelling their native touch default
      // also suppresses WebKit's long-press loupe, which CSS callout rules can miss.
      // Ordinary buttons and editable fields keep their native tap/caret behavior.
      if (event.touches.length > 1 || isPerformanceSurface(event.target)) event.preventDefault();
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const wheel = (event: WheelEvent) => {
      // Trackpad pinch arrives as Ctrl+wheel; the rack handles its own camera first.
      if (event.ctrlKey) event.preventDefault();
    };
    const contextMenu = (event: Event) => {
      if (isPerformanceSurface(event.target)) event.preventDefault();
    };
    // Native non-passive listeners are required: React's delegated touch listeners
    // cannot cancel Safari defaults. Do not stop propagation to musical controls.
    element.addEventListener('gesturestart', preventGesture, { passive: false });
    element.addEventListener('gesturechange', preventGesture, { passive: false });
    element.addEventListener('touchstart', touchStart, { passive: false });
    element.addEventListener('touchmove', touchMove, { passive: false });
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('contextmenu', contextMenu);
    return () => {
      element.removeEventListener('gesturestart', preventGesture);
      element.removeEventListener('gesturechange', preventGesture);
      element.removeEventListener('touchstart', touchStart);
      element.removeEventListener('touchmove', touchMove);
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('contextmenu', contextMenu);
    };
  }, [app]);
}
