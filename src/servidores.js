// src/servidores.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';

// Estado local de filtros e ordenação da tabela de servidores
const servidoresState = {
  busca: '',
  sdp: 'TODAS',
  delegaciaId: 'TODAS',
  cargo: 'TODOS',
  perfil: 'TODOS',
  sortColuna: 'NOME', // 'NOME', 'CARGO', 'DELEGACIA', 'SDP', 'PERFIL'
  sortDirecao: 'ASC'  // 'ASC' ou 'DESC'
};

export function renderServidoresTable(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const html = `
    <!-- Cabeçalho de Controle e Ações -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Cadastro Geral de Servidores / Policiais</h2>
          <p class="text-[11px] text-slate-500">Gestão de efetivo, cargos, contatos, perfis e lotações de origem</p>
        </div>
        <button onclick="window.abrirModalServidor()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
          ➕ Novo Servidor
        </button>
      </div>

      <!-- Barra de Filtros Múltiplos e Busca por Digitação -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-slate-200">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🔍 Busca Rápida:</label>
          <input type="text" id="filtro-srv-busca" oninput="window.atualizarFiltrosServidoresList()" placeholder="Nome, cargo ou telefone..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🏛️️ Subdivisão (SDP):</label>
          <select id="filtro-srv-sdp" onchange="window.aoMudarFiltroSdpServidores(this.value)" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            <!-- Popula dinamicamente -->
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🏢 Delegacia / Unidade:</label>
          <select id="filtro-srv-del" onchange="window.atualizarFiltrosServidoresList()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            <!-- Popula dinamicamente -->
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">👮 Cargo:</label>
          <select id="filtro-srv-cargo" onchange="window.atualizarFiltrosServidoresList()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            <!-- Popula dinamicamente -->
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🔑 Perfil de Acesso:</label>
          <select id="filtro-srv-perfil" onchange="window.atualizarFiltrosServidoresList()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            <option value="TODOS">Todos os Perfis</option>
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="GESTOR">Gestor de Unidade</option>
            <option value="VISUALIZADOR">Visualizador / Público</option>
          </select>
        </div>
      </div>

      <!-- Contador de Resultados -->
      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
        <span id="total-servidores-count" class="font-bold text-slate-700 bg-slate-200/80 px-2.5 py-0.5 rounded-md">
          Exibindo 0 Servidores
        </span>
        <span class="text-[10px] text-slate-400 italic">Dica: clique no cabeçalho das colunas da tabela para reordenar (A-Z)</span>
      </div>
    </div>

    <!-- Tabela Gerencial de Servidores -->
    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px] select-none">
            <th onclick="window.ordenarServidoresPorColuna('NOME')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Policial / Servidor <span id="sort-icon-NOME">⬆️</span>
            </th>
            <th onclick="window.ordenarServidoresPorColuna('CARGO')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Cargo <span id="sort-icon-CARGO"></span>
            </th>
            <th onclick="window.ordenarServidoresPorColuna('DELEGACIA')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Lotação de Origem <span id="sort-icon-DELEGACIA"></span>
            </th>
            <th onclick="window.ordenarServidoresPorColuna('SDP')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Subdivisão (SDP) <span id="sort-icon-SDP"></span>
            </th>
            <th onclick="window.ordenarServidoresPorColuna('PERFIL')" class="p-3 cursor-pointer hover:bg-slate-200 transition">
              Perfil <span id="sort-icon-PERFIL"></span>
            </th>
            <th class="p-3">Telefone</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-servidores-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  window.popularFiltrosIniciaisServidores();
  window.renderTabelaServidoresCorpo();
}

window.popularFiltrosIniciaisServidores = function() {
  // Popula SDPs
  const selectSdp = document.getElementById('filtro-srv-sdp');
  if (selectSdp) {
    const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
    (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim().toUpperCase()); });
    (appState.sdps || []).forEach(s => { if (s.nome) setSdps.add(s.nome.trim().toUpperCase()); });

    let opts = `<option value="TODAS">Todas as SDPs</option>`;
    [...setSdps].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach(s => {
      opts += `<option value="${s}">${s}</option>`;
    });
    selectSdp.innerHTML = opts;
  }

  // Popula Cargos
  const selectCargo = document.getElementById('filtro-srv-cargo');
  if (selectCargo) {
    const setCargos = new Set(['APJ', 'DELEGADO', 'INVESTIGADOR', 'ESCRIVÃO', 'AGENTE DE POLÍCIA']);
    (appState.servidores || []).forEach(s => { if (s.cargo) setCargos.add(s.cargo.trim().toUpperCase()); });

    let opts = `<option value="TODOS">Todos os Cargos</option>`;
    [...setCargos].sort().forEach(c => {
      opts += `<option value="${c}">${c}</option>`;
    });
    selectCargo.innerHTML = opts;
  }

  window.atualizarOptionsDelegaciasFiltro();
};

window.aoMudarFiltroSdpServidores = function(sdpSelecionada) {
  servidoresState.sdp = sdpSelecionada;
  servidoresState.delegaciaId = 'TODAS';

  window.atualizarOptionsDelegaciasFiltro();
  window.atualizarFiltrosServidoresList();
};

window.atualizarOptionsDelegaciasFiltro = function() {
  const selectDel = document.getElementById('filtro-srv-del');
  if (!selectDel) return;

  const sdpSel = servidoresState.sdp;
  let delegaciasFiltradas = appState.delegacias || [];

  if (sdpSel !== 'TODAS') {
    delegaciasFiltradas = delegaciasFiltradas.filter(d => (d.subdivisao || '').toUpperCase() === sdpSel);
  }

  let opts = `<option value="TODAS">Todas as Delegacias</option>`;
  delegaciasFiltradas
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    .forEach(d => {
      opts += `<option value="${d.id}">${d.nome}</option>`;
    });

  selectDel.innerHTML = opts;
  selectDel.value = servidoresState.delegaciaId;
};

window.atualizarFiltrosServidoresList = function() {
  servidoresState.busca = document.getElementById('filtro-srv-busca')?.value?.toLowerCase() || '';
  servidoresState.sdp = document.getElementById('filtro-srv-sdp')?.value || 'TODAS';
  servidoresState.delegaciaId = document.getElementById('filtro-srv-del')?.value || 'TODAS';
  servidoresState.cargo = document.getElementById('filtro-srv-cargo')?.value || 'TODOS';
  servidoresState.perfil = document.getElementById('filtro-srv-perfil')?.value || 'TODOS';

  window.renderTabelaServidoresCorpo();
};

window.ordenarServidoresPorColuna = function(coluna) {
  if (servidoresState.sortColuna === coluna) {
    servidoresState.sortDirecao = servidoresState.sortDirecao === 'ASC' ? 'DESC' : 'ASC';
  } else {
    servidoresState.sortColuna = coluna;
    servidoresState.sortDirecao = 'ASC';
  }

  // Atualiza ícones dos cabeçalhos
  ['NOME', 'CARGO', 'DELEGACIA', 'SDP', 'PERFIL'].forEach(col => {
    const iconEl = document.getElementById(`sort-icon-${col}`);
    if (iconEl) {
      if (col === servidoresState.sortColuna) {
        iconEl.innerText = servidoresState.sortDirecao === 'ASC' ? '⬆️' : '⬇️';
      } else {
        iconEl.innerText = '';
      }
    }
  });

  window.renderTabelaServidoresCorpo();
};

window.renderTabelaServidoresCorpo = function() {
  const tbody = document.getElementById('tabela-servidores-corpo');
  if (!tbody) return;

  const { busca, sdp, delegaciaId, cargo, perfil, sortColuna, sortDirecao } = servidoresState;

  // 1. FILTRAGEM MULTIVARIÁVEL
  let servidoresFiltrados = [...(appState.servidores || [])].filter(srv => {
    const n = normalizeText(srv.nome || '');
    if (n === 'administrador do sistema' || n === 'admin') return false;

    // Filtro por Busca Textual
    if (busca) {
      const nomeSrv = (srv.nome || '').toLowerCase();
      const cargoSrv = (srv.cargo || '').toLowerCase();
      const telSrv = (srv.telefone || '').toLowerCase();
      const delObj = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
      const nomeDel = (delObj?.nome || srv.delegaciaNome || '').toLowerCase();

      if (!nomeSrv.includes(busca) && !cargoSrv.includes(busca) && !telSrv.includes(busca) && !nomeDel.includes(busca)) {
        return false;
      }
    }

    // Filtro por SDP
    if (sdp !== 'TODAS') {
      const delObj = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
      const sdpSrv = (delObj?.subdivisao || srv.subdivisao || '').toUpperCase();
      if (sdpSrv !== sdp) return false;
    }

    // Filtro por Delegacia
    if (delegaciaId !== 'TODAS') {
      if (srv.delegaciaId !== delegaciaId) return false;
    }

    // Filtro por Cargo
    if (cargo !== 'TODOS') {
      if ((srv.cargo || '').toUpperCase() !== cargo) return false;
    }

    // Filtro por Perfil
    if (perfil !== 'TODOS') {
      const perfilSrv = (srv.perfil || 'VISUALIZADOR').toUpperCase();
      if (perfilSrv !== perfil) return false;
    }

    return true;
  });

  // 2. ORDENAÇÃO DINÂMICA
  servidoresFiltrados.sort((a, b) => {
    const delA = (appState.delegacias || []).find(d => d.id === a.delegaciaId);
    const delB = (appState.delegacias || []).find(d => d.id === b.delegaciaId);

    let valA = '', valB = '';

    if (sortColuna === 'NOME') {
      valA = a.nome || '';
      valB = b.nome || '';
    } else if (sortColuna === 'CARGO') {
      valA = a.cargo || '';
      valB = b.cargo || '';
    } else if (sortColuna === 'DELEGACIA') {
      valA = delA?.nome || a.delegaciaNome || '';
      valB = delB?.nome || b.delegaciaNome || '';
    } else if (sortColuna === 'SDP') {
      valA = delA?.subdivisao || a.subdivisao || '';
      valB = delB?.subdivisao || b.subdivisao || '';
    } else if (sortColuna === 'PERFIL') {
      valA = a.perfil || 'VISUALIZADOR';
      valB = b.perfil || 'VISUALIZADOR';
    }

    const res = valA.localeCompare(valB, undefined, { numeric: true });
    return sortDirecao === 'ASC' ? res : -res;
  });

  // Atualiza contador
  const totalEl = document.getElementById('total-servidores-count');
  if (totalEl) totalEl.innerText = `Exibindo ${servidoresFiltrados.length} Servidores`;

  if (servidoresFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 italic">Nenhum servidor localizado para os filtros informados.</td></tr>`;
    return;
  }

  tbody.innerHTML = servidoresFiltrados.map(srv => {
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    const isDel = (srv.cargo || '').toUpperCase().includes('DELEGADO');
    const perfilSrv = srv.perfil || 'VISUALIZADOR';

    let badgePerfilClass = 'bg-slate-100 text-slate-700 border-slate-300';
    if (perfilSrv === 'ADMINISTRADOR') badgePerfilClass = 'bg-rose-100 text-rose-900 border-rose-300 font-black';
    else if (perfilSrv === 'GESTOR') badgePerfilClass = 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold';

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
        <td class="p-3 font-bold text-slate-800">
          <div class="flex items-center gap-2">
            <span>${srv.nome}</span>
            ${isDel ? '<span class="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9px] rounded">DEL</span>' : ''}
          </div>
        </td>
        <td class="p-3 font-semibold text-slate-700">${srv.cargo || 'APJ'}</td>
        <td class="p-3 text-slate-600 font-medium">${del ? del.nome : (srv.delegaciaNome || 'Não informada')}</td>
        <td class="p-3 font-mono font-bold text-slate-700">${del?.subdivisao || srv.subdivisao || '8ª SDP'}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[9px] uppercase border ${badgePerfilClass}">
            ${perfilSrv}
          </span>
        </td>
        <td class="p-3 font-mono text-slate-700">${srv.telefone || '-'}</td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.abrirModalServidor('${srv.id}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer">
            Editar
          </button>
          <button onclick="window.excluirServidor('${srv.id}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

// =========================================================================
// MODAL DE CADASTRO / EDIÇÃO DE SERVIDOR
// =========================================================================
window.abrirModalServidor = function(srvId = null) {
  let modal = document.getElementById('modal-servidor');
  if (!modal) {
    criarModalServidorDOM();
    modal = document.getElementById('modal-servidor');
  }

  const selectDel = document.getElementById('srv-delegacia-id');
  let delOpts = `<option value="">Selecione a Unidade...</option>`;
  (appState.delegacias || [])
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    .forEach(d => {
      delOpts += `<option value="${d.id}">${d.nome} (${d.subdivisao || '8ª SDP'})</option>`;
    });
  if (selectDel) selectDel.innerHTML = delOpts;

  const inputId = document.getElementById('srv-id');
  const inputNome = document.getElementById('srv-nome');
  const selectCargo = document.getElementById('srv-cargo');
  const selectPerfil = document.getElementById('srv-perfil');
  const inputTelefone = document.getElementById('srv-telefone');

  if (srvId) {
    const srv = (appState.servidores || []).find(s => s.id === srvId);
    if (srv) {
      inputId.value = srv.id;
      inputNome.value = srv.nome || '';
      selectCargo.value = srv.cargo || 'APJ';
      selectPerfil.value = srv.perfil || 'VISUALIZADOR';
      selectDel.value = srv.delegaciaId || '';
      inputTelefone.value = srv.telefone || '';
    }
  } else {
    inputId.value = '';
    inputNome.value = '';
    selectCargo.value = 'APJ';
    selectPerfil.value = 'VISUALIZADOR';
    selectDel.value = '';
    inputTelefone.value = '';
  }

  modal.classList.remove('hidden');
};

window.fecharModalServidor = function() {
  document.getElementById('modal-servidor')?.classList.add('hidden');
};

window.aplicarMascaraTelefone = function(input) {
  let value = input.value.replace(/\D/g, "");
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 6) {
    value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
  } else if (value.length > 2) {
    value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
  } else if (value.length > 0) {
    value = `(${value}`;
  }

  input.value = value;
};

window.salvarServidorModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('srv-id').value;
  const nome = document.getElementById('srv-nome').value.toUpperCase().trim();
  const cargo = document.getElementById('srv-cargo').value.toUpperCase().trim();
  const perfil = document.getElementById('srv-perfil').value;
  const delegaciaId = document.getElementById('srv-delegacia-id').value;
  const telefone = document.getElementById('srv-telefone').value.trim();

  const delObj = (appState.delegacias || []).find(d => d.id === delegaciaId);

  const targetId = id || ('srv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));

  let srvObj = (appState.servidores || []).find(s => s.id === targetId) || { id: targetId };

  srvObj.nome = nome;
  srvObj.cargo = cargo;
  srvObj.perfil = perfil;
  srvObj.delegaciaId = delegaciaId;
  srvObj.delegaciaNome = delObj ? delObj.nome : '';
  srvObj.subdivisao = delObj ? delObj.subdivisao : '8ª SDP';
  srvObj.telefone = telefone;

  if (!appState.servidores) appState.servidores = [];
  if (!id) appState.servidores.push(srvObj);

  await syncDocToFirestore('servidores', targetId, srvObj);

  alert("Servidor cadastrado/atualizado com sucesso!");
  window.fecharModalServidor();

  window.popularFiltrosIniciaisServidores();
  window.renderTabelaServidoresCorpo();
};

window.excluirServidor = async function(id) {
  if (!confirm("Deseja realmente remover este servidor do cadastro?")) return;

  appState.servidores = (appState.servidores || []).filter(s => s.id !== id);
  await syncDocToFirestore('servidores', id, null, true);

  window.renderTabelaServidoresCorpo();
};

function criarModalServidorDOM() {
  const modalHTML = `
    <div id="modal-servidor" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">Cadastro de Policial / Servidor</h3>
          <button type="button" onclick="window.fecharModalServidor()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarServidorModal(event)" class="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="srv-id">

          <div>
            <label class="block font-bold text-slate-700 mb-1">Nome Completo do Policial:</label>
            <input type="text" id="srv-nome" required oninput="this.value = this.value.toUpperCase()" placeholder="EX: JOÃO DA SILVA" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900 uppercase">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Cargo:</label>
              <select id="srv-cargo" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="APJ">APJ</option>
                <option value="DELEGADO">DELEGADO</option>
                <option value="INVESTIGADOR">INVESTIGADOR</option>
                <option value="ESCRIVÃO">ESCRIVÃO</option>
                <option value="AGENTE DE POLÍCIA">AGENTE DE POLÍCIA</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Perfil de Acesso:</label>
              <select id="srv-perfil" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="VISUALIZADOR">VISUALIZADOR (Público)</option>
                <option value="GESTOR">GESTOR (Edita Escalas)</option>
                <option value="ADMINISTRADOR">ADMINISTRADOR (Acesso Total)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Telefone de Contato:</label>
              <input type="text" id="srv-telefone" oninput="window.aplicarMascaraTelefone(this)" placeholder="(44) 99999-9999" class="w-full border rounded-xl p-2 bg-slate-50 font-mono text-slate-900">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Lotação de Origem:</label>
              <select id="srv-delegacia-id" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
            </div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalServidor()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">Salvar Policial</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
