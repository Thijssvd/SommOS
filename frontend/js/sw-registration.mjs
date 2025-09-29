import core from './sw-registration-core.cjs';

const { setupServiceWorkerLifecycle: coreLifecycle, registerServiceWorker: coreRegister } = core;

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
