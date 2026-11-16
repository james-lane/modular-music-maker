import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audio/engine';
import { CONFIG } from '../config';

/** A short history of measured output voltage, not a schematic or a musical clock.
 * Drawing never edits a patch or drives the control source's timing.
 */
export function ControlScope({
  engine,
  moduleId,
  ports = 'out',
  active,
}: {
  engine: AudioEngine;
  moduleId: string;
  ports?: string;
  active: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const names = ports.split(',');
    const history = names.map(() => new Float32Array(90));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous = -Infinity;
    const draw = (now: number) => {
      if (active) frame = requestAnimationFrame(draw);
      if (now - previous < CONFIG.audio.visualizationIntervalMs) return;
      previous = now;
      context.clearRect(0, 0, 360, 90);
      context.strokeStyle = '#8da88a30';
      context.lineWidth = 1;
      for (let x = 0; x <= 360; x += 30) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, 90);
        context.stroke();
      }
      for (let y = 9; y <= 90; y += 18) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(360, y);
        context.stroke();
      }
      const values = names.map((name, index) => {
        const value = active
          ? engine.readControl(moduleId, name) / CONFIG.audio.modulation.reference
          : 0;
        const data = history[index];
        if (reduced.matches) data.fill(value);
        else {
          data.copyWithin(0, 1);
          data[data.length - 1] = value;
        }
        context.beginPath();
        context.strokeStyle = index === 0 ? '#d4edab' : '#e9b795';
        context.lineWidth = 2;
        data.forEach((sample, at) => {
          const x = (at * 360) / (data.length - 1);
          const y = 45 - Math.max(-1, Math.min(1, sample)) * 36;
          if (at === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();
        return `${name === 'out' ? 'MOD' : name.toUpperCase()} ${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
      });
      if (readout.current) readout.current.textContent = active ? values.join(' · ') : 'MOD · IDLE';
    };
    draw(0);
    return () => cancelAnimationFrame(frame);
  }, [engine, moduleId, ports, active]);
  return (
    <div className="control-scope">
      <canvas
        ref={canvas}
        width={360}
        height={90}
        aria-label="Measured modulation output history"
      />
      <output ref={readout}>MOD · IDLE</output>
    </div>
  );
}
