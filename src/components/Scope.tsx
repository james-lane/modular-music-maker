import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audio/engine';
import { CONFIG } from '../config';
import { useAnimation } from '../hooks/useAnimation';
import { refreshVisual } from './visual-refresh';

export function Scope({ engine, playing }: { engine: AudioEngine; playing: boolean }) {
  const { reduced } = useAnimation();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const data = new Uint8Array(256);
    const draw = () => {
      context.clearRect(0, 0, 420, 120);
      context.strokeStyle = '#2c4240';
      context.lineWidth = 1;
      for (let x = 0; x < 420; x += 30) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, 120);
        context.stroke();
      }
      for (let y = 0; y < 120; y += 30) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(420, y);
        context.stroke();
      }
      if (playing) engine.readWaveform(data);
      else data.fill(128);
      context.beginPath();
      context.strokeStyle = '#b7d4a3';
      context.lineWidth = 2;
      for (let index = 0; index < data.length; index++) {
        const x = (index / (data.length - 1)) * 420;
        const y = 60 + ((data[index] - 128) / 128) * 100;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    };
    return refreshVisual(
      canvas.current!,
      draw,
      playing,
      reduced ? CONFIG.audio.reducedVisualizationIntervalMs : CONFIG.audio.visualizationIntervalMs,
    );
  }, [engine, playing, reduced]);
  return (
    <div className="oscilloscope">
      <canvas
        ref={canvas}
        width={420}
        height={120}
        aria-label={playing ? 'Live output waveform' : 'Output waveform: stopped'}
      />
      <span>L / R</span>
    </div>
  );
}

export function LevelMeter({ engine, playing }: { engine: AudioEngine; playing: boolean }) {
  const { reduced } = useAnimation();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const update = () => {
      const level = playing ? Math.min(1, engine.readLevel() * 5) : 0;
      container.current?.style.setProperty('--level', `${playing ? level * 100 : 0}%`);
    };
    return refreshVisual(
      container.current,
      update,
      playing,
      reduced ? CONFIG.audio.reducedMeterIntervalMs : CONFIG.audio.visualizationIntervalMs,
    );
  }, [engine, playing, reduced]);
  return (
    <div ref={container} className="level-meter" aria-label="Live stereo output level">
      <span>L</span>
      <div>
        <i />
      </div>
      <span>R</span>
      <div>
        <i />
      </div>
    </div>
  );
}
