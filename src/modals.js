// src/modals.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

export function initModalsModule() {
  criarModalEscalaDOM();
  criarModalGeradorLoteDOM();
  criarModalDetalhesTurnoDOM();
}

// =========================================================================
// 1. MODAL DE LANÇAMENTO / EDIÇÃO DE ESCALA
// =========================================================================
window.abrirModalEscala = function(dataSugerida = null, escalaId = null, scopeTarget = 'CRF') {
  let modal = document.getElementById('modal-escala');
  if (!modal) {
    criarModalEscalaDOM();
    modal = document.getElementById('modal-escala');
  }

  const inputId = document.getElementById('modal-esc-id');
  const selectScope = document.getElementById('modal-esc-scope');
  const inputData = document.getElementById('modal-esc-data');
  const selectTipo = document.getElementById('modal-esc-tipo');
  const selectTurno = document.getElementById('modal-esc-turno');
  const filtroUnidadeSelect = document.getElementById('modal-esc-filtro-unidade');
  const buscaSrvInput = document.getElementById('modal-esc-busca-srv');

  if (selectScope) selectScope.value = scopeTarget;

  if (scopeTarget === 'CRF') {
    selectTipo.innerHTML = `
      <option value="REGULAR">REGULAR</option>
      <option value="EXTRAJORNADA">EXTRAJORNADA</option>
    `;
    selectTurno.innerHTML = `
      <option value="12h (D)">12h (D) - Diurno</option>
      <option value="12h (N)">12h (N) - Noturno</option>
    `;
    const horaAtual = new Date().getHours();
    selectTurno.value = horaAtual >= 18 ? '12h (N)' : '12h (D)';
  } else {
    selectTipo.innerHTML = `
      <option value="PLANTÃO">PLANTÃO</option>
      <option value="SOBREAVISO">SOBREAVISO</option>
      <option value="EXTRAJORNADA">EXTRAJORNADA</option>
    `;
    selectTurno.innerHTML = `
      <option value="12h">12 Horas</option>
      <option value="24h">24 Horas (1 Dia)</option>
      <option value="2 dias">2 Dias</option>
      <option value="3 dias">3 Dias</option>
      <option value="4 dias">4 Dias</option>
      <option value="5 dias">5 Dias</option>
      <option value="6 dias">6 Dias</option>
      <option value="7 dias">7 Dias (1 Semana)</option>
    `;
    
    window.atualizarTurnoPadraoDelegacia();
  }

  let delFilterOptions = `<option value="TODAS">Todas as Unidades</option>`;
  (appState.delegacias || []).forEach(d => {
    delFilterOptions += `<option value="${d.id}">${d.nome}</option>`;
  });
  if (filtroUnidadeSelect) filtroUnidadeSelect.innerHTML = delFilterOptions;

  if (scopeTarget === 'DELEGACIA' && appState.selectedDelegaciaId) {
    if (filtroUnidadeSelect) filtroUnidadeSelect.value = appState.selectedDelegaciaId;
  } else {
    if (filtroUnidadeSelect) filtroUnidadeSelect.value = 'TODAS';
  }

  const hojeIso = getHojeISO();
  if (inputData) inputData.value = dataSugerida || hojeIso;
  if (buscaSrvInput) buscaSrvInput.value = '';

  if (escalaId) {
    const esc = (appState.escalas || []).find(e => e.id === escalaId);
    if (esc) {
      inputId.value = esc.id;
      inputData.value = esc.data;
      selectTipo.value = (esc.tipo === 'SDP' ? 'EXTRAJORNADA' : (esc.tipo || (scopeTarget === 'CRF' ? 'REGULAR' : 'PLANTÃO')));
      selectTurno.value = esc.turno || (scopeTarget === 'CRF' ? '12h (D)' : '24h');

      renderListaServidoresCheckboxes([esc.servidorId], true);
    }
  } else {
    inputId.value = '';
    renderListaServidoresCheckboxes([], false);
  }

  modal.classList.remove('hidden');
};

window.atualizarTurnoPadraoDelegacia = function() {
  const scope = document.getElementById('modal-esc-scope')?.value;
  if (scope !== 'DELEGACIA') return;

  const tipo = document.getElementById('modal-esc-tipo')?.value || 'PLANTÃO';
  const selectTurno = document.getElementById('modal-esc-turno');
  const delAtiva = (appState.delegacias || []).find(d => d.id === appState.selectedDelegaciaId);

  if (!selectTurno || !delAtiva) return;

  let config = tipo === 'SOBREAVISO' ? delAtiva.sobreavisoConfig : delAtiva.plantaoConfig;
  let intervaloPadrao = config ? config.intervalo : '24h';

  if (intervaloPadrao) {
    selectTurno.value = intervaloPadrao;
  }
};

window.fecharModalEscala = function() {
  document.getElementById('modal-escala')?.classList.add('hidden');
};

window.filtrarServidoresModalInline = function() {
  const busca = document.getElementById('modal-esc-busca-srv')?.value?.toLowerCase() || '';
  const unidadeFiltro = document.getElementById('modal-esc-filtro-unidade')?.value || 'TODAS';
  const cards = document.querySelectorAll('.srv-checkbox-item');

  cards.forEach(card => {
    const nome = card.getAttribute('data-nome') || '';
    const cargo = card.getAttribute('data-cargo') || '';
    const delId = card.getAttribute('data-del-id') || '';

    let atendeBusca = !busca || nome.includes(busca) || cargo.includes(busca);
    
    let atendeUnidade = true;
    if (unidadeFiltro !== 'TODAS') {
      const delObj = (appState.delegacias || []).find(d => d.id === unidadeFiltro);
      if (delObj && delObj.delegaciasIds && delObj.delegaciasIds.length > 0) {
        atendeUnidade = delId === unidadeFiltro || delObj.delegaciasIds.includes(delId);
      } else {
        atendeUnidade = delId === unidadeFiltro;
      }
    }

    if (atendeBusca && atendeUnidade) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
};

function renderListaServidoresCheckboxes(idsSelecionados = [], modoEdicao = false) {
  const container = document.getElementById('modal-esc-servidores-lista');
  if (!container) return;

  const listaSrv = [...(appState.servidores || [])]
    .filter(srv => {
      const n = normalizeText(srv.nome || '');
      return n !== 'administrador do sistema' && n !== 'admin' && n !== 'administrador';
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  if (listaSrv.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic p-2">Nenhum servidor cadastrado no sistema.</p>`;
    return;
  }

  const inputType = modoEdicao ? 'radio' : 'checkbox';

  container.innerHTML = listaSrv.map(srv => {
    const isChecked = idsSelecionados.includes(srv.id);
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    const isDel = (srv.cargo || '').toUpperCase().includes('DELEGADO');

    return `
      <label class="srv-checkbox-item flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer select-none"
             data-nome="${(srv.nome || '').toLowerCase()}" data-cargo="${(srv.cargo || '').toLowerCase()}" data-del-id="${srv.delegaciaId || ''}">
        <div class="flex items-center gap-2.5">
          <input type="${inputType}" name="modal_srv_ids" value="${srv.id}" ${isChecked ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4">
          <div>
            <div class="font-bold text-slate-900 text-xs">${srv.nome}</div>
            <div class="text-[10px] text-slate-500">${srv.cargo || 'APJ'} • Lotação: <b>${del ? del.nome : (srv.delegaciaNome || 'Não informada')}</b></div>
          </div>
        </div>
        ${isDel ? '<span class="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">DEL</span>' : ''}
      </label>
    `;
  }).join('');

  window.filtrarServidoresModalInline();
}

window.salvarEscalaModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('modal-esc-id').value;
  const scope = document.getElementById('modal-esc-scope').value;
  const dataIso = document.getElementById('modal-esc-data').value;
  const tipo = document.getElementById('modal-esc-tipo').value;
  const turno = document.getElementById('modal-esc-turno').value;

  const selecionados = document.querySelectorAll('input[name="modal_srv_ids"]:checked');
  const servidoresIds = Array.from(selecionados).map(cb => cb.value);

  if (!dataIso) {
    alert("Selecione a data do plantão.");
    return;
  }

  if (servidoresIds.length === 0) {
    alert("Selecione um policial para o plantão.");
    return;
  }

  if (id) {
    const idx = (appState.escalas || []).findIndex(e => e.id === id);
    if (idx !== -1) {
      const esc = appState.escalas[idx];
      const novoSrvId = servidoresIds[0];
      const srvObj = (appState.servidores || []).find(s => s.id === novoSrvId);

      let idDelegaciaResolvido = srvObj?.delegaciaId;
      if (!idDelegaciaResolvido && srvObj?.delegaciaNome) {
        const delPorNome = (appState.delegacias || []).find(d => normalizeText(d.nome) === normalizeText(srvObj.delegaciaNome));
        if (delPorNome) idDelegaciaResolvido = delPorNome.id;
      }

      esc.data = dataIso;
      esc.tipo = tipo;
      esc.turno = turno;
      esc.servidorId = novoSrvId;
      esc.delegaciaId = scope === 'CRF' ? (idDelegaciaResolvido || appState.selectedDelegaciaId || '') : appState.selectedDelegaciaId;

      await syncDocToFirestore('escalas', esc.id, esc);
    }
  } else {
    for (const sId of servidoresIds) {
      const srv = (appState.servidores || []).find(s => s.id === sId);

      let idDelegaciaResolvido = srv?.delegaciaId;
      if (!idDelegaciaResolvido && srv?.delegaciaNome) {
        const delPorNome = (appState.delegacias || []).find(d => normalizeText(d.nome) === normalizeText(srv.delegaciaNome));
        if (delPorNome) idDelegaciaResolvido = delPorNome.id;
      }

      const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

      const novaEscala = {
        id: newEscId,
        data: dataIso,
        servidorId: sId,
        delegaciaId: scope === 'CRF' ? (idDelegaciaResolvido || appState.selectedDelegaciaId || '') : appState.selectedDelegaciaId,
        scope: scope,
        tipo: tipo,
        turno: turno
      };

      if (!appState.escalas) appState.escalas = [];
      appState.escalas.push(novaEscala);
      await syncDocToFirestore('escalas', newEscId, novaEscala);
    }
  }

  window.fecharModalEscala();

  if (scope === 'CRF') {
    if (typeof window.filtrarTabelaCrfInline === 'function') window.filtrarTabelaCrfInline();
    renderCalendarGrid('calendar-crf-container', 'CRF');
  } else {
    if (typeof window.filtrarTabelaDelInline === 'function') window.filtrarTabelaDelInline();
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  }
};

// =========================================================================
// 2. MODAL DE DETALHES DO PLANTÃO (EXPANDIDO AO CLICAR NO CALENDÁRIO)
// =========================================================================
window.abrirModalDetalhesTurno = function(titulo, horarioOuData, idsString) {
  let modal = document.getElementById('modal-detalhes-turno');
  if (!modal) {
    criarModalDetalhesTurnoDOM();
    modal = document.getElementById('modal-detalhes-turno');
  }

  const ids = (idsString || '').split(',').filter(Boolean);
  const escalas = (appState.escalas || []).filter(e => ids.includes(e.id));

  const containerCorpo = document.getElementById('modal-detalhes-corpo');
  const tituloEl = document.getElementById('modal-detalhes-titulo');

  if (tituloEl) {
    tituloEl.innerText = `${titulo} - Detalhes do Lançamento`;
  }

  if (escalas.length === 0) {
    containerCorpo.innerHTML = `<p class="text-xs text-slate-500 italic p-4 text-center">Nenhum detalhe localizado para este lançamento.</p>`;
  } else {
    containerCorpo.innerHTML = escalas.map(esc => {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      const delEscala = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);
      const delServidor = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);

      const lotacaoOrigem = delServidor ? delServidor.nome : (srv?.delegaciaNome || 'Lotação não informada');
      const unidadePlantao = delEscala ? delEscala.nome : 'Unidade Local';

      const isSobreaviso = esc.tipo === 'SOBREAVISO';
      const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';

      let badgeClass = 'bg-sky-100 text-sky-900 border-sky-300';
      if (isSobreaviso) badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
      if (isExtra) badgeClass = 'bg-purple-100 text-purple-900 border-purple-300';

      return `
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs font-sans">
          <div class="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <span class="font-black text-slate-900 text-sm block">${srv?.nome || 'Servidor Não Localizado'}</span>
              <span class="text-[11px] text-slate-500 font-medium">${srv?.cargo || 'APJ'} • Tel: ${srv?.telefone || 'Não informado'}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
              ${esc.tipo || 'PLANTÃO'}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700">
            <div><b>Lotação de Origem:</b> ${lotacaoOrigem}</div>
            <div><b>Unidade do Plantão:</b> ${unidadePlantao}</div>
            <div><b>Data do Lançamento:</b> ${formatarDataBr(esc.data)}</div>
            <div><b>Duração / Turno:</b> ${esc.turno || '24h'}</div>
            ${esc.vtr ? `<div class="sm:col-span-2"><b>🚘 Viatura (VTR):</b> <span class="bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-1.5 py-0.5 rounded text-[10px]">${esc.vtr}</span></div>` : ''}
          </div>

          <div class="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button onclick="window.fecharModalDetalhes(); window.abrirModalEscala(null, '${esc.id}', '${esc.scope}')" class="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer">
              ✏️ Editar
            </button>
            <button onclick="window.excluirEscalaDoModal('${esc.id}', '${esc.scope}')" class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer">
              🗑️ Excluir
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
};

window.fecharModalDetalhes = function() {
  document.getElementById('modal-detalhes-turno')?.classList.add('hidden');
};

window.excluirEscalaDoModal = async function(escalaId, scope) {
  if (!confirm("Deseja realmente excluir este plantão?")) return;

  appState.escalas = appState.escalas.filter(e => e.id !== escalaId);
  await syncDocToFirestore('escalas', escalaId, null, true);

  window.fecharModalDetalhes();

  if (scope === 'CRF') {
    if (typeof window.filtrarTabelaCrfInline === 'function') window.filtrarTabelaCrfInline();
    renderCalendarGrid('calendar-crf-container', 'CRF');
  } else {
    if (typeof window.filtrarTabelaDelInline === 'function') window.filtrarTabelaDelInline();
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  }
};

function getHojeISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}

// =========================================================================
// INJEÇÃO DOM DOS MODAIS
// =========================================================================
function criarModalEscalaDOM() {
  const modalHTML = `
    <div id="modal-escala" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">Lançamento de Plantão / Escala</h3>
          <button type="button" onclick="window.fecharModalEscala()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarEscalaModal(event)" class="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="modal-esc-id">
          <input type="hidden" id="modal-esc-scope">

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Data:</label>
              <input type="date" id="modal-esc-data" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Tipo:</label>
              <select id="modal-esc-tipo" onchange="window.atualizarTurnoPadraoDelegacia()" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Turno / Duração:</label>
              <select id="modal-esc-turno" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
            </div>
          </div>

          <div class="space-y-2 pt-2 border-t">
            <div class="flex items-center justify-between">
              <label class="block font-bold text-slate-800">Selecione o Policial:</label>
              <span class="text-[10px] text-slate-500">Unidade de lotação atribuída automaticamente</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input type="text" id="modal-esc-busca-srv" oninput="window.filtrarServidoresModalInline()" placeholder="🔍 Filtrar por nome/cargo..." class="w-full text-xs border border-slate-300 rounded-xl p-2 bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              </div>
              <div>
                <select id="modal-esc-filtro-unidade" onchange="window.filtrarServidoresModalInline()" class="w-full text-xs border border-slate-300 rounded-xl p-2 bg-slate-50 font-bold text-slate-800"></select>
              </div>
            </div>

            <div id="modal-esc-servidores-lista" class="space-y-1.5 max-h-52 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200"></div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalEscala()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">Salvar Plantão</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function criarModalDetalhesTurnoDOM() {
  const modalHTML = `
    <div id="modal-detalhes-turno" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 id="modal-detalhes-titulo" class="font-bold text-slate-900 text-sm">Detalhes do Lançamento</h3>
          <button type="button" onclick="window.fecharModalDetalhes()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <div id="modal-detalhes-corpo" class="space-y-3 flex-1 overflow-y-auto pr-1"></div>

        <div class="pt-2 border-t flex justify-end shrink-0">
          <button type="button" onclick="window.fecharModalDetalhes()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs shadow-xs cursor-pointer">Fechar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function criarModalGeradorLoteDOM() {
  // Gerador em lote integrado ao geradorLote.js
}
