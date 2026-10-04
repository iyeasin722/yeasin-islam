import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safeguard against third-party browser extension injection errors (e.g. MetaMask / Web3 wallets)
window.addEventListener('error', (event) => {
  const msg = event?.message || event?.error?.message || '';
  if (
    msg.includes('Cannot redefine property: ethereum') ||
    msg.includes('redefine property: ethereum') ||
    msg.includes('evmProviders')
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason?.message || String(event?.reason || '');
  if (reason.includes('ethereum') || reason.includes('Cannot redefine property')) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('PWA ServiceWorker registration failed:', err);
    });
  });
}

