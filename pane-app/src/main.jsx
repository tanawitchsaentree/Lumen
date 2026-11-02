import 'pane-react/tokens/core.css';
import 'pane-react/tokens/colour.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { initStore } from './lib/store.js';
import { App } from './App.jsx';

initStore();
createRoot(document.getElementById('root')).render(<App />);
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
