import { useSyncExternalStore } from 'react';
import type { PlaybackPosition } from '../audio/playback-position';

/** Only the relevant instrument's lights subscribe. Quarter-note sequencers do
 * not re-render for intermediate sixteenths, nor does the rest of the studio.
 */
export function usePlaybackStep(position: PlaybackPosition, ticksPerStep: number, count: number) {
  return useSyncExternalStore(position.subscribe, () => position.step(ticksPerStep, count));
}
