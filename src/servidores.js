// src/servidores.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore, fetchCollection } from './db.js';

export async function renderServidoresTable(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Busca atualização caso o appState esteja vazio
  if (!appState.servidores || appState.servidores.length === 0) {
    const doBanco = await fetchCollection('servidores');
    if (doBanco && doBanco.length > 0) appState.servidores = doBanco;
  }

  const subdivisoesUnicas = [...new Set((appState.delegacias || []).map(d => d.subdivisao).filter(Boolean))].sort();

  let subOptions = `<option value="TODAS">Todas as Subdivisões</option>`;
  subdivisoesUnicas.forEach(s => {
    subOptions += `<option value="${s}">${s}">${s}</option>`;
  });

  let html = `
    <!-- Barra Superior de Filtros e Ações -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Cadastro de Policiais e Servidores</h2>
          <p class="text-[11px] text-slate-500">Gestão do efetivo, cargos e lotações operacionais</p>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="window.abrirModalServidor()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer">
            ➕ Novo Servidor
          </button>
        </div>
      </div>

      <!-- Barra de Filtros em Tempo Real -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔍 Busca Rápida (Nome / Cargo):</label>
          <input type="text" id="filtro-servidor-busca" oninput="window.filtrarServidoresInline()" placeholder="Digite o nome do servidor..." class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔰 Subdivisão / SDP:</label>
          <select id="filtro-servidor-subdivisao" onchange="window.filtrarServidoresInline()" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-bold text-slate-800">
            ${subOptions}
          </select>
        </div>
      </div>

      <div id="servidor-count-summary" class="flex items-center justify-end text-[11px] text-slate-500 font-medium">
        Exibindo <b class="text-slate-800 mx-1">0</b> servidores cadastrados.
      </div>
    </div>

    <!-- Tabela em Lista de Servidores -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse font-sans">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Nome do Servidor</th>
            <th class="p-3">Cargo</th>
            <th class="p-3">Lotação de Origem</th>
            <th class="p-3">Subdivisão / SDP</th>
            <th class="p-3">Telefone / Contato</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-servidores-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  window.filtrarServidoresInline();
}

window.filtrarServidoresInline = function() {
  const tbody = document.getElementById('tabela-servidores-corpo');
  if (!tbody) return;

  const busca = document.getElementById('filtro-servidor-busca')?.value?.toLowerCase() || '';
  const subFiltro = document.getElementById('filtro-servidor-subdivisao')?.value || 'TODAS';

  const servidoresFiltrados = (appState.servidores || [])
    .filter(srv => {
      const n = normalizeText(srv.nome || '');
      return n !== 'administrador do sistema' && n !== 'admin';
    })
    .filter(srv => {
      if (busca) {
        const nomeNorm = (srv.nome || '').toLowerCase();
        const cargoNorm = (srv.cargo || '').toLowerCase();
        if (!nomeNorm.includes(busca) && !cargoNorm.includes(busca)) return false;
      }

      if (subFiltro !== 'TODAS' && normalizeText(srv.subdivisao || '') !== normalizeText(subFiltro)) {
        return false;
      }

      return true;
    });

  servidoresFiltrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const countEl = document.getElementById('servidor-count-summary');
  if (countEl) {
    countEl.innerHTML = `Exibindo <b class="text-slate-800 mx-1">${servidoresFiltrados.length}</b> servidores cadastrados.`;
  }

  if (servidoresFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-6 text-center text-slate-500 italic">
          Nenhum servidor localizado. Clique em "Novo Servidor" para cadastrar.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = servidoresFiltrados.map(srv => {
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    const isDel = (srv.cargo || '').toUpperCase().includes('DELEGADO');

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-bold text-slate-900 flex items-center gap-2">
          ${srv.nome}
          ${isDel ? '<span class="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">DEL</span>' : ''}
        </td>
        <td class="p-3 font-semibold text-slate-700">${srv.cargo || 'APJ'}</td>
        <td class="p-3 text-slate-700 font-medium">${del ? del.nome : (srv.delegaciaNome || '-')}</td>
        <td class="p-3 text-slate-600">${del ? del.subdivisao : (srv.subdivisao || '8ª SDP')}</td>
        <td class="p-3 font-mono text-slate-600">${srv.telefone || '-'}</td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.abrirModalServidor('${srv.id}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-xs transition cursor-pointer">
            Editar
          </button>
          <button onclick="window.excluirServidor('${srv.id}')" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-xs transition cursor-pointer">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

window.abrirModalServidor = function(srvId = null) {
  const modalAntigo = document.getElementById('modal-servidor');
  if (modalAntigo) modalAntigo.remove();

  criarModalServidorDOM();
  const modal = document.getElementById('modal-servidor');

  const inputId = document.getElementById('modal-srv-id');
  const inputNome = document.getElementById('modal-srv-nome');
  const inputCargo = document.getElementById('modal-srv-cargo');
  const selectDelegacia = document.getElementById('modal-srv-delegacia');
  const inputTelefone = document.getElementById('modal-srv-telefone');

  let delOptions = (appState.delegacias || []).map(d => `<option value="${d.id}">${d.nome} (${d.subdivisao})</option>`).join('');
  if (selectDelegacia) selectDelegacia.innerHTML = delOptions;

  if (srvId) {
    const srv = (appState.servidores || []).find(s => s.id === srvId);
    if (srv) {
      inputId.value = srv.id;
      inputNome.value = srv.nome || '';
      inputCargo.value = srv.cargo || 'APJ';
      if (selectDelegacia) selectDelegacia.value = srv.delegaciaId || '';
      inputTelefone.value = srv.telefone || '';
    }
  } else {
    inputId.value = '';
    inputNome.value = '';
    inputCargo.value = 'APJ';
    inputTelefone.value = '';
  }

  modal.classList.remove('hidden');
};

window.fecharModalServidor = function() {
  document.getElementById('modal-servidor')?.classList.add('hidden');
};

window.salvarServidorModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('modal-srv-id').value;
  const nome = document.getElementById('modal-srv-nome').value.trim();
  const cargo = document.getElementById('modal-srv-cargo').value;
  const delegaciaId = document.getElementById('modal-srv-delegacia').value;
  const telefone = document.getElementById('modal-srv-telefone').value.trim();

  const delObj = (appState.delegacias || []).find(d => d.id === delegaciaId);

  if (!nome) {
    alert("Informe o nome do servidor.");
    return;
  }

  if (id) {
    const srv = (appState.servidores || []).find(s => s.id === id);
    if (srv) {
      srv.nome = nome;
      srv.cargo = cargo;
      srv.delegaciaId = delegaciaId;
      srv.delegaciaNome = delObj ? delObj.nome : '';
      srv.subdivisao = delObj ? delObj.subdivisao : '8ª SDP';
      srv.telefone = telefone;

      await syncDocToFirestore('servidores', srv.id, srv);
    }
  } else {
    const newId = 'srv_' + Date.now();
    const novoSrv = {
      id: newId,
      nome,
      cargo,
      delegaciaId,
      delegaciaNome: delObj ? delObj.nome : '',
      subdivisao: delObj ? delObj.subdivisao : '8ª SDP',
      telefone
    };

    if (!appState.servidores) appState.servidores = [];
    appState.servidores.push(novoSrv);

    await syncDocToFirestore('servidores', newId, novoSrv);
  }

  window.fecharModalServidor();
  renderServidoresTable('servidores-table-container');
};

window.excluirServidor = async function(srvId) {
  if (!confirm("Deseja realmente EXCLUIR este servidor?")) return;

  appState.servidores = appState.servidores.filter(s => s.id !== srvId);
  await syncDocToFirestore('servidores', srvId, null, true);

  renderServidoresTable('servidores-table-container');
};

function criarModalServidorDOM() {
  const modalHTML = `
    <div id="modal-servidor" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-slate-900 text-sm">Cadastrar / Editar Servidor</h3>
          <button type="button" onclick="window.fecharModalServidor()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarServidorModal(event)" class="space-y-3 text-xs">
          <input type="hidden" id="modal-srv-id">

          <div>
            <label class="block font-bold text-slate-700 mb-1">Nome Completo:</label>
            <input type="text" id="modal-srv-nome" required placeholder="Ex: CARLOS ALBERTO DIAZ" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Cargo:</label>
              <select id="modal-srv-cargo" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="APJ">APJ</option>
                <option value="DELEGADO">DELEGADO</option>
                <option value="INVESTIGADOR">INVESTIGADOR</option>
                <option value="ESCRIVÃO">ESCRIVÃO</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Telefone / WhatsApp:</label>
              <input type="text" id="modal-srv-telefone" placeholder="(44) 99999-0000" class="w-full border rounded-xl p-2 bg-slate-50 font-medium text-slate-900">
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Lotação de Origem:</label>
            <select id="modal-srv-delegacia" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2">
            <button type="button" onclick="window.fecharModalServidor()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">Salvar Servidor</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
