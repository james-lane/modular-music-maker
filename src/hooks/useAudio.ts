import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/engine';
import { preferredRecordingType, saveRecording, type Recording } from '../audio/recordings';
import { CONFIG } from '../config';
import { downloadFile, fileSlug } from '../domain/storage';
import type { Project } from '../domain/types';
import { controllerTargets, drumLiveTailMs, type DrumSound } from '../domain/instruments';
import type { LiveControls } from '../audio/live';

export function useAudio(project: Project, notify: (message: string) => void) {
  const [engine] = useState(() => new AudioEngine());
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [step, setStep] = useState(-1);
  const [beat, setBeat] = useState(0);
  const [drumStep, setDrumStep] = useState(-1);
  const [liveActive, setLiveActive] = useState(false);
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
  const heldKeys = useRef(new Set<string>());
  const liveGeneration = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    engine.update(project);
  }, [engine, project]);
  useEffect(() => {
    // Effect setup can follow Fast Refresh cleanup while React preserves hook state.
    setPlaying(engine.isPlaying);
    setLiveActive(engine.isActive);
    setRecording(recorder.current?.state === 'recording');
    engine.onStep = (nextStep, nextBeat, nextDrumStep) => {
      setStep(nextStep);
      setBeat(nextBeat);
      setDrumStep(nextDrumStep);
    };
    return () => {
      recorder.current?.state === 'recording' && recorder.current.stop();
      clearTimeout(idleTimer.current);
      liveGeneration.current++;
      void engine.dispose();
    };
  }, [engine]);

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
  }, [engine, stopRecording]);

  const scheduleIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (heldKeys.current.size || engine.isPlaying) return;
    idleTimer.current = setTimeout(() => {
      if (!heldKeys.current.size && !engine.isPlaying) {
        void engine.stop();
        setLiveActive(false);
      }
    }, drumLiveTailMs(latest.current));
  }, [engine]);

  const activateLive = useCallback(
    async (action: () => void) => {
      const generation = liveGeneration.current;
      clearTimeout(idleTimer.current);
      try {
        await engine.activate(latest.current);
        if (generation !== liveGeneration.current) {
          if (!engine.isPlaying && !heldKeys.current.size) await engine.stop();
          return;
        }
        setLiveActive(true);
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
    (moduleId: string, note: number) => {
      if (!controllerTargets(latest.current, moduleId, 'pitch').length) {
        notifyRef.current('Connect Keyboard PITCH / GATE to an Oscillator PITCH input.');
        return;
      }
      const token = `${moduleId}:${note}`;
      heldKeys.current.add(token);
      void activateLive(() => {
        // A quick release may arrive while the audio device is still waking up.
        if (heldKeys.current.has(token)) {
          const module = latest.current.modules.find((item) => item.id === moduleId);
          if (module) engine.noteOn(moduleId, note, Number(module.parameters.velocity));
        }
      });
    },
    [activateLive, engine],
  );

  const noteOff = useCallback(
    (moduleId: string, note: number) => {
      heldKeys.current.delete(`${moduleId}:${note}`);
      engine.noteOff(moduleId, note);
      scheduleIdle();
    },
    [engine, scheduleIdle],
  );

  const releaseKeyboard = useCallback(
    (moduleId: string) => {
      for (const token of heldKeys.current)
        if (token.startsWith(`${moduleId}:`)) heldKeys.current.delete(token);
      engine.releaseKeyboard(moduleId);
      scheduleIdle();
    },
    [engine, scheduleIdle],
  );

  const drumHit = useCallback(
    (moduleId: string, sound: DrumSound) => {
      void activateLive(() => engine.hitDrum(moduleId, sound, 0.9));
    },
    [activateLive, engine],
  );

  const padHit = useCallback(
    (moduleId: string, sound: DrumSound) => {
      if (!controllerTargets(latest.current, moduleId, 'trigger').length) {
        notifyRef.current('Connect Pad controller TRIGGER OUT to Drum machine TRIGGER IN.');
        return;
      }
      void activateLive(() => {
        const module = latest.current.modules.find((item) => item.id === moduleId);
        if (module) engine.hitPad(moduleId, sound, Number(module.parameters.velocity));
      });
    },
    [activateLive, engine],
  );

  const live: LiveControls = { noteOn, noteOff, releaseKeyboard, drumHit, padHit };

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
    active: playing || liveActive,
    live,
    starting,
    play,
    stop,
    step,
    beat,
    drumStep,
    recording,
    recordingSeconds,
    toggleRecord,
    stopRecording,
    recordingVersion,
    recordingPending,
  };
}
