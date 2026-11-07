import React from 'react';
import ReactDOM from 'react-dom/client';
import RoomWorldValid from './components/RoomWorldValid';
import OperatingAtlas from './components/OperatingAtlas';
import ErrorBoundary from './components/ErrorBoundary';
import { installCometGardenRuntime } from './engine/cometGardenRuntime';
import { installPossibilityFieldRuntime } from './engine/possibilityFieldRuntime';
import { installAudioObservabilityRuntime } from './engine/audioObservabilityRuntime';
import { installAudioRoutingEvidenceRuntime } from './engine/audioRoutingEvidenceRuntime';
import { installAudibilityOutcomeRuntime } from './engine/audibilityOutcomeRuntime';
import { installAudioEvidenceExportRuntime } from './engine/audioEvidenceExportRuntime';
import { installAudioDeviceEvidenceRuntime } from './engine/audioDeviceEvidenceRuntime';
import { installDeploymentIdentityRuntime } from './engine/deploymentIdentityRuntime';
import { installRuntimeInfrastructure } from './services/runtimeBootstrap';
import './assets/styles.css';
import './assets/failsafe.css';
import './assets/comet-garden.css';
import './assets/possibility-field.css';
import './assets/art-direction.css';

installRuntimeInfrastructure();
installPossibilityFieldRuntime();
installDeploymentIdentityRuntime();
installAudioDeviceEvidenceRuntime({ window, navigator, document });
installAudioObservabilityRuntime();
installAudioRoutingEvidenceRuntime();
installAudibilityOutcomeRuntime();
installAudioEvidenceExportRuntime();
installCometGardenRuntime();

const isWorkshop = new URLSearchParams(window.location.search).get('view') === 'workshop';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isWorkshop ? <OperatingAtlas /> : <RoomWorldValid />}
    </ErrorBoundary>
  </React.StrictMode>,
);
