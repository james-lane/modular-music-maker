import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/engine';
import { preferredRecordingType, saveRecording, type Recording } from '../audio/recordings';
import { CONFIG } from '../config';
import { downloadFile, fileSlug } from '../domain/storage';
import type { Project } from '../domain/types';

export function useAudio(project: Project, notify: (message: string) => void) {
  const [engine] = useState(() => new AudioEngine());
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [step, setStep] = useState(-1);
  const [beat, setBeat] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingVersion, setRecordingVersion] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingStart = useRef(0);
  const latest = useRef(project);
  latest.current = project;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    engine.update(project);
  }, [engine, project]);
  useEffect(() => {
    engine.onStep = (nextStep, nextBeat) => {
      setStep(nextStep);
      setBeat(nextBeat);
    };
    return () => {
      recorder.current?.state === 'recording' && recorder.current.stop();
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
    stopRecording();
    await engine.stop();
    setPlaying(false);
  }, [engine, stopRecording]);

  const toggleRecord = useCallback(async () => {
    if (recorder.current?.state === 'recording') {
      stopRecording();
      return;
    }
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
    starting,
    play,
    stop,
    step,
    beat,
    recording,
    recordingSeconds,
    toggleRecord,
    stopRecording,
    recordingVersion,
  };
}
