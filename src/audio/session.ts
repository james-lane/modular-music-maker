type SessionMode = 'playback' | 'play-and-record';
interface BrowserAudioSession {
  type: string;
}

function isAudioSession(value: unknown): value is BrowserAudioSession {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  );
}

function browserAudioSession() {
  if (typeof navigator === 'undefined' || !('audioSession' in navigator)) return;
  const session = navigator.audioSession;
  return isAudioSession(session) ? session : undefined;
}

/** The browser session belongs to the whole page. Microphone capture must take
 * priority over music playback; the final owner restores the previous policy.
 */
export class AudioSessionCoordinator {
  private requests = new Set<{ mode: SessionMode }>();
  private session?: BrowserAudioSession;
  private previousType = 'auto';

  constructor(private readonly getSession = browserAudioSession) {}

  acquire(mode: SessionMode): () => void {
    if (!this.requests.size) {
      try {
        this.session = this.getSession();
        this.previousType = this.session?.type ?? 'auto';
      } catch {
        this.session = undefined;
      }
    }
    const request = { mode };
    this.requests.add(request);
    this.apply();
    return () => {
      if (!this.requests.delete(request)) return;
      this.apply();
      if (!this.requests.size) this.session = undefined;
    };
  }

  private apply() {
    if (!this.session) return;
    const type = this.requests.size
      ? [...this.requests].some((request) => request.mode === 'play-and-record')
        ? 'play-and-record'
        : 'playback'
      : this.previousType;
    try {
      if (this.session.type !== type) this.session.type = type;
    } catch {
      // This optional API can be unavailable or blocked. Ordinary Web Audio
      // must still work; older iPhones may require turning Silent mode off.
    }
  }
}

export const audioSession = new AudioSessionCoordinator();
