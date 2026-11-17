import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { CONFIG } from '../config';
import type { LiveControls } from '../audio/live';
import type { Project } from '../domain/types';
import { MidiDevices } from '../midi/devices';
import { MidiRouter } from '../midi/router';

const bindingsSchema = z.record(z.uuid(), z.string().max(1024));
function readBindings(projectId: string) {
  try {
    return bindingsSchema.parse(
      JSON.parse(localStorage.getItem(`${CONFIG.midi.storageKey}:${projectId}`) || '{}'),
    );
  } catch {
    return {};
  }
}

export function useMidi(project: Project, live: LiveControls, notify: (message: string) => void) {
  const latest = useRef({ project, live, notify });
  latest.current = { project, live, notify };
  const [bindings, setBindings] = useState(() => ({
    projectId: project.id,
    devices: readBindings(project.id),
  }));
  const currentBindings =
    bindings.projectId === project.id ? bindings.devices : readBindings(project.id);
  const devicesRef = useRef(currentBindings);
  devicesRef.current = currentBindings;
  const [router] = useState(() => new MidiRouter(() => latest.current.live));
  const [manager] = useState(
    () =>
      new MidiDevices(
        typeof navigator.requestMIDIAccess === 'function' && window.isSecureContext
          ? () => navigator.requestMIDIAccess({ sysex: false })
          : undefined,
        (state) => setState(state),
        (id, data) => {
          if (!document.hidden)
            router.receive(latest.current.project, devicesRef.current, id, data);
        },
        (device) => {
          router.panic(device);
          latest.current.live.resetMidi();
        },
      ),
  );
  const [state, setState] = useState(manager.snapshot);
  const panic = () => {
    router.panic();
    latest.current.live.resetMidi();
  };
  useLayoutEffect(() => {
    router.sync(project, currentBindings);
  }, [project, currentBindings, router]);
  useEffect(() => {
    const blur = () => {
      router.panic();
      latest.current.live.resetMidi();
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
      manager.disable();
    };
  }, [manager, router]);
  return {
    ...state,
    enable: () => manager.enable(),
    disable: () => manager.disable(),
    panic,
    device: (moduleId: string) => currentBindings[moduleId] ?? '',
    setDevice(moduleId: string, device: string) {
      panic();
      const devices = { ...devicesRef.current, [moduleId]: device };
      devicesRef.current = devices;
      setBindings({ projectId: project.id, devices });
      try {
        localStorage.setItem(`${CONFIG.midi.storageKey}:${project.id}`, JSON.stringify(devices));
      } catch {
        notify('MIDI input selected for this visit. Browser storage is unavailable.');
      }
    },
  };
}
export type MidiControls = ReturnType<typeof useMidi>;
export const MidiContext = createContext<MidiControls | null>(null);
export function useMidiControls() {
  const value = useContext(MidiContext);
  if (!value) throw new Error('MIDI controls require the studio provider');
  return value;
}
