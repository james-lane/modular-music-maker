import version from 'virtual:app-version';

export function AppVersion() {
  const label = `Patchwork ${version.version}${version.dirty ? ' (uncommitted changes)' : ''}`;
  return (
    <span className="version-badge" title={label} aria-label={label}>
      v{version.base}+{version.commits ?? 'source'}
      {version.dirty ? '*' : ''}
    </span>
  );
}
