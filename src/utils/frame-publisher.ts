/** Keep gesture maths immediate while publishing only the latest view per display frame.
 * Explicit replacement (Fit/project switching) cancels a pending gesture publication.
 */
export class FramePublisher<T> {
  private frame: number | null = null;
  private latest: { value: T } | null = null;
  private intervalMs = 0;
  private lastPublished = -Infinity;

  // Wrappers keep Window APIs from receiving this class instance as their receiver.
  constructor(
    private readonly publish: (value: T) => void,
    private readonly request: (callback: FrameRequestCallback) => number = (callback) =>
      requestAnimationFrame(callback),
    private readonly cancelRequest: (id: number) => void = (id) => cancelAnimationFrame(id),
  ) {}

  queue(value: T, intervalMs = 0) {
    this.latest = { value };
    this.intervalMs = intervalMs;
    if (this.frame !== null) return;
    this.frame = this.request(this.onFrame);
  }

  private onFrame = (now: number) => {
    // Leave rendering headroom for the audio scheduler during a performance.
    if (now - this.lastPublished < this.intervalMs) {
      this.frame = this.request(this.onFrame);
    } else {
      this.frame = null;
      const latest = this.latest;
      this.latest = null;
      this.lastPublished = now;
      if (latest) this.publish(latest.value);
    }
  };

  cancel() {
    if (this.frame !== null) this.cancelRequest(this.frame);
    this.frame = null;
    this.latest = null;
    this.lastPublished = -Infinity;
  }
}
