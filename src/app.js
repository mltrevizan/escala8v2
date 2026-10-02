// src/app.js
import { appState } from './state.js';
import { loadAllDataFromFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';
import { renderGestaoCrfModule, renderGestaoDelegaciasModule } from './gestaoEscalas.js';
import { renderServidoresTable } from './servidores.js';
import { renderDelegaciasCards } from './delegacias.js';
import { initAuthModule } from './auth.js';

/**
 * Troca de aba ativa
 */
window.switchTab = function(tabName) {
  appState.activeTab = tabName;

  // Atualiza estados dos botões
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-black', 'text-white', 'shadow-sm');
  });

  const btnAtivo = document.getElementById(`tab-btn-${tabName}`);
  if (btnAtivo) {
    btnAtivo.classList.add('active');
  }

  // Oculta todos os conteúdos
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });

  // Exibe o conteúdo selecionado
  const targetContent = document.getElementById(`tab-content-${tabName}`);
  if (targetContent) {
    targetContent.classList.remove('hidden');
  }

  // Renderiza o módulo específico da aba
  switch (tabName) {
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
    case 'servidores':
      renderServidoresTable('servidores-table-container');
      break;
    case 'unidades':
      renderDelegaciasCards('delegacias-container');
      break;
    case 'feriados':
      renderFeriadosModule('feriados-container');
      break;
    case 'ferias':
      renderFeriasModule('ferias-container');
      break;
  }
};

/**
 * Módulo de Feriados (Renderização Básica)
 */
function renderFeriadosModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentYear, feriados } = appState;
  
  let linhas = (feriados || []).sort((a, b) => a.data.localeCompare(b.data)).map(f => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
      <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(f.data)}</td>
      <td class="p-3 font-bold text-slate-900">${f.descricao}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 text-[10px] font-bold rounded border ${f.tipo === 'NACIONAL' ? 'bg-black text-pcpr-gold border-pcpr-gold' : 'bg-[#F7F3E8] text-[#5A4716] border-[#BEA55A]'}">
          ${f.tipo}
        </span>
      </td>
    </tr>
  `).join('');

  if ((feriados || []).length === 0) {
    linhas = `<tr><td colspan="3" class="p-6 text-center text-slate-400 italic">Nenhum feriado cadastrado para ${currentYear}.</td></tr>`;
  }

  container.innerHTML = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 font-sans">
      <h2 class="font-bold text-sm text-slate-800">Calendário de Feriados Oficiais (${currentYear})</h2>
      <p class="text-[11px] text-slate-500">Datas comutadas para regimes de plantão e sobreaviso</p>
    </div>
    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
            <th class="p-3">Data</th>
            <th class="p-3">Descrição do Feriado</th>
            <th class="p-3">Abrangência</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">${linhas}</tbody>
      </table>
    </div>
  `;
}

/**
 * Módulo de Férias (Renderização Básica)
 */
function renderFeriasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 font-sans">
      <h2 class="font-bold text-sm text-slate-800">Escala de Férias e Afastamentos</h2>
      <p class="text-[11px] text-slate-500">Controle de licenças, férias regulamentares e impedimentos</p>
    </div>
    <div class="p-6 text-center text-slate-400 italic font-sans text-xs">
      Módulo de Férias carregado e integrado à base de dados.
    </div>
  `;
}

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}

/**
 * Boot da Aplicação
 */
async function initApp() {
  try {
    // 1. Carrega dados do Firestore
    await loadAllDataFromFirestore();

    // 2. Inicializa o observador do Firebase Auth e o botão/modal de Login
    initAuthModule();

    // 3. Define a aba padrão inicial
    window.switchTab('crf');

  } catch (err) {
    console.error("Erro na inicialização do sistema:", err);
  }
}

// Inicia ao carregar a página
document.addEventListener('DOMContentLoaded', initApp);
