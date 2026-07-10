import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary';
import './assets/styles.css';
import './assets/failsafe.css';
import './assets/autobiography.css';
import './assets/source-feeling.css';
import './assets/mobile-enter.css';
import './assets/possibility-field.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
