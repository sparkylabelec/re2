
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("index.tsx entry point hit");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Root element #root not found in index.html");
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
