// src/gestaoEscalas.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

let gestaoCrfFiltros = { busca: '', sdp: 'TODAS', delegaciaId: 'TODAS' };

let gestaoDelTabelaState = {
  busca: '',
  modalidade: 'TODAS',
  mes: appState.currentMonth,
  ano: appState.currentYear,
  sortColuna: 'DATA',
  sortDirecao: 'ASC'
};

let modalCrfFiltros = { cargo: 'DELEGADO', busca: '' };
let modalDelFiltros = { cargo: 'TODOS', busca: '' };

function normalizarTipoModalidade(tipo) {
  if (!tipo) return 'PLANTÃO';
  const t = tipo.trim().toUpperCase();
  if (t === 'SDP') return 'EXTRAJORNADA';
  return t;
}

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
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
    <!-- Topo Gerencial -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão Geral de Escalas da CRF</h2>
          <p class="text-[11px] text-slate-500">Controle de lançamentos, turnos, equipes e substituições (${mesExtenso})</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="window.abrirModalLancamentoCrf()" class="px-3 py-2 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ➕ Novo Lançamento CRF
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
          <button onclick="window.abrirModalDetalhesTurno('Gestão CRF', '${esc.turno || '24h'}', '${esc.id}', '${esc.data}')" class="px-2.5 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded font-bold text-[10px] shadow-xs cursor-pointer">
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
// 2. MÓDULO GESTÃO POR DELEGACIAS (COM GERAÇÃO EM LOTE E FILTROS COMPLETOS)
// =========================================================================
export function renderGestaoDelegaciasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { selectedDelegaciaId } = appState;
  gestaoDelTabelaState.mes = appState.currentMonth;
  gestaoDelTabelaState.ano = appState.currentYear;

  let optsDelegacias = (appState.delegacias || []).map(d => 
    `<option value="${d.id}" ${d.id === selectedDelegaciaId ? 'selected' : ''}>${d.nome}</option>`
  ).join('');

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  let optsMeses = monthNames.map((m, idx) => `<option value="${idx}" ${idx === gestaoDelTabelaState.mes ? 'selected' : ''}>${m}</option>`).join('');

  let optsAnos = [gestaoDelTabelaState.ano - 1, gestaoDelTabelaState.ano, gestaoDelTabelaState.ano + 1]
    .map(a => `<option value="${a}" ${a === gestaoDelTabelaState.ano ? 'selected' : ''}>${a}</option>`).join('');

  container.innerHTML = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão de Escalas por Delegacia</h2>
          <p class="text-[11px] text-slate-500">Controle, consultas, filtros avançados e exclusão em lote</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="window.abrirModalLancamentoDelegacia()" class="px-3 py-2 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ➕ Novo Lançamento Local
          </button>
          <button onclick="window.gerarEscalaLoteDelegacia()" class="px-3 py-2 bg-[#2A2B2D] hover:bg-black text-white border border-slate-600 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ⚡ Gerar em Lote
          </button>
          <button onclick="window.exportarEscalaCrfCsv('DELEGACIA')" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            📤 Exportar CSV
          </button>
          <button onclick="window.importarEscalaCrfCsv('DELEGACIA')" class="px-3 py-2 bg-[#BEA55A] hover:bg-[#AF9340] text-black font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            📥 Importar CSV
          </button>
          <button onclick="window.excluirTodosFiltradosDelegacia()" class="px-3 py-2 bg-[#E2001A] hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            🚨 Excluir Filtrados
          </button>
        </div>
      </div>

      <!-- Barra de Filtros com Busca Letra a Letra, Mês/Ano e Modalidade -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-slate-200">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🏢 Unidade Alvo:</label>
          <select id="gestao-del-select-unidade" onchange="window.mudarUnidadeGestaoDel(this.value)" class="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-1.5 shadow-xs">
            ${optsDelegacias}
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🔍 Busca Rápida (Letra a Letra):</label>
          <input type="text" id="gest-del-busca" oninput="window.atualizarFiltrosGestaoDelList()" placeholder="Policial ou VTR..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:outline-none">
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🏷 Modalidade:</label>
          <select id="gest-del-modalidade" onchange="window.atualizarFiltrosGestaoDelList()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            <option value="TODAS">Todas as Modalidades</option>
            <option value="PLANTÃO">PLANTÃO LOCAL</option>
            <option value="SOBREAVISO">SOBREAVISO</option>
            <option value="EXTRAJORNADA">EXTRAJORNADA</option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">📅 Mês:</label>
          <select id="gest-del-mes" onchange="window.atualizarFiltrosGestaoDelList()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            ${optsMeses}
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">📆 Ano:</label>
          <select id="gest-del-ano" onchange="window.atualizarFiltrosGestaoDelList()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            ${optsAnos}
          </select>
        </div>
      </div>

      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
        <span id="gest-del-total-count" class="font-bold text-slate-700 bg-slate-200/80 px-2.5 py-0.5 rounded-md">
          Exibindo 0 Registros
        </span>
        <span class="text-[10px] text-slate-400 italic">Dica: clique nos cabeçalhos para reordenar (A-Z / Z-A)</span>
      </div>
    </div>

    <!-- Tabela Com Ordenação de Colunas -->
    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px] select-none">
            <th onclick="window.ordenarTabelaGestaoDel('DATA')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Data <span id="sort-del-icon-DATA">⬆️</span>
            </th>
            <th onclick="window.ordenarTabelaGestaoDel('POLICIAL')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Policial Escalado <span id="sort-del-icon-POLICIAL"></span>
            </th>
            <th onclick="window.ordenarTabelaGestaoDel('CARGO')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Cargo <span id="sort-del-icon-CARGO"></span>
            </th>
            <th onclick="window.ordenarTabelaGestaoDel('VTR')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Viatura (VTR) <span id="sort-del-icon-VTR"></span>
            </th>
            <th onclick="window.ordenarTabelaGestaoDel('TURNO')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Turno <span id="sort-del-icon-TURNO"></span>
            </th>
            <th onclick="window.ordenarTabelaGestaoDel('MODALIDADE')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Modalidade <span id="sort-del-icon-MODALIDADE"></span>
            </th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-gestao-del-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  window.renderTabelaGestaoDelCorpo();
}

/**
 * Função de geração em lote para a escala local da Delegacia selecionada
 */
window.gerarEscalaLoteDelegacia = async function() {
  const delId = document.getElementById('gestao-del-select-unidade')?.value || appState.selectedDelegaciaId;
  const mes = gestaoDelTabelaState.mes;
  const ano = gestaoDelTabelaState.ano;

  if (!delId) {
    alert("Selecione uma delegacia/unidade para gerar a escala.");
    return;
  }

  const delegaciaObj = (appState.delegacias || []).find(d => d.id === delId);
  const nomeDel = delegaciaObj ? delegaciaObj.nome : 'Unidade Selecionada';

  const confirmacao = confirm(
    `Deseja gerar automaticamente a escala em lote para:\n` +
    `• Unidade: ${nomeDel}\n` +
    `• Período: ${mes + 1}/${ano}\n\n` +
    `Atenção: Os plantões serão distribuídos entre o efetivo cadastrado nesta unidade.`
  );

  if (!confirmacao) return;

  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const policiaisDel = (appState.servidores || []).filter(s => s.delegaciaId === delId);

  if (policiaisDel.length === 0) {
    alert(`Nenhum policial cadastrado para a unidade ${nomeDel}.`);
    return;
  }

  let gerados = 0;
  for (let day = 1; day <= totalDias; day++) {
    const dataIso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const escalaId = `esc_del_${delId}_${dataIso}`;
    const novaescala = {
      id: escalaId,
      scope: 'DELEGACIA',
      delegaciaId: delId,
      data: dataIso,
      tipo: 'PLANTÃO',
      turno: '24h',
      servidorId: policiaisDel[(day - 1) % policiaisDel.length].id,
      criadoEm: new Date().toISOString()
    };

    await syncDocToFirestore('escalas', escalaId, novaescala);
    
    if (!appState.escalas) appState.escalas = [];
    const idx = appState.escalas.findIndex(e => e.id === escalaId);
    if (idx >= 0) appState.escalas[idx] = novaescala;
    else appState.escalas.push(novaescala);

    gerados++;
  }

  alert(`Escala em lote gerada com sucesso para ${nomeDel}! Total de ${gerados} dias criados.`);
  renderGestaoDelegaciasModule('gestao-delegacias-container');
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
};

window.atualizarFiltrosGestaoDelList = function() {
  gestaoDelTabelaState.busca = document.getElementById('gest-del-busca')?.value?.toLowerCase().trim() || '';
  gestaoDelTabelaState.modalidade = document.getElementById('gest-del-modalidade')?.value || 'TODAS';
  gestaoDelTabelaState.mes = parseInt(document.getElementById('gest-del-mes')?.value || appState.currentMonth);
  gestaoDelTabelaState.ano = parseInt(document.getElementById('gest-del-ano')?.value || appState.currentYear);

  window.renderTabelaGestaoDelCorpo();
};

window.ordenarTabelaGestaoDel = function(coluna) {
  if (gestaoDelTabelaState.sortColuna === coluna) {
    gestaoDelTabelaState.sortDirecao = gestaoDelTabelaState.sortDirecao === 'ASC' ? 'DESC' : 'ASC';
  } else {
    gestaoDelTabelaState.sortColuna = coluna;
    gestaoDelTabelaState.sortDirecao = 'ASC';
  }

  ['DATA', 'POLICIAL', 'CARGO', 'VTR', 'TURNO', 'MODALIDADE'].forEach(col => {
    const el = document.getElementById(`sort-del-icon-${col}`);
    if (el) {
      el.innerText = (col === gestaoDelTabelaState.sortColuna) ? (gestaoDelTabelaState.sortDirecao === 'ASC' ? '⬆️' : '⬇️') : '';
    }
  });

  window.renderTabelaGestaoDelCorpo();
};

window.obterEscalasFiltradasGestaoDel = function() {
  const { selectedDelegaciaId } = appState;
  const { busca, modalidade, mes, ano } = gestaoDelTabelaState;

  return (appState.escalas || []).filter(e => {
    if (e.scope !== 'DELEGACIA' || e.delegaciaId !== selectedDelegaciaId) return false;
    const [a, m] = e.data.split('-').map(Number);
    if (a !== ano || (m - 1) !== mes) return false;

    const tipoModalidade = normalizarTipoModalidade(e.tipo);
    if (modalidade !== 'TODAS' && tipoModalidade !== modalidade) return false;

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
  });
};

window.renderTabelaGestaoDelCorpo = function() {
  const tbody = document.getElementById('tabela-gestao-del-corpo');
  if (!tbody) return;

  const { sortColuna, sortDirecao } = gestaoDelTabelaState;
  let escalasDel = window.obterEscalasFiltradasGestaoDel();

  // Ordenação Reativa
  escalasDel.sort((a, b) => {
    const srvA = (appState.servidores || []).find(s => s.id === a.servidorId);
    const srvB = (appState.servidores || []).find(s => s.id === b.servidorId);

    let valA = '', valB = '';
    if (sortColuna === 'DATA') { valA = a.data || ''; valB = b.data || ''; }
    else if (sortColuna === 'POLICIAL') { valA = srvA?.nome || ''; valB = srvB?.nome || ''; }
    else if (sortColuna === 'CARGO') { valA = srvA?.cargo || ''; valB = srvB?.cargo || ''; }
    else if (sortColuna === 'VTR') { valA = a.vtr || ''; valB = b.vtr || ''; }
    else if (sortColuna === 'TURNO') { valA = a.turno || ''; valB = b.turno || ''; }
    else if (sortColuna === 'MODALIDADE') { valA = normalizarTipoModalidade(a.tipo); valB = normalizarTipoModalidade(b.tipo); }

    const res = valA.localeCompare(valB, undefined, { numeric: true });
    return sortDirecao === 'ASC' ? res : -res;
  });

  const totalEl = document.getElementById('gest-del-total-count');
  if (totalEl) totalEl.innerText = `Exibindo ${escalasDel.length} Registros`;

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
          <button onclick="window.abrirModalDetalhesTurno('Gestão Delegacia', '${esc.turno || '24h'}', '${esc.id}', '${esc.data}')" class="px-2.5 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded font-bold text-[10px] shadow-xs cursor-pointer">
            ✏ Edit
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

window.excluirTodosFiltradosDelegacia = async function() {
  const filtrados = window.obterEscalasFiltradasGestaoDel();
  if (filtrados.length === 0) {
    alert("Não há registros filtrados para excluir.");
    return;
  }

  const confirm1 = confirm(`ATENÇÃO: Deseja realmente EXCLUIR TODOS OS ${filtrados.length} REGISTROS FILTRADOS exibidos na tabela?`);
  if (!confirm1) return;

  const confirm2 = confirm(`Confirmação final: Esta ação removerá ${filtrados.length} plantões do banco de dados permanentemente.`);
  if (!confirm2) return;

  const idsParaRemover = new Set(filtrados.map(e => e.id));
  appState.escalas = (appState.escalas || []).filter(e => !idsParaRemover.has(e.id));

  for (const escId of idsParaRemover) {
    await syncDocToFirestore('escalas', escId, null, true);
  }

  alert(`Sucesso! ${filtrados.length} lançamentos excluídos.`);
  renderGestaoDelegaciasModule('gestao-delegacias-container');
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
};

// =========================================================================
// 3. MODAL DEDICADO: NOVO LANÇAMENTO GESTÃO CRF
// =========================================================================
window.abrirModalLancamentoCrf = function() {
  let modal = document.getElementById('modal-lancamento-crf');
  if (!modal) {
    criarModalLancamentoCrfDOM();
    modal = document.getElementById('modal-lancamento-crf');
  }

  modalCrfFiltros.cargo = 'DELEGADO';
  modalCrfFiltros.busca = '';

  document.getElementById('ml-crf-filtro-cargo').value = 'DELEGADO';
  document.getElementById('ml-crf-filtro-busca').value = '';

  const dtSugerida = obterPrimeiraDataLivreCrf();
  document.getElementById('ml-crf-data').value = dtSugerida.data;
  document.getElementById('ml-crf-turno').value = dtSugerida.turno;
  document.getElementById('ml-crf-tipo').value = 'PLANTÃO';

  window.atualizarOptionsServidoresCrfModal();
  modal.classList.remove('hidden');
};

function obterPrimeiraDataLivreCrf() {
  const { currentYear, currentMonth } = appState;
  const hoje = new Date();
  const hojeIso = hoje.toISOString().split('T')[0];

  const totalDias = new Date(currentYear, currentMonth + 1, 0).getDate();

  for (let d = 1; d <= totalDias; d++) {
    const dtIso = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dtIso < hojeIso) continue;

    const escalasNoDia = (appState.escalas || []).filter(e => e.scope === 'CRF' && e.data === dtIso);
    const tem24h = escalasNoDia.some(e => e.turno === '24h');
    const tem12D = escalasNoDia.some(e => e.turno === '12h (D)');
    const tem12N = escalasNoDia.some(e => e.turno === '12h (N)');

    if (!tem24h && !tem12D) return { data: dtIso, turno: '12h (D)' };
    if (!tem24h && !tem12N) return { data: dtIso, turno: '12h (N)' };
  }

  return { data: hojeIso, turno: '24h' };
}

window.fecharModalLancamentoCrf = function() {
  document.getElementById('modal-lancamento-crf')?.classList.add('hidden');
};

window.atualizarFiltrosServidoresCrfModal = function() {
  modalCrfFiltros.cargo = document.getElementById('ml-crf-filtro-cargo')?.value || 'TODOS';
  modalCrfFiltros.busca = document.getElementById('ml-crf-filtro-busca')?.value?.toLowerCase().trim() || '';

  window.atualizarOptionsServidoresCrfModal();
};

window.atualizarOptionsServidoresCrfModal = function() {
  const selectSrv = document.getElementById('ml-crf-servidor-id');
  if (!selectSrv) return;

  const { cargo, busca } = modalCrfFiltros;

  let srvs = [...(appState.servidores || [])].filter(s => {
    const n = normalizeText(s.nome || '');
    if (n === 'administrador do sistema' || n === 'admin') return false;

    if (cargo !== 'TODOS') {
      const cargoPol = (s.cargo || '').toUpperCase();
      if (cargo === 'DELEGADO' && !cargoPol.includes('DELEGADO')) return false;
      if (cargo === 'APJ' && cargoPol.includes('DELEGADO')) return false;
    }

    if (busca) {
      const nomePol = (s.nome || '').toLowerCase();
      if (!nomePol.includes(busca)) return false;
    }

    return true;
  });

  srvs.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  let opts = `<option value="">Selecione o Policial (${srvs.length} Encontrados)...</option>`;
  srvs.forEach(s => {
    opts += `<option value="${s.id}">${s.nome} (${s.cargo || 'APJ'})</option>`;
  });

  selectSrv.innerHTML = opts;
  window.aoMudarServidorCrf(selectSrv.value);
};

window.aoMudarServidorCrf = function(srvId) {
  const srv = (appState.servidores || []).find(s => s.id === srvId);
  const campoOrigem = document.getElementById('ml-crf-origem-nome');
  const blocoDelVinculado = document.getElementById('ml-crf-bloco-delegado');

  if (srv) {
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    if (campoOrigem) campoOrigem.value = del ? del.nome : (srv.delegaciaNome || 'Central CRF');

    const isApj = !(srv.cargo || '').toUpperCase().includes('DELEGADO');
    if (blocoDelVinculado) {
      if (isApj) {
        blocoDelVinculado.classList.remove('hidden');
        window.atualizarDelegadosDisponiveisCrf();
      } else {
        blocoDelVinculado.classList.add('hidden');
      }
    }
  } else {
    if (campoOrigem) campoOrigem.value = '';
    if (blocoDelVinculado) blocoDelVinculado.classList.add('hidden');
  }
};

window.atualizarDelegadosDisponiveisCrf = function() {
  const selectDel = document.getElementById('ml-crf-delegado-vinculado');
  if (!selectDel) return;

  const dataSel = document.getElementById('ml-crf-data')?.value;
  const turnoSel = document.getElementById('ml-crf-turno')?.value;

  const escalasDelegados = (appState.escalas || []).filter(e => {
    if (e.scope !== 'CRF' || e.data !== dataSel || e.turno !== turnoSel) return false;
    const srv = (appState.servidores || []).find(s => s.id === e.servidorId);
    return srv && (srv.cargo || '').toUpperCase().includes('DELEGADO');
  });

  let opts = `<option value="">Nenhum vínculo permanente (Avulso)</option>`;
  escalasDelegados.forEach(e => {
    const srv = (appState.servidores || []).find(s => s.id === e.servidorId);
    if (srv) {
      opts += `<option value="${srv.id}">DEL. ${srv.nome}</option>`;
    }
  });

  selectDel.innerHTML = opts;
};

window.salvarLancamentoCrfModal = async function(e) {
  e.preventDefault();

  const data = document.getElementById('ml-crf-data').value;
  const servidorId = document.getElementById('ml-crf-servidor-id').value;
  const tipo = document.getElementById('ml-crf-tipo').value;
  const turno = document.getElementById('ml-crf-turno').value;
  const delegadoVinculadoId = document.getElementById('ml-crf-delegado-vinculado')?.value || null;

  if (!servidorId || !data) {
    alert("Selecione o policial e a data antes de salvar.");
    return;
  }

  const srv = (appState.servidores || []).find(s => s.id === servidorId);
  const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const novaEsc = {
    id: newEscId,
    data: data,
    servidorId: servidorId,
    delegaciaId: srv ? srv.delegaciaId : '',
    scope: 'CRF',
    tipo: tipo,
    turno: turno,
    delegadoVinculadoId: delegadoVinculadoId
  };

  if (!appState.escalas) appState.escalas = [];
  appState.escalas.push(novaEsc);
  await syncDocToFirestore('escalas', newEscId, novaEsc);

  alert("Lançamento na Central CRF cadastrado com sucesso!");
  window.fecharModalLancamentoCrf();

  renderGestaoCrfModule('gestao-crf-container');
  renderCalendarGrid('calendar-crf-container', 'CRF');
};

function criarModalLancamentoCrfDOM() {
  const modalHTML = `
    <div id="modal-lancamento-crf" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">🏛️ Novo Lançamento na Central CRF</h3>
          <button type="button" onclick="window.fecharModalLancamentoCrf()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarLancamentoCrfModal(event)" class="space-y-3 text-xs flex-1 overflow-
