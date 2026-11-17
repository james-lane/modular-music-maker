import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioSessionCoordinator } from '../src/audio/session';

test('session policy is lazy, shared by playback owners, and restores the previous type', () => {
  const session = { type: 'ambient' };
  let reads = 0;
  const policy = new AudioSessionCoordinator(() => {
    reads++;
    return session;
  });
  assert.equal(reads, 0, 'loading the studio must not acquire an audio session');
  const first = policy.acquire('playback');
  const second = policy.acquire('playback');
  assert.equal(session.type, 'playback');
  first();
  first();
  assert.equal(session.type, 'playback', 'one owner cannot release another');
  second();
  assert.equal(session.type, 'ambient');
  assert.equal(reads, 1);
  session.type = 'auto';
  policy.acquire('playback')();
  assert.equal(session.type, 'auto', 'a new session snapshots the current policy');
});

test('microphone policy wins in either start order and playback returns after capture', () => {
  for (const micFirst of [false, true]) {
    const session = { type: 'auto' };
    const policy = new AudioSessionCoordinator(() => session);
    const first = policy.acquire(micFirst ? 'play-and-record' : 'playback');
    const second = policy.acquire(micFirst ? 'playback' : 'play-and-record');
    assert.equal(session.type, 'play-and-record');
    const releaseMic = micFirst ? first : second;
    const releasePlayback = micFirst ? second : first;
    releaseMic();
    assert.equal(session.type, 'playback');
    releasePlayback();
    assert.equal(session.type, 'auto');
  }
  const session = { type: 'auto' };
  const policy = new AudioSessionCoordinator(() => session);
  const releasePlayback = policy.acquire('playback');
  const releaseMic = policy.acquire('play-and-record');
  releasePlayback();
  assert.equal(session.type, 'play-and-record', 'Stop must not disable active capture');
  releaseMic();
  assert.equal(session.type, 'auto');
});

test('missing or rejected session APIs never prevent ordinary audio or cleanup', () => {
  const unavailable = new AudioSessionCoordinator(() => undefined);
  unavailable.acquire('playback')();
  let blocked = true;
  const session = { type: 'auto' };
  const policy = new AudioSessionCoordinator(() => {
    if (blocked) throw new Error('Blocked getter');
    return session;
  });
  policy.acquire('playback')();
  blocked = false;
  const release = policy.acquire('playback');
  assert.equal(session.type, 'playback', 'a failed attempt does not poison the next session');
  release();
  const rejected = new AudioSessionCoordinator(() => ({
    get type() {
      return 'auto';
    },
    set type(_value: string) {
      throw new Error('Blocked setter');
    },
  }));
  const stop = rejected.acquire('playback');
  const finish = rejected.acquire('play-and-record');
  stop();
  finish();
});
