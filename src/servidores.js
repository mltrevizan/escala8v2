// src/servidores.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';

export function renderServidoresTable(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let delOptions = `<option value="">Selecione a Unidade...</option>`;
  (appState.delegacias || []).forEach(d => {
    delOptions += `<option value="${d.id}">${d.nome}</option>`;
  });

  const html = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Cadastro Geral de Servidores / Policiais</h2>
          <p class="text-[11px] text-slate-500">Gestão de efetivo, cargos, contatos e lotações de origem</p>
        </div>
        <button onclick="window.abrirModalServidor()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
          ➕ Novo Servidor
        </button>
      </div>
    </div>

    <!-- Tabela de Servidores -->
    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Nome do Policial</th>
            <th class="p-3">Cargo</th>
            <th class="p-3">Lotação de Origem</th>
            <th class="p-3">Subdivisão</th>
            <th class="p-3">Telefone</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-servidores-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  renderTabelaServidoresCorpo();
}

function renderTabelaServidoresCorpo() {
  const tbody = document.getElementById('tabela-servidores-corpo');
  if (!tbody) return;

  const servidores = [...(appState.servidores || [])]
    .filter(s => {
      const n = normalizeText(s.nome || '');
      return n !== 'administrador do sistema' && n !== 'admin';
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  if (servidores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Nenhum servidor cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = servidores.map(srv => {
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    const isDel = (srv.cargo || '').toUpperCase().includes('DELEGADO');

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
        <td class="p-3 text-slate-600 font-mono">${del?.subdivisao || srv.subdivisao || '8ª SDP'}</td>
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
}

window.abrirModalServidor = function(srvId = null) {
  let modal = document.getElementById('modal-servidor');
  if (!modal) {
    criarModalServidorDOM();
    modal = document.getElementById('modal-servidor');
  }

  const selectDel = document.getElementById('srv-delegacia-id');
  let delOpts = `<option value="">Selecione a Unidade...</option>`;
  (appState.delegacias || []).forEach(d => {
    delOpts += `<option value="${d.id}">${d.nome}</option>`;
  });
  if (selectDel) selectDel.innerHTML = delOpts;

  const inputId = document.getElementById('srv-id');
  const inputNome = document.getElementById('srv-nome');
  const selectCargo = document.getElementById('srv-cargo');
  const inputTelefone = document.getElementById('srv-telefone');

  if (srvId) {
    const srv = (appState.servidores || []).find(s => s.id === srvId);
    if (srv) {
      inputId.value = srv.id;
      inputNome.value = srv.nome || '';
      selectCargo.value = srv.cargo || 'APJ';
      selectDel.value = srv.delegaciaId || '';
      inputTelefone.value = srv.telefone || '';
    }
  } else {
    inputId.value = '';
    inputNome.value = '';
    selectCargo.value = 'APJ';
    selectDel.value = '';
    inputTelefone.value = '';
  }

  modal.classList.remove('hidden');
};

window.fecharModalServidor = function() {
  document.getElementById('modal-servidor')?.classList.add('hidden');
};

// MÁSCARA AUTOMÁTICA DE TELEFONE (XX) XXXXX-XXXX
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
  const delegaciaId = document.getElementById('srv-delegacia-id').value;
  const telefone = document.getElementById('srv-telefone').value.trim();

  const delObj = (appState.delegacias || []).find(d => d.id === delegaciaId);

  const targetId = id || ('srv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));

  let srvObj = (appState.servidores || []).find(s => s.id === targetId) || { id: targetId };

  srvObj.nome = nome;
  srvObj.cargo = cargo;
  srvObj.delegaciaId = delegaciaId;
  srvObj.delegaciaNome = delObj ? delObj.nome : '';
  srvObj.subdivisao = delObj ? delObj.subdivisao : '8ª SDP';
  srvObj.telefone = telefone;

  if (!appState.servidores) appState.servidores = [];
  if (!id) appState.servidores.push(srvObj);

  await syncDocToFirestore('servidores', targetId, srvObj);

  alert("Servidor cadastrado/atualizado com sucesso!");
  window.fecharModalServidor();

  renderTabelaServidoresCorpo();
};

window.excluirServidor = async function(id) {
  if (!confirm("Deseja realmente remover este servidor do cadastro?")) return;

  appState.servidores = (appState.servidores || []).filter(s => s.id !== id);
  await syncDocToFirestore('servidores', id, null, true);

  renderTabelaServidoresCorpo();
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
              <label class="block font-bold text-slate-700 mb-1">Telefone de Contato:</label>
              <input type="text" id="srv-telefone" oninput="window.aplicarMascaraTelefone(this)" placeholder="(44) 99999-9999" class="w-full border rounded-xl p-2 bg-slate-50 font-mono text-slate-900">
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Lotação de Origem / Delegacia:</label>
            <select id="srv-delegacia-id" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
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
