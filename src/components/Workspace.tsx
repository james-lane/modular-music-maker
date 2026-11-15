import type { PlaybackPosition } from '../audio/playback-position';
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
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from 'react';
import type { AudioEngine } from '../audio/engine';
import { CONFIG } from '../config';
import { MODULES } from '../domain/modules';
import { connectionError, createModule, getPort } from '../domain/project';
import type { DrumSample, Endpoint, ModuleType, PatchModule, Project } from '../domain/types';
import type { CableStyle } from '../domain/preferences';
import { ModuleDrag } from './module-drag';
import { WorkspaceModule } from './WorkspaceModule';
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
  playbackPosition: PlaybackPosition;
  live: LiveControls;
  audioActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  historyNavigation: number;
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
  playbackPosition,
  live,
  audioActive,
  canUndo,
  canRedo,
  undo,
  redo,
  historyNavigation,
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
  const [drag] = useState(() => new ModuleDrag());
  const pan = useRef<(Point & { pointerId: number }) | null>(null);
  const gestures = useWorkspaceGestures(
    viewport,
    () => {
      drag.cancel();
      pan.current = null;
      setDragPreview(null);
    },
    audioActive ? CONFIG.canvas.playbackGestureIntervalMs : 0,
  );
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
    drag.cancel();
    pan.current = null;
    setDragPreview(null);
    setPending(null);
    fit();
  }, [project.id]);
  // Restoring a snapshot also abandons transient wiring/movement from the old graph.
  useLayoutEffect(() => {
    drag.cancel();
    pan.current = null;
    setDragPreview(null);
    setPending(null);
  }, [historyNavigation]);
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
  const displayModules = useMemo(
    () =>
      project.modules.map((module) =>
        module.id === dragPreview?.id ? { ...module, x: dragPreview.x, y: dragPreview.y } : module,
      ),
    [project.modules, dragPreview],
  );
  const drawingBounds = useMemo(() => moduleBounds(displayModules), [displayModules]);
  const compactDrawing =
    drawingBounds.width <= CONFIG.canvas.maxCompositedSpan &&
    drawingBounds.height <= CONFIG.canvas.maxCompositedSpan;
  // Compact patches keep an origin anchored to their content: crossing a camera
  // tile must not suddenly re-render every instrument during a performance.
  // Dispersed patches use a floating camera origin to bound layout coordinates.
  const originX = compactDrawing
    ? drawingBounds.x
    : Math.floor(view.x / CONFIG.canvas.renderOriginSize) * CONFIG.canvas.renderOriginSize;
  const originY = compactDrawing
    ? drawingBounds.y
    : Math.floor(view.y / CONFIG.canvas.renderOriginSize) * CONFIG.canvas.renderOriginSize;
  const offsetX = (originX - view.x) * zoom;
  const offsetY = (originY - view.y) * zoom;
  // CSS layout coordinates have a smaller usable range than our saved world.
  // Exceptionally spread-out patches retain per-panel screen placement so Fit and
  // keyboard recovery still work across the entire ±1 billion import guard.
  const sharedSurface = displayModules.every(
    (module) =>
      Math.abs(module.x - originX) <= CONFIG.canvas.maxLocalDrawingCoordinate &&
      Math.abs(module.y - originY) <= CONFIG.canvas.maxLocalDrawingCoordinate,
  );
  const compositedSurface =
    sharedSurface &&
    [
      drawingBounds.x - originX,
      drawingBounds.x + drawingBounds.width - originX,
      drawingBounds.y - originY,
      drawingBounds.y + drawingBounds.height - originY,
    ].every((coordinate) => Math.abs(coordinate) <= CONFIG.canvas.maxCompositedSpan);
  const cableModels = useMemo(() => {
    const modules = new Map(displayModules.map((module) => [module.id, module]));
    return project.cables.flatMap((cable) => {
      const fromModule = modules.get(cable.from.moduleId);
      const toModule = modules.get(cable.to.moduleId);
      const signal =
        fromModule &&
        MODULES[fromModule.type].ports.find((port) => port.id === cable.from.portId)?.signal;
      if (!fromModule || !toModule || !signal) return [];
      const start = socketPosition(fromModule, cable.from.portId);
      const end = socketPosition(toModule, cable.to.portId);
      return [
        {
          cable,
          fromModule,
          toModule,
          signal,
          from: { x: start.x - originX, y: start.y - originY },
          to: { x: end.x - originX, y: end.y - originY },
          // Calculate before rebasing: subtracting two rebased floats can introduce
          // rounding differences that needlessly regenerate every braided strand.
          span: { x: end.x - start.x, y: end.y - start.y },
        },
      ];
    });
  }, [displayModules, project.cables, originX, originY]);
  const unplug = useCallback(
    (id: string) => {
      commit((current) => ({
        ...current,
        cables: current.cables.filter((cable) => cable.id !== id),
      }));
    },
    [commit],
  );

  const startModuleDrag = useCallback(
    (module: PatchModule, event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || drag.current || !viewport.current) return;
      event.stopPropagation();
      event.preventDefault();
      // Capture on the stable rack, not the panel whose position/origin changes.
      // Descendant controls keep their own capture for knobs, keys and pads.
      viewport.current.setPointerCapture(event.pointerId);
      viewport.current.focus({ preventScroll: true });
      drag.start(module, event, screenToWorld(event.clientX, event.clientY));
      setDragPreview({ id: module.id, x: module.x, y: module.y });
      setSelected(module.id);
    },
    [screenToWorld, drag],
  );
  const moduleRemoved = useCallback((id: string) => {
    setPending((current) => (current?.moduleId === id ? null : current));
  }, []);
  const moveModule = (clientX: number, clientY: number, pointerId = drag.current?.pointerId) => {
    if (pointerId === undefined) return;
    const position = drag.move({ pointerId, clientX, clientY }, screenToWorld(clientX, clientY));
    if (position) setDragPreview({ id: position.id, x: position.x, y: position.y });
  };
  const portClick = useCallback(
    (endpoint: Endpoint) => {
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
    },
    [project, pending, displayModules, commit, notify],
  );

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.current?.pointerId === event.pointerId) {
      panByScreen(pan.current.x - event.clientX, pan.current.y - event.clientY);
      pan.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    }
    if (drag.current) moveModule(event.clientX, event.clientY, event.pointerId);
    if (pending) {
      cablePointer.current = { x: event.clientX, y: event.clientY };
      setPointer(screenToWorld(event.clientX, event.clientY));
    }
  };
  const saveDrag = (position: ModuleDrag['current']) => {
    if (position && (position.x !== position.moduleX || position.y !== position.moduleY))
      commit((current) => ({
        ...current,
        modules: current.modules.map((module) =>
          module.id === position.id ? { ...module, x: position.x, y: position.y } : module,
        ),
      }));
    if (!drag.current) setDragPreview(null);
  };
  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId)
      saveDrag(drag.release(event, screenToWorld(event.clientX, event.clientY)));
    if (pan.current?.pointerId === event.pointerId) pan.current = null;
  };
  const cancelPointer = (event: PointerEvent<HTMLDivElement>) => {
    drag.cancel(event.pointerId);
    if (!drag.current) setDragPreview(null);
    if (pan.current?.pointerId === event.pointerId) pan.current = null;
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
            title="Redo (⌘/Ctrl Shift Z or Ctrl Y)"
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
        onPointerUpCapture={(event) => {
          gestures.endTouch(event);
          // Finalize before a descendant can consume the release event.
          finishDrag(event);
        }}
        onPointerCancelCapture={gestures.endTouch}
        onClickCapture={gestures.onClickCapture}
        onPointerMove={onPointerMove}
        onPointerCancel={cancelPointer}
        onLostPointerCapture={(event) => {
          // Knob/key/pad capture-loss bubbles through the rack too. It must not
          // cancel a module move or pan owned by a different surface/pointer.
          if (event.target !== event.currentTarget) return;
          saveDrag(drag.lostCapture(event.pointerId, event.buttons));
          if (pan.current?.pointerId === event.pointerId) pan.current = null;
        }}
        onPointerDown={(event) => {
          if (
            event.target === event.currentTarget ||
            (event.target as Element).matches('.canvas-stage, .canvas-size, .module-surface')
          ) {
            setSelected(null);
            if ((handMode || event.pointerType === 'touch') && viewport.current) {
              pan.current = {
                x: event.clientX,
                y: event.clientY,
                pointerId: event.pointerId,
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
            drag.cancel();
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
            <div
              className="module-surface"
              style={{
                transform: sharedSurface
                  ? `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`
                  : undefined,
                willChange: compositedSurface ? 'transform' : undefined,
              }}
            >
              {displayModules.map((module) => (
                <WorkspaceModule
                  key={module.id}
                  module={module}
                  project={project}
                  originX={sharedSurface ? originX : view.x}
                  originY={sharedSurface ? originY : view.y}
                  scale={sharedSurface ? 1 : zoom}
                  selected={module.id === selected}
                  playbackPosition={playbackPosition}
                  live={live}
                  microphone={microphone}
                  audioActive={audioActive}
                  engine={engine}
                  playing={playing}
                  pending={pending}
                  commit={commit}
                  setSample={setSample}
                  notify={notify}
                  onSelect={setSelected}
                  onDragStart={startModuleDrag}
                  onPort={portClick}
                  onRemoved={moduleRemoved}
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
                <g
                  transform={
                    sharedSurface ? undefined : `translate(${offsetX},${offsetY}) scale(${zoom})`
                  }
                >
                  {cableModels.map(({ cable, fromModule, toModule, signal, from, to, span }) => {
                    // Keep the SVG viewport-sized. Curves outside their endpoint hull
                    // plus the bounded sag cannot enter the view, even after rebasing.
                    const left = view.x - originX;
                    const top = view.y - originY;
                    if (
                      Math.max(from.x, to.x) < left - 20 ||
                      Math.min(from.x, to.x) > left + size.width / zoom + 20 ||
                      Math.max(from.y, to.y) < top - 220 ||
                      Math.min(from.y, to.y) > top + size.height / zoom + 20
                    )
                      return null;
                    return (
                      <PatchCable
                        key={cable.id}
                        id={cable.id}
                        from={from}
                        span={span}
                        fromModule={fromModule}
                        toModule={toModule}
                        signal={signal}
                        cableStyle={cableStyle}
                        cableOpacity={cableOpacity}
                        onUnplug={unplug}
                      />
                    );
                  })}
                  {pending &&
                    (() => {
                      const module = displayModules.find(
                        (module) => module.id === pending.moduleId,
                      );
                      if (!module) return null;
                      return (
                        <path
                          className="pending-cable"
                          d={cablePath(
                            {
                              x: socketPosition(module, pending.portId).x - originX,
                              y: socketPosition(module, pending.portId).y - originY,
                            },
                            { x: pointer.x - originX, y: pointer.y - originY },
                          )}
                        />
                      );
                    })()}
                </g>
              </svg>
            </div>
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
