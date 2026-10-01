// src/gestaoEscalas.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';

// Estado local de filtros para não poluir ou depender do calendário global
const gestaoState = {
  crf: {
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1, // 1-12
    busca: '',
    ordenacao: 'DATA_ASC', // 'DATA_ASC', 'DATA_DESC', 'NOME_ASC', 'NOME_DESC'
  },
  delegacia: {
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    busca: '',
    delegaciaId: 'TODAS',
    ordenacao: 'DATA_ASC'
  }
};

export function renderGestaoEscalasModule(containerId) {
  renderGestaoCrfModule(containerId);
}

// =========================================================================
// 1. GESTÃO DE ESCALAS CRF
// =========================================================================
export function renderGestaoCrfModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const monthOptions = getMonthSelectOptions(gestaoState.crf.mes);
  const yearOptions = getYearSelectOptions(gestaoState.crf.ano);

  let html = `
    <!-- Cabeçalho de Controle CRF -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão de Escalas CRF</h2>
          <p class="text-[11px] text-slate-500">Visão gerencial global com filtros e ordenação autônomos</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.abrirModalEscala(null, null, 'CRF')" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ➕ Novo Plantão CRF
          </button>
          <button onclick="window.abrirModalGeradorLote('CRF')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ⚡ Gerar em Lote
          </button>
          <label class="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-xs flex items-center gap-1">
            <span>📥 Importar CSV</span>
            <input type="file" accept=".csv" class="hidden" onchange="window.importarEscalasCSV(event, 'CRF')">
          </label>
          <button onclick="window.exportarEscalasCSV('CRF')" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            📊 Exportar CSV
          </button>
        </div>
      </div>

      <!-- Barra de Filtros Próprios CRF -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">📅 Mês:</label>
          <select id="filtro-crf-mes" onchange="window.atualizarFiltrosCrf()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            ${monthOptions}
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">📆 Ano:</label>
          <select id="filtro-crf-ano" onchange="window.atualizarFiltrosCrf()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            ${yearOptions}
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔍 Busca Policial/Lotação:</label>
          <input type="text" id="filtro-crf-busca" oninput="window.atualizarFiltrosCrf()" placeholder="Digite nome ou cargo..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔀 Ordenar Por:</label>
          <select id="filtro-crf-ordem" onchange="window.atualizarFiltrosCrf()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            <option value="DATA_ASC">Data (Mais antiga ➔ Recente)</option>
            <option value="DATA_DESC">Data (Mais recente ➔ Antiga)</option>
            <option value="NOME_ASC">Nome Policial (A ➔ Z)</option>
            <option value="NOME_DESC">Nome Policial (Z ➔ A)</option>
          </select>
        </div>

        <div class="flex items-end justify-between sm:justify-end gap-2">
          <button onclick="window.excluirLançamentosFiltrados('CRF')" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer w-full sm:w-auto">
            🗑️ Excluir Filtrados
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-slate-500 font-mono pt-1">
        <span id="total-crf-count" class="font-bold text-slate-700 bg-slate-200/80 px-2.5 py-1 rounded-md">
          Total CRF: 0 Lançamentos
        </span>
      </div>
    </div>

    <!-- Tabela Gerencial CRF -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse font-sans">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Data</th>
            <th class="p-3">Policial / Servidor</th>
            <th class="p-3">Unidade / Lotação de Origem</th>
            <th class="p-3">Tipo</th>
            <th class="p-3">Turno</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-crf-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  window.filtrarTabelaCrfInline();
}

window.atualizarFiltrosCrf = function() {
  gestaoState.crf.mes = Number(document.getElementById('filtro-crf-mes')?.value || gestaoState.crf.mes);
  gestaoState.crf.ano = Number(document.getElementById('filtro-crf-ano')?.value || gestaoState.crf.ano);
  gestaoState.crf.busca = document.getElementById('filtro-crf-busca')?.value?.toLowerCase() || '';
  gestaoState.crf.ordenacao = document.getElementById('filtro-crf-ordem')?.value || 'DATA_ASC';

  window.filtrarTabelaCrfInline();
};

window.filtrarTabelaCrfInline = function() {
  const tbody = document.getElementById('tabela-crf-corpo');
  if (!tbody) return;

  const { mes, ano, busca, ordenacao } = gestaoState.crf;

  let escalasFiltradas = (appState.escalas || []).filter(esc => {
    if (!esc.data) return false;
    if (esc.scope !== 'CRF') return false;

    const [a, m] = esc.data.split('-').map(Number);
    if (a !== ano || m !== mes) return false;

    if (busca) {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      const del = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);
      const nomeSrv = (srv?.nome || '').toLowerCase();
      const cargoSrv = (srv?.cargo || '').toLowerCase();
      const nomeDel = (del?.nome || srv?.delegaciaNome || '').toLowerCase();

      if (!nomeSrv.includes(busca) && !cargoSrv.includes(busca) && !nomeDel.includes(busca)) return false;
    }
    return true;
  });

  // Ordenação
  escalasFiltradas = aplicarOrdenacao(escalasFiltradas, ordenacao);

  const totalEl = document.getElementById('total-crf-count');
  if (totalEl) totalEl.innerText = `Exibindo ${escalasFiltradas.length} Lançamentos na CRF`;

  tbody.innerHTML = renderLinhasTabela(escalasFiltradas);
};

// =========================================================================
// 2. GESTÃO DE ESCALAS POR DELEGACIAS
// =========================================================================
export function renderGestaoDelegaciasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const monthOptions = getMonthSelectOptions(gestaoState.delegacia.mes);
  const yearOptions = getYearSelectOptions(gestaoState.delegacia.ano);

  let delegaciasOptions = `<option value="TODAS">Todas as Delegacias</option>`;
  (appState.delegacias || []).forEach(d => {
    delegaciasOptions += `<option value="${d.id}" ${gestaoState.delegacia.delegaciaId === d.id ? 'selected' : ''}>${d.nome}</option>`;
  });

  let html = `
    <!-- Cabeçalho de Controle Delegacias -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão de Escalas por Delegacia</h2>
          <p class="text-[11px] text-slate-500">Auditoria e controle unificado de plantões locais e sobreavisos</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.abrirModalEscala(null, null, 'DELEGACIA')" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ➕ Novo Plantão Local
          </button>
          <button onclick="window.abrirModalGeradorLote('DELEGACIA')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ⚡ Gerar em Lote
          </button>
          <label class="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-xs flex items-center gap-1">
            <span>📥 Importar CSV</span>
            <input type="file" accept=".csv" class="hidden" onchange="window.importarEscalasCSV(event, 'DELEGACIA')">
          </label>
          <button onclick="window.exportarEscalasCSV('DELEGACIA')" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            📊 Exportar CSV
          </button>
        </div>
      </div>

      <!-- Barra de Filtros Próprios Delegacia -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🏢 Delegacia / Unidade:</label>
          <select id="filtro-del-unidade" onchange="window.atualizarFiltrosDel()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            ${delegaciasOptions}
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">📅 Mês:</label>
          <select id="filtro-del-mes" onchange="window.atualizarFiltrosDel()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            ${monthOptions}
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">📆 Ano:</label>
          <select id="filtro-del-ano" onchange="window.atualizarFiltrosDel()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            ${yearOptions}
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔍 Busca Policial:</label>
          <input type="text" id="filtro-del-busca" oninput="window.atualizarFiltrosDel()" placeholder="Digite nome ou cargo..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔀 Ordenação:</label>
          <select id="filtro-del-ordem" onchange="window.atualizarFiltrosDel()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            <option value="DATA_ASC">Data (Mais antiga ➔ Recente)</option>
            <option value="DATA_DESC">Data (Mais recente ➔ Antiga)</option>
            <option value="NOME_ASC">Nome Policial (A ➔ Z)</option>
            <option value="NOME_DESC">Nome Policial (Z ➔ A)</option>
          </select>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-slate-500 font-mono pt-1">
        <span id="total-del-count" class="font-bold text-slate-700 bg-slate-200/80 px-2.5 py-1 rounded-md">
          Exibindo 0 Lançamentos
        </span>
        <button onclick="window.excluirLançamentosFiltrados('DELEGACIA')" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer">
          🗑️ Excluir Filtrados
        </button>
      </div>
    </div>

    <!-- Tabela Gerencial Delegacias -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse font-sans">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Data</th>
            <th class="p-3">Policial / Servidor</th>
            <th class="p-3">Unidade de Plantão</th>
            <th class="p-3">Tipo</th>
            <th class="p-3">Turno</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-del-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  window.filtrarTabelaDelInline();
}

window.atualizarFiltrosDel = function() {
  gestaoState.delegacia.delegaciaId = document.getElementById('filtro-del-unidade')?.value || 'TODAS';
  gestaoState.delegacia.mes = Number(document.getElementById('filtro-del-mes')?.value || gestaoState.delegacia.mes);
  gestaoState.delegacia.ano = Number(document.getElementById('filtro-del-ano')?.value || gestaoState.delegacia.ano);
  gestaoState.delegacia.busca = document.getElementById('filtro-del-busca')?.value?.toLowerCase() || '';
  gestaoState.delegacia.ordenacao = document.getElementById('filtro-del-ordem')?.value || 'DATA_ASC';

  window.filtrarTabelaDelInline();
};

window.filtrarTabelaDelInline = function() {
  const tbody = document.getElementById('tabela-del-corpo');
  if (!tbody) return;

  const { mes, ano, busca, delegaciaId, ordenacao } = gestaoState.delegacia;

  let escalasFiltradas = (appState.escalas || []).filter(esc => {
    if (!esc.data) return false;
    if (esc.scope !== 'DELEGACIA') return false;

    const [a, m] = esc.data.split('-').map(Number);
    if (a !== ano || m !== mes) return false;

    if (delegaciaId !== 'TODAS') {
      const delObj = (appState.delegacias || []).find(d => d.id === delegaciaId);
      const bateuId = esc.delegaciaId === delegaciaId;
      const bateuUnificado = delObj?.delegaciasIds && delObj.delegaciasIds.includes(esc.delegaciaId);
      if (!bateuId && !bateuUnificado) return false;
    }

    if (busca) {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      const nomeSrv = (srv?.nome || '').toLowerCase();
      const cargoSrv = (srv?.cargo || '').toLowerCase();
      if (!nomeSrv.includes(busca) && !cargoSrv.includes(busca)) return false;
    }
    return true;
  });

  escalasFiltradas = aplicarOrdenacao(escalasFiltradas, ordenacao);

  const totalEl = document.getElementById('total-del-count');
  if (totalEl) totalEl.innerText = `Exibindo ${escalasFiltradas.length} Lançamentos na Unidade`;

  tbody.innerHTML = renderLinhasTabela(escalasFiltradas);
};

// =========================================================================
// 3. AÇÃO DE EXCLUSÃO DINÂMICA BASEADA NOS REGISTROS EXIBIDOS
// =========================================================================
window.excluirLançamentosFiltrados = async function(scope) {
  let listaParaExcluir = [];

  if (scope === 'CRF') {
    const { mes, ano, busca } = gestaoState.crf;
    listaParaExcluir = (appState.escalas || []).filter(esc => {
      if (!esc.data || esc.scope !== 'CRF') return false;
      const [a, m] = esc.data.split('-').map(Number);
      if (a !== ano || m !== mes) return false;

      if (busca) {
        const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
        const del = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);
        const nomeSrv = (srv?.nome || '').toLowerCase();
        const cargoSrv = (srv?.cargo || '').toLowerCase();
        const nomeDel = (del?.nome || srv?.delegaciaNome || '').toLowerCase();
        if (!nomeSrv.includes(busca) && !cargoSrv.includes(busca) && !nomeDel.includes(busca)) return false;
      }
      return true;
    });
  } else {
    const { mes, ano, busca, delegaciaId } = gestaoState.delegacia;
    listaParaExcluir = (appState.escalas || []).filter(esc => {
      if (!esc.data || esc.scope !== 'DELEGACIA') return false;
      const [a, m] = esc.data.split('-').map(Number);
      if (a !== ano || m !== mes) return false;

      if (delegaciaId !== 'TODAS') {
        const delObj = (appState.delegacias || []).find(d => d.id === delegaciaId);
        const bateuId = esc.delegaciaId === delegaciaId;
        const bateuUnificado = delObj?.delegaciasIds && delObj.delegaciasIds.includes(esc.delegaciaId);
        if (!bateuId && !bateuUnificado) return false;
      }

      if (busca) {
        const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
        const nomeSrv = (srv?.nome || '').toLowerCase();
        const cargoSrv = (srv?.cargo || '').toLowerCase();
        if (!nomeSrv.includes(busca) && !cargoSrv.includes(busca)) return false;
      }
      return true;
    });
  }

  if (listaParaExcluir.length === 0) {
    alert("Nenhum lançamento está visível no momento para ser excluído.");
    return;
  }

  const confirmacao = confirm(`ATENÇÃO!\n\nVocê está prestes a EXCLUIR OS ${listaParaExcluir.length} LANÇAMENTOS atualmente visíveis na tela.\n\nEsta ação é irreversível. Deseja continuar?`);
  if (!confirmacao) return;

  for (const esc of listaParaExcluir) {
    appState.escalas = appState.escalas.filter(e => e.id !== esc.id);
    await syncDocToFirestore('escalas', esc.id, null, true);
  }

  alert(`Sucesso! ${listaParaExcluir.length} registros foram excluídos do sistema.`);

  if (scope === 'CRF') window.filtrarTabelaCrfInline();
  else window.filtrarTabelaDelInline();
};

// =========================================================================
// AUXILIARES DE FORMATAÇÃO E ORDENAÇÃO
// =========================================================================
function aplicarOrdenacao(lista, criterio) {
  return [...lista].sort((a, b) => {
    const srvA = (appState.servidores || []).find(s => s.id === a.servidorId);
    const srvB = (appState.servidores || []).find(s => s.id === b.servidorId);

    if (criterio === 'DATA_ASC') return (a.data || '').localeCompare(b.data || '');
    if (criterio === 'DATA_DESC') return (b.data || '').localeCompare(a.data || '');
    if (criterio === 'NOME_ASC') return (srvA?.nome || '').localeCompare(srvB?.nome || '');
    if (criterio === 'NOME_DESC') return (srvB?.nome || '').localeCompare(srvA?.nome || '');

    return 0;
  });
}

function getMonthSelectOptions(selectedMonth) {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return meses.map((nome, idx) => 
    `<option value="${idx + 1}" ${selectedMonth === (idx + 1) ? 'selected' : ''}>${nome}</option>`
  ).join('');
}

function getYearSelectOptions(selectedYear) {
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2];
  return anos.map(ano => 
    `<option value="${ano}" ${selectedYear === ano ? 'selected' : ''}>${ano}</option>`
  ).join('');
}

function renderLinhasTabela(listaEscalas) {
  if (listaEscalas.length === 0) {
    return `
      <tr>
        <td colspan="6" class="p-6 text-center text-slate-500 italic">
          Nenhum plantão localizado para os filtros selecionados.
        </td>
      </tr>
    `;
  }

  return listaEscalas.map(esc => {
    const servidor = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const delegaciaServidor = (appState.delegacias || []).find(d => d.id === servidor?.delegaciaId);
    const delegaciaEscala = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);

    const nomeServidor = servidor ? `${servidor.nome} (${servidor.cargo})` : 'Não Localizado';
    
    let nomeUnidadeExibida = 'CRF Geral';
    if (esc.scope === 'CRF') {
      nomeUnidadeExibida = delegaciaServidor ? delegaciaServidor.nome : (servidor?.delegaciaNome || 'Central CRF');
    } else {
      nomeUnidadeExibida = delegaciaEscala ? delegaciaEscala.nome : 'Unidade Local';
    }

    const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';
    const isSobreaviso = esc.tipo === 'SOBREAVISO';

    let badgeClass = 'bg-sky-100 text-sky-900 border-sky-300 font-bold';
    if (isExtra) badgeClass = 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
    else if (isSobreaviso) badgeClass = 'bg-amber-100 text-amber-950 border-amber-300 font-bold';

    const tipoExibicao = (esc.tipo === 'SDP' ? 'EXTRAJORNADA' : (esc.tipo || 'REGULAR'));

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(esc.data)}</td>
        <td class="p-3 font-semibold text-slate-800">${nomeServidor}</td>
        <td class="p-3 text-slate-600 font-medium">${nomeUnidadeExibida}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
            ${tipoExibicao}
          </span>
        </td>
        <td class="p-3 font-mono text-slate-600">${esc.turno || '24h'}</td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.abrirModalEscala(null, '${esc.id}', '${esc.scope}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer">
            Editar
          </button>
          <button onclick="window.excluirEscalaIndividual('${esc.id}', '${esc.scope}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  if (parts.length < 3) return dataIso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

window.excluirEscalaIndividual = async function(escalaId, scope) {
  if (!confirm("Deseja realmente remover este lançamento de escala?")) return;

  appState.escalas = appState.escalas.filter(e => e.id !== escalaId);
  await syncDocToFirestore('escalas', escalaId, null, true);

  if (scope === 'CRF') window.filtrarTabelaCrfInline();
  else window.filtrarTabelaDelInline();
};

window.exportarEscalasCSV = function(scope) {
  let lista = [];
  if (scope === 'CRF') {
    const { mes, ano } = gestaoState.crf;
    lista = (appState.escalas || []).filter(e => {
      const [a, m] = e.data.split('-').map(Number);
      return a === ano && m === mes && e.scope === 'CRF';
    });
  } else {
    const { mes, ano, delegaciaId } = gestaoState.delegacia;
    lista = (appState.escalas || []).filter(e => {
      const [a, m] = e.data.split('-').map(Number);
      const bateuDel = delegaciaId === 'TODAS' || e.delegaciaId === delegaciaId;
      return a === ano && m === mes && e.scope === 'DELEGACIA' && bateuDel;
    });
  }

  if (lista.length === 0) {
    alert(`Nenhum lançamento encontrado para exportar nos filtros selecionados.`);
    return;
  }

  let csvContent = "DATA;PERIODO;EXTRAJORNADA;CARGO;NOME;DELEGACIA;SDP;TELEFONE\n";

  lista.forEach(esc => {
    const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const del = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);

    const data = esc.data;
    const periodo = esc.turno?.includes('(N)') ? 'NOTURNO' : 'DIURNO';
    const extra = (esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP') ? 'SIM' : 'NAO';
    const cargo = srv?.cargo || 'APJ';
    const nome = srv?.nome || 'NÃO LOCALIZADO';
    const delegacia = del?.nome || srv?.delegaciaNome || '';
    const sdp = del?.subdivisao || srv?.subdivisao || '8ª SDP';
    const telefone = srv?.telefone || '';

    csvContent += `${data};${periodo};${extra};${cargo};${nome};${delegacia};${sdp};${telefone}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `escalas_${scope.toLowerCase()}_gerencial.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
