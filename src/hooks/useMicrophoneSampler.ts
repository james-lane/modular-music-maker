import { useCallback, useEffect, useRef, useState } from 'react';
import { MicrophoneCapture, type CapturePhase } from '../audio/microphone';
import type { DrumSample, Project } from '../domain/types';

export interface MicrophoneControls {
  moduleId: string | null;
  phase: CapturePhase;
  seconds: number;
  start: (moduleId: string) => void;
  finish: () => void;
  cancel: () => void;
}

export function useMicrophoneSampler(
  project: Project,
  setSample: (moduleId: string, slot: string, sample: DrumSample | null) => boolean,
  notify: (message: string) => void,
): MicrophoneControls {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [capture] = useState(() => new MicrophoneCapture(setPhase));
  const owner = useRef<{ projectId: string; moduleId: string } | null>(null);
  const latest = useRef({ project, setSample, notify });
  latest.current = { project, setSample, notify };

  const cancel = useCallback(() => {
    owner.current = null;
    capture.cancel();
    setModuleId(null);
  }, [capture]);

  const start = useCallback(
    (id: string) => {
      const session = { projectId: latest.current.project.id, moduleId: id };
      owner.current = session;
      setModuleId(id);
      setSeconds(0);
      void capture
        .record()
        .then((sample) => {
          if (!sample || owner.current !== session) return;
          const current = latest.current;
          if (
            current.project.id !== session.projectId ||
            !current.project.modules.some((module) => module.id === id)
          )
            return;
          if (!current.setSample(id, 'clip', sample)) {
            current.notify(
              'This snippet exceeds the patch storage limit. Clear an unused sample and record again. Your previous clip is unchanged.',
            );
          } else
            current.notify(
              'Snippet saved in your patch. Connect AUDIO OUT and press Play snippet.',
            );
        })
        .catch((error: unknown) => {
          if (owner.current === session)
            latest.current.notify(
              error instanceof Error ? error.message : 'Unable to record the microphone.',
            );
        })
        .finally(() => {
          if (owner.current === session) {
            owner.current = null;
            setModuleId(null);
          }
        });
    },
    [capture],
  );

  // A pending permission dialog cannot be aborted by the browser API. Invalidating its
  // owner ensures a late grant releases every track instead of recording a different patch.
  useEffect(() => {
    const session = owner.current;
    if (
      session &&
      (session.projectId !== project.id ||
        !project.modules.some((module) => module.id === session.moduleId))
    )
      cancel();
  }, [project, cancel]);
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') cancel();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', cancel);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', cancel);
      cancel();
    };
  }, [cancel]);
  useEffect(() => {
    if (phase !== 'recording') return;
    const start = performance.now();
    const timer = setInterval(() => setSeconds((performance.now() - start) / 1000), 100);
    return () => clearInterval(timer);
  }, [phase]);
  return { moduleId, phase, seconds, start, finish: () => capture.finish(), cancel };
}
