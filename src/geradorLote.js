// src/geradorLote.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

let geradorState = {
  modo: 'INDIVIDUAL', // 'INDIVIDUAL' ou 'EQUIPE'
  policiaisSelecionados: [], // Lista ordenada de IDs
  grupos: [] // Para modo equipe: [{ id: 1, membros: [id1, id2] }]
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
  
  // Popula o select de Delegacias
  const selectDel = document.getElementById('ger-delegacia');
  let delOptions = (appState.delegacias || []).map(d => 
    `<option value="${d.id}" ${d.id === appState.selectedDelegaciaId ? 'selected' : ''}>${d.nome}</option>`
  ).join('');
  if (selectDel) selectDel.innerHTML = delOptions;

  // Reset do Estado do Gerador
  geradorState = {
    modo: 'INDIVIDUAL',
    policiaisSelecionados: [],
    grupos: []
  };

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

window.alternarModoGerador = function(novoModo) {
  geradorState.modo = novoModo;
  const btnInd = document.getElementById('btn-modo-individual');
  const btnEqp = document.getElementById('btn-modo-equipe');

  if (novoModo === 'INDIVIDUAL') {
    btnInd.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs cursor-pointer";
    btnEqp.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer";
  } else {
    btnEqp.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs cursor-pointer";
    btnInd.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer";
  }

  renderizarSelecaoEOrdenacao();
};

function renderizarSelecaoEOrdenacao() {
  const container = document.getElementById('ger-painel-policiais');
  if (!container) return;

  const idDelegaciaSel = document.getElementById('ger-delegacia')?.value || appState.selectedDelegaciaId;

  // Filtra policiais da unidade atenta
  const servidoresDisponiveis = [...(appState.servidores || [])]
    .filter(s => {
      const n = normalizeText(s.nome || '');
      return n !== 'administrador do sistema' && n !== 'admin';
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  if (geradorState.modo === 'INDIVIDUAL') {
    let htmlServidores = servidoresDisponiveis.map(srv => {
      const isChecked = geradorState.policiaisSelecionados.includes(srv.id);
      return `
        <label class="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer text-xs">
          <div class="flex items-center gap-2">
            <input type="checkbox" value="${srv.id}" ${isChecked ? 'checked' : ''} onchange="window.togglePolicialGerador('${srv.id}', this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500">
            <span class="font-bold text-slate-800">${srv.nome}</span>
          </div>
          <span class="text-[10px] text-slate-500">${srv.cargo || 'APJ'}</span>
        </label>
      `;
    }).join('');

    let htmlFilaOrdenada = geradorState.policiaisSelecionados.map((id, index) => {
      const srv = (appState.servidores || []).find(s => s.id === id);
      return `
        <div class="flex items-center justify-between p-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-950">
          <span>${index + 1}º - ${srv?.nome || 'Servidor'}</span>
          <div class="space-x-1">
            <button type="button" onclick="window.moverPolicialFila(${index}, -1)" class="px-1.5 py-0.5 bg-indigo-200 hover:bg-indigo-300 rounded text-[10px] cursor-pointer">⬆️</button>
            <button type="button" onclick="window.moverPolicialFila(${index}, 1)" class="px-1.5 py-0.5 bg-indigo-200 hover:bg-indigo-300 rounded text-[10px] cursor-pointer">⬇️️</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 text-xs">1. Selecione os Policiais:</label>
          <div class="space-y-1.5 max-h-48 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
            ${htmlServidores}
          </div>
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 text-xs">2. Ordem de Rotação (Fila):</label>
          <div class="space-y-1.5 max-h-48 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
            ${htmlFilaOrdenada.length > 0 ? htmlFilaOrdenada : '<p class="text-[11px] text-slate-400 italic p-2">Marque os policiais ao lado para ordenar a rotação.</p>'}
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
    renderizarGruposDOM(servidoresDisponiveis);
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

function renderizarGruposDOM(servidoresDisponiveis) {
  const container = document.getElementById('ger-lista-grupos');
  if (!container) return;

  if (geradorState.grupos.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-slate-400 italic p-2">Nenhum grupo criado. Clique em "Adicionar Grupo/Equipe".</p>`;
    return;
  }

  container.innerHTML = geradorState.grupos.map((grp, gIndex) => {
    let srvOpts = servidoresDisponiveis.map(s => {
      const isChecked = grp.membros.includes(s.id);
      return `
        <label class="inline-flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 text-[11px] font-medium">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleMembroGrupo(${gIndex}, '${s.id}', this.checked)" class="rounded text-indigo-600">
          <span>${s.nome}</span>
        </label>
      `;
    }).join(' ');

    return `
      <div class="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
        <div class="flex items-center justify-between font-bold text-slate-800">
          <span>👥 ${grp.nome}</span>
          <button type="button" onclick="window.removerGrupoGerador(${gIndex})" class="text-red-600 hover:text-red-800 font-bold text-[10px]">Excluir Equipe</button>
        </div>
        <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-white/50 rounded-lg">
          ${srvOpts}
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
  const tipoModalidade = document.getElementById('ger-modalidade').value; // 'PLANTÃO' ou 'SOBREAVISO'
  const regraDias = document.getElementById('ger-regra-dias').value; // 'TODOS', 'FDS_FERIADOS', 'DIAS_UTEIS'

  if (!dataInicio || !dataFim || dataFim < dataInicio) {
    alert("Selecione um intervalo de datas válido.");
    return;
  }

  // Validação de alocação
  if (geradorState.modo === 'INDIVIDUAL' && geradorState.policiaisSelecionados.length === 0) {
    alert("Selecione pelo menos um policial para a fila de rotação.");
    return;
  }

  if (geradorState.modo === 'EQUIPE' && geradorState.grupos.length === 0) {
    alert("Crie pelo menos uma equipe com membros cadastrados.");
    return;
  }

  // Calcula lista de dias válidos no intervalo
  const diasIntervalo = gerarArrayDatasISO(dataInicio, dataFim);
  const diasValidos = diasIntervalo.filter(dtStr => {
    const parts = dtStr.split('-').map(Number);
    const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
    const isFeriado = (appState.feriados || []).some(f => f.data === dtStr);

    if (regraDias === 'FDS_FERIADOS') return isWeekend || isFeriado;
    if (regraDias === 'DIAS_UTEIS') return !isWeekend && !isFeriado;
    return true; // 'TODOS'
  });

  if (diasValidos.length === 0) {
    alert("Nenhum dia no intervalo atende ao filtro de dias selecionado.");
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
              <label class="block font-bold text-slate-700 mb-1">Unidade / Delegacia:</label>
              <select id="ger-delegacia" onchange="renderizarSelecaoEOrdenacao()" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
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

          <!-- SELEÇÃO DE MODO DE ALOCAÇÃO -->
          <div class="pt-2 border-t space-y-2">
            <div class="flex items-center justify-between">
              <label class="block font-bold text-slate-800">Modo de Distribuição:</label>
              <div class="flex gap-1">
                <button type="button" id="btn-modo-individual" onclick="window.alternarModoGerador('INDIVIDUAL')">🔄 Rotação Individual</button>
                <button type="button" id="btn-modo-equipe" onclick="window.alternarModoGerador('EQUIPE')">👥 Equipes Fixas</button>
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
