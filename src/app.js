// src/app.js
import { appState } from './state.js';
import { loadAllDataFromFirestore, syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';
import { renderGestaoCrfModule, renderGestaoDelegaciasModule } from './gestaoEscalas.js';
import { renderServidoresTable } from './servidores.js';
import { 
  initDelegacias, 
  renderizarTabelaDelegacias, 
  renderDelegaciasCards, 
  popularDropdownDelegaciasComEscala,
  carregarListaSubdivisoes 
} from './delegacias.js';
import { initAuthModule } from './auth.js';
import { initGeradorLoteModule } from './geradorLote.js';
import { renderFeriasModule } from './ferias.js';
import { renderFeriadosModule } from './feriados.js';
import { 
  applyUIPermissions, 
  podeAcessarAbaGestaoCrf, 
  podeAcessarAbaGestaoDelegacias, 
  podeAcessarAbaServidores, 
  podeAcessarAbaDelegacias, 
  podeAcessarAbaFérias, 
  podeAcessarAbaFeriados 
} from './permissions.js';

// Intervalo de 6 Horas para Checagem Silenciosa do Ponteiro de Controle (6 * 60 * 60 * 1000 ms)
const INTERVALO_CHECAGEM_6H_MS = 21600000;

window.switchTab = async function(tabName) {
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

  // Atualiza classes dos botões das abas
  document.querySelectorAll('.tab-btn, [id^="tab-btn-"], [id^="btn-tab-"]').forEach(btn => {
    btn.classList.remove('active', 'bg-black', 'text-white', 'shadow-sm');
  });

  const btnAtivo = document.getElementById(`tab-btn-${tabName}`) || document.getElementById(`btn-tab-${tabName}`);
  if (btnAtivo) {
    btnAtivo.classList.add('active');
  }

  // Oculta todos os containers de abas
  document.querySelectorAll('.tab-content, [id^="tab-content-"], .module-container, section[id$="-container"]').forEach(content => {
    content.classList.add('hidden');
    content.style.display = 'none';
  });

  // Busca o container da aba por múltiplos IDs possíveis no HTML
  const targetContent = document.getElementById(`tab-content-${tabName}`) || 
                        document.getElementById(`${tabName}-container`) || 
                        document.getElementById(`container-${tabName}`) || 
                        document.getElementById(tabName);

  if (targetContent) {
    targetContent.classList.remove('hidden');
    targetContent.style.display = 'block';
  }

  // 🔑 CHECAGEM LEVE DE VERSÃO (1 LEITURA) APENAS PARA ABAS COM ALTA ROTATIVIDADE
  const abasComChecagemVersao = ['crf', 'gestao-crf', 'gestao-del', 'gestao-delegacias', 'servidores'];
  if (abasComChecagemVersao.includes(tabName) && typeof loadAllDataFromFirestore === 'function') {
    await loadAllDataFromFirestore(false);
  }

  switch (tabName) {
    case 'crf':
      renderCalendarGrid('calendar-crf-container', 'CRF');
      break;
    case 'delegacia':
      popularDropdownDelegaciasComEscala('select-calendar-delegacia');
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
      carregarListaSubdivisoes();
      renderizarTabelaDelegacias();
      renderDelegaciasCards('delegacias-container');
      break;
    case 'feriados':
      renderFeriadosModule('feriados-container');
      break;
    case 'ferias':
      renderFeriasModule('ferias-container');
      break;
  }

  if (typeof applyUIPermissions === 'function') {
    applyUIPermissions();
  }
};

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
      console.error("❌ Erro ao atualizar escala CRF:", err);
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

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}

/**
 * Configura a verificação passiva do ponteiro de controle a cada 6 horas para aplicações abertas continuamente.
 */
function iniciarChecagemPassiva6Horas() {
  setInterval(async () => {
    try {
      console.log("[Verificação 6h] Checando ponteiro de controle no Firestore...");
      await loadAllDataFromFirestore(false);

      // Redesenha a aba ativa em segundo plano apenas se houve alguma alteração de dados
      if (window.switchTab && appState.activeTab) {
        window.switchTab(appState.activeTab);
      }
    } catch (e) {
      console.warn("[Verificação 6h] Falha na checagem passiva:", e.message);
    }
  }, INTERVALO_CHECAGEM_6H_MS);
}

async function initApp() {
  try {
    // 1. Carregamento inicial inteligente usando Cache e Ponteiro de Controle
    await loadAllDataFromFirestore(false);

    initAuthModule();

    // Inicializa o módulo de delegacias e escutas do formulário/tabela
    if (typeof initDelegacias === 'function') {
      initDelegacias();
    }

    if (typeof initGeradorLoteModule === 'function') {
      initGeradorLoteModule();
    }

    if (typeof applyUIPermissions === 'function') {
      applyUIPermissions();
    }

    window.switchTab('crf');

    // 2. Ativa o temporizador de verificação passiva de 6 horas
    iniciarChecagemPassiva6Horas();

  } catch (err) {
    console.error("Erro na inicialização do sistema:", err);
  }
}

// Expõe métodos essenciais no escopo global
window.alternarAbaDirect = window.switchTab;
window.popularDropdownDelegaciasComEscala = popularDropdownDelegaciasComEscala;

document.addEventListener('DOMContentLoaded', initApp);
