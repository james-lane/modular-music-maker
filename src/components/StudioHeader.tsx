export type StudioDialog =
  | 'examples'
  | 'patches'
  | 'recordings'
  | 'help'
  | 'module-help'
  | 'switch-schedule'
  | 'export'
  | 'settings'
  | 'offline'
  | null;

/** A compact identity beside the transport; navigation lives in the More menu. */
export function StudioHeader() {
  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="Patchwork home">
        <span className="brand-icon">
          <i />
          <i />
          <i />
          <i />
        </span>
        <strong>patchwork</strong>
      </a>
    </header>
  );
}
