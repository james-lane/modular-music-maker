import { ensureFullGitHistory } from './git-history';

// npm runs this before every build, including a provider's default build command.
ensureFullGitHistory(process.cwd());
