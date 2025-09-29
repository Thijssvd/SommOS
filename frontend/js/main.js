import '../css/styles.css';
import SommOS from './app';
import { registerServiceWorker } from './sw-registration.mjs';

function bootstrapApp() {
  window.app = new SommOS();
  window.sommOS = window.app;
}

if (document.readyState !== 'loading') {
  bootstrapApp();
} else {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
}

registerServiceWorker();
