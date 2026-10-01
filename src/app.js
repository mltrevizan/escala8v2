// src/app.js
import { appState } from './state.js';
import { renderCalendarGrid } from './calendar.js';
import { renderGestaoCrfModule, renderGestaoDelegaciasModule } from './gestaoEscalas.js';
import { renderFeriadosModule } from './feriados.js';
import { initDelegaciasModule, renderDelegaciasCards } from './delegacias.js';
import { initServidoresModule, renderServidoresTable } from './servidores.js';
import { initFeriasModule, renderFeriasModule } from './ferias.js';
import { initModalsModule } from './modals.js';

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('app-status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">Conectando ao banco...</span>`;
  }

  try {
    // 1. Carrega as coleções do banco em paralelo que possuem init inicial
    await Promise.all([
      initDelegaciasModule(),
      initServidoresModule(),
      initFeriasModule()
    ]);

    // 2. Inicializa os modais do sistema
    initModalsModule();

    if (statusEl) {
      statusEl.innerHTML = `<span class="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">● Sistema Online</span>`;
    }

    // 3. Renderiza a aba inicial (Escala CRF)
    renderCalendarGrid('calendar-crf-container', 'CRF');

  } catch (err) {
    console.error("Erro na inicialização do aplicativo:", err);
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-xs bg-rose-100 text-rose-800 px-3 py-1 rounded-full font-bold">⚠️ Erro de Conexão</span>`;
    }
  }
});

// Troca de Abas
window.switchTab = function(tabId) {
  // Esconde todos os contêineres de aba
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

  // Desativa estilo visual de todos os botões
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm', 'active');
    btn.classList.add('text-slate-600', 'hover:bg-slate-100');
  });

  // Exibe a aba selecionada
  const targetContent = document.getElementById(`tab-content-${tabId}`);
  if (targetContent) {
    targetContent.classList.remove('hidden');
  }

  // Destaca o botão ativo
  const targetBtn = document.getElementById(`tab-btn-${tabId}`);
  if (targetBtn) {
    targetBtn.classList.remove('text-slate-600', 'hover:bg-slate-100');
    targetBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm', 'active');
  }

  // Renderiza dinamicamente o módulo da aba selecionada
  switch (tabId) {
    case 'crf':
      renderCalendarGrid('calendar-crf-container', 'CRF');
      break;
    case 'delegacia':
      renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
      break;
    case 'gestao-crf':
      renderGestaoCrfModule('gestao-crf-container');
      break;
    case 'gestao-del':
      renderGestaoDelegaciasModule('gestao-delegacias-container');
      break;
    case 'feriados':
      renderFeriadosModule('feriados-container');
      break;
    case 'unidades':
      renderDelegaciasCards('delegacias-container');
      break;
    case 'servidores':
      renderServidoresTable('servidores-table-container');
      break;
    case 'ferias':
      renderFeriasModule('ferias-container');
      break;
  }
};
