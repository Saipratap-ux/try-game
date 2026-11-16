import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('sc-sw-update-available', { detail: { updateSW } }));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('sc-sw-offline-ready'));
  },
});

createRoot(document.getElementById('root')!).render(<App />);
