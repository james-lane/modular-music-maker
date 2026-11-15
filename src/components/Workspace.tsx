import {
  Cable as CableIcon,
  Check,
  Hand,
  Maximize,
  Minimize,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  RotateCw,
  X,
} from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from 'react';
import type { AudioEngine } from '../audio/engine';
import { CONFIG } from '../config';
import { MODULES, SEQUENCER_DEGREES } from '../domain/modules';
import { connectionError, createModule, getPort } from '../domain/project';
import type { DrumSample, Endpoint, ModuleType, PatchModule, Project } from '../domain/types';
import type { CableStyle } from '../domain/preferences';
import { ModuleCard } from './ModuleCard';
import { PatchCable } from './PatchCable';
import { cablePath } from './cable-geometry';
import type { LiveControls } from '../audio/live';
import { useWorkspaceGestures } from '../hooks/useWorkspaceGestures';
import type { ModuleLibraryDrag } from '../hooks/useModuleLibraryDrag';
import { moduleBounds, snapPosition, type Point } from '../domain/workspace';
import type { MicrophoneControls } from '../hooks/useMicrophoneSampler';
import { edgePan, fittedView, viewAtAnchor } from './workspace-geometry';

interface Props {
  project: Project;
  commit: (edit: (project: Project) => Project, group?: string) => void;
  setSample: (moduleId: string, slot: string, sample: DrumSample | null) => boolean;
  microphone: MicrophoneControls;
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
  cableStyle: CableStyle;
  cableOpacity: number;
  libraryDrag: ModuleLibraryDrag | null;
  onLibraryDragFinish: (added: boolean) => void;
  onViewCentreChange: (point: Point) => void;
  libraryOpen: boolean;
  onLibraryToggle: () => void;
  focused: boolean;
  onFocusToggle: () => void;
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
  setSample,
  microphone,
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
  cableStyle,
  cableOpacity,
  libraryDrag,
  onLibraryDragFinish,
  onViewCentreChange,
  libraryOpen,
  onLibraryToggle,
  focused,
  onFocusToggle,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const droppedModule = useRef<string | null>(null);
  const previousIds = useRef(new Set(project.modules.map((module) => module.id)));
  const [pending, setPending] = useState<Endpoint | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const cablePointer = useRef<Point | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [handMode, setHandMode] = useState(false);
  const drag = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    moduleX: number;
    moduleY: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  const pan = useRef<Point | null>(null);
  const gestures = useWorkspaceGestures(viewport, () => {
    drag.current = null;
    pan.current = null;
    setDragPreview(null);
  });
  const { view, size, zoom, setView, zoomAt, panByScreen, screenToWorld } = gestures;
  useEffect(() => {
    if (pending && cablePointer.current)
      setPointer(screenToWorld(cablePointer.current.x, cablePointer.current.y));
  }, [view, pending]);
  const fit = () => {
    if (viewport.current)
      setView(
        fittedView(moduleBounds(project.modules), {
          width: viewport.current.clientWidth,
          height: viewport.current.clientHeight,
        }),
      );
  };
  // Opening a patch frames its saved world positions, including negative/distant ones.
  useLayoutEffect(() => {
    drag.current = null;
    pan.current = null;
    setDragPreview(null);
    setPending(null);
    fit();
  }, [project.id]);
  useEffect(() => {
    onViewCentreChange({ x: view.x + size.width / zoom / 2, y: view.y + size.height / zoom / 2 });
  }, [view, size, onViewCentreChange]);
  const previousProject = useRef(project.id);
  useEffect(() => {
    const added = project.modules.filter((module) => !previousIds.current.has(module.id));
    previousIds.current = new Set(project.modules.map((module) => module.id));
    if (previousProject.current !== project.id) {
      previousProject.current = project.id;
      return;
    }
    if (added.length === 1 && viewport.current) {
      const module = added[0];
      const definition = MODULES[module.type];
      setSelected(module.id);
      // A placed module is already under the pointer; preserve the current camera.
      if (droppedModule.current === module.id) {
        droppedModule.current = null;
        return;
      }
      setView(
        viewAtAnchor(
          { x: module.x + definition.width / 2, y: module.y + definition.height / 2 },
          { x: viewport.current.clientWidth / 2, y: viewport.current.clientHeight / 2 },
          zoom,
        ),
      );
    }
  }, [project.modules]);
  const displayModules = project.modules.map((module) =>
    module.id === dragPreview?.id ? { ...module, x: dragPreview.x, y: dragPreview.y } : module,
  );
  const localPoint = (point: Point) => ({ x: point.x - view.x, y: point.y - view.y });
  const moveModule = (clientX: number, clientY: number) => {
    const current = drag.current;
    if (!current) return;
    const point = screenToWorld(clientX, clientY);
    const position = snapPosition(point.x - current.offsetX, point.y - current.offsetY);
    Object.assign(current, position, { clientX, clientY });
    setDragPreview({ id: current.id, ...position });
  };
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
    cablePointer.current = null;
    const module = displayModules.find((module) => module.id === endpoint.moduleId)!;
    setPointer(socketPosition(module, endpoint.portId));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.current) {
      panByScreen(pan.current.x - event.clientX, pan.current.y - event.clientY);
      pan.current = { x: event.clientX, y: event.clientY };
    }
    if (drag.current) moveModule(event.clientX, event.clientY);
    if (pending) {
      cablePointer.current = { x: event.clientX, y: event.clientY };
      setPointer(screenToWorld(event.clientX, event.clientY));
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

  const dropPosition = (type: ModuleType, clientX: number, clientY: number) => {
    const element = viewport.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    // Hit testing excludes the library, toolbar and overlays, even though the rack runs behind them.
    const target = document.elementFromPoint(clientX, clientY);
    if (
      !target ||
      (!element.contains(target) && !(libraryDrag && target.matches('.library-dismiss'))) ||
      clientX < rect.left ||
      clientX >= rect.right ||
      clientY < rect.top ||
      clientY >= rect.bottom
    )
      return null;
    const point = screenToWorld(clientX, clientY);
    return snapPosition(point.x - MODULES[type].width / 2, point.y - 30);
  };

  const addAtPointer = (type: ModuleType, clientX: number, clientY: number) => {
    const position = dropPosition(type, clientX, clientY);
    if (!position) return false;
    const definition = MODULES[type];
    if (project.modules.length >= CONFIG.maxModules) {
      notify(`You can add up to ${CONFIG.maxModules} modules.`);
      return false;
    }
    if (
      definition.maxInstances &&
      project.modules.filter((module) => module.type === type).length >= definition.maxInstances
    ) {
      notify('Your patch already has an Output module. Use a Merger or Mixer to combine sounds.');
      return false;
    }
    const module = createModule(type, position.x, position.y);
    droppedModule.current = module.id;
    commit((current) => ({ ...current, modules: [...current.modules, module] }));
    setSelected(module.id);
    notify(`${definition.name} added. Connect a cable to bring it into your patch.`);
    return true;
  };

  useEffect(() => {
    if (libraryDrag?.released)
      onLibraryDragFinish(addAtPointer(libraryDrag.type, libraryDrag.clientX, libraryDrag.clientY));
  }, [libraryDrag, onLibraryDragFinish]);

  const placement =
    libraryDrag && dropPosition(libraryDrag.type, libraryDrag.clientX, libraryDrag.clientY);
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const definition = Object.values(MODULES).find(
      (module) => module.type === event.dataTransfer.getData('application/patchwork-module'),
    );
    if (definition) addAtPointer(definition.type, event.clientX, event.clientY);
  };

  const livePlacement = useRef(libraryDrag);
  livePlacement.current = libraryDrag;
  const latestMove = useRef({ panByScreen, moveModule });
  latestMove.current = { panByScreen, moveModule };
  const dragging = dragPreview !== null || libraryDrag !== null;
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const current = drag.current ?? livePlacement.current;
      const element = viewport.current;
      if (current && element) {
        const rect = element.getBoundingClientRect();
        const point = { x: current.clientX - rect.left, y: current.clientY - rect.top };
        // Releases/invalid targets never navigate; a held pointer near a rack edge does.
        if (
          point.x >= 0 &&
          point.x <= rect.width &&
          point.y >= 0 &&
          point.y <= rect.height &&
          !livePlacement.current?.released &&
          (drag.current ||
            element.contains(document.elementFromPoint(current.clientX, current.clientY)))
        ) {
          const speed = edgePan(point, { width: rect.width, height: rect.height });
          const seconds = Math.min(0.05, (now - previous) / 1000);
          if (speed.x || speed.y) {
            latestMove.current.panByScreen(speed.x * seconds, speed.y * seconds);
            if (drag.current) latestMove.current.moveModule(current.clientX, current.clientY);
          }
        }
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging]);
  const gridSize =
    CONFIG.canvas.grid * zoom * Math.max(1, Math.ceil(8 / (CONFIG.canvas.grid * zoom)));

  return (
    <main className="workspace">
      <div className="workspace-heading">
        <div className="patch-breadcrumb">
          <button
            className="button library-toggle"
            aria-label="Add modules"
            onClick={onLibraryToggle}
            aria-expanded={libraryOpen}
            aria-controls="module-library"
          >
            <Plus size={16} /> <span>Add modules</span>
          </button>
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
            onClick={onFocusToggle}
            aria-label={focused ? 'Leave workspace focus' : 'Focus on workspace'}
            aria-pressed={focused}
            title={focused ? 'Show studio toolbar' : 'Focus on workspace'}
          >
            {focused ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
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
        className={`canvas-viewport ${dragOver || placement ? 'drag-over' : ''} ${handMode ? 'hand-mode' : ''}`}
        aria-label="Module workspace"
        data-zoom={zoom}
        style={{
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${(-view.x * zoom) % gridSize}px ${(-view.y * zoom) % gridSize}px`,
        }}
        tabIndex={0}
        onFocusCapture={(event) => {
          if (event.target === event.currentTarget) return;
          const target = event.target as HTMLElement;
          if (!target.closest('.module-panel')) return;
          if (zoom < CONFIG.canvas.minZoom) {
            const id = target.closest<HTMLElement>('[data-module-id]')?.dataset.moduleId;
            const module = project.modules.find((item) => item.id === id);
            if (module) setView(fittedView(moduleBounds([module]), size));
            return;
          }
          const rect = target.getBoundingClientRect();
          const frame = event.currentTarget.getBoundingClientRect();
          // Tabbing to an offscreen control should move the camera, not silently
          // introduce browser scroll offsets into a camera-only coordinate system.
          if (
            rect.left < frame.left ||
            rect.right > frame.right ||
            rect.top < frame.top ||
            rect.bottom > frame.bottom
          ) {
            const point = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
            setView(viewAtAnchor(point, { x: frame.width / 2, y: frame.height / 2 }, zoom));
          }
        }}
        onScroll={(event) => {
          // Browsers may attempt native focus/scrollIntoView on clipped descendants.
          event.currentTarget.scrollLeft = 0;
          event.currentTarget.scrollTop = 0;
        }}
        onPointerDownCapture={gestures.onPointerDownCapture}
        onPointerMoveCapture={gestures.onPointerMoveCapture}
        onPointerUpCapture={gestures.endTouch}
        onPointerCancelCapture={gestures.endTouch}
        onClickCapture={gestures.onClickCapture}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          drag.current = null;
          pan.current = null;
          setDragPreview(null);
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          pan.current = null;
          setDragPreview(null);
        }}
        onPointerDown={(event) => {
          if (
            event.target === event.currentTarget ||
            (event.target as Element).matches('.canvas-stage, .canvas-size')
          ) {
            setSelected(null);
            if ((handMode || event.pointerType === 'touch') && viewport.current) {
              pan.current = {
                x: event.clientX,
                y: event.clientY,
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
          if (event.key === 'Escape') {
            setPending(null);
            drag.current = null;
            pan.current = null;
            setDragPreview(null);
          }
          if (event.target !== event.currentTarget) return;
          const amount = CONFIG.canvas.keyboardPanPixels * (event.shiftKey ? 3 : 1);
          const directions: Record<string, Point> = {
            ArrowLeft: { x: -amount, y: 0 },
            ArrowRight: { x: amount, y: 0 },
            ArrowUp: { x: 0, y: -amount },
            ArrowDown: { x: 0, y: amount },
          };
          if (directions[event.key]) {
            event.preventDefault();
            const delta = directions[event.key];
            panByScreen(delta.x, delta.y);
          }
          if (event.key === 'Home') {
            event.preventDefault();
            fit();
          }
        }}
      >
        <div className="canvas-size" style={{ width: size.width, height: size.height }}>
          <div
            className="canvas-stage"
            style={{
              width: size.width,
              height: size.height,
            }}
          >
            {libraryDrag && placement && (
              <div
                className="library-drop-preview"
                style={{
                  left: (placement.x - view.x) * zoom,
                  top: (placement.y - view.y) * zoom,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  width: MODULES[libraryDrag.type].width,
                  height: MODULES[libraryDrag.type].height,
                  borderColor: MODULES[libraryDrag.type].color,
                }}
              >
                <Plus size={20} />
                <strong>{MODULES[libraryDrag.type].name}</strong>
                <span>Release to place</span>
              </div>
            )}
            {displayModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                position={localPoint(module)}
                scale={zoom}
                project={project}
                selected={module.id === selected}
                step={step}
                drumStep={drumStep}
                live={live}
                microphone={microphone}
                audioActive={audioActive}
                engine={engine}
                playing={playing}
                pending={pending}
                onSelect={() => setSelected(module.id)}
                onDragStart={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const point = screenToWorld(event.clientX, event.clientY);
                  drag.current = {
                    id: module.id,
                    offsetX: point.x - module.x,
                    offsetY: point.y - module.y,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    moduleX: module.x,
                    moduleY: module.y,
                    x: module.x,
                    y: module.y,
                  };
                  setDragPreview({ id: module.id, x: module.x, y: module.y });
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
                onParameters={(values, group) =>
                  commit(
                    (current) => ({
                      ...current,
                      modules: current.modules.map((item) =>
                        item.id === module.id
                          ? { ...item, parameters: { ...item.parameters, ...values } }
                          : item,
                      ),
                    }),
                    group ? `${module.id}:${group}` : '',
                  )
                }
                onSample={(slot, sample) => {
                  const accepted = setSample(module.id, slot, sample);
                  if (!accepted)
                    notify(
                      'This sample exceeds the patch storage limit. Remove an unused sample first.',
                    );
                  return accepted;
                }}
                onStep={(index, next, group) =>
                  commit(
                    (current) => ({
                      ...current,
                      modules: current.modules.map((item) =>
                        item.id === module.id && item.steps
                          ? {
                              ...item,
                              steps: item.steps.map((degree, position) =>
                                position === index
                                  ? next === 'next'
                                    ? (degree + 1) % (SEQUENCER_DEGREES.max + 1)
                                    : next
                                  : degree,
                              ),
                            }
                          : item,
                      ),
                    }),
                    group ? `${module.id}:step:${index}:${group}` : '',
                  )
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
              width={size.width}
              height={size.height}
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
              <g transform={`scale(${zoom})`}>
                {project.cables.map((cable) => {
                  const fromModule = displayModules.find(
                    (module) => module.id === cable.from.moduleId,
                  );
                  const toModule = displayModules.find((module) => module.id === cable.to.moduleId);
                  const signal = getPort(project, cable.from)?.signal;
                  if (!fromModule || !toModule || !signal) return null;
                  const from = localPoint(socketPosition(fromModule, cable.from.portId));
                  const to = localPoint(socketPosition(toModule, cable.to.portId));
                  // The curve stays between its endpoint Xs and sags at most 200px.
                  // Links wholly outside that hull cannot enter the visible viewport.
                  if (
                    Math.max(from.x, to.x) < -20 ||
                    Math.min(from.x, to.x) > size.width / zoom + 20 ||
                    Math.max(from.y, to.y) < -220 ||
                    Math.min(from.y, to.y) > size.height / zoom + 20
                  )
                    return null;
                  return (
                    <PatchCable
                      key={cable.id}
                      from={from}
                      to={to}
                      fromModule={fromModule}
                      toModule={toModule}
                      signal={signal}
                      cableStyle={cableStyle}
                      cableOpacity={cableOpacity}
                      onUnplug={() =>
                        commit((current) => ({
                          ...current,
                          cables: current.cables.filter((item) => item.id !== cable.id),
                        }))
                      }
                    />
                  );
                })}
                {pending &&
                  (() => {
                    const module = displayModules.find((module) => module.id === pending.moduleId);
                    if (!module) return null;
                    return (
                      <path
                        className="pending-cable"
                        d={cablePath(
                          localPoint(socketPosition(module, pending.portId)),
                          localPoint(pointer),
                        )}
                      />
                    );
                  })()}
              </g>
            </svg>
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
        <button onClick={() => zoomAt(zoom / CONFIG.canvas.zoomButtonFactor)} aria-label="Zoom out">
          <Minus size={16} />
        </button>
        <span className="zoom-value">{zoom < 0.01 ? '<1' : Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomAt(zoom * CONFIG.canvas.zoomButtonFactor)} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <span className="control-divider" />
        <button onClick={fit} title="Fit all modules in view" aria-label="Fit modules to view">
          <Maximize size={16} />
        </button>
      </div>
    </main>
  );
}
