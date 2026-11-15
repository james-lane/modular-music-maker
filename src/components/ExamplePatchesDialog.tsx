import { ArrowUpRight, AudioLines } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { EXAMPLE_PATCHES, type ExamplePatch } from '../domain/examples';
import type { Project } from '../domain/types';
import { Modal } from './Dialogs';

/** Small vector motifs echo each patch's sound without downloading audio or starting playback. */
function ExampleArtwork({ kind }: { kind: ExamplePatch['artwork'] }) {
  const paths: Record<ExamplePatch['artwork'], string> = {
    melody: 'M4 40 Q14 8 24 40 T44 40 T64 40 T84 40 T104 40 T124 40 T144 40',
    performance: 'M8 20H28V36H8ZM40 20H60V36H40ZM72 20H92V36H72ZM104 20H124V36H104ZM8 48H124',
    bass: 'M4 52H12V15H26V52H44V15H58V52H76V15H90V52H108V15H122V52H148',
    texture:
      'M4 42C20 4 36 4 52 42S84 80 100 42S132 4 148 42M4 52C20 14 36 14 52 52S84 90 100 52S132 14 148 52',
    arcade: 'M4 52V32H22V14H40V32H58V14H76V4H94V14H112V32H130V52H148',
    ensemble:
      'M4 14H30V32H4ZM4 46H30V64H4ZM48 14H74V32H48ZM48 46H74V64H48ZM30 23H40V55H48M30 55H40M74 23H88V39H104M74 55H88V39M104 27H128V51H104ZM128 39H148',
    xy: 'M24 8H128V68H24ZM76 8V68M24 38H128M44 56Q76 12 108 24M102 24a6 6 0 1 0 12 0a6 6 0 1 0-12 0',
  };
  return (
    <svg viewBox="0 0 152 76" fill="none" aria-hidden="true">
      <path d={paths[kind]} stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function ExamplePatchesDialog({
  onOpen,
  onClose,
}: {
  onOpen: (project: Project) => Promise<void>;
  onClose: () => void;
}) {
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');

  const open = async (example: ExamplePatch) => {
    if (opening) return;
    setOpening(example.id);
    setError('');
    try {
      await onOpen(example.create());
    } catch {
      setError('This patch could not be opened. Please try again.');
      setOpening(null);
    }
  };

  return (
    <Modal
      title={`${EXAMPLE_PATCHES.length} ways to start.`}
      eyebrow="EXAMPLE PATCHES · VOL. 01"
      className="examples-dialog"
      wide
      onClose={onClose}
    >
      <div className="examples-body">
        <p className="examples-intro">
          Choose a sound, press Play, and make it yours. Every cable is connected and ready to
          explore.
        </p>
        <div className="example-patches">
          {EXAMPLE_PATCHES.map((example, index) => (
            <button
              key={example.id}
              className="example-patch"
              style={{ '--example-color': example.color } as CSSProperties}
              aria-label={`Open ${example.name} example`}
              disabled={opening !== null}
              onClick={() => void open(example)}
            >
              <span className="example-artwork">
                <span className="example-number">{String(index + 1).padStart(2, '0')}</span>
                <ExampleArtwork kind={example.artwork} />
                <span className="example-style">{example.style}</span>
              </span>
              <span className="example-copy">
                <strong className="example-name">{example.name}</strong>
                <span className="example-description">{example.description}</span>
                <span className="example-tip">{example.tryThis}</span>
                <span className="example-open">
                  {opening === example.id ? 'Opening…' : 'Open patch'} <ArrowUpRight size={15} />
                </span>
              </span>
            </button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
      <p className="examples-footer">
        <AudioLines size={16} /> Opens a fresh copy. Your current patch stays in My patches.
      </p>
    </Modal>
  );
}
