/** Read-only visual position published by the audio-clock scheduler. This store
 * never advances time or schedules sound; slow rendering must not become a clock.
 */
export class PlaybackPosition {
  private tick = -1;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  publish(tick: number) {
    if (tick === this.tick) return;
    this.tick = tick;
    this.listeners.forEach((listener) => listener());
  }

  step(ticksPerStep: number, count: number): number {
    return this.tick < 0 ? -1 : Math.floor(this.tick / ticksPerStep) % count;
  }

  bar(ticksPerBar: number): number {
    return this.tick < 0 ? -1 : Math.floor(this.tick / ticksPerBar);
  }
}
