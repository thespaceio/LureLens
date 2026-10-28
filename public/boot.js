// Runs before the app. Kept in a file (not inline) so the Content Security
// Policy can forbid inline scripts.

// The game used to live at phishguard-by-faith.netlify.app. Send visitors
// from that old address to the new one, keeping the path.
if (location.hostname === 'phishguard-by-faith.netlify.app') {
  location.replace('https://thespaceio.github.io/LureLens' + location.pathname + location.search + location.hash);
}

// Register the offline service worker in production builds only.
if ('serviceWorker' in navigator && !/localhost:5173/.test(location.host)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
