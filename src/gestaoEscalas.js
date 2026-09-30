// src/gestaoEscalas.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';

export function renderGestaoEscalasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentYear, currentMonth } = appState;
  
  // Filtros aplicados na visualização
  const escopoFiltro = document.getElementById('filtro-gestao-escopo')?.value || 'TODOS';
  const buscaPolicial = document.getElementById('filtro-gestao-busca')?.value?.toLowerCase() || '';

  // Filtra as escalas do mês/ano selecionado ou do escopo escolhido
  const escalasFiltradas = appState.escalas.filter(esc => {
    const [ano, mes] = esc.data.split('-').map(Number);
    if (ano !== currentYear || mes !== currentMonth + 1) return false;
    
    if (escopoFiltro !== 'TODOS' && esc.scope !== escopoFiltro) return false;

    if (buscaPolicial) {
      const srv = appState.servidores.find(s => s.id === esc.servidorId);
      const nomeSrv = srv ? srv.nome.toLowerCase() : '';
      if (!nomeSrv.includes(buscaPolicial)) return false;
    }

    return true;
  });

  let html = `
    <!-- Painel Superior de Ações e Filtros -->
    <div class="p-4 bg-slate-50 border-b space-y-3">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Painel Geral de Gestão de Escalas</h2>
          <p class="text-[11px] text-slate-500">Lançamentos em lote, automações de réplica e exportação de relatórios</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.abrirModalEscala(null, null)" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition">
            ➕ Novo Plantão Individual
          </button>
          <button onclick="window.abrirModalGeradorLote()" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition">
            ⚡ Gerar Escala em Lote
          </button>
          <button onclick="window.exportarEscalasCSV()" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition">
            📊 Exportar CSV
          </button>
        </div>
      </div>

      <!-- Barra de Filtros Rápidos -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">Filtrar por Escopo:</label>
          <select id="filtro-gestao-escopo" onchange="window.atualizarPainelGestao()" class="w-full text-xs border rounded-lg p-1.5 bg-white font-semibold">
            <option value="TODOS" ${escopoFiltro === 'TODOS' ? 'selected' : ''}>Todos os Escopos (CRF + Delegacias)</option>
            <option value="CRF" ${escopoFiltro === 'CRF' ? 'selected' : ''}>Apenas CRF & Extrajornada (SDP)</option>
            <option value="DELEGACIA" ${escopoFiltro === 'DELEGACIA' ? 'selected' : ''}>Apenas Plantões por Delegacia</option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">Buscar Policial:</label>
          <input type="text" id="filtro-gestao-busca" value="${buscaPolicial}" oninput="window.atualizarPainelGestao()" placeholder="Digite o nome..." class="w-full text-xs border rounded-lg p-1.5 bg-white font-medium">
        </div>

        <div class="flex items-end justify-end">
          <span class="text-xs font-bold text-slate-600 bg-slate-200/70 px-3 py-1.5 rounded-lg border font-mono w-full text-center sm:w-auto">
            Total no Mês: ${escalasFiltradas.length} Plantões
          </span>
        </div>
      </div>
    </div>

    <!-- Tabela Gerencial de Escalados -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b font-bold uppercase tracking-wider">
            <th class="p-3">Data</th>
            <th class="p-3">Policial / Servidor</th>
            <th class="p-3">Escopo / Unidade</th>
            <th class="p-3">Tipo de Plantão</th>
            <th class="p-3">Turno</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
  `;

  if (escalasFiltradas.length === 0) {
    html += `
      <tr>
        <td colspan="6" class="p-6 text-center text-slate-500 italic">
          Nenhum plantão localizado para os filtros selecionados neste mês.
        </td>
      </tr>
    `;
  } else {
    // Ordena por data
    escalasFiltradas.sort((a, b) => a.data.localeCompare(b.data));

    escalasFiltradas.forEach(esc => {
      const servidor = appState.servidores.find(s => s.id === esc.servidorId);
      const delegacia = appState.delegacias.find(d => d.id === esc.delegaciaId);

      const nomeServidor = servidor ? `${servidor.nome} (${servidor.cargo})` : 'Não Localizado';
      const nomeUnidade = delegacia ? delegacia.nome : 'CRF Geral';

      const isExtraOuSobreaviso = esc.tipo === 'SDP' || esc.tipo === 'SOBREAVISO';
      const badgeClass = isExtraOuSobreaviso ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-indigo-50 text-indigo-900 border-indigo-200';

      html += `
        <tr class="hover:bg-slate-50 transition">
          <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(esc.data)}</td>
          <td class="p-3 font-semibold text-slate-800">${nomeServidor}</td>
          <td class="p-3 text-slate-600">${nomeUnidade}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
              ${esc.tipo}
            </span>
          </td>
          <td class="p-3 font-mono text-slate-600">${esc.turno || '24h'}</td>
          <td class="p-3 text-right space-x-1">
            <button onclick="window.abrirModalEscala(null, '${esc.id}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow">
              Editar
            </button>
            <button onclick="window.excluirEscalaGestao('${esc.id}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow">
              Excluir
            </button>
          </td>
        </tr>
      `;
    });
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function formatarDataBr(dataIso) {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

window.atualizarPainelGestao = function() {
  renderGestaoEscalasModule('gestao-escalas-container');
};

// Exclusão rápida pelo painel
window.excluirEscalaGestao = async function(escalaId) {
  if (!confirm("Deseja realmente remover este lançamento de escala?")) return;

  appState.escalas = appState.escalas.filter(e => e.id !== escalaId);
  await syncDocToFirestore('escalas', escalaId, null, true);

  window.atualizarPainelGestao();
};

// Exportar escalas filtradas para CSV
window.exportarEscalasCSV = function() {
  const { currentYear, currentMonth } = appState;
  const escalasDoMes = appState.escalas.filter(esc => {
    const [ano, mes] = esc.data.split('-').map(Number);
    return ano === currentYear && mes === currentMonth + 1;
  });

  if (escalasDoMes.length === 0) {
    alert("Não há escalas registradas neste mês para exportar.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,Data;Policial;Cargo;Escopo;Unidade;Tipo;Turno\n";

  escalasDoMes.forEach(esc => {
    const srv = appState.servidores.find(s => s.id === esc.servidorId);
    const del = appState.delegacias.find(d => d.id === esc.delegaciaId);

    const dataFormatted = formatarDataBr(esc.data);
    const nomeSrv = srv ? srv.nome : 'POLICIAL';
    const cargoSrv = srv ? srv.cargo : 'AGENTE';
    const nomeDel = del ? del.nome : 'CRF';

    csvContent += `${dataFormatted};"${nomeSrv}";"${cargoSrv}";"${esc.scope}";"${nomeDel}";"${esc.tipo}";"${esc.turno || '24h'}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Escala_8CRF_${currentMonth + 1}_${currentYear}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
