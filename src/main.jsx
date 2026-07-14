import React from 'react';
import ReactDOM from 'react-dom/client';
import RoomWorldValid from './components/RoomWorldValid';
import { installCometGardenRuntime } from './engine/cometGardenRuntime';
import './assets/comet-garden.css';

installCometGardenRuntime();

class VisualBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.failed) {
      return <main className="visual-fallback"><button aria-label="Reload" onClick={() => window.location.reload()} /></main>;
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VisualBoundary>
      <RoomWorldValid />
    </VisualBoundary>
  </React.StrictMode>,
);
