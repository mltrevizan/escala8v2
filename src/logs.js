// src/logs.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';
import { getPerfilUsuarioLogado } from './permissions.js';

/**
 * Grava um registro de auditoria no Firestore
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
      delegaciaId: delegaciaId || null,
      tipoAcao: tipoAcao, // 'TROCA_DELEGADO', 'TROCA_APJ', 'VINCULAR_APJ'
      detalhes: detalhes,
      dataPlantao: dataPlantao || null,
      turno: turno || null
    };

    if (!appState.logs) appState.logs = [];
    appState.logs.push(logEntry);

    await syncDocToFirestore('logs', logId, logEntry);
  } catch (err) {
    console.error("Erro ao registrar log no Firestore:", err);
  }
}

/**
 * Renderiza o modal de consulta ao histórico de logs
 */
export function abrirModalHistoricoLogs(scope, delegaciaId = null) {
  let modal = document.getElementById('modal-historico-logs');
  if (!modal) {
    criarModalHistoricoLogsDOM();
    modal = document.getElementById('modal-historico-logs');
  }

  const tituloEl = document.getElementById('modal-logs-titulo');
  const corpoTabela = document.getElementById('tabela-logs-corpo');
  if (!corpoTabela) return;

  const delObj = (appState.delegacias || []).find(d => String(d.id) === String(delegaciaId));
  const nomeUnidade = scope === 'CRF' ? 'Central CRF' : (delObj ? delObj.nome : 'Delegacia Selecionada');

  if (tituloEl) {
    tituloEl.innerText = `📋 Histórico de Alterações de Escala — ${nomeUnidade}`;
  }

  // Filtra logs por escopo e por delegacia (se aplicável)
  let logsFiltrados = (appState.logs || []).filter(l => {
    if (l.scope !== scope) return false;
    if (scope === 'DELEGACIA' && delegaciaId) {
      if (delObj && delObj.delegaciasIds && delObj.delegaciasIds.length > 0) {
        return String(l.delegaciaId) === String(delegaciaId) || delObj.delegaciasIds.includes(l.delegaciaId);
      }
      return String(l.delegaciaId) === String(delegaciaId);
    }
    return true;
  }).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  if (logsFiltrados.length === 0) {
    corpoTabela.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400 italic">Nenhum registro de alteração localizado para ${nomeUnidade}.</td></tr>`;
  } else {
    corpoTabela.innerHTML = logsFiltrados.map(l => `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs font-sans">
        <td class="p-2.5 font-mono text-slate-600 font-bold whitespace-nowrap">${formatarDataHoraBr(l.timestamp)}</td>
        <td class="p-2.5 font-bold text-slate-900">
          ${l.usuarioNome}
          <span class="block text-[10px] text-slate-500 font-mono">${l.usuarioPerfil}</span>
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

  modal.classList.remove('hidden');
}

window.fecharModalHistoricoLogs = function() {
  document.getElementById('modal-historico-logs')?.classList.add('hidden');
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
      <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-5 space-y-4 max-h-[85vh] flex flex-col border-t-4 border-pcpr-gold">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <div>
            <h3 id="modal-logs-titulo" class="font-bold text-slate-900 text-sm flex items-center gap-1.5">📋 Histórico de Alterações</h3>
            <p class="text-[11px] text-slate-500">Registro auditável de trocas e substituições efetuadas no calendário</p>
          </div>
          <button type="button" onclick="window.fecharModalHistoricoLogs()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <div class="overflow-x-auto border border-slate-200 rounded-xl flex-1 max-h-[60vh] overflow-y-auto font-sans">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] select-none">
              <tr>
                <th class="p-2.5">Data / Hora</th>
                <th class="p-2.5">Responsável</th>
                <th class="p-2.5">Ação</th>
                <th class="p-2.5">Detalhamento da Operação</th>
              </tr>
            </thead>
            <tbody id="tabela-logs-corpo" class="divide-y divide-slate-200"></tbody>
          </table>
        </div>

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
