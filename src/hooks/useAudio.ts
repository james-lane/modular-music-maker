import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../audio/engine';
import { PlaybackPosition } from '../audio/playback-position';
import { preferredRecordingType, saveRecording, type Recording } from '../audio/recordings';
import { CONFIG } from '../config';
import { downloadFile, fileSlug } from '../domain/storage';
import type { Project } from '../domain/types';
import { controllerTargets, drumLiveTailMs, type DrumSound } from '../domain/instruments';
import { padTargets } from '../domain/pad-controller';
import type { LiveControls } from '../audio/live';

export function useAudio(project: Project, notify: (message: string) => void) {
  const [engine] = useState(() => new AudioEngine());
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [position] = useState(() => new PlaybackPosition());
  const [beat, setBeat] = useState(0);
  const [liveActive, setLiveActive] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [recording, setRecording] = useState(false);
  // Remains true until the last chunk is safely stored, even after Record is stopped.
  const [recordingPending, setRecordingPending] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingVersion, setRecordingVersion] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingStart = useRef(0);
  const latest = useRef(project);
  latest.current = project;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const heldKeys = useRef(
    new Map<string, { moduleId: string; note: number; velocity?: number; source: string }>(),
  );
  const liveGeneration = useRef(0);
  const midiGeneration = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    engine.update(project);
  }, [engine, project]);
  useEffect(() => {
    // Effect setup can follow Fast Refresh cleanup while React preserves hook state.
    setPlaying(engine.isPlaying);
    setLiveActive(engine.isActive);
    setPreviewActive(false);
    setRecording(recorder.current?.state === 'recording');
    engine.onTick = (nextTick, nextBeat) => {
      position.publish(nextTick);
      setBeat(nextBeat);
    };
    return () => {
      recorder.current?.state === 'recording' && recorder.current.stop();
      clearTimeout(idleTimer.current);
      liveGeneration.current++;
      void engine.dispose();
    };
  }, [engine, position]);

  const play = useCallback(async () => {
    setStarting(true);
    try {
      await engine.play(latest.current);
      setPlaying(true);
    } catch (error) {
      notifyRef.current(error instanceof Error ? error.message : 'Unable to start audio.');
    } finally {
      setStarting(false);
    }
  }, [engine]);

  const stopRecording = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
  }, []);

  const stop = useCallback(async () => {
    liveGeneration.current++;
    heldKeys.current.clear();
    clearTimeout(idleTimer.current);
    stopRecording();
    await engine.stop();
    setPlaying(false);
    setLiveActive(false);
    setPreviewActive(false);
  }, [engine, stopRecording]);

  const scheduleIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (heldKeys.current.size || engine.isPlaying) return;
    idleTimer.current = setTimeout(
      () => {
        if (!heldKeys.current.size && !engine.isPlaying) {
          void engine.stop();
          setLiveActive(false);
          setPreviewActive(false);
        }
      },
      Math.max(
        drumLiveTailMs(latest.current),
        engine.remainingTailSeconds() * 1000 + CONFIG.audio.liveTailMs,
      ),
    );
  }, [engine]);

  const activateLive = useCallback(
    async (action: () => void, activity: 'live' | 'preview' = 'live') => {
      const generation = liveGeneration.current;
      clearTimeout(idleTimer.current);
      try {
        await engine.activate(latest.current);
        if (generation !== liveGeneration.current) {
          if (!engine.isPlaying && !heldKeys.current.size) await engine.stop();
          return;
        }
        // A dry audition wakes audio without taking over the studio Play/Stop control.
        if (activity === 'preview') setPreviewActive(true);
        else setLiveActive(true);
        action();
        scheduleIdle();
      } catch (error) {
        notifyRef.current(
          error instanceof Error ? error.message : 'Unable to play this instrument.',
        );
      }
    },
    [engine, scheduleIdle],
  );

  const noteOn = useCallback(
    (moduleId: string, note: number, velocity?: number, source = 'ui') => {
      if (!controllerTargets(latest.current, moduleId, 'pitch').length) {
        if (
          latest.current.modules.some(
            (module) => module.id === moduleId && module.type === 'midi-input',
          )
        )
          return;
        notifyRef.current(
          'Connect Keyboard PITCH / GATE to an Oscillator PITCH or Envelope NOTE / GATE input.',
        );
        return;
      }
      const token = JSON.stringify([moduleId, note, source]);
      const hold = { moduleId, note, velocity, source };
      heldKeys.current.delete(token);
      heldKeys.current.set(token, hold);
      void activateLive(() => {
        // A quick release may arrive while the audio device is still waking up.
        if (heldKeys.current.get(token) === hold) {
          const module = latest.current.modules.find((item) => item.id === moduleId);
          if (module?.type === 'keyboard' || module?.type === 'midi-input')
            engine.noteOn(moduleId, note, Number(module.parameters.velocity) * (velocity ?? 1));
        }
      });
    },
    [activateLive, engine],
  );

  const noteOff = useCallback(
    (moduleId: string, note: number, source = 'ui') => {
      heldKeys.current.delete(JSON.stringify([moduleId, note, source]));
      if (
        ![...heldKeys.current.values()].some(
          (hold) => hold.moduleId === moduleId && hold.note === note,
        )
      )
        engine.noteOff(moduleId, note);
      scheduleIdle();
    },
    [engine, scheduleIdle],
  );

  const releaseKeyboard = useCallback(
    (moduleId: string) => {
      // Panel cleanup owns touch/computer keys only. A MIDI hold on the same
      // pitch must survive a pointer release or a keyboard layout remount.
      for (const hold of [...heldKeys.current.values()])
        if (hold.moduleId === moduleId && hold.source === 'ui') noteOff(moduleId, hold.note);
      scheduleIdle();
    },
    [noteOff, scheduleIdle],
  );

  const drumHit = useCallback(
    (moduleId: string, sound: DrumSound, velocity = 0.9) => {
      const projectId = latest.current.id;
      void activateLive(() => {
        if (latest.current.id === projectId) engine.hitDrum(moduleId, sound, velocity);
      });
    },
    [activateLive, engine],
  );

  const padHit = useCallback(
    (moduleId: string, index: number, velocity = 1) => {
      const sourceProject = latest.current;
      if (!padTargets(sourceProject, moduleId, index).length) {
        notifyRef.current(
          `Connect PAD ${index + 1} or ALL to a Drum machine, Mic sampler, Envelope, or Sample & Hold TRIGGER IN.`,
        );
        return;
      }
      void activateLive(() => {
        // Audio resume may finish after resizing/rewiring. Never dispatch into
        // the graph captured before that edit or revive a removed pad output.
        if (latest.current.id !== sourceProject.id) return;
        if (latest.current !== sourceProject) engine.update(latest.current);
        const module = latest.current.modules.find((item) => item.id === moduleId);
        if (module) engine.hitPad(moduleId, index, Number(module.parameters.velocity) * velocity);
      });
    },
    [activateLive, engine],
  );

  const sampleHit = useCallback(
    (moduleId: string) => {
      void activateLive(() => engine.hitSample(moduleId), 'preview');
    },
    [activateLive, engine],
  );

  const midiHit = useCallback(
    (moduleId: string, index: number, velocity: number) => {
      if (!controllerTargets(latest.current, moduleId, 'trigger').length) return;
      const projectId = latest.current.id,
        generation = midiGeneration.current;
      void activateLive(() => {
        if (generation === midiGeneration.current && latest.current.id === projectId)
          engine.hitMidi(moduleId, index, velocity);
      });
    },
    [activateLive, engine],
  );
  const midiControl = useCallback(
    (moduleId: string, index: number, value: number) => {
      if (!controllerTargets(latest.current, moduleId, `mod${index}`).length) return;
      const projectId = latest.current.id,
        generation = midiGeneration.current;
      void activateLive(() => {
        if (generation === midiGeneration.current && latest.current.id === projectId)
          engine.setMidiControl(moduleId, index, value);
      });
    },
    [activateLive, engine],
  );
  const resetMidi = useCallback(() => {
    midiGeneration.current++;
    for (const [token, hold] of heldKeys.current)
      if (hold.source.startsWith('midi:')) {
        heldKeys.current.delete(token);
        engine.noteOff(hold.moduleId, hold.note);
      }
    engine.resetMidi();
    scheduleIdle();
  }, [engine, scheduleIdle]);
  const live: LiveControls = useMemo(
    () => ({
      noteOn,
      noteOff,
      releaseKeyboard,
      drumHit,
      padHit,
      sampleHit,
      midiHit,
      midiControl,
      resetMidi,
    }),
    [noteOn, noteOff, releaseKeyboard, drumHit, padHit, sampleHit, midiHit, midiControl, resetMidi],
  );

  const toggleRecord = useCallback(async () => {
    if (recorder.current?.state === 'recording') {
      stopRecording();
      return;
    }
    if (recorder.current) return;
    setRecordingPending(true);
    try {
      const format = preferredRecordingType();
      await engine.play(latest.current);
      setPlaying(true);
      const next = new MediaRecorder(engine.getRecordingStream(), { mimeType: format.mimeType });
      const chunks: BlobPart[] = [];
      const patchName = latest.current.name;
      const startedAt = Date.now();
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = async () => {
        const saved: Recording = {
          id: crypto.randomUUID(),
          name: patchName,
          createdAt: new Date().toISOString(),
          duration: (Date.now() - startedAt) / 1000,
          blob: new Blob(chunks, { type: format.mimeType }),
          extension: format.extension,
        };
        try {
          await saveRecording(saved);
          setRecordingVersion((version) => version + 1);
          notifyRef.current('Take saved. Find it in Recordings.');
        } catch {
          downloadFile(saved.blob, `${fileSlug(saved.name)}.${saved.extension}`);
          notifyRef.current('Browser storage is unavailable. Your take has been downloaded.');
        }
        if (recorder.current === next) recorder.current = null;
        setRecordingPending(false);
      };
      next.onerror = () => {
        stopRecording();
        notifyRef.current('Recording was interrupted. Try another take.');
      };
      recorder.current = next;
      recordingStart.current = Date.now();
      next.start(1000);
      setRecordingSeconds(0);
      setRecording(true);
    } catch (error) {
      setRecordingPending(false);
      notifyRef.current(error instanceof Error ? error.message : 'Could not start recording.');
    }
  }, [engine, stopRecording]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - recordingStart.current) / 1000);
      setRecordingSeconds(seconds);
      if (seconds >= CONFIG.audio.maxRecordingSeconds) stopRecording();
    }, 250);
    return () => clearInterval(timer);
  }, [recording, stopRecording]);

  return {
    engine,
    playing,
    active: playing || liveActive || previewActive,
    transportActive: playing || liveActive,
    live,
    starting,
    play,
    stop,
    position,
    beat,
    recording,
    recordingSeconds,
    toggleRecord,
    stopRecording,
    recordingVersion,
    recordingPending,
  };
}
