import{StrictMode}from'react';
import{createRoot}from'react-dom/client';
import PublicApp from'./PublicApp.js';
import{installPerformanceObservers}from'./utils/performanceMetrics.js';
import'./styles/public-entry.css';

installPerformanceObservers();

createRoot(document.getElementById('root')!).render(
 <StrictMode><PublicApp/></StrictMode>,
);
