import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (e) => {
      if (
        typeof e.message === 'string' &&
        e.message.includes('ResizeObserver loop')
      ) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(<App />);
