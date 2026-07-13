import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary';
import AuthGate from './platform/AuthGate';
import { installPossibilityFieldRuntime } from './engine/possibilityFieldRuntime';
import { installCometGardenRuntime } from './engine/cometGardenRuntime';
import { installAudioObservabilityRuntime } from './engine/audioObservabilityRuntime';
import { installAudioRoutingEvidenceRuntime } from './engine/audioRoutingEvidenceRuntime';
import { installAudibilityOutcomeRuntime } from './engine/audibilityOutcomeRuntime';
import { installAudioEvidenceExportRuntime } from './engine/audioEvidenceExportRuntime';
import { installAudioDeviceEvidenceRuntime } from './engine/audioDeviceEvidenceRuntime';
import { installDeploymentIdentityRuntime } from './engine/deploymentIdentityRuntime';
import './assets/styles.css';
import './assets/failsafe.css';
import './assets/autobiography.css';
import './assets/source-feeling.css';
import './assets/mobile-enter.css';
import './assets/possibility-field.css';
import './assets/comet-garden.css';
import './assets/platform.css';

installDeploymentIdentityRuntime();
installAudioDeviceEvidenceRuntime({ window, navigator, document });
installAudioObservabilityRuntime();
installAudioRoutingEvidenceRuntime();
installAudibilityOutcomeRuntime();
installAudioEvidenceExportRuntime();
installPossibilityFieldRuntime();
installCometGardenRuntime();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  </React.StrictMode>,
);
