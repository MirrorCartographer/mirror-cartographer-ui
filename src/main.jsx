import React from 'react';
import ReactDOM from 'react-dom/client';
import GenerativeScoreGarden from './components/GenerativeScoreGarden';
import ErrorBoundary from './components/ErrorBoundary';
import { installDeploymentIdentityRuntime } from './engine/deploymentIdentityRuntime';
import { installRuntimeInfrastructure } from './services/runtimeBootstrap';
import './assets/failsafe.css';

installRuntimeInfrastructure();
installDeploymentIdentityRuntime();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GenerativeScoreGarden />
    </ErrorBoundary>
  </React.StrictMode>,
);
