import { ArrowLeft, ArrowRight, Cable, Lightbulb } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MODULE_GUIDES, compatiblePorts } from '../domain/module-guides';
import { createModuleDemo } from '../domain/module-demos';
import { MODULES } from '../domain/modules';
import type { ModuleType, PortDefinition, Project } from '../domain/types';
import { Modal } from './Dialogs';
import { Waveform } from './Waveform';

function CompatibleSockets({
  type,
  onExplore,
}: {
  type: ModuleType;
  onExplore: (type: ModuleType) => void;
}) {
  // Equivalent sockets (for example Mixer IN A and IN B) share one list of partners.
  const groups = new Map<string, PortDefinition[]>();
  for (const port of MODULES[type].ports) {
    const key = `${port.direction}:${port.signal}`;
    groups.set(key, [...(groups.get(key) ?? []), port]);
  }
  return (
    <div className="guide-socket-groups">
      {[...groups].map(([key, ports]) => {
        const socket = ports[0];
        const partners = new Map<ModuleType, string[]>();
        for (const match of compatiblePorts(type, socket.id))
          partners.set(match.module, [...(partners.get(match.module) ?? []), match.port.label]);
        return (
          <div className="guide-socket-group" key={key}>
            <div className="guide-socket-heading">
              <span className={`guide-signal signal-${socket.signal}`}>
                {socket.signal === 'control' ? 'modulation' : socket.signal}
              </span>
              <strong>{ports.map((port) => port.label).join(' / ')}</strong>
              <span>{socket.direction === 'output' ? 'can send to' : 'can receive from'}</span>
            </div>
            <div className="guide-compatible-modules">
              {[...partners].map(([partner, labels]) => (
                <button
                  key={partner}
                  aria-label={`Read ${MODULES[partner].name} guide`}
                  onClick={() => onExplore(partner)}
                >
                  <i style={{ background: MODULES[partner].color }} />
                  <span>
                    <strong>{MODULES[partner].name}</strong>
                    <small>{labels.join(' / ')}</small>
                  </span>
                  <ArrowRight size={12} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Browsing remains silent/read-only. Only the explicit demo action switches patches. */
export function ModuleHelpDialog({
  initialType,
  onClose,
  onOpen,
}: {
  onOpen: (project: Project, instructions: string) => Promise<void>;
  initialType: ModuleType;
  onClose: () => void;
}) {
  const [trail, setTrail] = useState<ModuleType[]>([initialType]);
  const type = trail[trail.length - 1];
  const definition = MODULES[type];
  const guide = MODULE_GUIDES[type];
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const explore = (next: ModuleType) => setTrail((current) => [...current, next]);

  useEffect(() => {
    // A related guide starts at its beginning, with focus restored inside the current modal.
    body.current?.closest('dialog')?.scrollTo({ top: 0 });
    body.current?.focus({ preventScroll: true });
  }, [type]);

  const loadDemo = async () => {
    if (opening) return;
    setOpening(true);
    setError('');
    try {
      const demo = createModuleDemo(type);
      await onOpen(demo.project, demo.instructions);
    } catch {
      setError('Could not open the demo. Your current patch is still available.');
      setOpening(false);
    }
  };

  return (
    <Modal
      title={`How to use ${definition.name}`}
      eyebrow={`MODULE GUIDE · ${definition.code}`}
      wide
      className="module-help-dialog"
      onClose={onClose}
    >
      <div
        className="module-guide-body"
        ref={body}
        tabIndex={-1}
        role="region"
        aria-label={`${definition.name} guide`}
        style={{ '--guide-color': definition.color } as CSSProperties}
      >
        {trail.length > 1 && (
          <button
            className="guide-back"
            onClick={() => setTrail((current) => current.slice(0, -1))}
          >
            <ArrowLeft size={14} /> Back to {MODULES[trail[trail.length - 2]].name}
          </button>
        )}
        <div className="guide-summary">
          <span className="guide-module-symbol">
            <Waveform type={type} waveform={type === 'oscillator' ? 'sawtooth' : 'sine'} />
          </span>
          <div>
            <span className="guide-category">{definition.category}</span>
            <p>{guide.overview}</p>
          </div>
        </div>
        <div className="guide-demo-action">
          <button
            className="button primary guide-load-demo"
            disabled={opening}
            aria-label={`Load ${definition.name} demo patch`}
            onClick={() => void loadDemo()}
          >
            {opening ? 'Opening…' : 'Load demo patch'}
          </button>
          <p className="guide-demo-note">
            Opens a temporary demo. Choose Save patch to keep your edits. Saved work stays in My
            patches. Audio waits for Play or a live key/pad.
          </p>
          {error && <p role="alert">{error}</p>}
        </div>
        <div className="guide-instructions">
          <section aria-label="How to use this module">
            <h3>Start here</h3>
            <ol className="guide-steps">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
          <section aria-label="Module controls">
            <h3>What to adjust</h3>
            <dl className="guide-controls">
              {definition.controls.map((control) => (
                <div key={control.id}>
                  <dt>{control.label}</dt>
                  <dd>{guide.controls[control.id]}</dd>
                </div>
              ))}
              {guide.extraControls?.map((control) => (
                <div key={control.label}>
                  <dt>{control.label}</dt>
                  <dd>{control.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
        <section className="guide-connections" aria-label="Web MIDI compatibility">
          <h3>Web MIDI compatibility</h3>
          <p>{guide.midi}</p>
        </section>
        <div className="guide-tip">
          <Lightbulb size={17} />
          <p>{guide.tip}</p>
        </div>
        <section className="guide-connections" aria-label="Compatible modules">
          <h3>
            <Cable size={17} /> Connect it with
          </h3>
          <p className="guide-section-intro">
            Match these sockets. Select a module below to open its guide.
          </p>
          <CompatibleSockets type={type} onExplore={explore} />
          <p className="guide-wiring-note">
            Each input takes one cable. Unplug an occupied input before connecting another source.
          </p>
        </section>
        <section className="guide-example" aria-label="Example patch">
          <h3>Try this patch</h3>
          <div className="guide-example-card">
            <h4>{guide.example.title}</h4>
            <p>{guide.example.description}</p>
            <ol className="guide-wire-list">
              {guide.example.connections.map((connection, index) => (
                <li className="guide-wire" key={index}>
                  <span>
                    <strong>{MODULES[connection.from.module].name}</strong>
                    <small>
                      {connection.from.instance && `${connection.from.instance} · `}
                      {
                        MODULES[connection.from.module].ports.find(
                          (port) => port.id === connection.from.port,
                        )!.label
                      }
                    </small>
                  </span>
                  <ArrowRight size={16} />
                  <span>
                    <strong>{MODULES[connection.to.module].name}</strong>
                    <small>
                      {connection.to.instance && `${connection.to.instance} · `}
                      {
                        MODULES[connection.to.module].ports.find(
                          (port) => port.id === connection.to.port,
                        )!.label
                      }
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
      <div className="guide-dialog-footer">
        <span>Follow your ears. There’s room to experiment.</span>
        <button className="button primary" onClick={onClose}>
          Back to studio
        </button>
      </div>
    </Modal>
  );
}
