// src/geradorLote.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

let geradorState = {
  modo: 'INDIVIDUAL', // 'INDIVIDUAL' ou 'EQUIPE'
  policiaisSelecionados: [], // Lista ordenada de IDs no modo individual
  grupos: [], // Para modo equipe: [{ id: 1, nome: 'Equipe 1', membros: [id1, id2] }]
  filtroTexto: '',
  filtroDelegacia: 'TODAS',
  filtroCargo: 'TODOS'
};

export function initGeradorLoteModule() {
  criarModalGeradorLoteDOM();
}

window.abrirModalGeradorLote = function(scopeTarget = 'DELEGACIA') {
  let modal = document.getElementById('modal-gerador-lote');
  if (!modal) {
    criarModalGeradorLoteDOM();
    modal = document.getElementById('modal-gerador-lote');
  }

  document.getElementById('ger-scope').value = scopeTarget;
  
  // Popula o select de Delegacias do Lote
  const selectDel = document.getElementById('ger-delegacia');
  let delOptions = (appState.delegacias || []).map(d => 
    `<option value="${d.id}" ${d.id === appState.selectedDelegaciaId ? 'selected' : ''}>${d.nome}</option>`
  ).join('');
  if (selectDel) selectDel.innerHTML = delOptions;

  // Popula filtro de Lotação na lista de busca
  const selectFiltroDel = document.getElementById('ger-filtro-del');
  let filtroDelOpts = `<option value="TODAS">Todas as Unidades</option>`;
  (appState.delegacias || []).forEach(d => {
    filtroDelOpts += `<option value="${d.id}">${d.nome}</option>`;
  });
  if (selectFiltroDel) selectFiltroDel.innerHTML = filtroDelOpts;

  // Popula filtro de Cargos dinamicamente
  const selectFiltroCargo = document.getElementById('ger-filtro-cargo');
  const cargosSet = new Set(['APJ', 'DELEGADO']);
  (appState.servidores || []).forEach(s => {
    if (s.cargo) cargosSet.add(s.cargo.toUpperCase());
  });
  let filtroCargoOpts = `<option value="TODOS">Todos os Cargos</option>`;
  cargosSet.forEach(c => {
    filtroCargoOpts += `<option value="${c}">${c}</option>`;
  });
  if (selectFiltroCargo) selectFiltroCargo.innerHTML = filtroCargoOpts;

  // Reset de Filtros e Estado do Gerador
  geradorState = {
    modo: 'INDIVIDUAL',
    policiaisSelecionados: [],
    grupos: [],
    filtroTexto: '',
    filtroDelegacia: scopeTarget === 'DELEGACIA' ? (appState.selectedDelegaciaId || 'TODAS') : 'TODAS',
    filtroCargo: 'TODOS'
  };

  const inputBusca = document.getElementById('ger-busca-srv');
  if (inputBusca) inputBusca.value = '';
  if (selectFiltroDel) selectFiltroDel.value = geradorState.filtroDelegacia;
  if (selectFiltroCargo) selectFiltroCargo.value = 'TODOS';

  // Preenche datas padrão (primeiro e último dia do mês atual)
  const { currentYear, currentMonth } = appState;
  const ultimoDia = new Date(currentYear, currentMonth + 1, 0).getDate();
  document.getElementById('ger-data-inicio').value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  document.getElementById('ger-data-fim').value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  window.alternarModoGerador('INDIVIDUAL');
  modal.classList.remove('hidden');
};

window.fecharModalGeradorLote = function() {
  document.getElementById('modal-gerador-lote')?.classList.add('hidden');
};

window.atualizarFiltrosListaServidoresGerador = function() {
  geradorState.filtroTexto = document.getElementById('ger-busca-srv')?.value?.toLowerCase() || '';
  geradorState.filtroDelegacia = document.getElementById('ger-filtro-del')?.value || 'TODAS';
  geradorState.filtroCargo = document.getElementById('ger-filtro-cargo')?.value || 'TODOS';

  renderizarSelecaoEOrdenacao();
};

window.alternarModoGerador = function(novoModo) {
  geradorState.modo = novoModo;
  const btnInd = document.getElementById('btn-modo-individual');
  const btnEqp = document.getElementById('btn-modo-equipe');

  if (novoModo === 'INDIVIDUAL') {
    btnInd.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs cursor-pointer transition";
    btnEqp.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer transition";
  } else {
    btnEqp.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs cursor-pointer transition";
    btnInd.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer transition";
  }

  renderizarSelecaoEOrdenacao();
};

function renderizarSelecaoEOrdenacao() {
  const container = document.getElementById('ger-painel-policiais');
  if (!container) return;

  const { filtroTexto, filtroDelegacia, filtroCargo } = geradorState;

  // Filtra lista de servidores com base nos 3 seletores (Texto, Delegacia e Cargo)
  const servidoresFiltrados = [...(appState.servidores || [])]
    .filter(s => {
      const n = normalizeText(s.nome || '');
      if (n === 'administrador do sistema' || n === 'admin') return false;

      // Filtro de Texto (Nome ou Cargo)
      if (filtroTexto) {
        const bateuNome = (s.nome || '').toLowerCase().includes(filtroTexto);
        const bateuCargo = (s.cargo || '').toLowerCase().includes(filtroTexto);
        if (!bateuNome && !bateuCargo) return false;
      }

      // Filtro de Delegacia / Lotação
      if (filtroDelegacia !== 'TODAS') {
        const delObj = (appState.delegacias || []).find(d => d.id === filtroDelegacia);
        const bateuId = s.delegaciaId === filtroDelegacia;
        const bateuUnificado = delObj?.delegaciasIds && delObj.delegaciasIds.includes(s.delegaciaId);
        if (!bateuId && !bateuUnificado) return false;
      }

      // Filtro de Cargo
      if (filtroCargo !== 'TODOS') {
        if ((s.cargo || '').toUpperCase() !== filtroCargo) return false;
      }

      return true;
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  if (geradorState.modo === 'INDIVIDUAL') {
    let htmlServidores = servidoresFiltrados.map(srv => {
      const isChecked = geradorState.policiaisSelecionados.includes(srv.id);
      const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
      const isDel = (srv.cargo || '').toUpperCase().includes('DELEGADO');

      return `
        <label class="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer text-xs select-none">
          <div class="flex items-center gap-2">
            <input type="checkbox" value="${srv.id}" ${isChecked ? 'checked' : ''} onchange="window.togglePolicialGerador('${srv.id}', this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4">
            <div>
              <span class="font-bold text-slate-800">${srv.nome}</span>
              <span class="text-[10px] text-slate-500 block">Lotação: ${del ? del.nome : (srv.delegaciaNome || 'Não informada')}</span>
            </div>
          </div>
          <span class="text-[10px] ${isDel ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'} font-bold px-1.5 py-0.5 rounded">${srv.cargo || 'APJ'}</span>
        </label>
      `;
    }).join('');

    if (servidoresFiltrados.length === 0) {
      htmlServidores = `<p class="text-[11px] text-slate-400 italic p-3 text-center">Nenhum policial localizado para os filtros informados.</p>`;
    }

    let htmlFilaOrdenada = geradorState.policiaisSelecionados.map((id, index) => {
      const srv = (appState.servidores || []).find(s => s.id === id);
      return `
        <div class="flex items-center justify-between p-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-950">
          <span class="truncate">${index + 1}º - ${srv?.nome || 'Servidor'}</span>
          <div class="space-x-1 shrink-0">
            <button type="button" onclick="window.moverPolicialFila(${index}, -1)" class="px-1.5 py-0.5 bg-indigo-200 hover:bg-indigo-300 rounded text-[10px] cursor-pointer">⬆️</button>
            <button type="button" onclick="window.moverPolicialFila(${index}, 1)" class="px-1.5 py-0.5 bg-indigo-200 hover:bg-indigo-300 rounded text-[10px] cursor-pointer">⬇️</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 text-xs">1. Selecione os Policiais (${servidoresFiltrados.length}):</label>
          <div class="space-y-1.5 max-h-52 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
            ${htmlServidores}
          </div>
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 text-xs">2. Ordem de Rotação (Fila do Ciclo):</label>
          <div class="space-y-1.5 max-h-52 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
            ${htmlFilaOrdenada.length > 0 ? htmlFilaOrdenada : '<p class="text-[11px] text-slate-400 italic p-3 text-center">Marque os policiais ao lado para montar a ordem da rotação.</p>'}
          </div>
        </div>
      </div>
    `;
  } else {
    // Modo Equipes / Grupos
    container.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="font-bold text-xs text-slate-800">Montagem de Equipes Fixas</span>
          <button type="button" onclick="window.adicionarGrupoGerador()" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer">➕ Adicionar Grupo/Equipe</button>
        </div>
        <div id="ger-lista-grupos" class="space-y-2 max-h-56 overflow-y-auto pr-1"></div>
      </div>
    `;
    renderizarGruposDOM(servidoresFiltrados);
  }
}

window.togglePolicialGerador = function(id, isChecked) {
  if (isChecked) {
    if (!geradorState.policiaisSelecionados.includes(id)) {
      geradorState.policiaisSelecionados.push(id);
    }
  } else {
    geradorState.policiaisSelecionados = geradorState.policiaisSelecionados.filter(x => x !== id);
  }
  renderizarSelecaoEOrdenacao();
};

window.moverPolicialFila = function(index, direcao) {
  const novaPos = index + direcao;
  if (novaPos < 0 || novaPos >= geradorState.policiaisSelecionados.length) return;

  const temp = geradorState.policiaisSelecionados[index];
  geradorState.policiaisSelecionados[index] = geradorState.policiaisSelecionados[novaPos];
  geradorState.policiaisSelecionados[novaPos] = temp;

  renderizarSelecaoEOrdenacao();
};

window.adicionarGrupoGerador = function() {
  const novoId = geradorState.grupos.length + 1;
  geradorState.grupos.push({
    id: novoId,
    nome: `Equipe ${novoId}`,
    membros: []
  });
  renderizarSelecaoEOrdenacao();
};

function renderizarGruposDOM(servidoresFiltrados) {
  const container = document.getElementById('ger-lista-grupos');
  if (!container) return;

  if (geradorState.grupos.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-slate-400 italic p-3 text-center">Nenhum grupo criado. Clique no botão acima para "Adicionar Grupo/Equipe".</p>`;
    return;
  }

  container.innerHTML = geradorState.grupos.map((grp, gIndex) => {
    let srvOpts = servidoresFiltrados.map(s => {
      const isChecked = grp.membros.includes(s.id);
      return `
        <label class="inline-flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 text-[11px] font-medium cursor-pointer">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleMembroGrupo(${gIndex}, '${s.id}', this.checked)" class="rounded text-indigo-600">
          <span>${s.nome}</span>
        </label>
      `;
    }).join(' ');

    return `
      <div class="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
        <div class="flex items-center justify-between font-bold text-slate-800">
          <span>👥 ${grp.nome}</span>
          <button type="button" onclick="window.removerGrupoGerador(${gIndex})" class="text-red-600 hover:text-red-800 font-bold text-[10px] cursor-pointer">Excluir Equipe</button>
        </div>
        <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-white/50 rounded-lg">
          ${srvOpts.length > 0 ? srvOpts : '<span class="text-[10px] text-slate-400 italic">Nenhum policial atende aos filtros de busca ativas.</span>'}
        </div>
      </div>
    `;
  }).join('');
}

window.toggleMembroGrupo = function(gIndex, srvId, isChecked) {
  if (isChecked) {
    if (!geradorState.grupos[gIndex].membros.includes(srvId)) {
      geradorState.grupos[gIndex].membros.push(srvId);
    }
  } else {
    geradorState.grupos[gIndex].membros = geradorState.grupos[gIndex].membros.filter(x => x !== srvId);
  }
};

window.removerGrupoGerador = function(gIndex) {
  geradorState.grupos.splice(gIndex, 1);
  renderizarSelecaoEOrdenacao();
};

window.executarGeradorLote = async function(e) {
  e.preventDefault();

  const scope = document.getElementById('ger-scope').value;
  const delegaciaId = document.getElementById('ger-delegacia').value;
  const dataInicio = document.getElementById('ger-data-inicio').value;
  const dataFim = document.getElementById('ger-data-fim').value;
  const tipoModalidade = document.getElementById('ger-modalidade').value;
  const regraDias = document.getElementById('ger-regra-dias').value;

  if (!dataInicio || !dataFim || dataFim < dataInicio) {
    alert("Selecione um intervalo de datas válido.");
    return;
  }

  if (geradorState.modo === 'INDIVIDUAL' && geradorState.policiaisSelecionados.length === 0) {
    alert("Selecione pelo menos um policial para a fila de rotação.");
    return;
  }

  if (geradorState.modo === 'EQUIPE' && geradorState.grupos.length === 0) {
    alert("Crie pelo menos uma equipe com membros cadastrados.");
    return;
  }

  const diasIntervalo = gerarArrayDatasISO(dataInicio, dataFim);
  const diasValidos = diasIntervalo.filter(dtStr => {
    const parts = dtStr.split('-').map(Number);
    const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
    const isFeriado = (appState.feriados || []).some(f => f.data === dtStr);

    if (regraDias === 'FDS_FERIADOS') return isWeekend || isFeriado;
    if (regraDias === 'DIAS_UTEIS') return !isWeekend && !isFeriado;
    return true;
  });

  if (diasValidos.length === 0) {
    alert("Nenhum dia no intervalo atende à regra de dias selecionada.");
    return;
  }

  let inseridosCount = 0;
  let filaIndex = 0;

  for (const dtIso of diasValidos) {
    let policiaisDoDia = [];

    if (geradorState.modo === 'INDIVIDUAL') {
      const srvId = geradorState.policiaisSelecionados[filaIndex % geradorState.policiaisSelecionados.length];
      policiaisDoDia.push(srvId);
      filaIndex++;
    } else {
      const grupoAtivo = geradorState.grupos[filaIndex % geradorState.grupos.length];
      policiaisDoDia = grupoAtivo ? grupoAtivo.membros : [];
      filaIndex++;
    }

    for (const sId of policiaisDoDia) {
      const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      
      const novaEscala = {
        id: newEscId,
        data: dtIso,
        servidorId: sId,
        delegaciaId: delegaciaId,
        scope: scope,
        tipo: tipoModalidade,
        turno: scope === 'CRF' ? '12h (D)' : '24h'
      };

      if (!appState.escalas) appState.escalas = [];
      appState.escalas.push(novaEscala);
      await syncDocToFirestore('escalas', newEscId, novaEscala);
      inseridosCount++;
    }
  }

  alert(`Sucesso! ${inseridosCount} lançamentos de escala gerados em lote.`);
  window.fecharModalGeradorLote();

  if (scope === 'CRF') {
    if (typeof window.filtrarTabelaCrfInline === 'function') window.filtrarTabelaCrfInline();
    renderCalendarGrid('calendar-crf-container', 'CRF');
  } else {
    if (typeof window.filtrarTabelaDelInline === 'function') window.filtrarTabelaDelInline();
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  }
};

function gerarArrayDatasISO(startStr, endStr) {
  const arr = [];
  const curr = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');

  while (curr <= end) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    arr.push(`${yyyy}-${mm}-${dd}`);
    curr.setDate(curr.getDate() + 1);
  }
  return arr;
}

function criarModalGeradorLoteDOM() {
  const modalHTML = `
    <div id="modal-gerador-lote" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">⚡ Gerador Automático de Escalas em Lote</h3>
          <button type="button" onclick="window.fecharModalGeradorLote()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.executarGeradorLote(event)" class="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="ger-scope">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Unidade / Delegacia de Destino:</label>
              <select id="ger-delegacia" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Modalidade:</label>
              <select id="ger-modalidade" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="PLANTÃO">PLANTÃO LOCAL</option>
                <option value="SOBREAVISO">SOBREAVISO</option>
                <option value="EXTRAJORNADA">EXTRAJORNADA</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Data Início:</label>
              <input type="date" id="ger-data-inicio" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Data Fim:</label>
              <input type="date" id="ger-data-fim" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Frequência dos Dias:</label>
              <select id="ger-regra-dias" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="TODOS">Todos os Dias</option>
                <option value="FDS_FERIADOS">Apenas Finais de Semana e Feriados</option>
                <option value="DIAS_UTEIS">Apenas Dias Úteis</option>
              </select>
            </div>
          </div>

          <!-- BARRA DE FILTROS DE POLICIAIS -->
          <div class="pt-2 border-t space-y-2">
            <div class="flex items-center justify-between">
              <label class="block font-bold text-slate-800">Modo de Distribuição:</label>
              <div class="flex gap-1">
                <button type="button" id="btn-modo-individual" onclick="window.alternarModoGerador('INDIVIDUAL')">🔄 Rotação Individual</button>
                <button type="button" id="btn-modo-equipe" onclick="window.alternarModoGerador('EQUIPE')">👥 Equipes Fixas</button>
              </div>
            </div>

            <!-- FILTROS DE BUSCA DENTRO DO MODAL -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200">
              <div>
                <input type="text" id="ger-busca-srv" oninput="window.atualizarFiltrosListaServidoresGerador()" placeholder="🔍 Filtrar por nome..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              </div>
              <div>
                <select id="ger-filtro-del" onchange="window.atualizarFiltrosListaServidoresGerador()" class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-bold text-slate-800"></select>
              </div>
              <div>
                <select id="ger-filtro-cargo" onchange="window.atualizarFiltrosListaServidoresGerador()" class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-bold text-slate-800"></select>
              </div>
            </div>

            <div id="ger-painel-policiais" class="pt-1"></div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalGeradorLote()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">⚡ Gerar Escala em Lote</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
