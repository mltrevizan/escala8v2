// src/geradorLote.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

let geradorState = {
  modo: 'INDIVIDUAL',
  policiaisSelecionados: [],
  equipes: [
    { id: 1, nome: 'Equipe 1', vtr: '', membros: [] },
    { id: 2, nome: 'Equipe 2', vtr: '', membros: [] }
  ],
  equipeAtivaIdx: 0,
  filtroTexto: '',
  filtroDelegacia: 'TODAS',
  filtroCargo: 'TODOS'
};

/**
 * Normaliza qualquer formato de data (ISO, Timestamp ou YYYY-MM-DD) para YYYY-MM-DD limpo.
 */
function normalizarDataParaIso(dataInput) {
  if (!dataInput) return '';
  if (typeof dataInput === 'string') {
    const apenasData = dataInput.split('T')[0];
    if (apenasData.includes('-')) {
      const parts = apenasData.split('-');
      if (parts[0].length === 4) return apenasData; // YYYY-MM-DD
    }
    if (apenasData.includes('/')) {
      const parts = apenasData.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  
  if (dataInput instanceof Date && !isNaN(dataInput)) {
    const yyyy = dataInput.getFullYear();
    const mm = String(dataInput.getMonth() + 1).padStart(2, '0');
    const dd = String(dataInput.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return String(dataInput);
}

/**
 * Verifica de forma rigorosa se o policial está em gozo de férias ou licença em uma determinada data
 */
export function estaDeFerias(servidorId, dataEscalaIso) {
  if (!servidorId || !dataEscalaIso || !appState.ferias) return false;

  const dataAlvoIso = normalizarDataParaIso(dataEscalaIso);

  return appState.ferias.some(f => {
    const matchServidor = (f.servidorId === servidorId || f.policialId === servidorId);
    if (!matchServidor) return false;

    const dataInicioIso = normalizarDataParaIso(f.dataInicio || f.inicio);
    const dataFimIso = normalizarDataParaIso(f.dataFim || f.fim);

    if (!dataInicioIso || !dataFimIso) return false;

    return dataAlvoIso >= dataInicioIso && dataAlvoIso <= dataFimIso;
  });
}

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

  const selectDel = document.getElementById('ger-delegacia');
  let delOptions = (appState.delegacias || []).map(d => 
    `<option value="${d.id}" ${d.id === appState.selectedDelegaciaId ? 'selected' : ''}>${d.nome}</option>`
  ).join('');
  if (selectDel) selectDel.innerHTML = delOptions;

  const selectFiltroDel = document.getElementById('ger-filtro-del');
  let filtroDelOpts = `<option value="TODAS">Todas as Unidades</option>`;
  (appState.delegacias || []).forEach(d => {
    filtroDelOpts += `<option value="${d.id}">${d.nome}</option>`;
  });
  if (selectFiltroDel) selectFiltroDel.innerHTML = filtroDelOpts;

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

  const { currentYear, currentMonth } = appState;
  const ultimoDia = new Date(currentYear, currentMonth + 1, 0).getDate();
  document.getElementById('ger-data-inicio').value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  document.getElementById('ger-data-fim').value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  const idDelInicial = selectDel?.value || appState.selectedDelegaciaId;
  window.carregarConfiguracaoMemorizadaDelegacia(idDelInicial);

  modal.classList.remove('hidden');
};

window.fecharModalGeradorLote = function() {
  document.getElementById('modal-gerador-lote')?.classList.add('hidden');
};

window.carregarConfiguracaoMemorizadaDelegacia = function(delegaciaId) {
  const delObj = (appState.delegacias || []).find(d => d.id === delegaciaId);

  geradorState = {
    modo: delObj?.geradorConfig?.modo || 'INDIVIDUAL',
    policiaisSelecionados: delObj?.geradorConfig?.policiaisSelecionados ? [...delObj.geradorConfig.policiaisSelecionados] : [],
    equipes: delObj?.geradorConfig?.equipes && delObj.geradorConfig.equipes.length > 0 
      ? JSON.parse(JSON.stringify(delObj.geradorConfig.equipes)) 
      : [
          { id: 1, nome: 'Equipe 1', vtr: '', membros: [] },
          { id: 2, nome: 'Equipe 2', vtr: '', membros: [] }
        ],
    equipeAtivaIdx: 0,
    filtroTexto: '',
    filtroDelegacia: delegaciaId || 'TODAS',
    filtroCargo: 'TODOS'
  };

  const inputBusca = document.getElementById('ger-busca-srv');
  const selectFiltroDel = document.getElementById('ger-filtro-del');
  const selectFiltroCargo = document.getElementById('ger-filtro-cargo');

  if (inputBusca) inputBusca.value = '';
  if (selectFiltroDel) selectFiltroDel.value = geradorState.filtroDelegacia;
  if (selectFiltroCargo) selectFiltroCargo.value = 'TODOS';

  window.alternarModoGerador(geradorState.modo);
  window.atualizarInfoParametrizacaoUnidade();
};

window.aoMudarDelegaciaGerador = function(delegaciaId) {
  window.carregarConfiguracaoMemorizadaDelegacia(delegaciaId);
};

window.atualizarInfoParametrizacaoUnidade = function() {
  const container = document.getElementById('ger-info-unidade-container');
  if (!container) return;

  const idDel = document.getElementById('ger-delegacia')?.value || appState.selectedDelegaciaId;
  const modalidade = document.getElementById('ger-modalidade')?.value || 'PLANTÃO';

  const delObj = (appState.delegacias || []).find(d => d.id === idDel);
  if (!delObj) {
    container.innerHTML = `<p class="text-[11px] text-slate-400 italic">Selecione uma unidade para carregar os parâmetros.</p>`;
    return;
  }

  const isSobreaviso = modalidade === 'SOBREAVISO';
  const config = isSobreaviso ? delObj.sobreavisoConfig : delObj.plantaoConfig;

  const regime = config?.regime || (isSobreaviso ? 'INTERMITENTE' : 'ININTERRUPTA');
  const intervalo = config?.intervalo || '24h';
  const uteis = config?.uteis || delObj.horarioUteis || '08:00 às 08:00';
  const naoUteis = config?.naoUteis || delObj.horarioNaoUteis || '08:00 às 08:00';

  container.innerHTML = `
    <div class="bg-sky-50/80 border border-sky-200 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sky-950">⏰ Padrão da Unidade (${isSobreaviso ? 'Sobreaviso' : 'Plantão Local'}):</span>
          <span class="px-1.5 py-0.5 bg-sky-200 text-sky-900 font-extrabold text-[10px] rounded uppercase">${regime}</span>
          <span class="px-1.5 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-[10px] rounded">Duração: ${intervalo}</span>
        </div>
        <div class="text-[11px] text-slate-600 flex flex-wrap items-center gap-3 font-mono">
          <span><b>Dias Úteis:</b> ${uteis}</span>
          <span>●</span>
          <span><b>Fins de Semana / Feriados:</b> ${naoUteis}</span>
        </div>
      </div>

      <button type="button" onclick="window.abrirModalDelegacia('${delObj.id}')" class="px-2.5 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-[11px] rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1 shrink-0">
        <span>⚙️</span> Ajustar Padrão
      </button>
    </div>
  `;
};

window.atualizarFiltrosListaServidoresGerador = function() {
  geradorState.filtroTexto = document.getElementById('ger-busca-srv')?.value?.toLowerCase() || '';
  geradorState.filtroDelegacia = document.getElementById('ger-filtro-del')?.value || 'TODAS';
  geradorState.filtroCargo = document.getElementById('ger-filtro-cargo')?.value || 'TODOS';

  renderizarPainelModo();
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

  renderizarPainelModo();
};

function renderizarPainelModo() {
  const container = document.getElementById('ger-painel-policiais');
  if (!container) return;

  if (geradorState.modo === 'INDIVIDUAL') {
    renderizarModoIndividual(container);
  } else {
    renderizarModoEquipesV1(container);
  }
}

function filtrarServidoresComPersistencia(membrosFixosIds = []) {
  const { filtroTexto, filtroDelegacia, filtroCargo } = geradorState;

  return [...(appState.servidores || [])]
    .filter(s => {
      const n = normalizeText(s.nome || '');
      if (n === 'administrador do sistema' || n === 'admin') return false;

      if (membrosFixosIds.includes(s.id)) return true;

      if (filtroTexto) {
        const bateuNome = (s.nome || '').toLowerCase().includes(filtroTexto);
        const bateuCargo = (s.cargo || '').toLowerCase().includes(filtroTexto);
        if (!bateuNome && !bateuCargo) return false;
      }

      if (filtroDelegacia !== 'TODAS') {
        const delObj = (appState.delegacias || []).find(d => d.id === filtroDelegacia);
        const bateuId = s.delegaciaId === filtroDelegacia;
        const bateuUnificado = delObj?.delegaciasIds && delObj.delegaciasIds.includes(s.delegaciaId);
        if (!bateuId && !bateuUnificado) return false;
      }

      if (filtroCargo !== 'TODOS') {
        if ((s.cargo || '').toUpperCase() !== filtroCargo) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const isSelA = membrosFixosIds.includes(a.id);
      const isSelB = membrosFixosIds.includes(b.id);

      if (isSelA && !isSelB) return -1;
      if (!isSelA && isSelB) return 1;

      if (isSelA && isSelB) {
        return membrosFixosIds.indexOf(a.id) - membrosFixosIds.indexOf(b.id);
      }

      return (a.nome || '').localeCompare(b.nome || '');
    });
}

function renderizarModoIndividual(container) {
  const servidoresFiltrados = filtrarServidoresComPersistencia(geradorState.policiaisSelecionados);

  let htmlServidores = servidoresFiltrados.map(srv => {
    const isChecked = geradorState.policiaisSelecionados.includes(srv.id);
    const posIndex = geradorState.policiaisSelecionados.indexOf(srv.id);
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    const isDel = (srv.cargo || '').toUpperCase().includes('DELEGADO');

    return `
      <label class="flex items-center justify-between p-2 rounded-lg border ${isChecked ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 bg-white'} hover:bg-slate-50 transition cursor-pointer text-xs select-none">
        <div class="flex items-center gap-2">
          <input type="checkbox" value="${srv.id}" ${isChecked ? 'checked' : ''} onchange="window.togglePolicialGerador('${srv.id}', this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4">
          <div>
            <span class="font-bold ${isChecked ? 'text-indigo-950' : 'text-slate-800'}">
              ${isChecked ? `<span class="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full mr-1">${posIndex + 1}º</span>` : ''}
              ${srv.nome}
            </span>
            <span class="text-[10px] text-slate-500 block">Lotação: ${del ? del.nome : (srv.delegaciaNome || 'Não informada')}</span>
          </div>
        </div>
        <span class="text-[10px] ${isDel ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'} font-bold px-1.5 py-0.5 rounded">${srv.cargo || 'APJ'}</span>
      </label>
    `;
  }).join('');

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
        <label class="block font-bold text-slate-700 mb-1 text-xs">2. Ordem da Rotação Individual:</label>
        <div class="space-y-1.5 max-h-52 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
          ${htmlFilaOrdenada.length > 0 ? htmlFilaOrdenada : '<p class="text-[11px] text-slate-400 italic p-3 text-center">Marque os policiais ao lado para montar a fila de revezamento.</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderizarModoEquipesV1(container) {
  const { equipes, equipeAtivaIdx } = geradorState;

  if (equipeAtivaIdx >= equipes.length) {
    geradorState.equipeAtivaIdx = 0;
  }

  const equipeAtiva = equipes[geradorState.equipeAtivaIdx];
  const servidoresFiltrados = filtrarServidoresComPersistencia(equipeAtiva ? equipeAtiva.membros : []);

  let htmlAbas = equipes.map((eqp, idx) => {
    const isSelected = idx === geradorState.equipeAtivaIdx;
    return `
      <div class="flex items-center bg-slate-100 rounded-t-xl border-t border-x ${isSelected ? 'border-indigo-600' : 'border-slate-300'} overflow-hidden">
        <button type="button" onclick="window.selecionarAbaEquipe(${idx})" class="px-3 py-1.5 font-bold text-xs cursor-pointer transition ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          ${idx + 1}º: ${eqp.nome} (${eqp.membros.length})
        </button>
        <div class="flex items-center px-1 bg-black/5 border-l border-slate-200 space-x-0.5">
          <button type="button" onclick="window.reordenarAbaEquipe(${idx}, -1)" title="Mover para esquerda" class="px-1 text-[9px] hover:bg-slate-300 rounded font-bold cursor-pointer">◀</button>
          <button type="button" onclick="window.reordenarAbaEquipe(${idx}, 1)" title="Mover para direita" class="px-1 text-[9px] hover:bg-slate-300 rounded font-bold cursor-pointer">▶</button>
        </div>
      </div>
    `;
  }).join('');

  htmlAbas += `
    <button type="button" onclick="window.adicionarNovaEquipeV1()" class="px-2.5 py-1.5 rounded-t-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition">
      ➕ Nova Equipe
    </button>
  `;

  let htmlPoliciaisEquipe = servidoresFiltrados.map(srv => {
    const isChecked = equipeAtiva.membros.includes(srv.id);
    const posIndex = equipeAtiva.membros.indexOf(srv.id);
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    const isDel = (srv.cargo || '').toUpperCase().includes('DELEGADO');

    return `
      <label class="flex items-center justify-between p-2 rounded-lg border ${isChecked ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 bg-white'} hover:bg-slate-50 transition cursor-pointer text-xs select-none">
        <div class="flex items-center gap-2">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleMembroEquipeV1('${srv.id}', this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4">
          <div>
            <span class="font-bold ${isChecked ? 'text-indigo-950' : 'text-slate-800'}">
              ${isChecked ? `<span class="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full mr-1">${posIndex + 1}º</span>` : ''}
              ${srv.nome}
            </span>
            <span class="text-[10px] text-slate-500 block">Lotação: ${del ? del.nome : (srv.delegaciaNome || 'Não informada')}</span>
          </div>
        </div>
        <span class="text-[10px] ${isDel ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'} font-bold px-1.5 py-0.5 rounded">${srv.cargo || 'APJ'}</span>
      </label>
    `;
  }).join('');

  container.innerHTML = `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-1 border-b border-slate-300 pb-0">
        ${htmlAbas}
      </div>

      <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label class="block font-bold text-slate-800 text-xs mb-1">Nome da Equipe:</label>
            <input type="text" value="${equipeAtiva.nome}" onchange="window.atualizarNomeEquipeV1(this.value)" class="w-full border border-slate-300 rounded-lg p-1.5 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500">
          </div>
          <div>
            <label class="block font-bold text-slate-800 text-xs mb-1">🚘 Viatura / VTR (Livre Digitação):</label>
            <input type="text" value="${equipeAtiva.vtr || ''}" placeholder="Ex: VTR 801 / DUSTER..." onchange="window.atualizarVtrEquipeV1(this.value)" class="w-full border border-slate-300 rounded-lg p-1.5 bg-white font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500">
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="font-bold text-slate-700 text-xs">Integrantes da ${equipeAtiva.nome} (${equipeAtiva.membros.length} selecionados):</label>
            ${equipes.length > 1 ? `<button type="button" onclick="window.removerEquipeAtivaV1()" class="text-red-600 hover:text-red-800 font-bold text-[10px] cursor-pointer">🗑️ Excluir esta equipe</button>` : ''}
          </div>
          <div class="space-y-1.5 max-h-48 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
            ${htmlPoliciaisEquipe}
          </div>
        </div>
      </div>
    </div>
  `;
}

window.selecionarAbaEquipe = function(idx) {
  geradorState.equipeAtivaIdx = idx;
  renderizarPainelModo();
};

window.reordenarAbaEquipe = function(idx, direcao) {
  const novaPos = idx + direcao;
  if (novaPos < 0 || novaPos >= geradorState.equipes.length) return;

  const temp = geradorState.equipes[idx];
  geradorState.equipes[idx] = geradorState.equipes[novaPos];
  geradorState.equipes[novaPos] = temp;

  geradorState.equipeAtivaIdx = novaPos;
  renderizarPainelModo();
};

window.adicionarNovaEquipeV1 = function() {
  const novoNum = geradorState.equipes.length + 1;
  geradorState.equipes.push({
    id: Date.now(),
    nome: `Equipe ${novoNum}`,
    vtr: '',
    membros: []
  });
  geradorState.equipeAtivaIdx = geradorState.equipes.length - 1;
  renderizarPainelModo();
};

window.atualizarNomeEquipeV1 = function(nome) {
  if (geradorState.equipes[geradorState.equipeAtivaIdx]) {
    geradorState.equipes[geradorState.equipeAtivaIdx].nome = nome;
    renderizarPainelModo();
  }
};

window.atualizarVtrEquipeV1 = function(vtrText) {
  if (geradorState.equipes[geradorState.equipeAtivaIdx]) {
    geradorState.equipes[geradorState.equipeAtivaIdx].vtr = vtrText.toUpperCase();
  }
};

window.removerEquipeAtivaV1 = function() {
  if (geradorState.equipes.length <= 1) return;
  geradorState.equipes.splice(geradorState.equipeAtivaIdx, 1);
  geradorState.equipeAtivaIdx = 0;
  renderizarPainelModo();
};

window.toggleMembroEquipeV1 = function(srvId, isChecked) {
  const eqp = geradorState.equipes[geradorState.equipeAtivaIdx];
  if (!eqp) return;

  if (isChecked) {
    if (!eqp.membros.includes(srvId)) eqp.membros.push(srvId);
  } else {
    eqp.membros = eqp.membros.filter(id => id !== srvId);
  }
  renderizarPainelModo();
};

window.togglePolicialGerador = function(id, isChecked) {
  if (isChecked) {
    if (!geradorState.policiaisSelecionados.includes(id)) {
      geradorState.policiaisSelecionados.push(id);
    }
  } else {
    geradorState.policiaisSelecionados = geradorState.policiaisSelecionados.filter(x => x !== id);
  }
  renderizarPainelModo();
};

window.moverPolicialFila = function(index, direcao) {
  const novaPos = index + direcao;
  if (novaPos < 0 || novaPos >= geradorState.policiaisSelecionados.length) return;

  const temp = geradorState.policiaisSelecionados[index];
  geradorState.policiaisSelecionados[index] = geradorState.policiaisSelecionados[novaPos];
  geradorState.policiaisSelecionados[novaPos] = temp;

  renderizarPainelModo();
};

// EXECUÇÃO CORRIGIDA DO GERADOR EM LOTE COM TRAVA ESTRITA DE DATA FIM
window.executarGeradorLote = async function(e) {
  e.preventDefault();

  const scope = document.getElementById('ger-scope').value;
  const delegaciaId = document.getElementById('ger-delegacia').value;
  const dataInicio = document.getElementById('ger-data-inicio').value;
  const dataFim = document.getElementById('ger-data-fim').value;
  const tipoModalidade = document.getElementById('ger-modalidade').value;
  const regraDias = document.getElementById('ger-regra-dias').value;

  const delObj = (appState.delegacias || []).find(d => d.id === delegaciaId);
  const isSobreaviso = tipoModalidade === 'SOBREAVISO';
  const config = isSobreaviso ? delObj?.sobreavisoConfig : delObj?.plantaoConfig;
  const turnoPadraoCalculado = config?.intervalo || (scope === 'CRF' ? '12h (D)' : '24h');

  let duracaoDiasTurno = 1;
  if (turnoPadraoCalculado.includes('dias')) {
    duracaoDiasTurno = parseInt(turnoPadraoCalculado) || 1;
  }

  if (!dataInicio || !dataFim || dataFim < dataInicio) {
    alert("Selecione um intervalo de datas válido.");
    return;
  }

  if (geradorState.modo === 'INDIVIDUAL' && geradorState.policiaisSelecionados.length === 0) {
    alert("Selecione pelo menos um policial para a rotação individual.");
    return;
  }

  if (geradorState.modo === 'EQUIPE' && geradorState.equipes.every(eq => eq.membros.length === 0)) {
    alert("Selecione membros para pelo menos uma das equipes.");
    return;
  }

  if (delObj) {
    delObj.geradorConfig = {
      modo: geradorState.modo,
      policiaisSelecionados: [...geradorState.policiaisSelecionados],
      equipes: JSON.parse(JSON.stringify(geradorState.equipes))
    };
    await syncDocToFirestore('delegacias', delObj.id, delObj);
  }

  const diasIntervalo = gerarArrayDatasISO(dataInicio, dataFim);
  const diasValidos = diasIntervalo.filter(dtStr => {
    const parts = dtStr.split('-').map(Number);
    const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

    const isFeriadoValido = (appState.feriados || []).some(f => {
      const fDataIso = normalizarDataParaIso(f.data);
      if (fDataIso !== dtStr) return false;
      if (f.tipo === 'NACIONAL' || f.tipo === 'ESTADUAL') return true;

      if (f.tipo === 'MUNICIPAL') {
        const idsAtingidos = f.delegaciasIds || [];
        const bateuLocal = idsAtingidos.includes(delegaciaId);
        const bateuUnificado = delObj?.delegaciasIds && delObj.delegaciasIds.some(unifId => idsAtingidos.includes(unifId));
        return bateuLocal || bateuUnificado;
      }
      return false;
    });

    if (regraDias === 'FDS_FERIADOS') return isWeekend || isFeriadoValido;
    if (regraDias === 'DIAS_UTEIS') return !isWeekend && !isFeriadoValido;
    return true;
  });

  if (diasValidos.length === 0) {
    alert("Nenhum dia no intervalo atende à regra de dias selecionada.");
    return;
  }

  let inseridosCount = 0;
  let filaIndex = 0;
  const conflitosDetectados = [];

  let idxDia = 0;
  while (idxDia < diasValidos.length) {
    const dtIso = diasValidos[idxDia];
    const datasDoTurno = gerarDatasMultiplasContinuas(dtIso, duracaoDiasTurno);

    if (geradorState.modo === 'INDIVIDUAL') {
      const sId = geradorState.policiaisSelecionados[filaIndex % geradorState.policiaisSelecionados.length];
      filaIndex++;

      for (const dataSubsequent of datasDoTurno) {
        // CORREÇÃO CRÍTICA: Bloqueia qualquer lançamento que ultrapasse a dataFim selecionada
        if (dataSubsequent > dataFim) continue;

        const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const novaEscala = {
          id: newEscId,
          data: dataSubsequent,
          servidorId: sId,
          delegaciaId: delegaciaId,
          scope: scope,
          tipo: tipoModalidade,
          turno: turnoPadraoCalculado
        };

        if (!appState.escalas) appState.escalas = [];
        appState.escalas.push(novaEscala);
        await syncDocToFirestore('escalas', newEscId, novaEscala);
        inseridosCount++;

        verificarECatalogarConflito(sId, dataSubsequent, tipoModalidade, conflitosDetectados);
      }
    } else {
      const equipeAtiva = geradorState.equipes[filaIndex % geradorState.equipes.length];
      filaIndex++;

      for (const sId of equipeAtiva.membros) {
        for (const dataSubsequent of datasDoTurno) {
          // CORREÇÃO CRÍTICA: Bloqueia qualquer lançamento de equipe que ultrapasse a dataFim selecionada
          if (dataSubsequent > dataFim) continue;

          const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const novaEscala = {
            id: newEscId,
            data: dataSubsequent,
            servidorId: sId,
            delegaciaId: delegaciaId,
            scope: scope,
            tipo: tipoModalidade,
            turno: turnoPadraoCalculado,
            vtr: equipeAtiva.vtr || ''
          };

          if (!appState.escalas) appState.escalas = [];
          appState.escalas.push(novaEscala);
          await syncDocToFirestore('escalas', newEscId, novaEscala);
          inseridosCount++;

          verificarECatalogarConflito(sId, dataSubsequent, tipoModalidade, conflitosDetectados);
        }
      }
    }

    idxDia += duracaoDiasTurno;
  }

  window.fecharModalGeradorLote();

  if (scope === 'CRF') {
    if (typeof window.filtrarTabelaCrfInline === 'function') window.filtrarTabelaCrfInline();
    renderCalendarGrid('calendar-crf-container', 'CRF');
  } else {
    if (typeof window.filtrarTabelaDelInline === 'function') window.filtrarTabelaDelInline();
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  }

  if (conflitosDetectados.length > 0) {
    let msgConflito = `⚠️ ATENÇÃO: Escala gerada (${inseridosCount} lançamentos), porém foram identificados ${conflitosDetectados.length} plantões marcados durante períodos de FÉRIAS/LICENÇA:\n\n`;
    
    const agrupado = {};
    conflitosDetectados.forEach(c => {
      if (!agrupado[c.servidorNome]) agrupado[c.servidorNome] = [];
      agrupado[c.servidorNome].push(`${formatarDataBr(c.data)} (${c.tipoModalidade})`);
    });

    Object.keys(agrupado).forEach(nome => {
      msgConflito += `• ${nome}:\n  Datas: ${agrupado[nome].join(', ')}\n\n`;
    });

    alert(msgConflito);
  } else {
    alert(`Sucesso! ${inseridosCount} lançamentos de escala gerados sem nenhum conflito de férias/licença.`);
  }
};

function verificarECatalogarConflito(servidorId, dataIso, tipoModalidade, listaConflitos) {
  const srv = (appState.servidores || []).find(s => s.id === servidorId);
  if (!srv) return;

  const temAfastamento = estaDeFerias(servidorId, dataIso);

  if (temAfastamento) {
    listaConflitos.push({
      servidorNome: srv.nome,
      data: dataIso,
      tipoModalidade: tipoModalidade
    });
  }
}

function gerarDatasMultiplasContinuas(dataInicialIso, diasDuracao) {
  const result = [];
  const parts = dataInicialIso.split('-').map(Number);
  
  for (let i = 0; i < diasDuracao; i++) {
    const d = new Date(parts[0], parts[1] - 1, parts[2] + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    result.push(`${yyyy}-${mm}-${dd}`);
  }

  return result;
}

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

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}

function criarModalGeradorLoteDOM() {
  // Limpeza de elemento duplicado antes da criação
  document.getElementById('modal-gerador-lote')?.remove();

  const modalHTML = `
    <div id="modal-gerador-lote" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">⚡ Gerador Automático de Escalas em Lote (Padrão V1)</h3>
          <button type="button" onclick="window.fecharModalGeradorLote()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.executarGeradorLote(event)" class="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="ger-scope">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Unidade / Delegacia de Destino:</label>
              <select id="ger-delegacia" onchange="window.aoMudarDelegaciaGerador(this.value)" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Modalidade:</label>
              <select id="ger-modalidade" onchange="window.atualizarInfoParametrizacaoUnidade()" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="PLANTÃO">PLANTÃO LOCAL</option>
                <option value="SOBREAVISO">SOBREAVISO</option>
                <option value="EXTRAJORNADA">EXTRAJORNADA</option>
              </select>
            </div>
          </div>

          <div id="ger-info-unidade-container"></div>

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

          <div class="pt-2 border-t space-y-2">
            <div class="flex items-center justify-between">
              <label class="block font-bold text-slate-800">Modo de Distribuição:</label>
              <div class="flex gap-1">
                <button type="button" id="btn-modo-individual" onclick="window.alternarModoGerador('INDIVIDUAL')">🔄 Rotação Individual</button>
                <button type="button" id="btn-modo-equipe" onclick="window.alternarModoGerador('EQUIPE')">👥 Equipes Fixas (V1)</button>
              </div>
            </div>

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
