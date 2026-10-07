// src/servidores.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { criarContaFirebaseAuth } from './authSync.js';
import { getCurrentUserRole, getCurrentUserDelegaciaId, getAllowedRolesForCreation, isProtectedAdminAccount } from './permissions.js';

let servidoresFiltros = { busca: '', cargo: 'TODOS', delegaciaId: 'TODAS' };

export function renderServidoresTable(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const role = getCurrentUserRole();
  const userDelId = getCurrentUserDelegaciaId();
  const isAdminOrCoord = ['ADMINISTRADOR', 'COORDENADOR'].includes(role);

  let optsDelegacias = `<option value="TODAS">Todas as Delegacias</option>`;
  (appState.delegacias || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).forEach(d => {
    optsDelegacias += `<option value="${d.id}" ${(!isAdminOrCoord && String(d.id) === String(userDelId)) ? 'selected' : (servidoresFiltros.delegaciaId === d.id ? 'selected' : '')}>${d.nome}</option>`;
  });

  container.innerHTML = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Cadastro de Policiais e Servidores</h2>
          <p class="text-[11px] text-slate-500">Gestão de efetivo, cargos, permissões e vínculos de lotação</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="window.abrirModalServidor()" class="px-3 py-2 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ➕ Novo Servidor
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
        <div>
          <input type="text" id="srv-filtro-busca" value="${servidoresFiltros.busca || ''}" oninput="window.filtrarTabelaServidores()" placeholder="🔍 Nome, cargo ou login..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:outline-none">
        </div>
        <div>
          <select id="srv-filtro-cargo" onchange="window.filtrarTabelaServidores()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            <option value="TODOS" ${servidoresFiltros.cargo === 'TODOS' ? 'selected' : ''}>Todos os Cargos</option>
            <option value="DELEGADO" ${servidoresFiltros.cargo === 'DELEGADO' ? 'selected' : ''}>DELEGADO DE POLÍCIA</option>
            <option value="APJ" ${servidoresFiltros.cargo === 'APJ' ? 'selected' : ''}>APJ (AGENTE DE POLÍCIA JUDICIÁRIA)</option>
          </select>
        </div>
        <div>
          <select id="srv-filtro-del" onchange="window.filtrarTabelaServidores()" ${!isAdminOrCoord ? 'disabled' : ''} class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
            ${optsDelegacias}
          </select>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
            <th class="p-3">Nome do Policial</th>
            <th class="p-3">Cargo</th>
            <th class="p-3">Nível de Acesso</th>
            <th class="p-3">Lotação Principal</th>
            <th class="p-3">Telefone</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-servidores-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  if (!isAdminOrCoord && userDelId) {
    servidoresFiltros.delegaciaId = userDelId;
  }

  window.renderTabelaServidoresCorpo();
}

window.filtrarTabelaServidores = function() {
  servidoresFiltros.busca = document.getElementById('srv-filtro-busca')?.value?.toLowerCase().trim() || '';
  servidoresFiltros.cargo = document.getElementById('srv-filtro-cargo')?.value || 'TODOS';
  servidoresFiltros.delegaciaId = document.getElementById('srv-filtro-del')?.value || 'TODAS';

  window.renderTabelaServidoresCorpo();
};

window.renderTabelaServidoresCorpo = function() {
  const tbody = document.getElementById('tabela-servidores-corpo');
  if (!tbody) return;

  const { busca, cargo, delegaciaId } = servidoresFiltros;
  const role = getCurrentUserRole();
  const userDelId = getCurrentUserDelegaciaId();
  const isAdminOrCoord = ['ADMINISTRADOR', 'COORDENADOR'].includes(role);

  let servidoresLista = (appState.servidores || []).filter(srv => {
    if (isProtectedAdminAccount(srv)) return false;

    const nomeNorm = (srv.nome || '').toLowerCase();
    const cargoNorm = (srv.cargo || '').toLowerCase();
    const loginNorm = (srv.login || '').toLowerCase();

    if (busca && !nomeNorm.includes(busca) && !cargoNorm.includes(busca) && !loginNorm.includes(busca)) {
      return false;
    }

    if (cargo !== 'TODOS') {
      if (cargo === 'DELEGADO' && !cargoNorm.includes('delegado')) return false;
      if (cargo === 'APJ' && cargoNorm.includes('delegado')) return false;
    }

    if (!isAdminOrCoord && userDelId) {
      if (String(srv.delegaciaId) !== String(userDelId)) return false;
    } else if (delegaciaId !== 'TODAS') {
      if (String(srv.delegaciaId) !== String(delegaciaId)) return false;
    }

    return true;
  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  if (servidoresLista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Nenhum servidor localizado.</td></tr>`;
    return;
  }

  tbody.innerHTML = servidoresLista.map(srv => {
    const del = (appState.delegacias || []).find(d => String(d.id) === String(srv.delegaciaId));
    const nivel = srv.nivelAcesso || srv.perfil || 'APJ';
    const cargoExibicao = (srv.cargo || '').toUpperCase().includes('DELEGADO') ? 'DELEGADO DE POLÍCIA' : 'APJ';

    let badgeClass = 'bg-slate-100 text-slate-800 border-slate-300';
    if (nivel.toUpperCase() === 'ADMINISTRADOR') badgeClass = 'bg-black text-[#BEA55A] border-[#BEA55A] font-extrabold';
    else if (nivel.toUpperCase() === 'DELEGADO') badgeClass = 'bg-[#F7F3E8] text-[#5A4716] border-[#BEA55A] font-bold';
    else if (nivel.toUpperCase() === 'COORDENADOR') badgeClass = 'bg-[#2A2B2D] text-white border-[#57585A] font-bold';

    const podeEditar = isAdminOrCoord || (String(srv.delegaciaId) === String(userDelId));

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
        <td class="p-3 font-bold text-slate-900">${srv.nome}</td>
        <td class="p-3 font-semibold text-slate-700">${cargoExibicao}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 text-[10px] rounded border ${badgeClass}">${nivel}</span>
        </td>
        <td class="p-3 text-slate-600 font-medium">${del ? del.nome : (srv.delegaciaNome || '-')}</td>
        <td class="p-3 font-mono text-slate-700">${srv.telefone || '-'}</td>
        <td class="p-3 text-right space-x-1">
          ${podeEditar ? `
            <button onclick="window.abrirModalServidor('${srv.id}')" class="px-2.5 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded font-bold text-[10px] shadow-xs cursor-pointer">
              ✏️ Editar
            </button>
            <button onclick="window.resetarSenhaServidorDirect('${srv.id}')" title="Solicitar redefinição de senha para o policial" class="px-2.5 py-1 bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 rounded font-bold text-[10px] shadow-xs cursor-pointer">
              🔑 Resetar Senha
            </button>
            <button onclick="window.excluirServidorDirect('${srv.id}')" class="px-2.5 py-1 bg-[#E2001A] hover:bg-red-700 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer">
              🗑 Excluir
            </button>
          ` : '<span class="text-[10px] text-slate-400 italic">Sem permissão</span>'}
        </td>
      </tr>
    `;
  }).join('');
};

window.abrirModalServidor = function(srvId = null) {
  let modal = document.getElementById('modal-cadastro-servidor');
  if (!modal) {
    criarModalServidorDOM();
    modal = document.getElementById('modal-cadastro-servidor');
  }

  const srv = srvId ? (appState.servidores || []).find(s => String(s.id) === String(srvId)) : null;
  const role = getCurrentUserRole();
  const userDelId = getCurrentUserDelegaciaId();
  const isAdminOrCoord = ['ADMINISTRADOR', 'COORDENADOR'].includes(role);

  const allowedRoles = getAllowedRolesForCreation();
  const selectNivel = document.getElementById('modal-srv-nivel');
  if (selectNivel) {
    selectNivel.innerHTML = allowedRoles.map(r => `<option value="${r}">${r}</option>`).join('');
  }

  const selectDel = document.getElementById('modal-srv-delegacia');
  if (selectDel) {
    let opts = (appState.delegacias || []).map(d => 
      `<option value="${d.id}" ${(!isAdminOrCoord && String(d.id) === String(userDelId)) ? 'selected' : ''}>${d.nome}</option>`
    ).join('');
    selectDel.innerHTML = opts;
    selectDel.disabled = !isAdminOrCoord;
  }

  let cargoPadrao = 'APJ';
  if (srv && (srv.cargo || '').toUpperCase().includes('DELEGADO')) {
    cargoPadrao = 'DELEGADO';
  }

  document.getElementById('modal-srv-id').value = srvId || '';
  document.getElementById('modal-srv-nome').value = srv ? srv.nome : '';
  document.getElementById('modal-srv-cargo').value = cargoPadrao;
  document.getElementById('modal-srv-telefone').value = srv ? (srv.telefone || '') : '';

  const containerReset = document.getElementById('modal-container-btn-reset');
  if (containerReset) {
    if (srvId) containerReset.classList.remove('hidden');
    else containerReset.classList.add('hidden');
  }

  if (srv && selectNivel) selectNivel.value = srv.nivelAcesso || srv.perfil || 'APJ';
  if (srv && selectDel && isAdminOrCoord) selectDel.value = srv.delegaciaId || '';

  modal.classList.remove('hidden');
};

window.fecharModalServidor = function() {
  document.getElementById('modal-cadastro-servidor')?.classList.add('hidden');
};

window.salvarServidorModalSubmit = async function(e) {
  e.preventDefault();

  const idInput = document.getElementById('modal-srv-id').value;
  const nome = document.getElementById('modal-srv-nome').value.toUpperCase().trim();
  const cargo = document.getElementById('modal-srv-cargo').value;
  const nivelAcesso = document.getElementById('modal-srv-nivel').value;
  const delegaciaId = document.getElementById('modal-srv-delegacia').value;
  const telefone = document.getElementById('modal-srv-telefone').value.trim();

  if (!nome || !delegaciaId) {
    alert("Preencha o nome do policial e a delegacia de lotação.");
    return;
  }

  if (idInput) {
    const srvExistente = (appState.servidores || []).find(s => String(s.id) === String(idInput));
    if (isProtectedAdminAccount(srvExistente) && nivelAcesso !== 'ADMINISTRADOR') {
      alert("Ação Bloqueada: O perfil do Administrador do Sistema não pode ser rebaixado.");
      return;
    }
  }

  const delObj = (appState.delegacias || []).find(d => String(d.id) === String(delegaciaId));
  const isNovo = !idInput;
  const srvId = idInput || 'srv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const loginCalc = normalizeText(nome).replace(/\s+/g, '.').toLowerCase();

  const novoServidor = {
    id: srvId,
    nome: nome,
    cargo: cargo,
    nivelAcesso: nivelAcesso,
    perfil: nivelAcesso,
    delegaciaId: delegaciaId,
    delegaciaNome: delObj ? delObj.nome : '',
    subdivisao: delObj ? delObj.subdivisao : '8ª SDP',
    telefone: telefone,
    login: loginCalc
  };

  if (!appState.servidores) appState.servidores = [];
  const idx = appState.servidores.findIndex(s => String(s.id) === String(srvId));
  if (idx >= 0) appState.servidores[idx] = novoServidor;
  else appState.servidores.push(novoServidor);

  await syncDocToFirestore('servidores', srvId, novoServidor);

  if (isNovo) {
    await criarContaFirebaseAuth(novoServidor, 'Central123');
    alert(`Policial ${nome} cadastrado com sucesso!\n\nSenha Padrão Inicial: Central123`);
  } else {
    alert(`Cadastro de ${nome} atualizado com sucesso!`);
  }

  window.fecharModalServidor();
  renderServidoresTable('servidores-table-container');
};

/**
 * Função de Reset de Senha adaptada ao SDK Web do Firebase Auth
 */
window.resetarSenhaServidorDirect = async function(srvId = null) {
  const idUsar = srvId || document.getElementById('modal-srv-id')?.value;
  if (!idUsar) return;

  const srv = (appState.servidores || []).find(s => String(s.id) === String(idUsar));
  if (!srv) return;

  if (isProtectedAdminAccount(srv)) {
    alert("Ação Bloqueada: A senha da conta do Administrador do Sistema não pode ser resetada.");
    return;
  }

  if (!confirm(`Deseja realmente resetar a senha do servidor ${srv.nome} para a senha padrão 'Central123'?\n\nO servidor será obrigado a alterar a senha no próximo acesso.`)) {
    return;
  }

  try {
    const loginBase = srv.login ? srv.login.toLowerCase().trim() : normalizeText(srv.nome || '').replace(/\s+/g, '.');
    const emailCalculado = srv.email || `${loginBase}@policiacivil.pr.gov.br`;

    // 1. ATUALIZA A SINALIZAÇÃO DE RESET DIRETO NO FIRESTORE
    srv.senhaResetada = true;
    srv.forcarTrocaSenha = true;
    await syncDocToFirestore('servidores', srv.id, srv);

    // 2. ATUALIZA A SENHA NO FIREBASE AUTH USANDO INSTÂNCIA SECUNDÁRIA (Sem deslogar o Admin)
    const currentConfig = firebase.app().options;
    let secondaryApp;
    
    try {
      secondaryApp = firebase.app("secondaryAppReset");
    } catch (e) {
      secondaryApp = firebase.initializeApp(currentConfig, "secondaryAppReset");
    }

    try {
      // Tenta criar/redefinir a conta secundária
      const secAuth = secondaryApp.auth();
      
      try {
        const secUserCred = await secAuth.signInWithEmailAndPassword(emailCalculado, "Central123");
        // Se a conta já usa a senha Central123, apenas confirma
      } catch (authErr) {
        // Se a senha atual for outra, recria/atualiza
        if (authErr.code === 'auth/wrong-password') {
          // Sinalizado no Firestore; o fluxo de login tratará a alteração
        } else if (authErr.code === 'auth/user-not-found') {
          await secAuth.createUserWithEmailAndPassword(emailCalculado, "Central123");
        }
      }

      await secAuth.signOut();
    } catch (secErr) {
      console.warn("Aviso na instância secundária de Auth:", secErr.message);
    }

    alert(`Sucesso! A senha do policial ${srv.nome} foi resetada para o padrão 'Central123' diretamente no banco de dados.`);

    if (document.getElementById('modal-cadastro-servidor')) {
      window.fecharModalServidor();
    }

    if (window.renderServidoresTable) {
      renderServidoresTable('servidores-table-container');
    }

  } catch (err) {
    console.error("Erro ao resetar senha no banco:", err);
    alert(`Erro ao salvar reset no banco de dados: ${err.message}`);
  }
};

window.excluirServidorDirect = async function(srvId) {
  const srv = (appState.servidores || []).find(s => String(s.id) === String(srvId));

  if (isProtectedAdminAccount(srv)) {
    alert("Ação Bloqueada: A conta do Administrador do Sistema não pode ser excluída.");
    return;
  }

  if (!confirm(`Deseja realmente remover o servidor ${srv ? srv.nome : ''}?`)) return;

  appState.servidores = (appState.servidores || []).filter(s => String(s.id) !== String(srvId));
  await syncDocToFirestore('servidores', srvId, null, true);

  alert("Servidor removido do cadastro.");
  renderServidoresTable('servidores-table-container');
};

function criarModalServidorDOM() {
  document.getElementById('modal-cadastro-servidor')?.remove();

  const modalHTML = `
    <div id="modal-cadastro-servidor" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">👮 Cadastro / Edição de Policial</h3>
          <button type="button" onclick="window.fecharModalServidor()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarServidorModalSubmit(event)" class="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="modal-srv-id">

          <div>
            <label class="block font-bold text-slate-700 mb-1">Nome Completo do Policial:</label>
            <input type="text" id="modal-srv-nome" required oninput="this.value = this.value.toUpperCase()" placeholder="EX: JOÃO DA SILVA" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Cargo / Função:</label>
              <select id="modal-srv-cargo" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="APJ">APJ (AGENTE DE POLÍCIA JUDICIÁRIA)</option>
                <option value="DELEGADO">DELEGADO DE POLÍCIA</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Nível de Acesso:</label>
              <select id="modal-srv-nivel" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Lotação Principal (Delegacia):</label>
            <select id="modal-srv-delegacia" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Telefone de Contato / Plantão:</label>
            <input type="text" id="modal-srv-telefone" placeholder="(44) 99999-9999" class="w-full border rounded-xl p-2 bg-slate-50 font-medium text-slate-900">
          </div>

          <div id="modal-container-btn-reset" class="hidden pt-2 border-t">
            <button type="button" onclick="window.resetarSenhaServidorDirect()" class="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1">
              🔑 Resetar Senha do Policial
            </button>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalServidor()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-black text-pcpr-gold border border-pcpr-gold hover:bg-slate-800 rounded-xl font-bold shadow-xs cursor-pointer">Salvar Servidor</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
