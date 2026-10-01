// src/gestaoEscalas.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';

export function renderGestaoEscalasModule(containerId) {
  renderGestaoCrfModule(containerId);
}

// =========================================================================
// 1. GESTÃO DE ESCALAS CRF (Menu 1)
// =========================================================================
export function renderGestaoCrfModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = `
    <!-- Cabeçalho de Controle CRF -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão de Escalas CRF</h2>
          <p class="text-[11px] text-slate-500">Lançamentos em lote, importação de CSV da CRF e plantões da Central</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.abrirModalEscala(null, null, 'CRF')" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ➕ Novo Plantão CRF
          </button>
          <button onclick="window.abrirModalGeradorLote('CRF')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ⚡ Gerar em Lote
          </button>
          <label class="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-xs flex items-center gap-1">
            <span>📥 Importar CSV CRF</span>
            <input type="file" accept=".csv" class="hidden" onchange="window.importarEscalasCSV(event, 'CRF')">
          </label>
          <button onclick="window.exportarEscalasCSV('CRF')" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            📊 Exportar CSV
          </button>
        </div>
      </div>

      <!-- Parametrização Fixa CRF -->
      <div class="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 space-y-1.5">
        <span class="text-xs font-bold text-amber-900 block">⏰ Parametrização Oficial de Horários de Trabalho (CRF - Padrão Único):</span>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div class="bg-white p-2 rounded-lg border border-amber-200 text-slate-700">
            <span class="font-bold text-amber-800 block text-[10px] uppercase">Turno Diurno (12h D)</span>
            <span class="font-mono font-bold text-xs">07:30 às 19:30</span>
          </div>
          <div class="bg-white p-2 rounded-lg border border-indigo-200 text-slate-700">
            <span class="font-bold text-indigo-800 block text-[10px] uppercase">Turno Noturno (12h N)</span>
            <span class="font-mono font-bold text-xs">19:30 às 07:30</span>
          </div>
          <div class="bg-white p-2 rounded-lg border border-slate-200 text-slate-700">
            <span class="font-bold text-slate-800 block text-[10px] uppercase">Turno Integral (24h)</span>
            <span class="font-mono font-bold text-xs">07:30 às 07:30 (Próx. Dia)</span>
          </div>
        </div>
      </div>

      <!-- Barra de Filtro -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <div class="w-full sm:w-72">
          <input type="text" id="filtro-gestao-crf-busca" oninput="window.filtrarTabelaCrfInline()" placeholder="Buscar policial na CRF..." class="w-full text-xs border rounded-lg p-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button onclick="window.limparEscalasDoMes('CRF')" class="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-lg border border-red-300 transition cursor-pointer">
            🗑️ Limpar Mês CRF
          </button>
          <span id="total-crf-count" class="text-xs font-bold text-slate-700 bg-slate-200/80 px-3 py-1.5 rounded-lg border font-mono">
            Total CRF: 0 Plantões
          </span>
        </div>
      </div>
    </div>

    <!-- Tabela Gerencial CRF -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse font-sans">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Data</th>
            <th class="p-3">Policial / Servidor</th>
            <th class="p-3">Unidade / Lotação</th>
            <th class="p-3">Tipo de Plantão</th>
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

window.filtrarTabelaCrfInline = function() {
  const tbody = document.getElementById('tabela-crf-corpo');
  if (!tbody) return;

  const { currentYear, currentMonth } = appState;
  const busca = document.getElementById('filtro-gestao-crf-busca')?.value?.toLowerCase() || '';

  const escalasFiltradas = (appState.escalas || []).filter(esc => {
    if (!esc.data) return false;
    const [ano, mes] = esc.data.split('-').map(Number);
    if (ano !== currentYear || mes !== currentMonth + 1) return false;
    if (esc.scope !== 'CRF') return false;

    if (busca) {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      const nomeSrv = srv ? srv.nome.toLowerCase() : '';
      if (!nomeSrv.includes(busca)) return false;
    }
    return true;
  });

  const totalEl = document.getElementById('total-crf-count');
  if (totalEl) totalEl.innerText = `Total CRF: ${escalasFiltradas.length} Plantões`;

  tbody.innerHTML = renderLinhasTabela(escalasFiltradas);
};

// =========================================================================
// 2. GESTÃO DE ESCALAS POR DELEGACIAS (Menu 2)
// =========================================================================
export function renderGestaoDelegaciasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { selectedDelegaciaId } = appState;
  const delSelecionada = (appState.delegacias || []).find(d => d.id === selectedDelegaciaId) || (appState.delegacias || [])[0];

  let delegaciasOptions = (appState.delegacias || []).map(d => 
    `<option value="${d.id}" ${delSelecionada?.id === d.id ? 'selected' : ''}>${d.nome}</option>`
  ).join('');

  let html = `
    <!-- Cabeçalho de Controle Delegacias -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão de Escalas por Delegacia</h2>
          <p class="text-[11px] text-slate-500">Configuração individual de horário por unidade, escalas ordinárias e sobreavisos</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.abrirModalEscala(null, null, 'DELEGACIA')" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ➕ Novo Plantão Local
          </button>
          <button onclick="window.abrirModalGeradorLote('DELEGACIA')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ⚡ Gerar em Lote
          </button>
          <label class="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-xs flex items-center gap-1">
            <span>📥 Importar CSV Local</span>
            <input type="file" accept=".csv" class="hidden" onchange="window.importarEscalasCSV(event, 'DELEGACIA')">
          </label>
          <button onclick="window.exportarEscalasCSV('DELEGACIA')" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            📊 Exportar CSV
          </button>
        </div>
      </div>

      <!-- Seleção e Parametrização -->
      <div class="bg-sky-50/70 p-3 rounded-xl border border-sky-200 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-sky-950">🏢 Unidade / Delegacia Selecionada:</span>
            <select id="select-gestao-delegacia-ativa" onchange="window.mudarDelegaciaAtivaGestao(this.value)" class="text-xs font-bold bg-white border border-sky-300 rounded-lg p-1.5 text-slate-800">
              ${delegaciasOptions}
            </select>
          </div>
          <button onclick="window.salvarHorarioCustomizadoDelegacia('${delSelecionada?.id}')" class="px-3 py-1 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer">
            💾 Salvar Horários da Unidade
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="bg-white p-2 rounded-lg border border-sky-200 space-y-1">
            <label class="font-bold text-sky-900 block text-[11px]">⏰ Horário Padrão Plantão 24h / Integral:</label>
            <input type="text" id="horario-del-24h" value="${delSelecionada?.horario24h || '08:00 às 08:00'}" class="w-full border rounded px-2 py-1 font-mono text-xs bg-slate-50 font-bold">
          </div>
          <div class="bg-white p-2 rounded-lg border border-sky-200 space-y-1">
            <label class="font-bold text-sky-900 block text-[11px]">⏰ Horário Padrão Plantão 12h / Fracionado:</label>
            <input type="text" id="horario-del-12h" value="${delSelecionada?.horario12h || '08:00 às 20:00'}" class="w-full border rounded px-2 py-1 font-mono text-xs bg-slate-50 font-bold">
          </div>
        </div>
      </div>

      <!-- Barra de Filtros -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <div class="w-full sm:w-72">
          <input type="text" id="filtro-gestao-del-busca" oninput="window.filtrarTabelaDelInline()" placeholder="Buscar policial na unidade..." class="w-full text-xs border rounded-lg p-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button onclick="window.limparEscalasDoMes('DELEGACIA')" class="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-lg border border-red-300 transition cursor-pointer">
            🗑️ Limpar Mês Local
          </button>
          <span id="total-del-count" class="text-xs font-bold text-slate-700 bg-slate-200/80 px-3 py-1.5 rounded-lg border font-mono">
            Total Unidade: 0 Plantões
          </span>
        </div>
      </div>
    </div>

    <!-- Tabela Gerencial Delegacias -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse font-sans">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Data</th>
            <th class="p-3">Policial / Servidor</th>
            <th class="p-3">Unidade / Lotação</th>
            <th class="p-3">Tipo de Plantão</th>
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

window.filtrarTabelaDelInline = function() {
  const tbody = document.getElementById('tabela-del-corpo');
  if (!tbody) return;

  const { currentYear, currentMonth, selectedDelegaciaId } = appState;
  const busca = document.getElementById('filtro-gestao-del-busca')?.value?.toLowerCase() || '';

  const delSelecionada = (appState.delegacias || []).find(d => d.id === selectedDelegaciaId) || (appState.delegacias || [])[0];

  const escalasFiltradas = (appState.escalas || []).filter(esc => {
    if (!esc.data) return false;
    const [ano, mes] = esc.data.split('-').map(Number);
    if (ano !== currentYear || mes !== currentMonth + 1) return false;
    if (esc.scope !== 'DELEGACIA') return false;

    if (delSelecionada) {
      if (delSelecionada.delegaciasIds) {
        if (!delSelecionada.delegaciasIds.includes(esc.delegaciaId)) return false;
      } else if (esc.delegaciaId !== delSelecionada.id) {
        return false;
      }
    }

    if (busca) {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      const nomeSrv = srv ? srv.nome.toLowerCase() : '';
      if (!nomeSrv.includes(busca)) return false;
    }
    return true;
  });

  const totalEl = document.getElementById('total-del-count');
  if (totalEl) totalEl.innerText = `Total Unidade: ${escalasFiltradas.length} Plantões`;

  tbody.innerHTML = renderLinhasTabela(escalasFiltradas);
};

// =========================================================================
// 3. LEITOR INTELIGENTE DE CSV DE ESCALAS (COM PREVENÇÃO DE DUPLICATAS)
// =========================================================================
window.importarEscalasCSV = function(event, targetScope) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      const { importados, atualizados } = await processarCSVImportEscalas(text, targetScope);
      alert(`Sucesso no processamento de escalas (${targetScope})!\n- ${importados} novos plantões cadastrados.\n- ${atualizados} plantões existentes atualizados (sem duplicação).`);
      
      if (targetScope === 'CRF') window.filtrarTabelaCrfInline();
      else window.filtrarTabelaDelInline();
    } catch (err) {
      alert("Erro ao importar CSV de escalas: " + err.message);
    }
  };
  reader.readAsText(file);
};

export async function processarCSVImportEscalas(csvText, targetScope) {
  const lines = csvText.split(/\r?\n/);
  let importados = 0;
  let atualizados = 0;

  if (lines.length === 0) return { importados: 0, atualizados: 0 };

  const firstLine = lines[0].trim();
  const sep = firstLine.includes(';') ? ';' : ',';
  const headerParts = firstLine.split(sep).map(p => p.trim().toUpperCase().replace(/^"|"$/g, ''));

  // Detecta se é o formato 'export_gestao' (CRF) ou 'export_sobreaviso' (DELEGACIA)
  const isFormatoGestao = headerParts.includes('DATA') && headerParts.includes('PERIODO');
  const isFormatoSobreaviso = headerParts.includes('MODALIDADE') && headerParts.includes('INICIO');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(sep).map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 3) continue;

    let dataIso = '';
    let nomePolicial = '';
    let delegaciaNome = '';
    let tipoTurno = 'ORDINARIO';
    let turnoRotulo = '24h';
    let sdpNome = '';

    if (isFormatoGestao) {
      // Formato CRF: DATA, PERIODO, EXTRAJORNADA, CARGO, NOME, LOGIN, SDP, DELEGACIA, TELEFONE
      const idxData = headerParts.indexOf('DATA');
      const idxPeriodo = headerParts.indexOf('PERIODO');
      const idxExtra = headerParts.indexOf('EXTRAJORNADA');
      const idxNome = headerParts.indexOf('NOME');
      const idxDel = headerParts.indexOf('DELEGACIA');
      const idxSdp = headerParts.indexOf('SDP');

      dataIso = parts[idxData] || '';
      const periodo = (parts[idxPeriodo] || 'DIURNO').toUpperCase();
      const isExtra = (parts[idxExtra] || 'NAO').toUpperCase() === 'SIM';
      
      nomePolicial = parts[idxNome] || '';
      delegaciaNome = parts[idxDel] || '';
      sdpNome = parts[idxSdp] || '';

      tipoTurno = isExtra ? 'EXTRAJORNADA' : 'ORDINARIO';
      turnoRotulo = periodo.includes('NOTURNO') ? '12h (N)' : '12h (D)';

    } else if (isFormatoSobreaviso) {
      // Formato Sobreaviso / Local: MODALIDADE, DELEGACIA, INICIO, FIM, VIATURA, SERVIDORES
      const idxMod = headerParts.indexOf('MODALIDADE');
      const idxDel = headerParts.indexOf('DELEGACIA');
      const idxInicio = headerParts.indexOf('INICIO');
      const idxSrv = headerParts.indexOf('SERVIDORES');

      const modalidade = parts[idxMod] || 'PLANTONISTA';
      delegaciaNome = parts[idxDel] || '';
      const inicioRaw = parts[idxInicio] || '';
      nomePolicial = parts[idxSrv] || '';

      // Extrai data ISO YYYY-MM-DD
      dataIso = inicioRaw.split('T')[0] || inicioRaw.split(' ')[0] || '';
      tipoTurno = modalidade.toUpperCase().includes('SOBREAVISO') ? 'SOBREAVISO' : 'ORDINARIO';
      turnoRotulo = '24h';
    } else {
      // Formato genérico de contingência
      dataIso = parts[0];
      nomePolicial = parts[1];
      delegaciaNome = parts[2] || '';
    }

    if (!dataIso || !nomePolicial || normalizeText(nomePolicial) === 'nome') continue;

    // 1. Busca Policial no Cadastro
    let srvObj = (appState.servidores || []).find(s => normalizeText(s.nome) === normalizeText(nomePolicial));
    if (!srvObj) {
      // Se não existir, cadastra automaticamente o policial
      const newSrvId = 'srv_' + Date.now() + '_' + i;
      srvObj = {
        id: newSrvId,
        nome: nomePolicial,
        cargo: 'APJ',
        delegaciaNome: delegaciaNome,
        subdivisao: sdpNome || '8ª SDP',
        telefone: ''
      };
      if (!appState.servidores) appState.servidores = [];
      appState.servidores.push(srvObj);
      await syncDocToFirestore('servidores', newSrvId, srvObj);
    }

    // 2. Busca Delegacia no Cadastro
    let delObj = (appState.delegacias || []).find(d => normalizeText(d.nome) === normalizeText(delegaciaNome));
    if (!delObj && delegaciaNome) {
      const newDelId = 'del_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      delObj = {
        id: newDelId,
        nome: delegaciaNome,
        subdivisao: sdpNome || '8ª SDP',
        horario24h: '08:00 às 08:00',
        horario12h: '08:00 às 20:00',
        tipo: 'UNIDADE'
      };
      if (!appState.delegacias) appState.delegacias = [];
      appState.delegacias.push(delObj);
      await syncDocToFirestore('delegacias', newDelId, delObj);
    }

    // 3. PREVENÇÃO DE DUPLICATAS: Busca se este mesmo lançamento já existe no banco
    const escExistente = (appState.escalas || []).find(e => 
      e.data === dataIso &&
      e.servidorId === srvObj.id &&
      e.scope === targetScope &&
      e.turno === turnoRotulo
    );

    if (escExistente) {
      // Atualiza o registro pré-existente sem duplicar
      escExistente.delegaciaId = delObj ? delObj.id : (srvObj.delegaciaId || '');
      escExistente.tipo = tipoTurno;
      escExistente.sdpId = sdpNome;
      await syncDocToFirestore('escalas', escExistente.id, escExistente);
      atualizados++;
    } else {
      // Cria novo lançamento
      const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const novaEscala = {
        id: newEscId,
        data: dataIso,
        servidorId: srvObj.id,
        delegaciaId: delObj ? delObj.id : (srvObj.delegaciaId || ''),
        scope: targetScope,
        tipo: tipoTurno,
        turno: turnoRotulo,
        sdpId: sdpNome
      };

      if (!appState.escalas) appState.escalas = [];
      appState.escalas.push(novaEscala);
      await syncDocToFirestore('escalas', newEscId, novaEscala);
      importados++;
    }
  }

  return { importados, atualizados };
}

// Exportação de CSV
window.exportarEscalasCSV = function(scope) {
  const { currentYear, currentMonth } = appState;
  const lista = (appState.escalas || []).filter(esc => {
    if (!esc.data) return false;
    const [ano, mes] = esc.data.split('-').map(Number);
    return ano === currentYear && mes === currentMonth + 1 && esc.scope === scope;
  });

  if (lista.length === 0) {
    alert(`Nenhum lançamento encontrado para exportar no escopo ${scope} neste mês.`);
    return;
  }

  let csvContent = "DATA;PERIODO;EXTRAJORNADA;CARGO;NOME;DELEGACIA;SDP;TELEFONE\n";

  lista.forEach(esc => {
    const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const del = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);

    const data = esc.data;
    const periodo = esc.turno.includes('(N)') ? 'NOTURNO' : 'DIURNO';
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
  link.setAttribute("download", `escalas_${scope.toLowerCase()}_${currentYear}_${currentMonth + 1}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function renderLinhasTabela(listaEscalas) {
  if (listaEscalas.length === 0) {
    return `
      <tr>
        <td colspan="6" class="p-6 text-center text-slate-500 italic">
          Nenhum plantão localizado para este filtro neste mês.
        </td>
      </tr>
    `;
  }

  listaEscalas.sort((a, b) => a.data.localeCompare(b.data));

  return listaEscalas.map(esc => {
    const servidor = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const delegacia = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);

    const nomeServidor = servidor ? `${servidor.nome} (${servidor.cargo})` : 'Não Localizado';
    const nomeUnidade = delegacia ? delegacia.nome : 'CRF Geral';

    const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';

    let badgeClass = 'bg-indigo-50 text-indigo-900 border-indigo-200';
    if (isExtra) badgeClass = 'bg-purple-100 text-purple-900 border-purple-300 font-bold';

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(esc.data)}</td>
        <td class="p-3 font-semibold text-slate-800">${nomeServidor}</td>
        <td class="p-3 text-slate-600">${nomeUnidade}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
            ${isExtra ? 'EXTRAJORNADA' : esc.tipo}
          </span>
        </td>
        <td class="p-3 font-mono text-slate-600">${esc.turno || '24h'}</td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.abrirModalEscala(null, '${esc.id}', '${esc.scope}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer">
            Editar
          </button>
          <button onclick="window.excluirEscalaGestao('${esc.id}', '${esc.scope}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer">
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

window.atualizarPainelGestaoCrf = function() {
  window.filtrarTabelaCrfInline();
};

window.atualizarPainelGestaoDel = function() {
  window.filtrarTabelaDelInline();
};

window.mudarDelegaciaAtivaGestao = function(idDel) {
  appState.selectedDelegaciaId = idDel;
  renderGestaoDelegaciasModule('gestao-delegacias-container');
};

window.salvarHorarioCustomizadoDelegacia = async function(idDel) {
  const input24h = document.getElementById('horario-del-24h')?.value;
  const input12h = document.getElementById('horario-del-12h')?.value;

  const del = (appState.delegacias || []).find(d => d.id === idDel);
  if (del) {
    del.horario24h = input24h;
    del.horario12h = input12h;
    await syncDocToFirestore('delegacias', del.id, del);
    alert(`Horários padrão atualizados com sucesso para ${del.nome}!`);
  }
};

window.excluirEscalaGestao = async function(escalaId, scope) {
  if (!confirm("Deseja realmente remover este lançamento de escala?")) return;

  appState.escalas = appState.escalas.filter(e => e.id !== escalaId);
  await syncDocToFirestore('escalas', escalaId, null, true);

  if (scope === 'CRF') window.filtrarTabelaCrfInline();
  else window.filtrarTabelaDelInline();
};

window.limparEscalasDoMes = async function(scope) {
  const { currentYear, currentMonth } = appState;
  if (!confirm(`TEM CERTEZA? Isso excluirá TODOS os plantões do escopo ${scope} do mês ${currentMonth + 1}/${currentYear}!`)) return;

  const aRemover = (appState.escalas || []).filter(esc => {
    if (!esc.data) return false;
    const [ano, mes] = esc.data.split('-').map(Number);
    return ano === currentYear && mes === currentMonth + 1 && esc.scope === scope;
  });

  for (const esc of aRemover) {
    appState.escalas = appState.escalas.filter(e => e.id !== esc.id);
    await syncDocToFirestore('escalas', esc.id, null, true);
  }

  alert("Lançamentos do mês limpos com sucesso!");
  if (scope === 'CRF') window.filtrarTabelaCrfInline();
  else window.filtrarTabelaDelInline();
};
