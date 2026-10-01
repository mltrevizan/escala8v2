// src/app.js
import { appState } from './state.js';
import { fetchCollection } from './db.js';
import { renderCalendarGrid } from './calendar.js';
import { renderGestaoCrfModule, renderGestaoDelegaciasModule } from './gestaoEscalas.js';
import { renderFeriadosModule } from './feriados.js';
import { renderDelegaciasCards } from './delegacias.js';
import { renderServidoresTable } from './servidores.js';
import { renderFeriasModule } from './ferias.js';
import { initModalsModule } from './modals.js';

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('app-status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">Conectando ao banco...</span>`;
  }

  try {
    // 1. Carrega TODAS as coleções do Firestore para o appState na inicialização
    await carregarDadosGlobais();

    // 2. Inicializa a estrutura dos Modais no DOM
    initModalsModule();

    if (statusEl) {
      statusEl.innerHTML = `<span class="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">● Sistema Online</span>`;
    }

    // 3. Renderiza a aba inicial (Escala CRF) com todos os dados carregados
    renderCalendarGrid('calendar-crf-container', 'CRF');

  } catch (err) {
    console.error("Erro na inicialização do aplicativo:", err);
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-xs bg-rose-100 text-rose-800 px-3 py-1 rounded-full font-bold">⚠️ Erro de Conexão</span>`;
    }
  }
});

// Função responsável por carregar todas as coleções do Firestore na inicialização
async function carregarDadosGlobais() {
  const [delegacias, servidores, escalas, feriados, ferias] = await Promise.all([
    fetchCollection('delegacias'),
    fetchCollection('servidores'),
    fetchCollection('escalas'),
    fetchCollection('feriados'),
    fetchCollection('ferias')
  ]);

  appState.delegacias = delegacias || [];
  appState.servidores = servidores || [];
  appState.escalas = escalas || [];
  appState.feriados = feriados || [];
  appState.ferias = ferias || [];

  // Garante que a primeira delegacia seja a selecionada por padrão se não houver selecionada
  if (!appState.selectedDelegaciaId && appState.delegacias.length > 0) {
    appState.selectedDelegaciaId = appState.delegacias[0].id;
  }
}

// Controle e Troca de Abas
window.switchTab = function(tabId) {
  // Esconde todos os contêineres de aba
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

  // Desativa o destaque de todos os botões da barra de navegação
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm', 'active');
    btn.classList.add('text-slate-600', 'hover:bg-slate-100');
  });

  // Exibe o contêiner da aba alvo
  const targetContent = document.getElementById(`tab-content-${tabId}`);
  if (targetContent) {
    targetContent.classList.remove('hidden');
  }

  // Destaca o botão da aba ativa
  const targetBtn = document.getElementById(`tab-btn-${tabId}`);
  if (targetBtn) {
    targetBtn.classList.remove('text-slate-600', 'hover:bg-slate-100');
    targetBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm', 'active');
  }

  // Renderiza dinamicamente o módulo correspondente
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
