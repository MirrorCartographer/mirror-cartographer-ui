import React from 'react';
import ReactDOM from 'react-dom/client';

function Offline() {
  return <main aria-label="offline" style={{ minHeight: '100vh', background: '#000' }} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Offline />
  </React.StrictMode>,
);
