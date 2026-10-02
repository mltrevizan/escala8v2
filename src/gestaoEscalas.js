// src/gestaoEscalas.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

let gestaoCrfFiltros = { busca: '', sdp: 'TODAS', delegaciaId: 'TODAS' };

function normalizarTipoModalidade(tipo) {
  if (!tipo) return 'PLANTÃO';
  const t = tipo.trim().toUpperCase();
  if (t === 'SDP') return 'EXTRAJORNADA';
  return t;
}

// =========================================================================
// 1. MÓDULO GESTÃO CRF
// =========================================================================
export function renderGestaoCrfModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentYear, currentMonth } = appState;
  const mesExtenso = new Date(currentYear, currentMonth, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  container.innerHTML = `
    <!-- Topo Gerencial com Ações Padronizadas PCPR -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão Geral de Escalas da CRF</h2>
          <p class="text-[11px] text-slate-500">Controle de lançamentos, turnos, equipes e substituições (${mesExtenso})</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="window.abrirModalNovoLancamento('CRF')" class="px-3 py-2 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ➕ Novo Lançamento
          </button>
          <button onclick="window.abrirModalVincularApjPontual()" class="px-3 py-2 bg-[#2A2B2D] hover:bg-black text-white border border-slate-600 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            🔗 Vincular APJ
          </button>
          <button onclick="window.exportarEscalaCrfCsv('CRF')" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            📤 Exportar CSV
          </button>
          <button onclick="window.importarEscalaCrfCsv('CRF')" class="px-3 py-2 bg-[#BEA55A] hover:bg-[#AF9340] text-black font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            📥 Importar CSV
          </button>
        </div>
      </div>

      <!-- Filtros da Gestão CRF -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
        <div>
          <input type="text" id="gest-crf-busca" oninput="window.filtrarTabelaGestaoCrf()" placeholder="🔍 Filtrar por nome do policial..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:outline-none">
        </div>
        <div>
          <select id="gest-crf-sdp" onchange="window.filtrarTabelaGestaoCrf()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800"></select>
        </div>
        <div>
          <select id="gest-crf-del" onchange="window.filtrarTabelaGestaoCrf()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800"></select>
        </div>
      </div>
    </div>

    <!-- Tabela -->
    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
            <th class="p-3">Data</th>
            <th class="p-3">Policial Escalado</th>
            <th class="p-3">Cargo</th>
            <th class="p-3">Lotação de Origem</th>
            <th class="p-3">Turno</th>
            <th class="p-3">Modalidade</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-gestao-crf-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  window.popularFiltrosGestaoCrf();
  window.renderTabelaGestaoCrfCorpo();
}

window.popularFiltrosGestaoCrf = function() {
  const selectSdp = document.getElementById('gest-crf-sdp');
  if (selectSdp) {
    const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
    (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim().toUpperCase()); });

    let opts = `<option value="TODAS">Todas as SDPs</option>`;
    [...setSdps].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach(s => {
      opts += `<option value="${s}">${s}</option>`;
    });
    selectSdp.innerHTML = opts;
  }

  const selectDel = document.getElementById('gest-crf-del');
  if (selectDel) {
    let opts = `<option value="TODAS">Todas as Delegacias</option>`;
    (appState.delegacias || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).forEach(d => {
      opts += `<option value="${d.id}">${d.nome}</option>`;
    });
    selectDel.innerHTML = opts;
  }
};

window.filtrarTabelaGestaoCrf = function() {
  gestaoCrfFiltros.busca = document.getElementById('gest-crf-busca')?.value?.toLowerCase() || '';
  gestaoCrfFiltros.sdp = document.getElementById('gest-crf-sdp')?.value || 'TODAS';
  gestaoCrfFiltros.delegaciaId = document.getElementById('gest-crf-del')?.value || 'TODAS';

  window.renderTabelaGestaoCrfCorpo();
};

window.renderTabelaGestaoCrfCorpo = function() {
  const tbody = document.getElementById('tabela-gestao-crf-corpo');
  if (!tbody) return;

  const { currentYear, currentMonth } = appState;
  const { busca, sdp, delegaciaId } = gestaoCrfFiltros;

  let escalasCrf = (appState.escalas || []).filter(e => {
    if (e.scope !== 'CRF') return false;
    const [ano, mes] = e.data.split('-').map(Number);
    if (ano !== currentYear || (mes - 1) !== currentMonth) return false;

    const srv = (appState.servidores || []).find(s => s.id === e.servidorId);
    if (busca && !srv?.nome?.toLowerCase().includes(busca)) return false;

    if (sdp !== 'TODAS') {
      const delObj = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);
      if ((delObj?.subdivisao || '').toUpperCase() !== sdp) return false;
    }

    if (delegaciaId !== 'TODAS' && e.delegaciaId !== delegaciaId && srv?.delegaciaId !== delegaciaId) return false;

    return true;
  }).sort((a, b) => a.data.localeCompare(b.data));

  if (escalasCrf.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 italic">Nenhum lançamento localizado.</td></tr>`;
    return;
  }

  tbody.innerHTML = escalasCrf.map(esc => {
    const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const delOrigem = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);
    const tipoModalidade = normalizarTipoModalidade(esc.tipo);

    let badgeClass = 'bg-[#F7F3E8] text-[#5A4716] border-[#BEA55A]';
    if (tipoModalidade === 'EXTRAJORNADA') badgeClass = 'bg-black text-pcpr-gold border-pcpr-gold';

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
        <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(esc.data)}</td>
        <td class="p-3 font-bold text-slate-900">${srv ? srv.nome : 'Policial'}</td>
        <td class="p-3 font-semibold text-slate-700">${srv ? srv.cargo : 'APJ'}</td>
        <td class="p-3 text-slate-600 font-medium">${delOrigem ? delOrigem.nome : (srv?.delegaciaNome || '-')}</td>
        <td class="p-3 font-mono font-bold text-slate-700">${esc.turno || '24h'}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 text-[10px] font-bold rounded border ${badgeClass}">
            ${tipoModalidade}
          </span>
        </td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.abrirModalDetalhesTurno('Gestão CRF', '${esc.data}', '${esc.id}')" class="px-2.5 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded font-bold text-[10px] shadow-xs cursor-pointer">
            ✏️ Editar
          </button>
          <button onclick="window.excluirEscalaGestaoDirect('${esc.id}', 'CRF')" class="px-2.5 py-1 bg-[#E2001A] hover:bg-red-700 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer">
            🗑 Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

// =========================================================================
// 2. MÓDULO GESTÃO POR DELEGACIAS (COM FILTRO REATIVO RESTAURADO)
// =========================================================================
export function renderGestaoDelegaciasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentYear, currentMonth, selectedDelegaciaId } = appState;
  const mesExtenso = new Date(currentYear, currentMonth, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  let optsDelegacias = (appState.delegacias || []).map(d => 
    `<option value="${d.id}" ${d.id === selectedDelegaciaId ? 'selected' : ''}>${d.nome}</option>`
  ).join('');

  container.innerHTML = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão de Escalas por Delegacia</h2>
          <p class="text-[11px] text-slate-500">Controle dos plantões locais e sobreavisos das unidades (${mesExtenso})</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="window.abrirModalNovoLancamento('DELEGACIA')" class="px-3 py-2 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ➕ Novo Lançamento
          </button>
          <button onclick="window.abrirModalGeradorLote('DELEGACIA')" class="px-3 py-2 bg-[#2A2B2D] hover:bg-black text-white border border-slate-600 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ⚡ Gerar em Lote
          </button>
          <button onclick="window.exportarEscalaCrfCsv('DELEGACIA')" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            📤 Exportar CSV
          </button>
          <button onclick="window.importarEscalaCrfCsv('DELEGACIA')" class="px-3 py-2 bg-[#BEA55A] hover:bg-[#AF9340] text-black font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            📥 Importar CSV
          </button>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <label class="text-xs font-bold text-slate-700">Selecione a Unidade:</label>
          <select id="gestao-del-select-unidade" onchange="window.mudarUnidadeGestaoDel(this.value)" class="text-xs font-bold bg-white border border-slate-300 rounded-xl p-2 shadow-xs">
            ${optsDelegacias}
          </select>
        </div>

        <div class="w-full sm:w-64">
          <input type="text" id="gest-del-busca" oninput="window.renderTabelaGestaoDelCorpo()" placeholder="🔍 Filtrar por policial ou VTR..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:outline-none">
        </div>
      </div>
    </div>

    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
            <th class="p-3">Data</th>
            <th class="p-3">Policial Escalado</th>
            <th class="p-3">Cargo</th>
            <th class="p-3">Viatura (VTR)</th>
            <th class="p-3">Turno</th>
            <th class="p-3">Modalidade</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-gestao-del-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  window.renderTabelaGestaoDelCorpo();
}

window.renderTabelaGestaoDelCorpo = function() {
  const tbody = document.getElementById('tabela-gestao-del-corpo');
  if (!tbody) return;

  const { currentYear, currentMonth, selectedDelegaciaId } = appState;
  const busca = document.getElementById('gest-del-busca')?.value?.toLowerCase().trim() || '';

  const escalasDel = (appState.escalas || []).filter(e => {
    if (e.scope !== 'DELEGACIA' || e.delegaciaId !== selectedDelegaciaId) return false;
    const [ano, mes] = e.data.split('-').map(Number);
    if (ano !== currentYear || (mes - 1) !== currentMonth) return false;

    if (busca) {
      const srv = (appState.servidores || []).find(s => s.id === e.servidorId);
      const nomePolicial = (srv?.nome || '').toLowerCase();
      const cargoPolicial = (srv?.cargo || '').toLowerCase();
      const vtrStr = (e.vtr || '').toLowerCase();
      const dataStr = (e.data || '').toLowerCase();

      if (!nomePolicial.includes(busca) && !cargoPolicial.includes(busca) && !vtrStr.includes(busca) && !dataStr.includes(busca)) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => a.data.localeCompare(b.data));

  if (escalasDel.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 italic">Nenhum lançamento localizado para os filtros informados nesta unidade.</td></tr>`;
    return;
  }

  tbody.innerHTML = escalasDel.map(esc => {
    const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const tipoModalidade = normalizarTipoModalidade(esc.tipo);

    let badgeClass = 'bg-[#F7F3E8] text-[#5A4716] border-[#BEA55A]';
    if (tipoModalidade === 'SOBREAVISO' || tipoModalidade === 'EXTRAJORNADA') {
      badgeClass = 'bg-black text-pcpr-gold border-pcpr-gold';
    }

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
        <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(esc.data)}</td>
        <td class="p-3 font-bold text-slate-900">${srv ? srv.nome : 'Policial'}</td>
        <td class="p-3 font-semibold text-slate-700">${srv ? srv.cargo : 'APJ'}</td>
        <td class="p-3 font-mono text-slate-800 font-bold">${esc.vtr ? `🚘 ${esc.vtr}` : '-'}</td>
        <td class="p-3 font-mono font-bold text-slate-700">${esc.turno || '24h'}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 text-[10px] font-bold rounded border ${badgeClass}">
            ${tipoModalidade}
          </span>
        </td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.abrirModalDetalhesTurno('Gestão Delegacia', '${esc.data}', '${esc.id}')" class="px-2.5 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded font-bold text-[10px] shadow-xs cursor-pointer">
            ✏️ Editar
          </button>
          <button onclick="window.excluirEscalaGestaoDirect('${esc.id}', 'DELEGACIA')" class="px-2.5 py-1 bg-[#E2001A] hover:bg-red-700 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer">
            🗑 Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

window.mudarUnidadeGestaoDel = function(id) {
  appState.selectedDelegaciaId = id;
  renderGestaoDelegaciasModule('gestao-delegacias-container');
};

// =========================================================================
// 3. ESTRUTURA DO MODAL "NOVO LANÇAMENTO AVULSO" (FUNCIONAMENTO GLOBAL)
// =========================================================================
window.abrirModalNovoLancamento = function(scope = 'CRF') {
  let modal = document.getElementById('modal-novo-lancamento');
  if (!modal) {
    criarModalNovoLancamentoDOM();
    modal = document.getElementById('modal-novo-lancamento');
  }

  const selectSrv = document.getElementById('nl-servidor-id');
  let optsSrv = `<option value="">Selecione o Policial...</option>`;
  (appState.servidores || [])
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    .forEach(s => {
      optsSrv += `<option value="${s.id}">${s.nome} (${s.cargo || 'APJ'})</option>`;
    });
  if (selectSrv) selectSrv.innerHTML = optsSrv;

  const selectDel = document.getElementById('nl-delegacia-id');
  let optsDel = `<option value="">Selecione a Unidade...</option>`;
  (appState.delegacias || [])
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    .forEach(d => {
      optsDel += `<option value="${d.id}">${d.nome}</option>`;
    });
  if (selectDel) selectDel.innerHTML = optsDel;

  document.getElementById('nl-scope').value = scope;
  document.getElementById('nl-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('nl-tipo').value = 'PLANTÃO';
  document.getElementById('nl-turno').value = '24h';
  document.getElementById('nl-vtr').value = '';

  modal.classList.remove('hidden');
};

window.fecharModalNovoLancamento = function() {
  document.getElementById('modal-novo-lancamento')?.classList.add('hidden');
};

window.salvarNovoLancamentoModal = async function(e) {
  e.preventDefault();

  const scope = document.getElementById('nl-scope').value;
  const data = document.getElementById('nl-data').value;
  const servidorId = document.getElementById('nl-servidor-id').value;
  const delegaciaId = document.getElementById('nl-delegacia-id').value;
  const tipo = document.getElementById('nl-tipo').value;
  const turno = document.getElementById('nl-turno').value;
  const vtr = document.getElementById('nl-vtr').value.toUpperCase().trim();

  if (!servidorId || !data) {
    alert("Preencha a data e selecione o policial antes de salvar.");
    return;
  }

  const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const novaEsc = {
    id: newEscId,
    data: data,
    servidorId: servidorId,
    delegaciaId: scope === 'DELEGACIA' ? (delegaciaId || appState.selectedDelegaciaId) : delegaciaId,
    scope: scope,
    tipo: tipo,
    turno: turno,
    vtr: vtr
  };

  if (!appState.escalas) appState.escalas = [];
  appState.escalas.push(novaEsc);
  await syncDocToFirestore('escalas', newEscId, novaEsc);

  alert("Lançamento cadastrado com sucesso!");
  window.fecharModalNovoLancamento();

  if (scope === 'CRF') {
    renderGestaoCrfModule('gestao-crf-container');
    renderCalendarGrid('calendar-crf-container', 'CRF');
  } else {
    renderGestaoDelegaciasModule('gestao-delegacias-container');
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  }
};

function criarModalNovoLancamentoDOM() {
  const modalHTML = `
    <div id="modal-novo-lancamento" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">➕ Novo Lançamento de Escala</h3>
          <button type="button" onclick="window.fecharModalNovoLancamento()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarNovoLancamentoModal(event)" class="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="nl-scope">

          <div>
            <label class="block font-bold text-slate-700 mb-1">Data do Plantão:</label>
            <input type="date" id="nl-data" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Policial / Servidor:</label>
            <select id="nl-servidor-id" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Unidade / Lotação do Plantão:</label>
            <select id="nl-delegacia-id" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Modalidade:</label>
              <select id="nl-tipo" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="PLANTÃO">PLANTÃO</option>
                <option value="SOBREAVISO">SOBREAVISO</option>
                <option value="EXTRAJORNADA">EXTRAJORNADA</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Turno:</label>
              <select id="nl-turno" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="24h">24h</option>
                <option value="12h (D)">12h (D)</option>
                <option value="12h (N)">12h (N)</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Prefix da Viatura (Opicional):</label>
            <input type="text" id="nl-vtr" oninput="this.value = this.value.toUpperCase()" placeholder="EX: VTR 8011" class="w-full border rounded-xl p-2 bg-slate-50 font-mono text-slate-900">
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalNovoLancamento()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-black text-pcpr-gold border border-pcpr-gold hover:bg-slate-800 rounded-xl font-bold shadow-xs cursor-pointer">Salvar Lançamento</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.excluirEscalaGestaoDirect = async function(id, scopeTarget) {
  if (!confirm("Deseja realmente remover este lançamento de escala?")) return;

  appState.escalas = (appState.escalas || []).filter(e => e.id !== id);
  await syncDocToFirestore('escalas', id, null, true);

  if (scopeTarget === 'CRF') {
    renderGestaoCrfModule('gestao-crf-container');
    renderCalendarGrid('calendar-crf-container', 'CRF');
  } else {
    renderGestaoDelegaciasModule('gestao-delegacias-container');
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  }
};

// =========================================================================
// EXPORTAÇÃO E IMPORTAÇÃO DE ARQUIVO CSV
// =========================================================================
window.exportarEscalaCrfCsv = function(scopeTarget = 'CRF') {
  const { currentYear, currentMonth, selectedDelegaciaId } = appState;

  const escalasFiltradas = (appState.escalas || []).filter(e => {
    if (e.scope !== scopeTarget) return false;
    if (scopeTarget === 'DELEGACIA' && e.delegaciaId !== selectedDelegaciaId) return false;
    const [ano, mes] = e.data.split('-').map(Number);
    return ano === currentYear && (mes - 1) === currentMonth;
  });

  if (escalasFiltradas.length === 0) {
    alert("Não há escalas registradas para exportar neste mês.");
    return;
  }

  let csvContent = "\uFEFFData,Policial,Cargo,Lotacao,Turno,Modalidade,VTR\n";
  escalasFiltradas.forEach(esc => {
    const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const del = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);
    csvContent += `"${esc.data}","${srv?.nome || ''}","${srv?.cargo || ''}","${del?.nome || ''}","${esc.turno || ''}","${normalizarTipoModalidade(esc.tipo)}","${esc.vtr || ''}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `escala_${scopeTarget.toLowerCase()}_${currentYear}_${currentMonth + 1}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.importarEscalaCrfCsv = function(scopeTarget = 'CRF') {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv';

  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const linhas = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        if (linhas.length <= 1) {
          alert("O arquivo CSV selecionado está vazio ou contém apenas o cabeçalho.");
          return;
        }

        let importados = 0;
        for (let i = 1; i < linhas.length; i++) {
          const cols = linhas[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length < 2) continue;

          const dataIso = cols[0];
          const nomePolicial = cols[1].toUpperCase();
          const turnoStr = cols[4] || '24h';
          const tipoStr = normalizarTipoModalidade(cols[5]);
          const vtrStr = cols[6] || '';

          const srv = (appState.servidores || []).find(s => normalizeText(s.nome) === normalizeText(nomePolicial));

          if (srv && dataIso.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const novaEsc = {
              id: newEscId,
              data: dataIso,
              servidorId: srv.id,
              delegaciaId: scopeTarget === 'DELEGACIA' ? appState.selectedDelegaciaId : (srv.delegaciaId || ''),
              scope: scopeTarget,
              tipo: tipoStr,
              turno: turnoStr,
              vtr: vtrStr
            };

            if (!appState.escalas) appState.escalas = [];
            appState.escalas.push(novaEsc);
            await syncDocToFirestore('escalas', newEscId, novaEsc);
            importados++;
          }
        }

        alert(`Sucesso! ${importados} lançamento(s) importados do arquivo CSV.`);

        if (scopeTarget === 'CRF') {
          renderGestaoCrfModule('gestao-crf-container');
          renderCalendarGrid('calendar-crf-container', 'CRF');
        } else {
          renderGestaoDelegaciasModule('gestao-delegacias-container');
          renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
        }

      } catch (err) {
        console.error("Erro na importação CSV:", err);
        alert("Ocorreu um erro ao processar o arquivo CSV.");
      }
    };

    reader.readAsText(file);
  };

  fileInput.click();
};

// =========================================================================
// 4. FERRAMENTA: VINCULAR APJ PONTUAL
// =========================================================================
let vincularApjPontualState = {
  filtroDelegado: '',
  filtroApj: ''
};

window.abrirModalVincularApjPontual = function() {
  let modal = document.getElementById('modal-vincular-apj-pontual');
  if (!modal) {
    criarModalVincularApjPontualDOM();
    modal = document.getElementById('modal-vincular-apj-pontual');
  }

  vincularApjPontualState.filtroDelegado = '';
  vincularApjPontualState.filtroApj = '';

  const inputDel = document.getElementById('vinc-filtro-delegado-input');
  const inputApj = document.getElementById('vinc-filtro-apj-input');
  if (inputDel) inputDel.value = '';
  if (inputApj) inputApj.value = '';

  window.renderizarListaPlantoesApenasDelegados();
  modal.classList.remove('hidden');
};

window.fecharModalVincularApjPontual = function() {
  document.getElementById('modal-vincular-apj-pontual')?.classList.add('hidden');
};

window.atualizarFiltrosVincularApj = function() {
  vincularApjPontualState.filtroDelegado = document.getElementById('vinc-filtro-delegado-input')?.value?.toLowerCase() || '';
  vincularApjPontualState.filtroApj = document.getElementById('vinc-filtro-apj-input')?.value?.toLowerCase() || '';

  window.renderizarListaPlantoesApenasDelegados();
};

window.renderizarListaPlantoesApenasDelegados = function() {
  const container = document.getElementById('vinc-apj-lista-plantoes');
  if (!container) return;

  const hojeIso = new Date().toISOString().split('T')[0];

  const gruposDiaTurno = {};
  (appState.escalas || []).forEach(e => {
    if (e.scope === 'CRF' && e.data >= hojeIso) {
      const key = `${e.data}_${e.turno || '24h'}`;
      if (!gruposDiaTurno[key]) gruposDiaTurno[key] = [];
      gruposDiaTurno[key].push(e);
    }
  });

  let pendencias = [];
  Object.keys(gruposDiaTurno).forEach(key => {
    const lancamentos = gruposDiaTurno[key];
    
    const apenasDelegados = lancamentos.every(esc => {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      return srv && (srv.cargo || '').toUpperCase().includes('DELEGADO');
    });

    if (apenasDelegados && lancamentos.length > 0) {
      const primeiroDelegadoEsc = lancamentos[0];
      const delegadoSrv = (appState.servidores || []).find(s => s.id === primeiroDelegadoEsc.servidorId);

      pendencias.push({
        data: primeiroDelegadoEsc.data,
        turno: primeiroDelegadoEsc.turno || '24h',
        delegadoId: delegadoSrv ? delegadoSrv.id : null,
        delegadoNome: delegadoSrv ? delegadoSrv.nome : 'Delegado Plantonista',
        delegadoDelId: delegadoSrv ? delegadoSrv.delegaciaId : null,
        escalaDelegadoId: primeiroDelegadoEsc.id
      });
    }
  });

  const buscaDelegado = vincularApjPontualState.filtroDelegado;
  if (buscaDelegado) {
    pendencias = pendencias.filter(item => (item.delegadoNome || '').toLowerCase().includes(buscaDelegado));
  }

  pendencias.sort((a, b) => a.data.localeCompare(b.data));

  if (pendencias.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400 italic">Nenhum plantão pendente localizado para os filtros informados.</td></tr>`;
    return;
  }

  const apjsPool = (appState.servidores || []).filter(s => {
    const cargoU = (s.cargo || '').toUpperCase();
    const nomeN = normalizeText(s.nome || '');
    return !cargoU.includes('DELEGADO') && nomeN !== 'administrador do sistema' && nomeN !== 'admin';
  });

  const buscaApj = vincularApjPontualState.filtroApj;

  container.innerHTML = pendencias.map((item, idx) => {
    const poolOrdenada = [...apjsPool].sort((a, b) => {
      const mesmaDelA = (a.delegaciaId === item.delegadoDelId) ? 1 : 0;
      const mesmaDelB = (b.delegaciaId === item.delegadoDelId) ? 1 : 0;

      if (mesmaDelA !== mesmaDelB) return mesmaDelB - mesmaDelA;
      return (a.nome || '').localeCompare(b.nome || '');
    });

    const poolFiltrada = poolOrdenada.filter(s => {
      if (!buscaApj) return true;
      return (s.nome || '').toLowerCase().includes(buscaApj);
    });

    let selectOptions = `<option value="">Selecione o APJ...</option>`;
    poolFiltrada.forEach(s => {
      const eMesmaDel = (s.delegaciaId === item.delegadoDelId);
      const tagDel = eMesmaDel ? ' (★ Mesma Delegacia)' : '';
      selectOptions += `<option value="${s.id}">${s.nome}${tagDel}</option>`;
    });

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
        <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(item.data)}</td>
        <td class="p-3 font-bold text-slate-900">DEL. ${item.delegadoNome}</td>
        <td class="p-3 font-mono text-slate-700">${item.turno}</td>
        <td class="p-3">
          <div class="flex items-center gap-2">
            <select id="vinc-select-apj-${idx}" class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-white">
              ${selectOptions}
            </select>
            <button type="button" onclick="window.confirmarVinculoApjPontual('${item.data}', '${item.turno}', 'vinc-select-apj-${idx}')" class="px-3.5 py-1.5 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-lg shadow-xs transition cursor-pointer shrink-0">
              Vincular
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.confirmarVinculoApjPontual = async function(dataPlantao, turnoPlantao, selectId) {
  const selectEl = document.getElementById(selectId);
  const apjId = selectEl?.value;

  if (!apjId) {
    alert("Selecione um APJ na lista antes de clicar em Vincular.");
    return;
  }

  const srvApj = (appState.servidores || []).find(s => s.id === apjId);
  const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const novaEscala = {
    id: newEscId,
    data: dataPlantao,
    servidorId: apjId,
    delegaciaId: srvApj ? srvApj.delegaciaId : '',
    scope: 'CRF',
    tipo: 'PLANTÃO',
    turno: turnoPlantao
  };

  if (!appState.escalas) appState.escalas = [];
  appState.escalas.push(novaEscala);
  await syncDocToFirestore('escalas', newEscId, novaEscala);

  alert(`Sucesso! ${srvApj ? srvApj.nome : 'Policial'} vinculado ao plantão do dia ${formatarDataBr(dataPlantao)} (${turnoPlantao}).`);

  window.renderizarListaPlantoesApenasDelegados();
  renderGestaoCrfModule('gestao-crf-container');
  renderCalendarGrid('calendar-crf-container', 'CRF');
};

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}

function criarModalVincularApjPontualDOM() {
  const modalHTML = `
    <div id="modal-vincular-apj-pontual" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">🔗 Vincular APJ a Plantões com Apenas Delegado</h3>
          <button type="button" onclick="window.fecharModalVincularApjPontual()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0">
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🔍 Filtro Delegado:</label>
            <input type="text" id="vinc-filtro-delegado-input" oninput="window.atualizarFiltrosVincularApj()" placeholder="Digite o nome do Delegado..." class="w-full text-xs border border-slate-300 rounded-xl p-2 bg-slate-50 font-medium focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🔍 Filtro APJ:</label>
            <input type="text" id="vinc-filtro-apj-input" oninput="window.atualizarFiltrosVincularApj()" placeholder="Digite o nome do APJ..." class="w-full text-xs border border-slate-300 rounded-xl p-2 bg-slate-50 font-medium focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
          </div>
        </div>

        <div class="overflow-x-auto border border-slate-200 rounded-xl flex-1 max-h-80 overflow-y-auto">
          <table class="w-full text-left text-xs border-collapse font-sans">
            <thead class="sticky top-0 bg-slate-100 z-10 select-none">
              <tr class="text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                <th class="p-3">Data</th>
                <th class="p-3">Delegado Escalado</th>
                <th class="p-3">Turno</th>
                <th class="p-3">Selecione e Vincule o APJ</th>
              </tr>
            </thead>
            <tbody id="vinc-apj-lista-plantoes" class="divide-y divide-slate-200"></tbody>
          </table>
        </div>

        <div class="pt-3 border-t flex justify-end shrink-0">
          <button type="button" onclick="window.fecharModalVincularApjPontual()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer">Fechar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
