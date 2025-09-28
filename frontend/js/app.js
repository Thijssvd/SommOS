import { apiHealth, getGuidance } from './api.js';
import { renderHealth, renderGuidance } from './ui.js';

async function init(){
  try {
    const h = await apiHealth();
    renderHealth(h);
  } catch (e) {
    console.error(e);
  }

  const form = document.querySelector('#guidance-form');
  if (form){
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const payload = {
        style: form.style.value || undefined,
        pairing: form.pairing.value || undefined,
        budget: form.budget.value ? Number(form.budget.value) : undefined,
        weather: form.tempC.value ? { tempC: Number(form.tempC.value) } : undefined
      };
      try {
        const res = await getGuidance(payload);
        renderGuidance(res.recommendations);
      } catch (e) {
        alert('Failed to fetch guidance');
      }
    });
  }
}
document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }
