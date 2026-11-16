import { ArrowUpRight, AudioLines, FolderOpen, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { listAllProjects } from '../domain/storage';
import type { Project } from '../domain/types';
import { Modal } from './Dialogs';

export function PatchLibraryDialog({
  activeProject,
  onDelete,
  onClose,
  onOpen,
  onNew,
  onImport,
  notify,
}: {
  activeProject: Project;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  onOpen: (project: Project) => void;
  onNew: () => void;
  onImport: () => void;
  notify: (message: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const focusDeleteAction = (id?: string) =>
    requestAnimationFrame(() => {
      const button =
        (id
          ? list.current?.querySelector<HTMLButtonElement>(
              `[data-patch-id="${id}"] .patch-delete-button`,
            )
          : null) ??
        list.current?.querySelector<HTMLButtonElement>('.patch-delete-button') ??
        list.current?.closest('dialog')?.querySelector<HTMLButtonElement>('.dialog-toolbar button');
      button?.focus();
    });
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void listAllProjects()
      .then((result) => {
        if (active)
          setProjects([
            activeProject,
            ...result.filter((project) => project.id !== activeProject.id),
          ]);
      })
      .catch(() => {
        if (active) {
          setProjects([activeProject]);
          notify('The patch library could not be loaded.');
        }
      });
    return () => {
      active = false;
    };
  }, [activeProject, notify]);
  const remove = async (project: Project) => {
    if (deleting) return;
    setDeleting(project.id);
    setError('');
    try {
      await onDelete(project.id);
      setProjects((current) => current?.filter((item) => item.id !== project.id) ?? null);
      setConfirming(null);
      focusDeleteAction();
      notify(`“${project.name}” deleted. Saved recordings are kept.`);
    } catch {
      setError(
        'This patch could not be deleted. Your open patch is still available; check that browser storage is allowed.',
      );
    } finally {
      setDeleting(null);
    }
  };
  return (
    <Modal title="Your little collection." eyebrow="MY PATCHES" onClose={onClose} wide>
      <p className="dialog-intro">
        Good ideas deserve another listen. Your patches are saved on this device.
      </p>
      <div className="dialog-toolbar">
        <button className="button primary" onClick={onNew} disabled={deleting !== null}>
          <Plus size={16} /> New patch
        </button>
        <button className="button" onClick={onImport} disabled={deleting !== null}>
          <Upload size={16} /> Import patch
        </button>
      </div>
      {error && (
        <p role="alert" className="patch-delete-error">
          {error}
        </p>
      )}
      <div className="saved-patches" ref={list}>
        {projects === null ? (
          <p className="dialog-empty">Opening your patch collection…</p>
        ) : (
          projects.map((project) => (
            <div className="saved-patch-entry" key={project.id} data-patch-id={project.id}>
              <button
                className="saved-patch"
                aria-label={`Open ${project.name}`}
                onClick={() => onOpen(project)}
                disabled={deleting !== null}
              >
                <span className="saved-patch-art">
                  <AudioLines size={27} />
                </span>
                <span>
                  <strong>{project.name}</strong>
                  <small>
                    {project.modules.length} {project.modules.length === 1 ? 'module' : 'modules'} ·{' '}
                    {project.tempo} BPM · {project.rootNote} {project.scale}
                  </small>
                  <em>
                    {new Date(project.updatedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {project.id === activeProject.id ? ' · Open now' : ''}
                  </em>
                </span>
                <ArrowUpRight size={18} />
              </button>
              {confirming === project.id ? (
                <div
                  className="patch-delete-confirm"
                  role="group"
                  aria-label={`Delete ${project.name}?`}
                >
                  <p>
                    Delete “{project.name}”?
                    {project.id === activeProject.id
                      ? ' Audio will stop and an empty patch will open.'
                      : ''}{' '}
                    Recordings are kept.
                  </p>
                  <button
                    autoFocus
                    className="button"
                    disabled={deleting !== null}
                    onClick={() => {
                      setConfirming(null);
                      setError('');
                      focusDeleteAction(project.id);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="button danger"
                    aria-label={`Confirm delete ${project.name}`}
                    disabled={deleting !== null}
                    onClick={() => void remove(project)}
                  >
                    {deleting === project.id ? 'Deleting…' : 'Delete patch'}
                  </button>
                </div>
              ) : (
                <div className="saved-patch-actions">
                  <button
                    className="patch-delete-button"
                    aria-label={`Delete ${project.name}`}
                    disabled={deleting !== null}
                    onClick={() => {
                      setConfirming(project.id);
                      setError('');
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <p className="dialog-footnote">
        <FolderOpen size={14} /> Export a patch to keep a portable backup or share it with a friend.
      </p>
    </Modal>
  );
}
