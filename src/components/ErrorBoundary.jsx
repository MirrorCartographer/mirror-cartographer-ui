import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'unknown portal error'
    };
  }

  componentDidCatch(error, info) {
    try {
      console.error('Mirror Portal recovered from a render failure:', error, info);
    } catch {}
  }

  reset = () => {
    this.setState({ hasError: false, message: '' });
  };

  clearAndReset = () => {
    try {
      window.localStorage?.removeItem?.('mirror.portal.creation.weather.v1');
    } catch {}
    this.reset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="gate-screen">
        <section className="gate-card failsafe-card">
          <p className="eyebrow">portal recovery</p>
          <h1>the field glitched</h1>
          <p className="gate-line">The portal caught a render failure instead of going blank.</p>
          <p className="quiet">{this.state.message}</p>
          <div className="action-row failsafe-actions">
            <button className="primary-action" onClick={this.reset}>try again</button>
            <button className="secondary-action" onClick={this.clearAndReset}>clear local field</button>
          </div>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
