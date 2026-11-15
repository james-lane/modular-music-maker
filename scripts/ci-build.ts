import { execFileSync } from 'node:child_process';
import { readAppVersion } from './app-version';

// Workers Builds may provide a shallow checkout. Recover the actual history before
// versioning; a CI-specific version shortcut would disagree with local releases.
const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
  encoding: 'utf8',
}).trim();
if (shallow === 'true')
  execFileSync('git', ['fetch', '--unshallow', 'origin'], { stdio: 'inherit' });

const version = readAppVersion(process.cwd());
if (!version.revision || version.dirty)
  throw new Error('Automatic releases require a clean Git checkout with full history.');

// Cloudflare only runs the deploy command if all validation and the build succeed.
for (const command of ['format:check', 'check'])
  execFileSync('npm', ['run', command], { stdio: 'inherit' });
