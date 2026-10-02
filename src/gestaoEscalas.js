// src/gestaoEscalas.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

let vinculoState = {
  escalaDelegadoId: null,
  delegadoObj: null,
  dataPlantao: null,
  turnoPlantao: null,
  buscaTextual: '',
  sdp: 'TODAS',
  delegaciaId: 'TODAS',
  sortColuna: 'PRIORIDADE', // 'PRIORIDADE', 'NOME', 'CARGO', 'DELEGACIA', 'SDP'
  sortDirecao: 'ASC',
  membrosSelecionados: []
};

export function renderGestaoCrfModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentYear, currentMonth, filtroSdpGestaoCrf, filtroDelGestaoCrf } = appState;
  const mesExtenso = new Date(currentYear, currentMonth, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // Lista os Delegados escalados no mês para a CRF
  const escalasDelegados = (appState.escalas || []).filter(e => {
    if (e.scope !== 'CRF') return false;
    const [ano, mes] = e.data.split('-').map(Number);
    if (ano !== currentYear || (mes - 1) !== currentMonth) return false;

    const srv = (appState.servidores || []).find(s => s.id === e.servidorId);
    return srv && (srv.cargo || '').toUpperCase().includes('DELEGADO');
  }).sort((a, b) => a.data.localeCompare(b.data));

  let htmlLinhas = escalasDelegados.map(esc => {
    const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const delOrigem = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);

    // Identifica se há APJs vinculados no mesmo dia/turno/esc do delegado
    const vinculosExistentes = (appState.escalas || []).filter(e => 
      e.scope === 'CRF' && 
      e.data === esc.data && 
      e.turno === esc.turno && 
      e.delegadoVinculadoId === esc.servidorId
    );

    const nomesApjsVinculados = vinculosExistentes.map(v => {
      const s = (appState.servidores || []).find(pol => pol.id === v.servidorId);
      return s ? s.nome : 'Policial';
    }).join(', ');

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
        <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(esc.data)}</td>
        <td class="p-3 font-bold text-slate-900">${srv ? srv.nome : 'Delegado'}</td>
        <td class="p-3 text-slate-600 font-medium">${delOrigem ? delOrigem.nome : (srv?.delegaciaNome || '-')}</td>
        <td class="p-3 font-mono font-bold text-slate-700">${esc.turno || '24h'}</td>
        <td class="p-3">
          ${vinculosExistentes.length > 0 ? `
            <div class="space-y-0.5">
              <span class="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-1.5 py-0.5 rounded block w-fit">
                👥 ${vinculosExistentes.length} APJs Vinculados
              </span>
              <span class="text-[10px] text-slate-500 italic block truncate max-w-xs" title="${nomesApjsVinculados}">
                ${nomesApjsVinculados}
              </span>
            </div>
          ` : `
            <span class="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">
              ⚠️ Sem equipe de apoio
            </span>
          `}
        </td>
        <td class="p-3 text-right">
          <button onclick="window.abrirModalVincularApjs('${esc.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1 ml-auto">
            🔗 Vincular Equipe / APJs
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (escalasDelegados.length === 0) {
    htmlLinhas = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Nenhum Delegado escalado no mês de ${mesExtenso} para a Central CRF.</td></tr>`;
  }

  container.innerHTML = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão e Vinculação de Equipes CRF</h2>
          <p class="text-[11px] text-slate-500">Acompanhamento dos plantões de Delegados e montagem de equipes de apoio (${mesExtenso})</p>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
            <th class="p-3">Data</th>
            <th class="p-3">Delegado Plantonista</th>
            <th class="p-3">Lotação de Origem</th>
            <th class="p-3">Turno</th>
            <th class="p-3">Equipe de Apoio (APJs)</th>
            <th class="p-3 text-right">Ação</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">${htmlLinhas}</tbody>
      </table>
    </div>
  `;
}

export function renderGestaoDelegaciasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs font-bold">Módulo de Gestão por Delegacias operando via calendário interativo.</div>`;
}

// =========================================================================
// MODAL DE VINCULAÇÃO DE APJS AO DELEGADO COM AUTOCOMPLETE E PRIORIZAÇÃO
// =========================================================================
window.abrirModalVincularApjs = function(escalaDelegadoId) {
  let modal = document.getElementById('modal-vincular-apjs');
  if (!modal) {
    criarModalVincularApjsDOM();
    modal = document.getElementById('modal-vincular-apjs');
  }

  const escDelegado = (appState.escalas || []).find(e => e.id === escalaDelegadoId);
  if (!escDelegado) return;

  const delegadoSrv = (appState.servidores || []).find(s => s.id === escDelegado.servidorId);

  vinculoState.escalaDelegadoId = escalaDelegadoId;
  vinculoState.delegadoObj = delegadoSrv;
  vinculoState.dataPlantao = escDelegado.data;
  vinculoState.turnoPlantao = escDelegado.turno;
  vinculoState.buscaTextual = '';
  vinculoState.sdp = 'TODAS';
  vinculoState.delegaciaId = 'TODAS';
  vinculoState.sortColuna = 'PRIORIDADE';
  vinculoState.sortDirecao = 'ASC';

  // Carrega APJs já vinculados a este plantão
  const vinculadosJa = (appState.escalas || []).filter(e => 
    e.scope === 'CRF' && 
    e.data === escDelegado.data && 
    e.turno === escDelegado.turno && 
    e.delegadoVinculadoId === escDelegado.servidorId
  );
  vinculoState.membrosSelecionados = vinculadosJa.map(e => e.servidorId);

  // Preenche dados do topo do modal
  const infoEl = document.getElementById('vinc-info-delegado');
  if (infoEl) {
    infoEl.innerHTML = `
      <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div>
          <span class="font-black text-indigo-950 block text-sm">👮 DEL. ${delegadoSrv ? delegadoSrv.nome : 'Plantonista'}</span>
          <span class="text-slate-600 font-mono text-[11px]"><b>Data:</b> ${formatarDataBr(escDelegado.data)} | <b>Turno:</b> ${escDelegado.turno || '24h'}</span>
        </div>
        <button type="button" onclick="window.sugerirAutocompleteEquipeAnterior()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1 shrink-0">
          ✨ Repetir Última Equipe Vinculada
        </button>
      </div>
    `;
  }

  window.popularFiltrosModalVinculacao();
  window.renderizarListaApjsModal();
  modal.classList.remove('hidden');
};

window.fecharModalVincularApjs = function() {
  document.getElementById('modal-vincular-apjs')?.classList.add('hidden');
};

window.popularFiltrosModalVinculacao = function() {
  const selectSdp = document.getElementById('vinc-filtro-sdp');
  if (selectSdp) {
    const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
    (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim().toUpperCase()); });

    let opts = `<option value="TODAS">Todas as SDPs</option>`;
    [...setSdps].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach(s => {
      opts += `<option value="${s}">${s}</option>`;
    });
    selectSdp.innerHTML = opts;
  }

  window.atualizarOptionsDelegaciasVinculacao();
};

window.aoMudarSdpModalVinculacao = function(sdpSel) {
  vinculoState.sdp = sdpSel;
  vinculoState.delegaciaId = 'TODAS';
  window.atualizarOptionsDelegaciasVinculacao();
  window.renderizarListaApjsModal();
};

window.atualizarOptionsDelegaciasVinculacao = function() {
  const selectDel = document.getElementById('vinc-filtro-del');
  if (!selectDel) return;

  let dels = appState.delegacias || [];
  if (vinculoState.sdp !== 'TODAS') {
    dels = dels.filter(d => (d.subdivisao || '').toUpperCase() === vinculoState.sdp);
  }

  let opts = `<option value="TODAS">Todas as Delegacias</option>`;
  dels.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).forEach(d => {
    opts += `<option value="${d.id}">${d.nome}</option>`;
  });
  selectDel.innerHTML = opts;
};

window.atualizarFiltrosModalVinculacao = function() {
  vinculoState.buscaTextual = document.getElementById('vinc-busca-srv')?.value?.toLowerCase() || '';
  vinculoState.sdp = document.getElementById('vinc-filtro-sdp')?.value || 'TODAS';
  vinculoState.delegaciaId = document.getElementById('vinc-filtro-del')?.value || 'TODAS';

  window.renderizarListaApjsModal();
};

window.ordenarApjsModalColuna = function(coluna) {
  if (vinculoState.sortColuna === coluna) {
    vinculoState.sortDirecao = vinculoState.sortDirecao === 'ASC' ? 'DESC' : 'ASC';
  } else {
    vinculoState.sortColuna = coluna;
    vinculoState.sortDirecao = 'ASC';
  }

  ['PRIORIDADE', 'NOME', 'CARGO', 'DELEGACIA', 'SDP'].forEach(col => {
    const el = document.getElementById(`vinc-sort-icon-${col}`);
    if (el) {
      if (col === vinculoState.sortColuna) {
        el.innerText = vinculoState.sortDirecao === 'ASC' ? '⬆️' : '⬇️';
      } else {
        el.innerText = '';
      }
    }
  });

  window.renderizarListaApjsModal();
};

window.renderizarListaApjsModal = function() {
  const container = document.getElementById('vinc-tabela-corpo');
  if (!container) return;

  const { delegadoObj, buscaTextual, sdp, delegaciaId, sortColuna, sortDirecao, membrosSelecionados } = vinculoState;
  const delegadoId = delegadoObj ? delegadoObj.id : null;
  const delDelegadoId = delegadoObj ? delegadoObj.delegaciaId : null;

  // 1. Calcula histórico de vínculos anteriores com este Delegado
  const apjsHistoricoIds = new Set();
  (appState.escalas || []).forEach(e => {
    if (e.scope === 'CRF' && e.delegadoVinculadoId === delegadoId && e.servidorId !== delegadoId) {
      apjsHistoricoIds.add(e.servidorId);
    }
  });

  // 2. Filtra Policiais (Apenas não-Delegados)
  let apjsFiltrados = [...(appState.servidores || [])].filter(srv => {
    const cargoU = (srv.cargo || '').toUpperCase();
    if (cargoU.includes('DELEGADO')) return false;

    const nomeN = normalizeText(srv.nome || '');
    if (nomeN === 'administrador do sistema' || nomeN === 'admin') return false;

    // Filtro por Busca Textual
    if (buscaTextual) {
      const nomePol = (srv.nome || '').toLowerCase();
      const cargoPol = (srv.cargo || '').toLowerCase();
      const telPol = (srv.telefone || '').toLowerCase();
      if (!nomePol.includes(buscaTextual) && !cargoPol.includes(buscaTextual) && !telPol.includes(buscaTextual)) {
        return false;
      }
    }

    // Filtro por SDP
    if (sdp !== 'TODAS') {
      const delObj = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
      const sdpSrv = (delObj?.subdivisao || srv.subdivisao || '').toUpperCase();
      if (sdpSrv !== sdp) return false;
    }

    // Filtro por Delegacia
    if (delegaciaId !== 'TODAS') {
      if (srv.delegaciaId !== delegaciaId) return false;
    }

    return true;
  });

  // 3. Ordenação com Prioridade Inteligente
  apjsFiltrados.sort((a, b) => {
    const isSelA = membrosSelecionados.includes(a.id);
    const isSelB = membrosSelecionados.includes(b.id);

    // Selecionados sempre em primeiro lugar
    if (isSelA && !isSelB) return -1;
    if (!isSelA && isSelB) return 1;

    // Prioridade por Grupo se a coluna for 'PRIORIDADE'
    if (sortColuna === 'PRIORIDADE') {
      const histA = apjsHistoricoIds.has(a.id) ? 1 : 0;
      const histB = apjsHistoricoIds.has(b.id) ? 1 : 0;

      const mesmaDelA = (a.delegaciaId === delDelegadoId) ? 1 : 0;
      const mesmaDelB = (b.delegaciaId === delDelegadoId) ? 1 : 0;

      const pesoA = (histA * 10) + (mesmaDelA * 5);
      const pesoB = (histB * 10) + (mesmaDelB * 5);

      if (pesoA !== pesoB) return sortDirecao === 'ASC' ? (pesoB - pesoA) : (pesoA - pesoB);
    }

    const delA = (appState.delegacias || []).find(d => d.id === a.delegaciaId);
    const delB = (appState.delegacias || []).find(d => d.id === b.delegaciaId);

    let valA = '', valB = '';
    if (sortColuna === 'NOME') { valA = a.nome || ''; valB = b.nome || ''; }
    else if (sortColuna === 'CARGO') { valA = a.cargo || ''; valB = b.cargo || ''; }
    else if (sortColuna === 'DELEGACIA') { valA = delA?.nome || a.delegaciaNome || ''; valB = delB?.nome || b.delegaciaNome || ''; }
    else if (sortColuna === 'SDP') { valA = delA?.subdivisao || a.subdivisao || ''; valB = delB?.subdivisao || b.subdivisao || ''; }

    const res = valA.localeCompare(valB, undefined, { numeric: true });
    return sortDirecao === 'ASC' ? res : -res;
  });

  const contadorEl = document.getElementById('vinc-contador-sel');
  if (contadorEl) contadorEl.innerText = `${membrosSelecionados.length} APJs Selecionados`;

  if (apjsFiltrados.length === 0) {
    container.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 italic">Nenhum policial encontrado para os filtros.</td></tr>`;
    return;
  }

  container.innerHTML = apjsFiltrados.map(srv => {
    const isChecked = membrosSelecionados.includes(srv.id);
    const posIndex = membrosSelecionados.indexOf(srv.id);

    const temHistorico = apjsHistoricoIds.has(srv.id);
    const mesmaDelegacia = (srv.delegaciaId === delDelegadoId);
    const delObj = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);

    let badgeTag = '';
    if (temHistorico) {
      badgeTag = `<span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[9px] rounded">✨ Vinculado Anteriormente</span>`;
    } else if (mesmaDelegacia) {
      badgeTag = `<span class="px-1.5 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-[9px] rounded">🏢 Mesma Delegacia de Origem</span>`;
    }

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs ${isChecked ? 'bg-indigo-50/50' : ''}">
        <td class="p-2.5 text-center">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleApjVinculoModal('${srv.id}', this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer">
        </td>
        <td class="p-2.5 font-bold text-slate-800">
          <div class="flex items-center gap-2">
            ${isChecked ? `<span class="bg-indigo-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full">${posIndex + 1}º</span>` : ''}
            <span>${srv.nome}</span>
            ${badgeTag}
          </div>
        </td>
        <td class="p-2.5 font-semibold text-slate-700">${srv.cargo || 'APJ'}</td>
        <td class="p-2.5 text-slate-600">${delObj ? delObj.nome : (srv.delegaciaNome || '-')}</td>
        <td class="p-2.5 font-mono text-slate-700">${delObj?.subdivisao || srv.subdivisao || '8ª SDP'}</td>
      </tr>
    `;
  }).join('');
};

window.toggleApjVinculoModal = function(srvId, isChecked) {
  if (isChecked) {
    if (!vinculoState.membrosSelecionados.includes(srvId)) {
      vinculoState.membrosSelecionados.push(srvId);
    }
  } else {
    vinculoState.membrosSelecionados = vinculoState.membrosSelecionados.filter(id => id !== srvId);
  }
  window.renderizarListaApjsModal();
};

// AUTOCOMPLETE DE EQUIPE ANTERIOR
window.sugerirAutocompleteEquipeAnterior = function() {
  const delegadoId = vinculoState.delegadoObj ? vinculoState.delegadoObj.id : null;
  if (!delegadoId) return;

  // Busca a última escala do mesmo delegado que teve APJs vinculados
  const escalasPassadasComEquipe = (appState.escalas || []).filter(e => 
    e.scope === 'CRF' && 
    e.delegadoVinculadoId === delegadoId && 
    e.servidorId !== delegadoId &&
    e.data < vinculoState.dataPlantao
  ).sort((a, b) => b.data.localeCompare(a.data));

  if (escalasPassadasComEquipe.length === 0) {
    alert("Nenhuma equipe prévia vinculada a este Delegado foi localizada em plantões anteriores.");
    return;
  }

  const ultimaData = escalasPassadasComEquipe[0].data;
  const apjsUltimaEquipe = (appState.escalas || []).filter(e => 
    e.scope === 'CRF' && 
    e.delegadoVinculadoId === delegadoId && 
    e.data === ultimaData
  ).map(e => e.servidorId);

  if (apjsUltimaEquipe.length > 0) {
    vinculoState.membrosSelecionados = [...new Set([...vinculoState.membrosSelecionados, ...apjsUltimaEquipe])];
    window.renderizarListaApjsModal();
    alert(`Autocomplete aplicado! ${apjsUltimaEquipe.length} APJs sugeridos a partir da escala do dia ${formatarDataBr(ultimaData)}.`);
  }
};

window.salvarVinculacaoApjsModal = async function(e) {
  e.preventDefault();

  const { dataPlantao, turnoPlantao, delegadoObj, membrosSelecionados } = vinculoState;
  const delegadoId = delegadoObj ? delegadoObj.id : null;

  if (!delegadoId) return;

  // 1. Remove APJs vinculados anteriormente neste mesmo dia/turno para este delegado
  const escalasExistentes = (appState.escalas || []).filter(e => 
    e.scope === 'CRF' && 
    e.data === dataPlantao && 
    e.turno === turnoPlantao && 
    e.delegadoVinculadoId === delegadoId
  );

  for (const esc of escalasExistentes) {
    appState.escalas = (appState.escalas || []).filter(x => x.id !== esc.id);
    await syncDocToFirestore('escalas', esc.id, null, true);
  }

  // 2. Insere os novos APJs vinculados
  let inseridos = 0;
  for (const apjId of membrosSelecionados) {
    const srvApj = (appState.servidores || []).find(s => s.id === apjId);
    const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const novaEscala = {
      id: newEscId,
      data: dataPlantao,
      servidorId: apjId,
      delegaciaId: srvApj ? srvApj.delegaciaId : '',
      scope: 'CRF',
      tipo: 'PLANTÃO',
      turno: turnoPlantao,
      delegadoVinculadoId: delegadoId
    };

    if (!appState.escalas) appState.escalas = [];
    appState.escalas.push(novaEscala);
    await syncDocToFirestore('escalas', newEscId, novaEscala);
    inseridos++;
  }

  alert(`Sucesso! Equipe de ${inseridos} APJs vinculada com sucesso ao Delegado.`);
  window.fecharModalVincularApjs();

  renderGestaoCrfModule('gestao-crf-container');
  renderCalendarGrid('calendar-crf-container', 'CRF');
};

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}

function criarModalVincularApjsDOM() {
  const modalHTML = `
    <div id="modal-vincular-apjs" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">🔗 Vincular Equipe de APJs ao Delegado Plantonista</h3>
          <button type="button" onclick="window.fecharModalVincularApjs()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <div id="vinc-info-delegado"></div>

        <form onsubmit="window.salvarVinculacaoApjsModal(event)" class="space-y-3 text-xs flex-1 overflow-y-auto pr-1 flex flex-col">
          <!-- Filtros de Busca -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200 shrink-0">
            <div>
              <input type="text" id="vinc-busca-srv" oninput="window.atualizarFiltrosModalVinculacao()" placeholder="🔍 Filtrar nome ou cargo..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </div>
            <div>
              <select id="vinc-filtro-sdp" onchange="window.aoMudarSdpModalVinculacao(this.value)" class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-bold text-slate-800"></select>
            </div>
            <div>
              <select id="vinc-filtro-del" onchange="window.atualizarFiltrosModalVinculacao()" class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-bold text-slate-800"></select>
            </div>
          </div>

          <!-- Contador -->
          <div class="flex items-center justify-between text-[11px] font-mono text-slate-500 shrink-0">
            <span id="vinc-contador-sel" class="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">0 APJs Selecionados</span>
            <span class="text-[10px] text-slate-400 italic">Clique nos cabeçalhos para reordenar a lista</span>
          </div>

          <!-- Tabela com Ordenação Clicável -->
          <div class="overflow-x-auto border border-slate-200 rounded-xl flex-1 max-h-64 overflow-y-auto">
            <table class="w-full text-left text-xs border-collapse font-sans">
              <thead class="sticky top-0 bg-slate-100 z-10 select-none">
                <tr class="text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th class="p-2.5 text-center w-10">Sel.</th>
                  <th onclick="window.ordenarApjsModalColuna('PRIORIDADE')" class="p-2.5 cursor-pointer hover:bg-slate-200 transition">
                    Policial / Servidor <span id="vinc-sort-icon-PRIORIDADE">⬆️</span>
                  </th>
                  <th onclick="window.ordenarApjsModalColuna('CARGO')" class="p-2.5 cursor-pointer hover:bg-slate-200 transition">
                    Cargo <span id="vinc-sort-icon-CARGO"></span>
                  </th>
                  <th onclick="window.ordenarApjsModalColuna('DELEGACIA')" class="p-2.5 cursor-pointer hover:bg-slate-200 transition">
                    Lotação <span id="vinc-sort-icon-DELEGACIA"></span>
                  </th>
                  <th onclick="window.ordenarApjsModalColuna('SDP')" class="p-2.5 cursor-pointer hover:bg-slate-200 transition">
                    SDP <span id="vinc-sort-icon-SDP"></span>
                  </th>
                </tr>
              </thead>
              <tbody id="vinc-tabela-corpo" class="divide-y divide-slate-200"></tbody>
            </table>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalVincularApjs()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">💾 Salvar Vinculação da Equipe</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
