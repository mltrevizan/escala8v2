// src/auth.js
import { appState, normalizeText } from './state.js';
import { applyUIPermissions } from './permissions.js';
import { loadAllDataFromFirestore } from './db.js'; // CORREÇÃO 1: Importação do db.js

let loginSearchState = {
  servidorSelecionado: null
};

function obterEmailAutenticacao(srv) {
  if (!srv) return '';
  if (srv.email && srv.email.includes('@')) {
    return srv.email.toLowerCase().trim();
  }
  const loginBase = srv.login ? srv.login.toLowerCase().trim() : normalizeText(srv.nome || '').replace(/\s+/g, '.');
  return `${loginBase}@policiacivil.pr.gov.br`;
}

export function initAuthModule() {
  if (!window.firebase || !firebase.auth) {
    console.error("Firebase Auth não carregado no index.html");
    return;
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      // 1. Recarrega os dados sem a sanitização ao realizar login
      await loadAllDataFromFirestore();

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
      // 2. Se deslogou, sanitiza recarregando a base pública
      await loadAllDataFromFirestore();
    }

    renderUserStatusHeader();
    applyUIPermissions();
    
    // Recarrega o calendário visível
    if (window.renderCalendarGrid) {
      window.renderCalendarGrid(
        appState.activeTab === 'crf' ? 'calendar-crf-container' : 'calendar-delegacia-container', 
        appState.activeTab === 'crf' ? 'CRF' : 'DELEGACIA'
      );
    }
  });

  renderUserStatusHeader();
} // CORREÇÃO 2: Fechamento correto da função initAuthModule()

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

  containerSugestoes.innerHTML = '';
  servidoresMatcheados.slice(0
