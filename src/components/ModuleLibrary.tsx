import {
  AudioLines,
  ChevronDown,
  CircleHelp,
  Grid2X2,
  Plus,
  Search,
  SlidersHorizontal,
  Waves,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MODULE_LIST } from '../domain/modules';
import type { Category, ModuleType } from '../domain/types';
import { Waveform } from './Waveform';

export function ModuleLibrary({
  onAdd,
  onHelp,
  onModuleHelp,
  open,
  onClose,
}: {
  onAdd: (type: ModuleType) => void;
  onHelp: () => void;
  onModuleHelp: (type: ModuleType) => void;
  open: boolean;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open)
      panel.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }, [open]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'All modules'>('All modules');
  const filtered = MODULE_LIST.filter(
    (module) =>
      (category === 'All modules' || category === module.category) &&
      `${module.name} ${module.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const categories = [
    { label: 'All modules', icon: Grid2X2 },
    { label: 'Sources', icon: AudioLines },
    { label: 'Modulation', icon: Waves },
    { label: 'Effects', icon: SlidersHorizontal },
    { label: 'Utility', icon: Plus },
  ] as const;
  return (
    <aside
      id="module-library"
      ref={panel}
      aria-label="Module library"
      className={`module-library ${open ? 'is-open' : ''}`}
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
      <p className="library-intro">Good sounds start with a little curiosity.</p>
      <label className="search-field">
        <Search size={16} />
        <input
          aria-label="Search modules"
          placeholder="Find a module…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <kbd>⌕</kbd>
      </label>
      <nav className="library-categories" aria-label="Module categories">
        {categories.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={category === label ? 'active' : ''}
            onClick={() => setCategory(label)}
          >
            <Icon size={16} />
            <span>{label}</span>
            <small>
              {label === 'All modules'
                ? MODULE_LIST.length
                : MODULE_LIST.filter((module) => module.category === label).length}
            </small>
          </button>
        ))}
      </nav>
      <div className="library-section-title">
        <span>{category === 'All modules' ? 'THE BUILDING BLOCKS' : category.toUpperCase()}</span>
        <ChevronDown size={13} />
      </div>
      <div className="library-modules">
        {filtered.map((module) => (
          <div
            key={module.type}
            className="library-module"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/patchwork-module', module.type);
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
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
            <div>
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
        <div className="library-tip">
          <span className="tip-plus">↗</span>
          <p>
            Drag a module into your workspace.
            <br />
            See where it takes you.
          </p>
        </div>
        <button className="help-link" onClick={onHelp}>
          <CircleHelp size={15} /> A little help getting started <span>↗</span>
        </button>
      </div>
    </aside>
  );
}
