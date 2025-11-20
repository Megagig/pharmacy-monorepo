import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
import './index.css';
// import { webVitalsMonitor } from './utils/WebVitalsMonitor';

// Initialize Web Vitals monitoring - Temporarily disabled to fix console errors
// if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_WEB_VITALS === 'true') {
//   webVitalsMonitor.enable();
// }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChunkErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ChunkErrorBoundary>
  </React.StrictMode>
);