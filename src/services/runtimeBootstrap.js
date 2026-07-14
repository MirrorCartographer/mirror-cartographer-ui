export function installRuntimeInfrastructure({ windowRef = window, documentRef = document } = {}) {
  const manifest = documentRef.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = '/manifest.webmanifest';
  documentRef.head.appendChild(manifest);

  const icon = documentRef.createElement('link');
  icon.rel = 'icon';
  icon.href = '/icon.svg';
  icon.type = 'image/svg+xml';
  documentRef.head.appendChild(icon);

  if ('serviceWorker' in windowRef.navigator && import.meta.env.PROD) {
    windowRef.addEventListener('load', () => {
      windowRef.navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[mirror-cartographer] service worker unavailable', error);
      });
    }, { once: true });
  }
}
