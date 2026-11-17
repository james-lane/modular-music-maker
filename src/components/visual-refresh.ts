/** Display timers never schedule music. A clipped/hidden display should not keep
 * sampling audio or painting; visibility recovery draws the latest value directly.
 * Intervals replace sixty callbacks a second with only the work a display needs.
 */
export function refreshVisual(
  element: Element,
  draw: () => void,
  active: boolean,
  interval: number,
): () => void {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bounds = element.getBoundingClientRect();
  let visible =
    bounds.bottom > 0 && bounds.right > 0 && bounds.top < innerHeight && bounds.left < innerWidth;
  const tick = () => {
    timer = undefined;
    if (disposed || document.visibilityState === 'hidden' || !visible) return;
    draw();
    if (active) timer = setTimeout(tick, interval);
  };
  const restart = () => {
    if (disposed) return;
    clearTimeout(timer);
    timer = undefined;
    tick();
  };
  const observer =
    active && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
          if (visible === entry.isIntersecting) return;
          visible = entry.isIntersecting;
          restart();
        })
      : undefined;
  observer?.observe(element);
  if (active) {
    document.addEventListener('visibilitychange', restart);
    tick();
  } else draw();
  return () => {
    disposed = true;
    clearTimeout(timer);
    observer?.disconnect();
    document.removeEventListener('visibilitychange', restart);
  };
}
