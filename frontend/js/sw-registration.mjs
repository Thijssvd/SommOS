import { setupServiceWorkerLifecycle as coreLifecycle, registerServiceWorker as coreRegister } from './sw-registration-core.js';

export function setupServiceWorkerLifecycle(registration) {
  return coreLifecycle(registration);
}

export function registerServiceWorker(options = {}) {
  const mergedOptions = { ...options };
  if (!Object.prototype.hasOwnProperty.call(mergedOptions, 'env')) {
    mergedOptions.env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  }
  return coreRegister(mergedOptions);
}

export default {
  setupServiceWorkerLifecycle,
  registerServiceWorker
};
