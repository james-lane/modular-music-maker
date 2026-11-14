import {
  Cable as CableIcon,
  Check,
  Hand,
  Maximize,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  RotateCw,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent,
} from 'react';
import type { AudioEngine } from '../audio/engine';
import { CONFIG } from '../config';
import { MODULES } from '../domain/modules';
import { connectionError, createModule, getPort } from '../domain/project';
import type { Endpoint, ModuleType, PatchModule, Project } from '../domain/types';
import { ModuleCard } from './ModuleCard';
import type { LiveControls } from '../audio/live';

interface Props {
  project: Project;
  commit: (edit: (project: Project) => Project, group?: string) => void;
  notify: (message: string) => void;
  engine: AudioEngine;
  playing: boolean;
  step: number;
  drumStep: number;
  live: LiveControls;
  audioActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  saveStatus: 'saving' | 'saved' | 'error';
}

export function socketPosition(module: PatchModule, portId: string) {
  const definition = MODULES[module.type];
  const index = definition.ports.findIndex((port) => port.id === portId);
  // Match the port footer's 12px inset on both sides (see .module-ports).
  return {
    x: module.x + 12 + ((definition.width - 24) * (index + 0.5)) / definition.ports.length,
    y: module.y + definition.height - 22,
  };
}

export function Workspace({
  project,
  commit,
  notify,
  engine,
  playing,
  step,
  drumStep,
  live,
  audioActive,
  canUndo,
  canRedo,
  undo,
  redo,
  saveStatus,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(() =>
    window.innerWidth <= 760
      ? 0.85
      : Math.max(
          CONFIG.canvas.minZoom,
          Math.min(CONFIG.canvas.defaultZoom, (window.innerWidth - 270) / 1290),
        ),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const previousIds = useRef(new Set(project.modules.map((module) => module.id)));
  useEffect(() => {
    const added = project.modules.filter((module) => !previousIds.current.has(module.id));
    previousIds.current = new Set(project.modules.map((module) => module.id));
    if (added.length === 1 && viewport.current) {
      const module = added[0];
      const definition = MODULES[module.type];
      setSelected(module.id);
      viewport.current.scrollTo({
        left: Math.max(
          0,
          (module.x + definition.width / 2) * zoom - viewport.current.clientWidth / 2,
        ),
        top: Math.max(
          0,
          (module.y + definition.height / 2) * zoom - viewport.current.clientHeight / 2,
        ),
      });
    } else if (added.length > 1) viewport.current?.scrollTo(0, 0);
  }, [project.modules, zoom]);
  const [pending, setPending] = useState<Endpoint | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [handMode, setHandMode] = useState(false);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    moduleX: number;
    moduleY: number;
    x: number;
    y: number;
  } | null>(null);
  const pan = useRef<{ x: number; y: number; scrollX: number; scrollY: number } | null>(null);
  const displayModules = project.modules.map((module) =>
    module.id === dragPreview?.id ? { ...module, x: dragPreview.x, y: dragPreview.y } : module,
  );

  const boundedPosition = (type: ModuleType, x: number, y: number) => ({
    x: Math.max(
      0,
      Math.min(
        CONFIG.canvas.width - MODULES[type].width,
        Math.round(x / CONFIG.canvas.grid) * CONFIG.canvas.grid,
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        CONFIG.canvas.height - MODULES[type].height,
        Math.round(y / CONFIG.canvas.grid) * CONFIG.canvas.grid,
      ),
    ),
  });

  const portClick = (endpoint: Endpoint) => {
    const port = getPort(project, endpoint);
    if (!port) return;
    if (pending) {
      if (pending.moduleId === endpoint.moduleId && pending.portId === endpoint.portId) {
        setPending(null);
        return;
      }
      const from = port.direction === 'input' ? pending : endpoint;
      const to = port.direction === 'input' ? endpoint : pending;
      const error = connectionError(project, from, to);
      if (error) {
        notify(error);
        return;
      }
      commit((current) => ({
        ...current,
        cables: [...current.cables, { id: crypto.randomUUID(), from, to }],
      }));
      setPending(null);
      return;
    }
    if (port.direction === 'input') {
      const cable = project.cables.find(
        (cable) => cable.to.moduleId === endpoint.moduleId && cable.to.portId === endpoint.portId,
      );
      if (cable) {
        commit((current) => ({
          ...current,
          cables: current.cables.filter((item) => item.id !== cable.id),
        }));
        setPending(cable.from);
        return;
      }
    }
    setPending(endpoint);
    const module = displayModules.find((module) => module.id === endpoint.moduleId)!;
    setPointer(socketPosition(module, endpoint.portId));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.current && viewport.current) {
      viewport.current.scrollLeft = pan.current.scrollX + pan.current.x - event.clientX;
      viewport.current.scrollTop = pan.current.scrollY + pan.current.y - event.clientY;
    }
    if (drag.current) {
      const module = project.modules.find((module) => module.id === drag.current!.id)!;
      const position = boundedPosition(
        module.type,
        drag.current.moduleX + (event.clientX - drag.current.startX) / zoom,
        drag.current.moduleY + (event.clientY - drag.current.startY) / zoom,
      );
      drag.current.x = position.x;
      drag.current.y = position.y;
      setDragPreview({ id: module.id, ...position });
    }
    if (pending && viewport.current) {
      const rect = viewport.current.getBoundingClientRect();
      setPointer({
        x: (event.clientX - rect.left + viewport.current.scrollLeft) / zoom,
        y: (event.clientY - rect.top + viewport.current.scrollTop) / zoom,
      });
    }
  };

  const finishDrag = () => {
    const position = drag.current;
    if (position && (position.x !== position.moduleX || position.y !== position.moduleY))
      commit((current) => ({
        ...current,
        modules: current.modules.map((module) =>
          module.id === position.id ? { ...module, x: position.x, y: position.y } : module,
        ),
      }));
    drag.current = null;
    setDragPreview(null);
    pan.current = null;
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const type = event.dataTransfer.getData('application/patchwork-module') as ModuleType;
    if (!MODULES[type] || !viewport.current) return;
    const definition = MODULES[type];
    if (project.modules.length >= CONFIG.maxModules) {
      notify(`You can add up to ${CONFIG.maxModules} modules.`);
      return;
    }
    if (
      definition.maxInstances &&
      project.modules.filter((module) => module.type === type).length >= definition.maxInstances
    ) {
      notify('Your patch already has an Output module.');
      return;
    }
    const rect = viewport.current.getBoundingClientRect();
    const position = boundedPosition(
      type,
      (event.clientX - rect.left + viewport.current.scrollLeft) / zoom - definition.width / 2,
      (event.clientY - rect.top + viewport.current.scrollTop) / zoom - 30,
    );
    const module = createModule(type, position.x, position.y);
    commit((current) => ({ ...current, modules: [...current.modules, module] }));
    setSelected(module.id);
  };

  const pathFor = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const sag = Math.min(200, 70 + Math.abs(to.x - from.x) * 0.15 + Math.abs(to.y - from.y) * 0.1);
    return `M${from.x},${from.y} C${from.x},${from.y + sag} ${to.x},${to.y + sag} ${to.x},${to.y}`;
  };

  const fit = () => {
    if (!viewport.current || !project.modules.length) return;
    const right =
      Math.max(...project.modules.map((module) => module.x + MODULES[module.type].width)) + 50;
    const bottom =
      Math.max(...project.modules.map((module) => module.y + MODULES[module.type].height)) + 60;
    setZoom(
      Math.max(
        CONFIG.canvas.minZoom,
        Math.min(1, viewport.current.clientWidth / right, viewport.current.clientHeight / bottom),
      ),
    );
    viewport.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  };

  return (
    <main className="workspace">
      <div className="workspace-heading">
        <div className="patch-breadcrumb">
          <span className="patch-color" />
          <input
            aria-label="Patch name"
            value={project.name}
            maxLength={80}
            onChange={(event) =>
              commit(
                (current) => ({ ...current, name: event.target.value || 'Untitled patch' }),
                'name',
              )
            }
          />
          <span className="patch-badge">PATCH 01</span>
          <span className={`save-indicator ${saveStatus}`}>
            <Check size={13} />
            {saveStatus === 'saved'
              ? 'All changes saved'
              : saveStatus === 'saving'
                ? 'Saving…'
                : 'Storage full — export your patch'}
          </span>
        </div>
        <div className="history-controls">
          <button
            className="icon-button"
            disabled={!canUndo}
            onClick={undo}
            aria-label="Undo"
            title="Undo (⌘/Ctrl Z)"
          >
            <RotateCcw size={17} />
          </button>
          <button
            className="icon-button"
            disabled={!canRedo}
            onClick={redo}
            aria-label="Redo"
            title="Redo (⌘/Ctrl Shift Z)"
          >
            <RotateCw size={17} />
          </button>
        </div>
      </div>
      <div
        ref={viewport}
        className={`canvas-viewport ${dragOver ? 'drag-over' : ''} ${handMode ? 'hand-mode' : ''}`}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerDown={(event) => {
          if (
            event.target === event.currentTarget ||
            (event.target as HTMLElement).classList.contains('canvas-stage')
          ) {
            setSelected(null);
            if (handMode && viewport.current) {
              pan.current = {
                x: event.clientX,
                y: event.clientY,
                scrollX: viewport.current.scrollLeft,
                scrollY: viewport.current.scrollTop,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setPending(null);
        }}
      >
        <div
          className="canvas-size"
          style={{ width: CONFIG.canvas.width * zoom, height: CONFIG.canvas.height * zoom }}
        >
          <div
            className="canvas-stage"
            style={{
              width: CONFIG.canvas.width,
              height: CONFIG.canvas.height,
              transform: `scale(${zoom})`,
            }}
          >
            <div className="workspace-label">
              <span className="tiny-led on" /> YOUR SOUND, YOUR RULES.
            </div>
            {displayModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                project={project}
                selected={module.id === selected}
                step={step}
                drumStep={drumStep}
                live={live}
                audioActive={audioActive}
                engine={engine}
                playing={playing}
                pending={pending}
                onSelect={() => setSelected(module.id)}
                onDragStart={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = {
                    id: module.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    moduleX: module.x,
                    moduleY: module.y,
                    x: module.x,
                    y: module.y,
                  };
                  setSelected(module.id);
                }}
                onParameter={(id, value) =>
                  commit(
                    (current) => ({
                      ...current,
                      modules: current.modules.map((item) =>
                        item.id === module.id
                          ? { ...item, parameters: { ...item.parameters, [id]: value } }
                          : item,
                      ),
                    }),
                    `${module.id}:${id}`,
                  )
                }
                onStep={(index, rest) =>
                  commit((current) => ({
                    ...current,
                    modules: current.modules.map((item) =>
                      item.id === module.id
                        ? {
                            ...item,
                            steps: item.steps!.map((degree, position) =>
                              position === index ? (rest ? -1 : (degree + 1) % 14) : degree,
                            ),
                          }
                        : item,
                    ),
                  }))
                }
                onPort={portClick}
                onDrumStep={(sound, index) =>
                  commit((current) => ({
                    ...current,
                    modules: current.modules.map((item) =>
                      item.id === module.id && item.drumPattern
                        ? {
                            ...item,
                            drumPattern: {
                              ...item.drumPattern,
                              [sound]: item.drumPattern[sound].map((enabled, position) =>
                                position === index ? !enabled : enabled,
                              ),
                            },
                          }
                        : item,
                    ),
                  }))
                }
                onRemove={() => {
                  commit((current) => ({
                    ...current,
                    modules: current.modules.filter((item) => item.id !== module.id),
                    cables: current.cables.filter(
                      (cable) =>
                        cable.from.moduleId !== module.id && cable.to.moduleId !== module.id,
                    ),
                  }));
                  if (pending?.moduleId === module.id) setPending(null);
                }}
              />
            ))}
            <svg
              className="patch-cables"
              width={CONFIG.canvas.width}
              height={CONFIG.canvas.height}
              aria-label="Patch cable connections"
            >
              <defs>
                <filter id="cable-shadow" x="-20%" y="-20%" width="140%" height="150%">
                  <feDropShadow
                    dx="0"
                    dy="3"
                    stdDeviation="2"
                    floodColor="#302a22"
                    floodOpacity="0.2"
                  />
                </filter>
              </defs>
              {project.cables.map((cable) => {
                const fromModule = displayModules.find(
                  (module) => module.id === cable.from.moduleId,
                );
                const toModule = displayModules.find((module) => module.id === cable.to.moduleId);
                if (!fromModule || !toModule) return null;
                const from = socketPosition(fromModule, cable.from.portId);
                const to = socketPosition(toModule, cable.to.portId);
                const signal = getPort(project, cable.from)?.signal;
                return (
                  <g
                    key={cable.id}
                    className={`patch-cable signal-${signal}`}
                    style={
                      {
                        '--cable-color':
                          signal === 'pitch'
                            ? '#c89a52'
                            : signal === 'control'
                              ? '#9385b7'
                              : signal === 'trigger'
                                ? '#b9788f'
                                : MODULES[fromModule.type].color,
                      } as CSSProperties
                    }
                  >
                    <path
                      className="cable-hit"
                      d={pathFor(from, to)}
                      onDoubleClick={() =>
                        commit((current) => ({
                          ...current,
                          cables: current.cables.filter((item) => item.id !== cable.id),
                        }))
                      }
                    >
                      <title>Double-click to unplug this cable</title>
                    </path>
                    <path className="cable-body" d={pathFor(from, to)} />
                    <path className="cable-highlight" d={pathFor(from, to)} />
                    {[from, to].map((position, index) => (
                      <g
                        key={index}
                        className="cable-plug"
                        transform={`translate(${position.x},${position.y})`}
                      >
                        <rect x="-6" y="-9" width="12" height="23" rx="4" />
                        <path d="M-4 4H4M-4 7H4" />
                      </g>
                    ))}
                  </g>
                );
              })}
              {pending &&
                (() => {
                  const module = displayModules.find((module) => module.id === pending.moduleId);
                  if (!module) return null;
                  return (
                    <path
                      className="pending-cable"
                      d={pathFor(socketPosition(module, pending.portId), pointer)}
                    />
                  );
                })()}
            </svg>
            {!displayModules.some(
              (module) =>
                module.x < 440 &&
                module.x + MODULES[module.type].width > 90 &&
                module.y < 650 &&
                module.y + MODULES[module.type].height > 570,
            ) && (
              <div className="canvas-note">
                <span>Room for your next idea.</span>
                <p>Grab a module. Turn a knob. Follow your ears.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {pending && (
        <div className="wiring-message">
          <CableIcon size={15} /> Choose a matching{' '}
          {getPort(project, pending)?.direction === 'output' ? 'input' : 'output'} socket{' '}
          <button onClick={() => setPending(null)} aria-label="Cancel cable">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="canvas-controls">
        <div className="canvas-tool-group">
          <button
            className={!handMode ? 'active' : ''}
            onClick={() => setHandMode(false)}
            title="Select and move modules"
            aria-label="Select tool"
            aria-pressed={!handMode}
          >
            <MousePointer2 size={17} />
          </button>
          <button
            className={handMode ? 'active' : ''}
            onClick={() => setHandMode(true)}
            title="Pan the workspace"
            aria-label="Pan tool"
            aria-pressed={handMode}
          >
            <Hand size={17} />
          </button>
        </div>
        <span className="control-divider" />
        <button
          onClick={() => setZoom((value) => Math.max(CONFIG.canvas.minZoom, value - 0.1))}
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        <span className="zoom-value">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((value) => Math.min(CONFIG.canvas.maxZoom, value + 0.1))}
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <span className="control-divider" />
        <button onClick={fit} title="Fit all modules in view" aria-label="Fit modules to view">
          <Maximize size={16} />
        </button>
      </div>
      <div className="canvas-hint">
        <span className="hint-socket" /> Click a socket to start patching <span>·</span>{' '}
        Double-click a cable to unplug
      </div>
    </main>
  );
}
