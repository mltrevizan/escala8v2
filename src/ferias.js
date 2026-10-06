// src/ferias.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';

// Estado local para controle de ordenação e filtros da tabela
let ordenacaoAtual = { coluna: 'nome', asc: true };

export function renderFeriasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Extrai listas únicas de SDP e Delegacias para preencher os seletores
  const sdps = Array.from(new Set((appState.servidores || []).map(s => s.subdivisao).filter(Boolean))).sort();
  const delegacias = (appState.delegacias || []).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  let sdpOptionsHtml = `<option value="">Todas as SDPs</option>`;
  sdps.forEach(sdp => {
    sdpOptionsHtml += `<option value="${sdp}">${sdp}</option>`;
  });

  let delOptionsHtml = `<option value="">Todas as Delegacias</option>`;
  delegacias.forEach(d => {
    delOptionsHtml += `<option value="${d.id}">${d.nome}</option>`;
  });

  const html = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div>
        <h2 class="font-bold text-sm text-slate-800">Módulo de Férias e Licenças</h2>
        <p class="text-[11px] text-slate-500">Cadastro de afastamentos e monitoramento de conflitos de escala</p>
      </div>

      <!-- FORMULÁRIO DE CADASTRO COM FILTROS AVANÇADOS -->
      <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 class="font-bold text-xs text-indigo-900 border-b border-slate-100 pb-1">Novo Cadastramento de Afastamento</h3>
        
        <!-- Filtros do Formulário -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
          <div>
            <label class="block font-bold text-slate-600 text-[10px] uppercase mb-0.5">Filtrar Policial por Nome:</label>
            <input type="text" id="filtro-cad-busca" oninput="window.atualizarSelectServidoresCadastro()" 
                   placeholder="Digite o nome..." class="w-full border border-slate-300 rounded p-1 font-semibold text-slate-800 bg-white">
          </div>
          <div>
            <label class="block font-bold text-slate-600 text-[10px] uppercase mb-0.5">Filtrar por SDP:</label>
            <select id="filtro-cad-sdp" onchange="window.atualizarSelectServidoresCadastro()" class="w-full border border-slate-300 rounded p-1 font-semibold text-slate-800 bg-white">
              ${sdpOptionsHtml}
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-600 text-[10px] uppercase mb-0.5">Filtrar por Delegacia:</label>
            <select id="filtro-cad-delegacia" onchange="window.atualizarSelectServidoresCadastro()" class="w-full border border-slate-300 rounded p-1 font-semibold text-slate-800 bg-white">
              ${delOptionsHtml}
            </select>
          </div>
        </div>

        <form onsubmit="window.salvarFerias(event)" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
          <div class="md:col-span-2">
            <label class="block font-bold text-slate-700 mb-1">Policial / Servidor Selecionado:</label>
            <select id="ferias-servidor-id" required class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
              <!-- Opções carregadas via JS -->
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Tipo de Afastamento:</label>
            <select id="ferias-tipo" required class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
              <option value="Férias">Férias</option>
              <option value="Licença Prêmio">Licença Prêmio</option>
              <option value="Licença Médica">Licença Médica</option>
              <option value="Folga Compensatória">Folga Compensatória</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Data Início:</label>
            <input type="date" id="ferias-data-inicio" required class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Data Fim:</label>
            <input type="date" id="ferias-data-fim" required class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
          </div>

          <div class="md:col-span-5 flex justify-end pt-1">
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition">
              ➕ Cadastrar Afastamento
            </button>
          </div>
        </form>
      </div>

      <!-- ÁREA DE LISTAGEM COM FILTROS DE PESQUISA -->
      <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <h3 class="font-bold text-xs text-slate-800">Registros Cadastrados</h3>
          
          <!-- Filtros da Tabela -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs w-full md:w-auto">
            <input type="text" id="filtro-tabela-busca" oninput="window.renderTabelaFerias()" 
                   placeholder="🔍 Pesquisar na tabela..." class="border border-slate-300 rounded p-1 text-slate-800">
            <select id="filtro-tabela-sdp" onchange="window.renderTabelaFerias()" class="border border-slate-300 rounded p-1 text-slate-800">
              ${sdpOptionsHtml}
            </select>
            <select id="filtro-tabela-delegacia" onchange="window.renderTabelaFerias()" class="border border-slate-300 rounded p-1 text-slate-800">
              ${delOptionsHtml}
            </select>
          </div>
        </div>

        <!-- Tabela com Ordenação nas Colunas -->
        <div class="overflow-x-auto font-sans">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <th class="p-3 cursor-pointer hover:bg-slate-200 transition" onclick="window.alternarOrdenacaoFerias('nome')">
                  Servidor / Policial <span id="sort-icon-nome">▲</span>
                </th>
                <th class="p-3 cursor-pointer hover:bg-slate-200 transition" onclick="window.alternarOrdenacaoFerias('cargo')">
                  Cargo <span id="sort-icon-cargo"></span>
                </th>
                <th class="p-3 cursor-pointer hover:bg-slate-200 transition" onclick="window.alternarOrdenacaoFerias('tipo')">
                  Afastamento <span id="sort-icon-tipo"></span>
                </th>
                <th class="p-3 cursor-pointer hover:bg-slate-200 transition" onclick="window.alternarOrdenacaoFerias('dataInicio')">
                  Data Início <span id="sort-icon-dataInicio"></span>
                </th>
                <th class="p-3 cursor-pointer hover:bg-slate-200 transition" onclick="window.alternarOrdenacaoFerias('dataFim')">
                  Data Fim <span id="sort-icon-dataFim"></span>
                </th>
                <th class="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="tabela-ferias-corpo" class="divide-y divide-slate-200"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  window.atualizarSelectServidoresCadastro();
  window.renderTabelaFerias();
}

/**
  Filtra dinamicamente as opções de servidores no formulário de cadastro
 */
window.atualizarSelectServidoresCadastro = function() {
  const select = document.getElementById('ferias-servidor-id');
  if (!select) return;

  const termoBusca = (document.getElementById('filtro-cad-busca')?.value || '').toLowerCase();
  const sdpFiltro = document.getElementById('filtro-cad-sdp')?.value || '';
  const delegaciaFiltro = document.getElementById('filtro-cad-delegacia')?.value || '';

  const servidoresFiltrados = (appState.servidores || []).filter(s => {
    const atendeNome = !termoBusca || (s.nome || '').toLowerCase().includes(termoBusca);
    const atendeSdp = !sdpFiltro || s.subdivisao === sdpFiltro;
    const atendeDel = !delegaciaFiltro || s.delegaciaId === delegaciaFiltro;
    return atendeNome && atendeSdp && atendeDel;
  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  let srvOptions = `<option value="">Selecione o Servidor (${servidoresFiltrados.length} encontrados)...</option>`;
  servidoresFiltrados.forEach(s => {
    srvOptions += `<option value="${s.id}">${s.nome} (${s.cargo || 'APJ'})</option>`;
  });

  select.innerHTML = srvOptions;
};

/**
 * Renderiza a tabela aplicando busca, filtros de SDP/Delegacia e ordenação por coluna
 */
window.renderTabelaFerias = function() {
  const tbody = document.getElementById('tabela-ferias-corpo');
  if (!tbody) return;

  const termoBusca = (document.getElementById('filtro-tabela-busca')?.value || '').toLowerCase();
  const sdpFiltro = document.getElementById('filtro-tabela-sdp')?.value || '';
  const delegaciaFiltro = document.getElementById('filtro-tabela-delegacia')?.value || '';

  let listaFerias = (appState.ferias || []).slice();

  // Mapeia dados do servidor para cada registro
  let listaCompletada = listaFerias.map(fer => {
    const srv = (appState.servidores || []).find(s => s.id === fer.servidorId) || {};
    return {
      ...fer,
      servidorNome: srv.nome || 'Servidor Não Encontrado',
      cargo: srv.cargo || 'APJ',
      subdivisao: srv.subdivisao || '',
      delegaciaId: srv.delegaciaId || ''
    };
  });

  // Filtros aplicados
  listaCompletada = listaCompletada.filter(f => {
    const atendeBusca = !termoBusca || 
      f.servidorNome.toLowerCase().includes(termoBusca) || 
      f.cargo.toLowerCase().includes(termoBusca) ||
      (f.tipo || '').toLowerCase().includes(termoBusca);
    const atendeSdp = !sdpFiltro || f.subdivisao === sdpFiltro;
    const atendeDel = !delegaciaFiltro || f.delegaciaId === delegaciaFiltro;

    return atendeBusca && atendeSdp && atendeDel;
  });

  // Ordenação
  const { coluna, asc } = ordenacaoAtual;
  listaCompletada.sort((a, b) => {
    let valA = a[coluna] || a.servidorNome || '';
    let valB = b[coluna] || b.servidorNome || '';

    if (coluna === 'nome') {
      valA = a.servidorNome;
      valB = b.servidorNome;
    }

    const comp = valA.toString().localeCompare(valB.toString());
    return asc ? comp : -comp;
  });

  if (listaCompletada.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Nenhum registro de férias ou licença localizado com os filtros aplicados.</td></tr>`;
    return;
  }

  tbody.innerHTML = listaCompletada.map(fer => {
    const escalasEmConflito = (appState.escalas || []).filter(e => {
      return e.servidorId === fer.servidorId && e.data >= fer.dataInicio && e.data <= fer.dataFim;
    });

    const temConflito = escalasEmConflito.length > 0;
    const idsConflitoStr = escalasEmConflito.map(e => e.id).join(',');

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
        <td class="p-3 font-bold text-slate-800">
          <div class="flex items-center gap-2">
            <span>${fer.servidorNome}</span>
            ${temConflito ? `
              <button type="button" onclick="window.exibirDetalhesConflitoFerias('${fer.servidorNome}', '${idsConflitoStr}')" 
                      class="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-extrabold text-[10px] rounded-full shadow-xs cursor-pointer flex items-center gap-1 transition">
                <span>⚠️</span> ${escalasEmConflito.length} Plantão(ões) Marcado(s)
              </button>
            ` : ''}
          </div>
        </td>
        <td class="p-3 text-slate-600 font-medium">${fer.cargo}</td>
        <td class="p-3 font-bold text-indigo-900">${fer.tipo || 'Férias'}</td>
        <td class="p-3 font-mono text-slate-700">${formatarDataBr(fer.dataInicio)}</td>
        <td class="p-3 font-mono text-slate-700">${formatarDataBr(fer.dataFim)}</td>
        <td class="p-3 text-right">
          <button onclick="window.excluirFerias('${fer.id}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] shadow-xs cursor-pointer">Excluir</button>
        </td>
      </tr>
    `;
  }).join('');
};

/**
 * Alterna a coluna e a direção da ordenação na tabela
 */
window.alternarOrdenacaoFerias = function(coluna) {
  if (ordenacaoAtual.coluna === coluna) {
    ordenacaoAtual.asc = !ordenacaoAtual.asc;
  } else {
    ordenacaoAtual.coluna = coluna;
    ordenacaoAtual.asc = true;
  }

  // Atualiza os ícones das colunas
  ['nome', 'cargo', 'tipo', 'dataInicio', 'dataFim'].forEach(col => {
    const iconEl = document.getElementById(`sort-icon-${col}`);
    if (iconEl) {
      if (col === ordenacaoAtual.coluna) {
        iconEl.innerText = ordenacaoAtual.asc ? '▲' : '▼';
      } else {
        iconEl.innerText = '';
      }
    }
  });

  window.renderTabelaFerias();
};

window.salvarFerias = async function(e) {
  e.preventDefault();

  const servidorId = document.getElementById('ferias-servidor-id').value;
  const tipo = document.getElementById('ferias-tipo').value;
  const dataInicio = document.getElementById('ferias-data-inicio').value;
  const dataFim = document.getElementById('ferias-data-fim').value;

  if (!servidorId) {
    alert("Por favor, selecione um policial/servidor.");
    return;
  }

  if (dataFim < dataInicio) {
    alert("A data final não pode ser anterior à data inicial.");
    return;
  }

  const newFerId = 'fer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const novoAfastamento = {
    id: newFerId,
    servidorId: servidorId,
    tipo: tipo,
    dataInicio: dataInicio,
    dataFim: dataFim
  };

  if (!appState.ferias) appState.ferias = [];
  appState.ferias.push(novoAfastamento);

  await syncDocToFirestore('ferias', newFerId, novoAfastamento);

  alert("Afastamento cadastrado com sucesso!");
  window.renderTabelaFerias();
};

window.excluirFerias = async function(id) {
  if (!confirm("Deseja realmente remover este registro de afastamento?")) return;

  appState.ferias = (appState.ferias || []).filter(f => f.id !== id);
  await syncDocToFirestore('ferias', id, null, true);

  window.renderTabelaFerias();
};

window.exibirDetalhesConflitoFerias = function(nomeServidor, idsEscalasStr) {
  const ids = idsEscalasStr.split(',').filter(Boolean);
  const escalas = (appState.escalas || []).filter(e => ids.includes(e.id));

  let detalheMsg = `⚠️ DATAS EM CONFLITO DE AFASTAMENTO\n\nPolicial: ${nomeServidor}\n\nEste servidor possui os seguintes lançamentos agendados durante seu afastamento:\n\n`;

  escalas.forEach(esc => {
    const del = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);
    detalheMsg += `• Data: ${formatarDataBr(esc.data)} | Tipo: ${esc.tipo || 'PLANTÃO'} | Unidade: ${del ? del.nome : 'Unidade Local'}\n`;
  });

  alert(detalheMsg);
};

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}
