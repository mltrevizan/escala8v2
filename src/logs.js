// src/logs.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';
import { getPerfilUsuarioLogado } from './permissions.js';

let logsFiltrosState = {
  busca: '',
  dataInicio: '',
  dataFim: '',
  sortColuna: 'TIMESTAMP',
  sortDirecao: 'DESC' // Padrão: mais recentes primeiro
};

let modalLogsContexto = {
  scope: 'CRF',
  delegaciaId: null
};

/**
 * Grava um registro de auditoria no Firestore e no appState local
 */
export async function registrarLogTroca({ scope, delegaciaId = null, tipoAcao, detalhes, dataPlantao, turno }) {
  try {
    const user = appState.currentUser || {};
    const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      usuarioNome: user.nome || user.displayName || 'Usuário Não Identificado',
      usuarioPerfil: getPerfilUsuarioLogado(),
      usuarioLogin: user.login || user.email || 'sistema',
      scope: scope, // 'CRF' ou 'DELEGACIA'
      delegaciaId: delegaciaId ? String(delegaciaId) : null,
      tipoAcao: tipoAcao, // 'TROCA_DELEGADO', 'TROCA_APJ', 'VINCULAR_APJ'
      detalhes: detalhes,
      dataPlantao: dataPlantao || null,
      turno: turno || null
    };

    if (!appState.logs) appState.logs = [];
    appState.logs.push(logEntry);

    // Gravação síncrona obrigatória no banco de dados
    await syncDocToFirestore('logs', logId, logEntry);
  } catch (err) {
    console.error("Erro ao registrar log no Firestore:", err);
  }
}

/**
 * Abre e inicializa o modal do Histórico de Logs
 */
export function abrirModalHistoricoLogs(scope, delegaciaId = null) {
  let modal = document.getElementById('modal-historico-logs');
  if (!modal) {
    criarModalHistoricoLogsDOM();
    modal = document.getElementById('modal-historico-logs');
  }

  modalLogsContexto.scope = scope;
  modalLogsContexto.delegaciaId = delegaciaId ? String(delegaciaId) : null;

  // Reseta filtros locais ao abrir
  logsFiltrosState.busca = '';
  logsFiltrosState.dataInicio = '';
  logsFiltrosState.dataFim = '';
  logsFiltrosState.sortColuna = 'TIMESTAMP';
  logsFiltrosState.sortDirecao = 'DESC';

  const inputBusca = document.getElementById('modal-logs-busca');
  const inputIni = document.getElementById('modal-logs-data-inicio');
  const inputFim = document.getElementById('modal-logs-data-fim');

  if (inputBusca) inputBusca.value = '';
  if (inputIni) inputIni.value = '';
  if (inputFim) inputFim.value = '';

  const tituloEl = document.getElementById('modal-logs-titulo');
  const delObj = (appState.delegacias || []).find(d => String(d.id) === String(delegaciaId));
  const nomeUnidade = scope === 'CRF' ? 'Central CRF' : (delObj ? delObj.nome : 'Delegacia Selecionada');

  if (tituloEl) {
    tituloEl.innerText = `📋 Histórico de Alterações de Escala — ${nomeUnidade}`;
  }

  window.renderTabelaLogsCorpo();
  modal.classList.remove('hidden');
}

window.fecharModalHistoricoLogs = function() {
  document.getElementById('modal-historico-logs')?.classList.add('hidden');
};

window.atualizarFiltrosLogs = function() {
  logsFiltrosState.busca = document.getElementById('modal-logs-busca')?.value?.toLowerCase().trim() || '';
  logsFiltrosState.dataInicio = document.getElementById('modal-logs-data-inicio')?.value || '';
  logsFiltrosState.dataFim = document.getElementById('modal-logs-data-fim')?.value || '';

  window.renderTabelaLogsCorpo();
};

window.ordenarTabelaLogs = function(coluna) {
  if (logsFiltrosState.sortColuna === coluna) {
    logsFiltrosState.sortDirecao = logsFiltrosState.sortDirecao === 'ASC' ? 'DESC' : 'ASC';
  } else {
    logsFiltrosState.sortColuna = coluna;
    logsFiltrosState.sortDirecao = 'ASC';
  }

  // Atualiza indicadores visuais nos cabeçalhos
  ['TIMESTAMP', 'RESPONSAVEL', 'ACAO', 'DETALHES'].forEach(col => {
    const el = document.getElementById(`sort-log-icon-${col}`);
    if (el) {
      el.innerText = (col === logsFiltrosState.sortColuna) ? (logsFiltrosState.sortDirecao === 'ASC' ? '⬆' : '⬇️') : '';
    }
  });

  window.renderTabelaLogsCorpo();
};

window.renderTabelaLogsCorpo = function() {
  const corpoTabela = document.getElementById('tabela-logs-corpo');
  const countEl = document.getElementById('modal-logs-count');
  if (!corpoTabela) return;

  const { scope, delegaciaId } = modalLogsContexto;
  const { busca, dataInicio, dataFim, sortColuna, sortDirecao } = logsFiltrosState;
  const delObj = (appState.delegacias || []).find(d => String(d.id) === String(delegaciaId));

  // 1. FILTRAGEM
  let logsFiltrados = (appState.logs || []).filter(l => {
    // Filtro por escopo e delegacia
    if (l.scope !== scope) return false;
    if (scope === 'DELEGACIA' && delegaciaId) {
      if (delObj && delObj.delegaciasIds && delObj.delegaciasIds.length > 0) {
        const bateuPai = String(l.delegaciaId) === String(delegaciaId);
        const bateuFilho = delObj.delegaciasIds.some(unfId => String(unfId) === String(l.delegaciaId));
        if (!bateuPai && !bateuFilho) return false;
      } else if (String(l.delegaciaId) !== String(delegaciaId)) {
        return false;
      }
    }

    // Filtro de Faixa de Datas
    const logDataIso = l.timestamp ? l.timestamp.split('T')[0] : '';
    if (dataInicio && logDataIso < dataInicio) return false;
    if (dataFim && logDataIso > dataFim) return false;

    // Filtro Busca Letra a Letra
    if (busca) {
      const nomeResp = (l.usuarioNome || '').toLowerCase();
      const perfResp = (l.usuarioPerfil || '').toLowerCase();
      const acaoStr = (l.tipoAcao || '').toLowerCase();
      const detStr = (l.detalhes || '').toLowerCase();

      if (!nomeResp.includes(busca) && !perfResp.includes(busca) && !acaoStr.includes(busca) && !detStr.includes(busca)) {
        return false;
      }
    }

    return true;
  });

  // 2. ORDENAÇÃO
  logsFiltrados.sort((a, b) => {
    let valA = '', valB = '';

    if (sortColuna === 'TIMESTAMP') {
      valA = a.timestamp || '';
      valB = b.timestamp || '';
    } else if (sortColuna === 'RESPONSAVEL') {
      valA = a.usuarioNome || '';
      valB = b.usuarioNome || '';
    } else if (sortColuna === 'ACAO') {
      valA = a.tipoAcao || '';
      valB = b.tipoAcao || '';
    } else if (sortColuna === 'DETALHES') {
      valA = a.detalhes || '';
      valB = b.detalhes || '';
    }

    const res = valA.localeCompare(valB, undefined, { numeric: true });
    return sortDirecao === 'ASC' ? res : -res;
  });

  if (countEl) {
    countEl.innerText = `Exibindo ${logsFiltrados.length} Registro(s)`;
  }

  if (logsFiltrados.length === 0) {
    corpoTabela.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400 italic">Nenhum registro de alteração localizado com os filtros aplicados.</td></tr>`;
  } else {
    corpoTabela.innerHTML = logsFiltrados.map(l => `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs font-sans">
        <td class="p-2.5 font-mono text-slate-600 font-bold whitespace-nowrap">${formatarDataHoraBr(l.timestamp)}</td>
        <td class="p-2.5 font-bold text-slate-900">
          ${l.usuarioNome}
          <span class="block text-[10px] text-slate-500 font-mono font-normal">${l.usuarioPerfil}</span>
        </td>
        <td class="p-2.5">
          <span class="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-black text-pcpr-gold border border-pcpr-gold">
            ${l.tipoAcao || 'ALTERAÇÃO'}
          </span>
        </td>
        <td class="p-2.5 text-slate-800 font-medium">${l.detalhes || '-'}</td>
      </tr>
    `).join('');
  }
};

function formatarDataHoraBr(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  } catch (e) {
    return isoStr;
  }
}

function criarModalHistoricoLogsDOM() {
  const modalHTML = `
    <div id="modal-historico-logs" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-5 space-y-3 max-h-[88vh] flex flex-col border-t-4 border-pcpr-gold">
        <!-- Topo do Modal -->
        <div class="flex items-center justify-between border-b pb-2 shrink-0">
          <div>
            <h3 id="modal-logs-titulo" class="font-bold text-slate-900 text-sm flex items-center gap-1.5">📋 Histórico de Alterações</h3>
            <p class="text-[11px] text-slate-500">Registro auditável de trocas e substituições efetuadas no calendário</p>
          </div>
          <button type="button" onclick="window.fecharModalHistoricoLogs()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <!-- Painel de Filtros Avançados do Log -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs shrink-0">
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🔍 Busca Rápida (Letra a Letra):</label>
            <input type="text" id="modal-logs-busca" oninput="window.atualizarFiltrosLogs()" placeholder="Responsável, ação ou detalhe..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-pcpr-gold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-0.5">📆 Data Início:</label>
            <input type="date" id="modal-logs-data-inicio" onchange="window.atualizarFiltrosLogs()" class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-0.5">📆 Data Fim:</label>
            <input type="date" id="modal-logs-data-fim" onchange="window.atualizarFiltrosLogs()" class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium">
          </div>
        </div>

        <!-- Barra do Total de Registros Encontrados -->
        <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0">
          <span id="modal-logs-count" class="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            Exibindo 0 Registro(s)
          </span>
          <span class="text-[10px] text-slate-400 italic">Clique nos cabeçalhos para reordenar (A-Z / Z-A)</span>
        </div>

        <!-- Tabela com Ordenação Clicável nos Cabeçalhos -->
        <div class="overflow-x-auto border border-slate-200 rounded-xl flex-1 max-h-[50vh] overflow-y-auto font-sans">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] select-none">
              <tr>
                <th onclick="window.ordenarTabelaLogs('TIMESTAMP')" class="p-2.5 cursor-pointer hover:bg-slate-200 transition">
                  Data / Hora <span id="sort-log-icon-TIMESTAMP">⬇️</span>
                </th>
                <th onclick="window.ordenarTabelaLogs('RESPONSAVEL')" class="p-2.5 cursor-pointer hover:bg-slate-200 transition">
                  Responsável <span id="sort-log-icon-RESPONSAVEL"></span>
                </th>
                <th onclick="window.ordenarTabelaLogs('ACAO')" class="p-2.5 cursor-pointer hover:bg-slate-200 transition">
                  Ação <span id="sort-log-icon-ACAO"></span>
                </th>
                <th onclick="window.ordenarTabelaLogs('DETALHES')" class="p-2.5 cursor-pointer hover:bg-slate-200 transition">
                  Detalhamento da Operação <span id="sort-log-icon-DETALHES"></span>
                </th>
              </tr>
            </thead>
            <tbody id="tabela-logs-corpo" class="divide-y divide-slate-200"></tbody>
          </table>
        </div>

        <!-- Rodapé do Modal -->
        <div class="pt-2 border-t flex justify-end shrink-0">
          <button type="button" onclick="window.fecharModalHistoricoLogs()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
