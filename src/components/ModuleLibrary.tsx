import { GripVertical, CircleHelp, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { MODULE_LIST } from '../domain/modules';
import type { Category, ModuleType } from '../domain/types';
import { useModuleLibraryDrag, type ModuleLibraryDrag } from '../hooks/useModuleLibraryDrag';
import { Waveform } from './Waveform';

export function ModuleLibrary({
  onAdd,
  onHelp,
  onModuleHelp,
  open,
  onClose,
  drag,
  onDragChange,
}: {
  onAdd: (type: ModuleType) => void;
  onHelp: () => void;
  onModuleHelp: (type: ModuleType) => void;
  open: boolean;
  onClose: () => void;
  drag: ModuleLibraryDrag | null;
  onDragChange: (drag: ModuleLibraryDrag | null) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector<HTMLButtonElement>('.library-close')
        ?.focus({ preventScroll: true });
  }, [open]);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const moduleDrag = useModuleLibraryDrag(onDragChange, open);
  const [category, setCategory] = useState<Category | 'All modules'>('All modules');
  const filtered = MODULE_LIST.filter(
    (module) =>
      (category === 'All modules' || category === module.category) &&
      `${module.name} ${module.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const categories = ['All modules', 'Sources', 'Modulation', 'Effects', 'Utility'] as const;
  return (
    <aside
      id="module-library"
      ref={panel}
      aria-label="Module library"
      className={`module-library ${open ? 'is-open' : ''} ${drag ? 'is-dragging' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="library-heading">
        <h2>Module library</h2>
        <span>{MODULE_LIST.length}</span>
        <button
          className="icon-button library-close"
          onClick={onClose}
          aria-label="Close module library"
        >
          <X size={18} />
        </button>
      </div>
      <div className="library-tools">
        <p>Drag a grip to place, or tap + to add.</p>
        <button
          ref={searchToggle}
          className="icon-button library-search-toggle"
          aria-label="Search modules"
          aria-expanded={searchOpen}
          aria-controls="module-library-search"
          onClick={() => {
            flushSync(() => setSearchOpen((value) => !value));
            // Focus during the explicit tap so iPad can open its keyboard when requested.
            if (!searchOpen) {
              searchInput.current?.focus();
            } else {
              setSearch('');
              searchToggle.current?.focus();
            }
          }}
        >
          <Search size={17} />
        </button>
      </div>
      <label className="search-field" id="module-library-search" hidden={!searchOpen}>
        <Search size={16} />
        <input
          ref={searchInput}
          aria-label="Find a module"
          placeholder="Find a module…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          className="icon-button"
          aria-label="Close module search"
          onClick={() => {
            setSearch('');
            setSearchOpen(false);
            searchToggle.current?.focus();
          }}
        >
          <X size={14} />
        </button>
      </label>
      <nav className="library-categories" aria-label="Module categories">
        {categories.map((label) => (
          <button
            key={label}
            className={category === label ? 'active' : ''}
            aria-pressed={category === label}
            onClick={() => setCategory(label)}
          >
            <span>{label === 'All modules' ? 'All' : label}</span>
            {label === 'All modules' && <small>{MODULE_LIST.length}</small>}
          </button>
        ))}
      </nav>
      <div className="library-section-title" role="status">
        {filtered.length} {filtered.length === 1 ? 'module' : 'modules'}
      </div>
      <div className="library-modules">
        {filtered.map((module) => (
          <div
            key={module.type}
            className="library-module"
            onPointerDown={(event) => moduleDrag.start(event, module.type)}
            onPointerMove={moduleDrag.move}
            onPointerUp={moduleDrag.end}
            onPointerCancel={moduleDrag.cancel}
            onLostPointerCapture={moduleDrag.cancel}
            onClickCapture={moduleDrag.click}
          >
            <span className="library-drag-handle" aria-hidden="true" title="Drag to workspace">
              <GripVertical size={16} />
            </span>
            <div
              className="library-module-icon"
              style={{
                color: module.color,
                background: `color-mix(in srgb, ${module.color} 13%, #f9f5ed)`,
              }}
            >
              <Waveform
                type={module.type}
                waveform={module.type === 'oscillator' ? 'sawtooth' : 'sine'}
              />
            </div>
            <div className="library-module-copy">
              <strong>{module.name}</strong>
              <p>{module.description}</p>
            </div>
            <div className="library-module-actions">
              <button
                className="module-help-button"
                draggable={false}
                aria-haspopup="dialog"
                aria-label={`How to use ${module.name}`}
                title={`How to use ${module.name}`}
                onPointerDown={(event) => event.stopPropagation()}
                onDragStart={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.currentTarget.focus();
                  onModuleHelp(module.type);
                }}
              >
                <CircleHelp size={14} />
              </button>
              <button
                className="add-module-button"
                aria-label={`Add ${module.name}`}
                title={`Add ${module.name}`}
                onClick={() => onAdd(module.type)}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        ))}
        {!filtered.length && <p className="empty-search">No modules found. Try another name.</p>}
      </div>
      <div className="library-footer">
        <button className="help-link" onClick={onHelp}>
          <CircleHelp size={15} /> Getting started <span>↗</span>
        </button>
      </div>
    </aside>
  );
}
