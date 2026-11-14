import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './components/instruments.css';
import './components/module-finishes.css';

// A single studio owns one AudioEngine. Avoid dev-only double mounting of live audio nodes.
createRoot(document.getElementById('root')!).render(<App />);
