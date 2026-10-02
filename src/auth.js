// src/auth.js
import { appState } from './state.js';

/**
 * Inicializa os observadores do Firebase Auth e renderiza o botão/modal de login
 */
export function initAuthModule() {
  if (!window.firebase || !firebase.auth) {
    console.error("Firebase Auth não carregado no index.html");
    return;
  }

  // Observador de estado da sessão do Firebase Auth
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      // Procura o perfil correspondente na coleção de servidores pelo e-mail
      const srv = (appState.servidores || []).find(s => 
        (s.email || '').toLowerCase() === user.email.toLowerCase()
      );

      appState.currentUser = {
        uid: user.uid,
        email: user.email,
        nome: srv ? srv.nome : (user.displayName || user.email.split('@')[0].toUpperCase()),
        cargo: srv ? srv.cargo : 'VISUALIZADOR',
        perfil: srv ? srv.perfil : 'Visualizador',
        delegaciaId: srv ? srv.delegaciaId : null,
        subdivisao: srv ? srv.subdivisao : '8ª SDP'
      };
    } else {
      appState.currentUser = null;
    }

    renderUserStatusHeader();
  });

  renderUserStatusHeader();
}

/**
 * Renderiza o botão/badge de utilizador logado no topo direito do Header
 */
export function renderUserStatusHeader() {
  const container = document.getElementById('app-status');
  if (!container) return;

  const user = appState.currentUser;

  if (user) {
    let badgePerfilClass = 'bg-slate-100 text-slate-800 border-slate-300';
    if (user.perfil === 'Administrador') badgePerfilClass = 'bg-black text-[#BEA55A] border-[#BEA55A] font-extrabold';
    else if (user.perfil === 'Delegado') badgePerfilClass = 'bg-[#F7F3E8] text-[#5A4716] border-[#BEA55A] font-bold';
    else if (user.perfil === 'Coordenador') badgePerfilClass = 'bg-[#2A2B2D] text-white border-[#57585A] font-bold';

    container.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="text-right hidden sm:block">
          <span class="block text-xs font-bold text-slate-900">${user.nome}</span>
          <span class="text-[9.5px] px-1.5 py-0.2 rounded border ${badgePerfilClass}">${user.perfil}</span>
        </div>
        <button onclick="window.fazerLogoutApp()" class="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1">
          🚪 Sair
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="window.abrirModalLoginApp()" class="px-3.5 py-1.5 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold rounded-xl font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5">
        🔑 Entrar / Login
      </button>
    `;
  }
}

// Global Handlers do Login Modal
window.abrirModalLoginApp = function() {
  let modal = document.getElementById('modal-login-app');
  if (!modal) {
    criarModalLoginDOM();
    modal = document.getElementById('modal-login-app');
  }

  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-erro-msg')?.classList.add('hidden');

  modal.classList.remove('hidden');
};

window.fecharModalLoginApp = function() {
  document.getElementById('modal-login-app')?.classList.add('hidden');
};

window.executarLoginFirebase = async function(e) {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msgErro = document.getElementById('login-erro-msg');

  if (!email || !password) return;

  try {
    msgErro?.classList.add('hidden');
    await firebase.auth().signInWithEmailAndPassword(email, password);
    window.fecharModalLoginApp();
    alert("Login efetuado com sucesso!");
  } catch (err) {
    console.error("Erro no login:", err);
    if (msgErro) {
      msgErro.innerText = "E-mail ou palavra-passe incorretos.";
      msgErro.classList.remove('hidden');
    }
  }
};

window.fazerLogoutApp = async function() {
  if (confirm("Deseja realmente encerrar a sessão?")) {
    await firebase.auth().signOut();
    appState.currentUser = null;
    renderUserStatusHeader();
  }
};

function criarModalLoginDOM() {
  const modalHTML = `
    <div id="modal-login-app" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 flex flex-col border-t-4 border-pcpr-gold">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-lg">🔐</span>
            <h3 class="font-bold text-slate-900 text-sm">Acesso Restrito ao Sistema</h3>
          </div>
          <button type="button" onclick="window.fecharModalLoginApp()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.executarLoginFirebase(event)" class="space-y-3 text-xs">
          <div id="login-erro-msg" class="hidden p-2 bg-red-100 text-red-800 border border-red-200 font-bold rounded-lg text-[11px] text-center"></div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">E-mail Institucional / Cadastrado:</label>
            <input type="email" id="login-email" required placeholder="exemplo@policiacivil.pr.gov.br" class="w-full border rounded-xl p-2 bg-slate-50 font-medium text-slate-900 focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Palavra-passe:</label>
            <input type="password" id="login-password" required placeholder="••••••••" class="w-full border rounded-xl p-2 bg-slate-50 font-medium text-slate-900 focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalLoginApp()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-black text-pcpr-gold border border-pcpr-gold hover:bg-slate-800 rounded-xl font-bold shadow-xs cursor-pointer">Entrar no Sistema</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
