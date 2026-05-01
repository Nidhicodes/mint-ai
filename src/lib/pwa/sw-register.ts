/**
 * Registers the service worker and sets up update detection.
 * Dispatches a 'sw-update-available' custom event on the window
 * when a new service worker version is waiting to activate.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  // Don't register SW in development — it causes stale cache issues
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Unregister any existing SW in dev
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      // Check for waiting worker on initial load
      if (registration.waiting) {
        window.dispatchEvent(new CustomEvent('sw-update-available'));
      }

      // Detect new service worker installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version is waiting — notify the app
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      });

      // Listen for controller change (new SW took over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // The new service worker has taken control
        // This fires after skipWaiting + clients.claim
      });

      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          window.dispatchEvent(new CustomEvent('sw-update-available'));
        }
      });
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  });
}
