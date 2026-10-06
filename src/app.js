// src/app.js
import { appState } from './state.js';
import { loadAllDataFromFirestore, syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';
import { renderGestaoCrfModule, renderGestaoDelegaciasModule } from './gestaoEscalas.js';
import { renderServidoresTable } from './servidores.js';
import { renderDelegaciasCards } from './delegacias.js';
import { initAuthModule } from './auth.js';
import { initGeradorLoteModule } from './geradorLote.js';
import { renderFeriasModule } from './ferias.js';
import { 
  applyUIPermissions, 
  podeAcessarAbaGestaoCrf, 
  podeAcessarAbaGestaoDelegacias, 
  podeAcessarAbaServidores, 
  podeAcessarAbaDelegacias, 
  podeAcessarAbaFérias, 
  podeAcessarAbaFeriados 
} from './permissions.js';

/**
 * Troca de aba ativa com validação estrita de permissões
 */
window.switchTab = function(tabName) {
  // Validação de acesso por aba antes de efetuar a troca
  if (tabName === 'gestao-crf' && !podeAcessarAbaGestaoCrf()) {
    tabName = 'crf';
  } else if ((tabName === 'gestao-del' || tabName === 'gestao-delegacias') && !podeAcessarAbaGestaoDelegacias()) {
    tabName = 'delegacia';
  } else if (tabName === 'servidores' && !podeAcessarAbaServidores()) {
    tabName = 'delegacia';
  } else if ((tabName === 'unidades' || tabName === 'delegacias') && !podeAcessarAbaDelegacias()) {
    tabName = 'delegacia';
  } else if (tabName === 'ferias' && !podeAcessarAbaFérias()) {
    tabName = 'delegacia';
  } else if (tabName === 'feriados' && !podeAcessarAbaFeriados()) {
    tabName = 'delegacia';
  }

  appState.activeTab = tabName;

  // Atualiza estados visuais dos botões das abas
  document.querySelectorAll('.tab-btn, [id^="tab-btn-"]').forEach(btn => {
    btn.classList.remove('active', 'bg-black', 'text-white', 'shadow-sm');
  });

  const btnAtivo = document.getElementById(`tab-btn-${tabName}`);
  if (btnAtivo) {
    btnAtivo.classList.add('active');
  }

  // Oculta todos os contêineres de conteúdo
  document.querySelectorAll('.tab-content, [id^="tab-content-"]').forEach(content => {
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
    case 'gestao-delegacias':
      renderGestaoDelegaciasModule('gestao-delegacias-container');
      break;
    case 'servidores':
      renderServidoresTable('servidores-table-container');
      break;
    case 'unidades':
    case 'delegacias':
      renderDelegaciasCards('delegacias-container');
      break;
    case 'feriados':
      renderFeriadosModule('feriados-container');
      break;
    case 'ferias':
      renderFeriasModule('ferias-container');
      break;
  }

  // Garante a aplicação contínua de permissões da UI
  if (typeof applyUIPermissions === 'function') {
    applyUIPermissions();
  }
};

/**
 * Função de migração em lote com trava de segurança:
 * Converte apenas os registros da CRF (scope === 'CRF') que estão como 'SDP' para 'EXTRAJORNADA'
 */
window.corrigirEscalasSdpParaExtrajornadaCRF = async function() {
  const role = (appState.currentUser?.perfil || appState.currentUser?.nivelAcesso || '').toUpperCase();
  
  if (role !== 'ADMINISTRADOR') {
    alert("Operação restrita ao Administrador do Sistema.");
    return;
  }

  const escalasSdpCrf = (appState.escalas || []).filter(e => 
    e.scope === 'CRF' && (e.tipo === 'SDP' || e.tipo === 'sdp')
  );

  if (escalasSdpCrf.length === 0) {
    alert("Nenhuma escala da CRF registrada como 'SDP' foi localizada para correção.");
    return;
  }

  const confirmacao = confirm(
    `ATENÇÃO - MIGRAÇÃO DE DADOS EXCLUSIVA DA CRF:\n\n` +
    `Foram localizadas ${escalasSdpCrf.length} escalas restritas da CRF cadastradas como 'SDP'.\n\n` +
    `Deseja converter apenas estes registros para 'EXTRAJORNADA'?\n` +
    `(As escalas locais das delegacias NÃO serão alteradas).`
  );

  if (!confirmacao) return;

  let corrigidos = 0;
  let erros = 0;

  for (const escala of escalasSdpCrf) {
    try {
      escala.tipo = 'EXTRAJORNADA';
      await syncDocToFirestore('escalas', escala.id, escala);
      corrigidos++;
    } catch (err) {
      console.error(`❌ Erro ao atualizar escala CRF ${escala.id}:`, err);
      erros++;
    }
  }

  alert(
    `Correção Concluída!\n\n` +
    `• Registros da CRF convertidos para EXTRAJORNADA: ${corrigidos}\n` +
    `• Falhas: ${erros}`
  );

  if (window.renderCalendarGrid && appState.activeTab === 'crf') {
    window.renderCalendarGrid('calendar-crf-container', 'CRF');
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

    // 3. Inicializa o DOM do Gerador em Lote Completo
    if (typeof initGeradorLoteModule === 'function') {
      initGeradorLoteModule();
    }

    // 4. Aplica travas de permissão na interface
    if (typeof applyUIPermissions === 'function') {
      applyUIPermissions();
    }

    // 5. Define a aba padrão inicial protegida
    window.switchTab('crf');

  } catch (err) {
    console.error("Erro na inicialização do sistema:", err);
  }
}

// Inicia ao carregar a página
document.addEventListener('DOMContentLoaded', initApp);
