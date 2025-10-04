function setupServiceWorkerLifecycle(registration, runtimeNavigator = globalThis.navigator, runtimeWindow = globalThis.window) {
  if (!registration || !runtimeNavigator?.serviceWorker || !runtimeWindow) {
    return;
  }

  const sendSkipWaitingMessage = (worker) => {
    if (worker && worker.state === 'installed') {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  if (registration.waiting) {
    sendSkipWaitingMessage(registration.waiting);
  }

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && runtimeNavigator.serviceWorker.controller) {
        sendSkipWaitingMessage(newWorker);
      }
    });
  });

  let refreshing = false;
  runtimeNavigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    runtimeWindow.location.reload();
  });
}

function registerServiceWorker(options = {}) {
  const {
    env,
    navigator: navigatorOverride = globalThis.navigator,
    window: windowOverride = globalThis.window,
    console: consoleOverride = globalThis.console
  } = options;

  if (!navigatorOverride || !('serviceWorker' in navigatorOverride)) {
    return;
  }

  if (env && env.DEV) {
    if (consoleOverride && typeof consoleOverride.log === 'function') {
      consoleOverride.log('Service worker registration skipped in development mode.');
    }
    return;
  }

  windowOverride.addEventListener('load', async () => {
    try {
      const registration = await navigatorOverride.serviceWorker.register('/sw.js');
      setupServiceWorkerLifecycle(registration, navigatorOverride, windowOverride);
      if (consoleOverride && typeof consoleOverride.log === 'function') {
        consoleOverride.log('SW registered: ', registration);
      }
    } catch (error) {
      if (consoleOverride && typeof consoleOverride.error === 'function') {
        consoleOverride.error('SW registration failed: ', error);
      }
    }
  });
}

export { setupServiceWorkerLifecycle, registerServiceWorker };
