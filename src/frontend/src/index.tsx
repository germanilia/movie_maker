import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Add styles directly
const styles = document.createElement('style');
styles.textContent = `
  body {
    position: fixed;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
`;
document.head.appendChild(styles);

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 