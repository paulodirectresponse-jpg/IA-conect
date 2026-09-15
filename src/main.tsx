import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installPerformanceObservers} from './utils/performanceMetrics.js';
import './index.css';
import './styles/enterprise-theme.css';

installPerformanceObservers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
