// src/app.js
import { initFirebase, fetchCollection } from './db.js';
import { appState } from './state.js';
import { renderServidoresTable, processCSVImport } from './servidores.js';
import { initDelegaciasModule, renderDelegaciasCards } from './delegacias.js';
import { renderCalendarGrid } from './calendar.js';
import { initModalsModule } from './modals.js';
import { renderGestaoCrfModule, renderGestaoDelegaciasModule } from './gestaoEscalas.js';
import { renderFeriadosModule } from './feriados.js';

window.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 Inicializando 8ª CRF - Escala v2.5.0...");
  initFirebase();

  // Injeta estrutura de modais no DOM
  initModalsModule();

  // Carrega coleções do Firestore
  appState.servidores = await fetchCollection('servidores');
  appState.escalas = await fetchCollection('escalas');
  appState.feriados = await fetchCollection('feriados');
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

  renderCalendarGrid('calendar-crf-container', 'CRF');
}

window.switchTab = function(tabName) {
  const tabs = ['crf', 'delegacia', 'gestao-crf', 'gestao-del', 'feriados', 'unidades', 'servidores'];

  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`tab-content-${t}`);

    if (t === tabName) {
      btn?.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      btn?.classList.remove('text-slate-600', 'hover:bg-slate-100');
      content?.classList.remove('hidden');
    } else {
      btn?.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
      btn?.classList.add('text-slate-600', 'hover:bg-slate-100');
      content?.classList.add('hidden');
    }
  });

  if (tabName === 'crf') {
    renderCalendarGrid('calendar-crf-container', 'CRF');
  } else if (tabName === 'delegacia') {
    if (!appState.selectedDelegaciaId && appState.delegacias.length > 0) {
      appState.selectedDelegaciaId = appState.delegacias[0].id;
    }
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  } else if (tabName === 'gestao-crf') {
    renderGestaoCrfModule('gestao-crf-container');
  } else if (tabName === 'gestao-del') {
    renderGestaoDelegaciasModule('gestao-delegacias-container');
  } else if (tabName === 'feriados') {
    renderFeriadosModule('feriados-container');
  } else if (tabName === 'unidades') {
    renderDelegaciasCards('delegacias-container');
  } else if (tabName === 'servidores') {
    renderServidoresTable('servidores-table-container');
  }
};

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
          alert(`Sucesso! ${importedCount} servidores foram importados.`);
          await initDelegaciasModule();
          renderServidoresTable('servidores-table-container');
        } catch (err) {
          alert("Erro ao processar CSV: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
}
