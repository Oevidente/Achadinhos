import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) {
        void reg.unregister();
      }
    });
  } else {
    const tinhaController = Boolean(navigator.serviceWorker.controller);
    let recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (tinhaController && !recarregando) {
        recarregando = true;
        window.location.reload();
      }
    });
  }
}

registerSW({
  immediate: true,
});

createRoot(document.getElementById('root')!).render(<App />);
