/**
 * Reasoning Layer V3 - Perceptual Layer UI
 * Main entry point
 * 
 * Note: VS Code API is acquired in the HTML inline script BEFORE this bundle loads.
 * It's available at window.vscode and should NOT be acquired again here.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('🧠 Reasoning Layer V3 Perceptual UI initialized');
