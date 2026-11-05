import { createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

function VepaRuntimeHost() {
  useEffect(() => {
    import('./main.js').catch((error) => {
      console.error('VEPA runtime failed to load:', error);
    });
  }, []);

  return null;
}

const rootElement = document.getElementById('react-root');
if (!rootElement) {
  throw new Error('VEPA React host root is missing');
}

createRoot(rootElement).render(createElement(VepaRuntimeHost));
