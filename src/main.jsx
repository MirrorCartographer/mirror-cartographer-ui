import React from 'react';
import ReactDOM from 'react-dom/client';
import RoomWorldValid from './components/RoomWorldValid';
import ErrorBoundary from './components/ErrorBoundary';
import { installCometGardenRuntime } from './engine/cometGardenRuntime';
import { installAudioObservabilityRuntime } from './engine/audioObservabilityRuntime';
import { installAudioRoutingEvidenceRuntime } from './engine/audioRoutingEvidenceRuntime';
import { installAudibilityOutcomeRuntime } from './engine/audibilityOutcomeRuntime';
import { installAudioEvidenceExportRuntime } from './engine/audioEvidenceExportRuntime';
import { installAudioDeviceEvidenceRuntime } from './engine/audioDeviceEvidenceRuntime';
import { installDeploymentIdentityRuntime } from './engine/deploymentIdentityRuntime';
import { installRuntimeInfrastructure } from './services/runtimeBootstrap';
import { installPossibilityFieldRuntime } from './engine/possibilityFieldRuntime.js';
import './assets/styles.css';
import './assets/failsafe.css';
import './assets/comet-garden.css';
import './assets/possibility-field.css';

installRuntimeInfrastructure();
installPossibilityFieldRuntime();
installDeploymentIdentityRuntime();
installAudioDeviceEvidenceRuntime({ window, navigator, document });
installAudioObservabilityRuntime();
installAudioRoutingEvidenceRuntime();
installAudibilityOutcomeRuntime();
installAudioEvidenceExportRuntime();
installCometGardenRuntime();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RoomWorldValid />
    </ErrorBoundary>
  </React.StrictMode>,
);
