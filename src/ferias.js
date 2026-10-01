// src/ferias.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore, fetchCollection } from './db.js';

export async function renderFeriasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Busca do banco apenas se o appState de ferias ainda não tiver sido populado
  if (!appState.ferias || appState.ferias.length === 0) {
    try {
      const doBanco = await fetchCollection('ferias');
      appState.ferias = doBanco || [];
    } catch (e) {
      console.error("Erro ao carregar férias:", e);
      appState.ferias = appState.ferias || [];
    }
  }

  let html = `
    <!-- Cabeçalho de Controle e Ações -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão de Férias e Licenças</h2>
          <p class="text-[11px] text-slate-500">Controle de afastamentos regulamentares, licenças especiais e médicas do efetivo</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.abrirModalFerias()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ➕ Novo Lançamento de Férias/Licença
          </button>
          <button onclick="window.exportarFeriasCSV()" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            📊 Exportar CSV
          </button>
        </div>
      </div>

      <!-- Barra de Filtros em Tempo Real -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔍 Busca Rápida (Nome / Cargo):</label>
          <input type="text" id="filtro-ferias-busca" oninput="window.filtrarTabelaFeriasInline()" placeholder="Digite para filtrar..." class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🏷️️ Tipo de Afastamento:</label>
          <select id="filtro-ferias-tipo" onchange="window.filtrarTabelaFeriasInline()" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-bold text-slate-800">
            <option value="TODOS">Todos os Tipos</option>
            <option value="FERIAS">Férias Regulamentares</option>
            <option value="LICENCA_ESPECIAL">Licença Especial</option>
            <option value="LICENCA_MEDICA">Licença Médica</option>
            <option value="FOLGA">Folga Compensatória</option>
          </select>
        </div>

        <div class="flex items-end justify-end">
          <span id="total-ferias-count" class="text-xs font-bold text-slate-700 bg-slate-200/80 px-3 py-2 rounded-lg border font-mono w-full sm:w-auto text-center">
            Exibindo 0 Afastamentos
          </span>
        </div>
      </div>
    </div>

    <!-- Tabela Gerencial de Férias -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse font-sans">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Servidor / Policial</th>
            <th class="p-3">Lotação / Unidade</th>
            <th class="p-3">Tipo de Afastamento</th>
            <th class="p-3">Período (Início ➔ Fim)</th>
            <th class="p-3">Duração</th>
            <th class="p-3">Observações / Portaria</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-ferias-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  window.filtrarTabelaFeriasInline();
}

window.filtrarTabelaFeriasInline = function() {
  const tbody = document.getElementById('tabela-ferias-corpo');
  if (!tbody) return;

  const busca = document.getElementById('filtro-ferias-busca')?.value?.toLowerCase() || '';
  const tipoFiltro = document.getElementById('filtro-ferias-tipo')?.value || 'TODOS';

  const listaFiltrada = (appState.ferias || []).filter(f => {
    const srv = (appState.servidores || []).find(s => s.id === f.servidorId);
    
    if (busca) {
      const nomeSrv = (srv?.nome || '').toLowerCase();
      const cargoSrv = (srv?.cargo || '').toLowerCase();
      if (!nomeSrv.includes(busca) && !cargoSrv.includes(busca)) return false;
    }

    if (tipoFiltro !== 'TODOS' && f.tipo !== tipoFiltro) return false;

    return true;
  });

  listaFiltrada.sort((a, b) => (b.dataInicio || '').localeCompare(a.dataInicio || ''));

  const countEl = document.getElementById('total-ferias-count');
  if (countEl) countEl.innerText = `Exibindo ${listaFiltrada.length} Afastamentos`;

  if (listaFiltrada.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-6 text-center text-slate-500 italic">
          Nenhum registro de férias ou licença localizado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = listaFiltrada.map(f => {
    const srv = (appState.servidores || []).find(s => s.id === f.servidorId);
    const del = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);

    const dias = calcularDiferencaDias(f.dataInicio, f.dataFim);

    let badgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300';
    let rotuloTipo = 'FÉRIAS REGULAMENTARES';

    if (f.tipo === 'LICENCA_ESPECIAL') {
      badgeClass = 'bg-purple-100 text-purple-900 border-purple-300';
      rotuloTipo = 'LICENÇA ESPECIAL';
    } else if (f.tipo === 'LICENCA_MEDICA') {
      badgeClass = 'bg-rose-100 text-rose-900 border-rose-300';
      rotuloTipo = 'LICENÇA MÉDICA';
    } else if (f.tipo === 'FOLGA') {
      badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
      rotuloTipo = 'FOLGA COMPENSATÓRIA';
    }

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-bold text-slate-900">${srv ? srv.nome : 'Não Localizado'} <span class="text-[10px] text-slate-500 block font-normal">${srv?.cargo || 'APJ'}</span></td>
        <td class="p-3 text-slate-700 font-medium">${del ? del.nome : (srv?.delegaciaNome || '-')}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
            ${rotuloTipo}
          </span>
        </td>
        <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(f.dataInicio)} ➔ ${formatarDataBr(f.dataFim)}</td>
        <td class="p-3 font-mono text-slate-700 font-bold">${dias} dias</td>
        <td class="p-3 text-slate-500 italic max-w-xs truncate">${f.observacao || '-'}</td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.abrirModalFerias('${f.id}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-xs transition cursor-pointer">
            Editar
          </button>
          <button onclick="window.excluirFerias('${f.id}')" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-xs transition cursor-pointer">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

window.abrirModalFerias = function(feriasId = null) {
  const modalAntigo = document.getElementById('modal-ferias');
  if (modalAntigo) modalAntigo.remove();

  criarModalFeriasDOM();
  const modal = document.getElementById('modal-ferias');

  const inputId = document.getElementById('modal-fer-id');
  const selectSrv = document.getElementById('modal-fer-servidor');
  const selectTipo = document.getElementById('modal-fer-tipo');
  const inputInicio = document.getElementById('modal-fer-inicio');
  const inputFim = document.getElementById('modal-fer-fim');
  const inputObs = document.getElementById('modal-fer-obs');

  const listaSrv = (appState.servidores || [])
    .filter(s => {
      const n = normalizeText(s.nome || '');
      return n !== 'administrador do sistema' && n !== 'admin';
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  let srvOptions = listaSrv.map(s => `<option value="${s.id}">${s.nome} (${s.cargo})</option>`).join('');
  if (selectSrv) selectSrv.innerHTML = srvOptions;

  if (feriasId) {
    const f = (appState.ferias || []).find(x => x.id === feriasId);
    if (f) {
      inputId.value = f.id;
      selectSrv.value = f.servidorId;
      selectTipo.value = f.tipo || 'FERIAS';
      inputInicio.value = f.dataInicio;
      inputFim.value = f.dataFim;
      inputObs.value = f.observacao || '';
    }
  } else {
    inputId.value = '';
    selectTipo.value = 'FERIAS';
    inputInicio.value = '';
    inputFim.value = '';
    inputObs.value = '';
  }

  modal.classList.remove('hidden');
};

window.fecharModalFerias = function() {
  document.getElementById('modal-ferias')?.classList.add('hidden');
};

window.salvarFeriasModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('modal-fer-id').value;
  const servidorId = document.getElementById('modal-fer-servidor').value;
  const tipo = document.getElementById('modal-fer-tipo').value;
  const dataInicio = document.getElementById('modal-fer-inicio').value;
  const dataFim = document.getElementById('modal-fer-fim').value;
  const observacao = document.getElementById('modal-fer-obs').value.trim();

  if (!servidorId || !dataInicio || !dataFim) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  if (dataFim < dataInicio) {
    alert("A data final não pode ser anterior à data de início.");
    return;
  }

  if (id) {
    const f = (appState.ferias || []).find(x => x.id === id);
    if (f) {
      f.servidorId = servidorId;
      f.tipo = tipo;
      f.dataInicio = dataInicio;
      f.dataFim = dataFim;
      f.observacao = observacao;

      await syncDocToFirestore('ferias', f.id, f);
    }
  } else {
    const newId = 'fer_' + Date.now();
    const novoRegistro = {
      id: newId,
      servidorId,
      tipo,
      dataInicio,
      dataFim,
      observacao,
      criadoEm: new Date().toISOString()
    };

    if (!appState.ferias) appState.ferias = [];
    appState.ferias.push(novoRegistro);

    await syncDocToFirestore('ferias', newId, novoRegistro);
  }

  window.fecharModalFerias();
  renderFeriasModule('ferias-container');
};

window.excluirFerias = async function(feriasId) {
  if (!confirm("Deseja realmente EXCLUIR este registro de afastamento?")) return;

  appState.ferias = appState.ferias.filter(f => f.id !== feriasId);
  await syncDocToFirestore('ferias', feriasId, null, true);

  renderFeriasModule('ferias-container');
};

window.exportarFeriasCSV = function() {
  const lista = appState.ferias || [];
  if (lista.length === 0) {
    alert("Nenhum registro de férias/licença cadastrado para exportar.");
    return;
  }

  let csvContent = "NOME;CARGO;LOTACAO;TIPO;DATA_INICIO;DATA_FIM;DIAS;OBSERVACAO\n";

  lista.forEach(f => {
    const srv = (appState.servidores || []).find(s => s.id === f.servidorId);
    const del = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);

    const nome = srv?.nome || 'NÃO LOCALIZADO';
    const cargo = srv?.cargo || 'APJ';
    const lotacao = del?.nome || srv?.delegaciaNome || '';
    const dias = calcularDiferencaDias(f.dataInicio, f.dataFim);

    csvContent += `${nome};${cargo};${lotacao};${f.tipo};${f.dataInicio};${f.dataFim};${dias};"${f.observacao || ''}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `ferias_licencas_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function calcularDiferencaDias(d1Str, d2Str) {
  if (!d1Str || !d2Str) return 0;
  const d1 = new Date(d1Str + 'T00:00:00');
  const d2 = new Date(d2Str + 'T00:00:00');
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  if (parts.length < 3) return dataIso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function criarModalFeriasDOM() {
  const modalHTML = `
    <div id="modal-ferias" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-slate-900 text-sm">Lançamento de Férias / Licença</h3>
          <button type="button" onclick="window.fecharModalFerias()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarFeriasModal(event)" class="space-y-3 text-xs">
          <input type="hidden" id="modal-fer-id">

          <div>
            <label class="block font-bold text-slate-700 mb-1">Servidor / Policial:</label>
            <select id="modal-fer-servidor" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Tipo de Afastamento:</label>
            <select id="modal-fer-tipo" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
              <option value="FERIAS">Férias Regulamentares</option>
              <option value="LICENCA_ESPECIAL">Licença Especial</option>
              <option value="LICENCA_MEDICA">Licença Médica</option>
              <option value="FOLGA">Folga Compensatória</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Data Inicial:</label>
              <input type="date" id="modal-fer-inicio" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Data Final:</label>
              <input type="date" id="modal-fer-fim" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Observações / Número da Portaria:</label>
            <input type="text" id="modal-fer-obs" placeholder="Ex: Portaria nº 045/2026" class="w-full border rounded-xl p-2 bg-slate-50 font-medium">
          </div>

          <div class="pt-3 border-t flex justify-end gap-2">
            <button type="button" onclick="window.fecharModalFerias()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">Salvar Afastamento</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
