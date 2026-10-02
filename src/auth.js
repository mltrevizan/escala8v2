// src/auth.js
import { appState, normalizeText } from './state.js';
import { applyUIPermissions } from './permissions.js';

let loginSearchState = {
  servidorSelecionado: null
};

/**
 * Normaliza e-mails ou converte logins curtos (ex: "admin") para e-mail padrão do Firebase Auth
 */
function obterEmailAutenticacao(srv) {
  if (!srv) return '';
  if (srv.email && srv.email.includes('@')) {
    return srv.email.toLowerCase().trim();
  }
  const loginBase = srv.login ? srv.login.toLowerCase().trim() : normalizeText(srv.nome || '').replace(/\s+/g, '.');
  return `${loginBase}@policiacivil.pr.gov.br`;
}

/**
 * Inicializa os observadores do Firebase Auth e renderiza o botão/modal de login
 */
export function initAuthModule() {
  if (!window.firebase || !firebase.auth) {
    console.error("Firebase Auth não carregado no index.html");
    return;
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      const srv = (appState.servidores || []).find(s => {
        const emailSrv = obterEmailAutenticacao(s);
        return emailSrv === user.email.toLowerCase();
      });

      appState.currentUser = {
        uid: user.uid,
        email: user.email,
        nome: srv ? srv.nome : (user.displayName || 'ADMINISTRADOR DO SISTEMA'),
        cargo: srv ? srv.cargo : 'DELEGADO',
        perfil: srv ? (srv.nivelAcesso || srv.perfil) : 'Administrador',
        delegaciaId: srv ? srv.delegaciaId : null,
        subdivisao: srv ? srv.subdivisao : '8ª SDP'
      };
    } else {
      appState.currentUser = null;
    }

    renderUserStatusHeader();
    applyUIPermissions();
  });

  renderUserStatusHeader();
}

/**
 * Renderiza o botão/badge de usuário logado no topo direito do Header
 */
export function renderUserStatusHeader() {
  const container = document.getElementById('app-status');
  if (!container) return;

  const user = appState.currentUser;

  if (user) {
    const perfilStr = user.perfil || 'Visualizador';
    let badgePerfilClass = 'bg-slate-100 text-slate-800 border-slate-300';
    if (perfilStr.toUpperCase() === 'ADMINISTRADOR') badgePerfilClass = 'bg-black text-[#BEA55A] border-[#BEA55A] font-extrabold';
    else if (perfilStr.toUpperCase() === 'DELEGADO') badgePerfilClass = 'bg-[#F7F3E8] text-[#5A4716] border-[#BEA55A] font-bold';
    else if (perfilStr.toUpperCase() === 'COORDENADOR') badgePerfilClass = 'bg-[#2A2B2D] text-white border-[#57585A] font-bold';

    container.innerHTML = `
      <div class="flex items-center gap-2 font-sans">
        <div class="text-right hidden sm:block">
          <span class="block text-xs font-bold text-slate-900">${user.nome}</span>
          <span class="text-[9.5px] px-1.5 py-0.2 rounded border ${badgePerfilClass}">${perfilStr}</span>
        </div>
        <button onclick="window.fazerLogoutApp()" class="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1">
          🚪 Sair
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="window.abrirModalLoginApp()" class="px-3.5 py-1.5 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold rounded-xl font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 font-sans">
        🔑 Entrar / Login
      </button>
    `;
  }
}

// Handlers globais do Modal de Login
window.abrirModalLoginApp = function() {
  let modal = document.getElementById('modal-login-app');
  if (!modal) {
    criarModalLoginDOM();
    modal = document.getElementById('modal-login-app');
  }

  loginSearchState.servidorSelecionado = null;

  const inputNome = document.getElementById('login-nome-busca');
  const inputEmailHidden = document.getElementById('login-email-hidden');
  const inputPassword = document.getElementById('login-password');
  const containerSugestoes = document.getElementById('login-sugestoes-lista');

  if (inputNome) inputNome.value = '';
  if (inputEmailHidden) inputEmailHidden.value = '';
  if (inputPassword) inputPassword.value = '';
  if (containerSugestoes) containerSugestoes.innerHTML = '';

  document.getElementById('login-erro-msg')?.classList.add('hidden');
  document.getElementById('login-badge-servidor-sel')?.classList.add('hidden');

  modal.classList.remove('hidden');
};

window.fecharModalLoginApp = function() {
  document.getElementById('modal-login-app')?.classList.add('hidden');
};

/**
 * Filtra a lista de servidores em tempo real letra a letra
 */
window.filtrarPolicialLogin = function(termo) {
  const containerSugestoes = document.getElementById('login-sugestoes-lista');
  const badgeSel = document.getElementById('login-badge-servidor-sel');
  if (!containerSugestoes) return;

  const busca = (termo || '').toLowerCase().trim();

  if (badgeSel) badgeSel.classList.add('hidden');
  loginSearchState.servidorSelecionado = null;
  document.getElementById('login-email-hidden').value = '';

  if (busca.length < 2) {
    containerSugestoes.innerHTML = '';
    return;
  }

  const servidoresMatcheados = (appState.servidores || []).filter(srv => {
    const nomeNorm = (srv.nome || '').toLowerCase();
    const cargoNorm = (srv.cargo || '').toLowerCase();
    const loginNorm = (srv.login || '').toLowerCase();
    return nomeNorm.includes(busca) || cargoNorm.includes(busca) || loginNorm.includes(busca);
  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  if (servidoresMatcheados.length === 0) {
    containerSugestoes.innerHTML = `<div class="p-2 text-center text-slate-400 italic text-xs">Nenhum policial localizado com esse nome.</div>`;
    return;
  }

  // Criação segura de elementos da DOM sem usar aspas em template strings do onclick
  containerSugestoes.innerHTML = '';
  servidoresMatcheados.slice(0, 6).forEach(srv => {
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    const emailCalculado = obterEmailAutenticacao(srv);
    const nivelExibicao = srv.nivelAcesso || srv.perfil || 'APJ';

    const itemDiv = document.createElement('div');
    itemDiv.className = 'p-2 hover:bg-indigo-50 border-b border-slate-100 cursor-pointer transition flex items-center justify-between font-sans';
    itemDiv.innerHTML = `
      <div>
        <span class="font-bold text-slate-900 block text-xs">${srv.nome}</span>
        <span class="text-[10px] text-slate-500">${srv.cargo || 'APJ'} • ${del ? del.nome : (srv.delegaciaNome || '8ª SDP')}</span>
      </div>
      <span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">${nivelExibicao}</span>
    `;

    itemDiv.onclick = () => {
      window.selecionarPolicialLogin(srv.id, srv.nome, emailCalculado, srv.cargo || 'APJ');
    };

    containerSugestoes.appendChild(itemDiv);
  });
};

/**
 * Confirma a seleção do policial ao clicar
 */
window.selecionarPolicialLogin = function(id, nome, email, cargo) {
  loginSearchState.servidorSelecionado = { id, nome, email, cargo };

  const inputNome = document.getElementById('login-nome-busca');
  const inputEmailHidden = document.getElementById('login-email-hidden');
  const containerSugestoes = document.getElementById('login-sugestoes-lista');
  const badgeSel = document.getElementById('login-badge-servidor-sel');
  const textoBadge = document.getElementById('login-badge-texto');

  if (inputNome) inputNome.value = nome;
  if (inputEmailHidden) inputEmailHidden.value = email;
  if (containerSugestoes) containerSugestoes.innerHTML = '';

  if (badgeSel && textoBadge) {
    textoBadge.innerText = `Selecionado: ${nome} (${cargo})`;
    badgeSel.classList.remove('hidden');
  }
};

window.executarLoginFirebase = async function(e) {
  e.preventDefault();

  const email = document.getElementById('login-email-hidden')?.value;
  const password = document.getElementById('login-password')?.value;
  const msgErro = document.getElementById('login-erro-msg');

  if (!email) {
    if (msgErro) {
      msgErro.innerText = "Por favor, digite seu nome e selecione o policial na lista.";
      msgErro.classList.remove('hidden');
    }
    return;
  }

  if (!password) return;

  try {
    msgErro?.classList.add('hidden');
    await firebase.auth().signInWithEmailAndPassword(email, password);
    window.fecharModalLoginApp();
    alert(`Bem-vindo, ${loginSearchState.servidorSelecionado?.nome || 'Usuário'}!`);
  } catch (err) {
    console.error("Erro no login:", err);
    if (msgErro) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msgErro.innerText = "Senha incorreta ou usuário não cadastrado no Firebase Auth.";
      } else {
        msgErro.innerText = `Erro de Autenticação: ${err.message}`;
      }
      msgErro.classList.remove('hidden');
    }
  }
};

/**
 * Encerrar a Sessão
 */
window.fazerLogoutApp = async function() {
  if (confirm("Deseja realmente encerrar a sessão?")) {
    await firebase.auth().signOut();
    appState.currentUser = null;
    
    renderUserStatusHeader();
    applyUIPermissions();
    
    if (window.switchTab) {
      window.switchTab('crf');
    }
  }
};

function criarModalLoginDOM() {
  const modalHTML = `
    <div id="modal-login-app" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 flex flex-col border-t-4 border-pcpr-gold">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-lg">🔐</span>
            <h3 class="font-bold text-slate-900 text-sm">Acesso ao Sistema de Escalas PCPR</h3>
          </div>
          <button type="button" onclick="window.fecharModalLoginApp()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.executarLoginFirebase(event)" class="space-y-3 text-xs">
          <div id="login-erro-msg" class="hidden p-2 bg-red-100 text-red-800 border border-red-200 font-bold rounded-lg text-[11px] text-center"></div>

          <input type="hidden" id="login-email-hidden">

          <div class="relative">
            <label class="block font-bold text-slate-700 mb-1">Identifique-se pelo seu Nome ou Login:</label>
            <input type="text" id="login-nome-busca" oninput="window.filtrarPolicialLogin(this.value)" placeholder="🔍 Digite 'ADMIN' ou as primeiras letras do seu nome..." autocomplete="off" class="w-full border rounded-xl p-2.5 bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
            
            <div id="login-sugestoes-lista" class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl max-h-48 overflow-y-auto z-20"></div>
          </div>

          <div id="login-badge-servidor-sel" class="hidden p-2 bg-[#F7F3E8] border border-[#BEA55A] rounded-xl text-[#5A4716] font-bold text-xs flex items-center justify-between">
            <span id="login-badge-texto"></span>
            <span class="text-emerald-700">✓</span>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Senha:</label>
            <input type="password" id="login-password" required placeholder="••••••••" class="w-full border rounded-xl p-2.5 bg-slate-50 font-medium text-slate-900 focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
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
