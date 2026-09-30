// src/app.js
import { initFirebase, fetchCollection } from './db.js';
import { appState } from './state.js';
import { renderServidoresTable, processCSVImport } from './servidores.js';
import { initDelegaciasModule, renderDelegaciasCards } from './delegacias.js';
import { renderCalendarGrid } from './calendar.js';

window.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 Inicializando v2 Modular...");
  initFirebase();

  // Carga paralela de coleções
  appState.servidores = await fetchCollection('servidores');
  appState.escalas = await fetchCollection('escalas');
  await initDelegaciasModule();

  updateUI();
  setupEventListeners();
});

function updateUI() {
  const statusElem = document.getElementById('app-status');
  if (statusElem) {
    statusElem.innerHTML = `
      <span class="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-1 rounded-full">
        ✅ Conectado ao Firebase (${appState.servidores.length} Servidores | ${appState.delegacias.length} Unidades)
      </span>
    `;
  }

  renderCalendarGrid('calendar-container');
  renderDelegaciasCards('delegacias-container');
  renderServidoresTable('servidores-table-container');
}

function setupEventListeners() {
  const csvInput = document.getElementById('csv-file-input');
  if (csvInput) {
    csvInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const importedCount = await processCSVImport(evt.target.result);
          alert(`Sucesso! ${importedCount} servidores foram importados e gravados no Firestore.`);
          
          await initDelegaciasModule();
          updateUI();
        } catch (err) {
          alert("Erro ao processar CSV: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
}
