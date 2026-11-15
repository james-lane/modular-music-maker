import { AudioLines, CircleHelp, FolderOpen, Headphones, LayoutGrid } from 'lucide-react';

export type StudioDialog =
  | 'examples'
  | 'patches'
  | 'recordings'
  | 'help'
  | 'module-help'
  | 'export'
  | 'settings'
  | 'offline'
  | null;

interface Props {
  dialog: StudioDialog;
  recordingCount: number;
  onDialog: (dialog: StudioDialog) => void;
}

export function StudioHeader({ dialog, recordingCount, onDialog }: Props) {
  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="Patchwork home">
        <span className="brand-icon">
          <i />
          <i />
          <i />
          <i />
        </span>
        <strong>
          patchwork<span>®</span>
        </strong>
        <span className="brand-divider" />
        <span className="brand-tagline">a playground for sound</span>
      </a>
      <nav className="header-navigation" aria-label="Studio navigation">
        <button className={dialog === null ? 'active' : ''} onClick={() => onDialog(null)}>
          <LayoutGrid size={15} /> Studio
        </button>
        <button
          className={dialog === 'examples' ? 'active' : ''}
          onClick={() => onDialog('examples')}
          aria-haspopup="dialog"
        >
          <AudioLines size={15} /> Examples
        </button>
        <button
          className={dialog === 'patches' ? 'active' : ''}
          onClick={() => onDialog('patches')}
        >
          <FolderOpen size={15} /> My patches
        </button>
        <button
          className={dialog === 'recordings' ? 'active' : ''}
          onClick={() => onDialog('recordings')}
        >
          <Headphones size={15} /> Recordings
          {recordingCount > 0 && <span className="count-badge">{recordingCount}</span>}
        </button>
      </nav>
      <div className="header-right">
        <span className="beta-label">EARLY ACCESS</span>
        <button
          className="icon-button"
          aria-label="Getting started"
          onClick={() => onDialog('help')}
        >
          <CircleHelp size={19} />
        </button>
        <span className="profile-avatar" title="Your local studio">
          you
        </span>
      </div>
    </header>
  );
}
