import { createRoot } from 'react-dom/client';
import App from './App';
import { loadTheme } from './domain/preferences';
import { applyTheme } from './hooks/useTheme';
import './styles.css';
import './components/instruments.css';
import './components/module-finishes.css';
import './components/module-help.css';
import './components/examples.css';
import './components/module-library.css';

// Apply a saved override before mounting so the first studio frame uses the right theme.
applyTheme(loadTheme());

// A single studio owns one AudioEngine. Avoid dev-only double mounting of live audio nodes.
createRoot(document.getElementById('root')!).render(<App />);
