import React from 'react';
import ReactDOM from 'react-dom/client';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard';
import App from './App';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AnalyticsDashboard />
    <App />
  </React.StrictMode>
);
