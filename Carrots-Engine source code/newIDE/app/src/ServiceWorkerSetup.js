// @flow
import optionalRequire from './Utils/OptionalRequire';
import { isNativeMobileApp } from './Utils/Platform';

// $FlowFixMe[cannot-resolve-name]
const PUBLIC_URL: string = process.env.PUBLIC_URL || '';
// $FlowFixMe[cannot-resolve-name]
const isDev = process.env.NODE_ENV !== 'production';

const electron = optionalRequire('electron');
const serviceWorker =
  typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
const getServiceWorkerUrl = () =>
  `${PUBLIC_URL}/service-worker.js${isDev ? '?dev=1' : ''}`;

const unregisterAllServiceWorkers = async () => {
  if (!serviceWorker || typeof serviceWorker.getRegistrations !== 'function') {
    return;
  }
  const registrations = await serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(registration => registration.unregister())
  );
};

const clearServiceWorkerCaches = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
};

const registerDevelopmentServiceWorker = async () => {
  if (!serviceWorker) {
    return;
  }

  await unregisterAllServiceWorkers();
  await clearServiceWorkerCaches();

  const registration = await serviceWorker.register(getServiceWorkerUrl());
  await registration.update();
};

const handleServiceWorkerError = (context: string, error: any) => {
  if (isDev) {
    console.warn(`[ServiceWorker] ${context} failed.`, error);
    unregisterAllServiceWorkers().catch(unregisterError => {
      console.warn(
        '[ServiceWorker] Failed to cleanup existing registrations.',
        unregisterError
      );
    });
    return;
  }

  console.error(`[ServiceWorker] ${context} failed.`, error);
};

export function isServiceWorkerSupported(): boolean {
  return !!serviceWorker;
}

export function registerServiceWorker() {
  if (isNativeMobileApp() || !!electron) {
    return;
  }

  if (!serviceWorker) {
    console.warn(
      'Service Worker not supported on this deployment (probably: not HTTPS and not localhost).'
    );
    return;
  }

  // In local development, a stale service worker can keep serving old bundles
  // and cause hard-to-debug startup failures. Register a preview-only service
  // worker that avoids Workbox caching but still serves Browser SW previews.
  if (isDev) {
    window.addEventListener('load', () => {
      registerDevelopmentServiceWorker().catch(error =>
        handleServiceWorkerError('development registration', error)
      );
    });

    return;
  }

  window.addEventListener('load', () => {
    const swUrl = getServiceWorkerUrl();

    serviceWorker
      .register(swUrl)
      .then(registration => {
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) {
            return;
          }
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              const alreadyHasAServiceWorker = !!serviceWorker.controller;
              if (!isDev) {
                if (alreadyHasAServiceWorker) {
                  // At this point, the updated precached content has been fetched,
                  // but the previous service worker will still serve the older
                  // content until all client tabs are closed.
                  console.log(
                    'A new version is available and will be used when all tabs for this page are closed.'
                  );
                } else {
                  // Service worker has been installed for the first time.
                  console.log('Content is cached for offline use.');
                }
              }
            }
          };
        };
      })
      .catch(error => handleServiceWorkerError('registration', error));

    serviceWorker.ready
      .then(registration => {
        // Forces a check right now for a newer service worker script.
        // If there is one, it will be installed (see the service worker script to verify how in development
        // a new service worker script does a `self.skipWaiting()` and `self.clients.claim()`).
        return registration.update();
      })
      .catch(error => handleServiceWorkerError('ready/update', error));
  });
}
