// src/gestaoEscalas.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';

export function renderGestaoEscalasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentYear, currentMonth } = appState;
  
  const escopoFiltro = document.getElementById('filtro-gestao-escopo')?.value || 'TODOS';
  const buscaPolicial = document.getElementById('filtro-gestao-busca')?.value?.toLowerCase() || '';

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
    <div class="p-4 bg-slate-50 border-b space-y-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Painel de Gestão de Escalas & Automação</h2>
          <p class="text-[11px] text-slate-500">Lançamentos em lote, importação/exportação CSV e parametrização de turnos</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.abrirModalEscala(null, null)" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition">
            ➕ Novo Plantão Individual
          </button>
          <button onclick="window.abrirModalGeradorLote()" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition">
            ⚡ Gerar Escala em Lote
          </button>
          <label class="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow flex items-center gap-1">
            <span>📥 Importar Escalas CSV</span>
            <input type="file" id="csv-escalas-input" accept=".csv" class="hidden" onchange="window.importarEscalasCSV(event)">
          </label>
          <button onclick="window.exportarEscalasCSV()" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition">
            📊 Exportar CSV
          </button>
        </div>
      </div>

      <!-- Configuração de Horários Padrão (Parametrização) -->
      <div class="bg-white p-3 rounded-xl border space-y-2">
        <span class="text-xs font-bold text-slate-800 block">⏰ Parametrização de Horários Padrão de Trabalho:</span>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border">
            <span class="font-bold text-indigo-700">Turno Integral (24h):</span>
            <input type="text" id="horario-24h" value="08:00 às 08:00 (Próx. Dia)" class="border rounded px-2 py-1 font-mono text-[11px] w-full" readonly>
          </div>
          <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border">
            <span class="font-bold text-amber-700">Diurno (12h D):</span>
            <input type="text" id="horario-12d" value="08:00 às 20:00" class="border rounded px-2 py-1 font-mono text-[11px] w-full" readonly>
          </div>
          <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border">
            <span class="font-bold text-purple-700">Noturno (12h N):</span>
            <input type="text" id="horario-12n" value="20:00 às 08:00" class="border rounded px-2 py-1 font-mono text-[11px] w-full" readonly>
          </div>
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

        <div class="flex items-end justify-between sm:justify-end gap-2">
          <button onclick="window.limparEscalasDoMes()" class="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-lg border border-red-300 shadow-sm transition">
            🗑️ Limpar Mês
          </button>
          <span class="text-xs font-bold text-slate-600 bg-slate-200/70 px-3 py-1.5 rounded-lg border font-mono">
            Total no Mês: ${escalasFiltradas.length} Plantões
          </span>
        </div>
      </div>
    </div>

    <!-- Tabela Gerencial -->
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
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  if (parts.length < 3) return dataIso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

window.atualizarPainelGestao = function() {
  renderGestaoEscalasModule('gestao-escalas-container');
};

window.excluirEscalaGestao = async function(escalaId) {
  if (!confirm("Deseja realmente remover este lançamento de escala?")) return;

  appState.escalas = appState.escalas.filter(e => e.id !== escalaId);
  await syncDocToFirestore('escalas', escalaId, null, true);

  window.atualizarPainelGestao();
};

window.limparEscalasDoMes = async function() {
  const { currentYear, currentMonth } = appState;
  if (!confirm(`TEM CERTEZA? Isso excluirá TODOS os plantões do mês ${currentMonth + 1}/${currentYear} do sistema!`)) return;

  const aRemover = appState.escalas.filter(esc => {
    const [ano, mes] = esc.data.split('-').map(Number);
    return ano === currentYear && mes === currentMonth + 1;
  });

  for (const esc of aRemover) {
    appState.escalas = appState.escalas.filter(e => e.id !== esc.id);
    await syncDocToFirestore('escalas', esc.id, null, true);
  }

  alert("Mês limpo com sucesso!");
  window.atualizarPainelGestao();
};

// Importar Escalas via CSV
window.importarEscalasCSV = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) throw new Error("Arquivo CSV inválido ou vazio.");

      const delimiter = lines[0].includes(';') ? ';' : ',';
      let importados = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map(c => c.replace(/"/g, '').trim());
        if (cols.length < 3) continue;

        // Formato esperado: Data(YYYY-MM-DD ou DD/MM/YYYY); PolicialLoginOuNome; DelegaciaNome; Tipo; Turno; Escopo
        let rawData = cols[0];
        let dataIso = rawData;
        if (rawData.includes('/')) {
          const [d, m, a] = rawData.split('/');
          dataIso = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        const termoPolicial = cols[1]?.toLowerCase();
        const servidor = appState.servidores.find(s => 
          s.login?.toLowerCase() === termoPolicial || s.nome?.toLowerCase().includes(termoPolicial)
        );

        if (!servidor) continue;

        const termoDelegacia = cols[2]?.toLowerCase();
        const delegacia = appState.delegacias.find(d => 
          d.nome?.toLowerCase().includes(termoDelegacia)
        );

        const tipo = cols[3] || 'REGULAR';
        const turno = cols[4] || '24h';
        const scope = cols[5] || 'CRF';

        const newId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const novaEscala = {
          id: newId,
          data: dataIso,
          servidorId: servidor.id,
          delegaciaId: delegacia ? delegacia.id : (appState.delegacias[0]?.id || ''),
          tipo: tipo.toUpperCase(),
          turno: turno,
          scope: scope.toUpperCase(),
          sdpId: '8SDP'
        };

        appState.escalas.push(novaEscala);
        await syncDocToFirestore('escalas', novaEscala.id, novaEscala);
        importados++;
      }

      alert(`Sucesso! ${importados} escalas foram importadas do CSV.`);
      window.atualizarPainelGestao();
    } catch (err) {
      alert("Erro ao importar CSV de escalas: " + err.message);
    }
  };
  reader.readAsText(file);
};

// Exportar escalas para CSV
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
