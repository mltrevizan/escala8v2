// src/app.js
import { initFirebase, fetchCollection, syncDocToFirestore } from './db.js';
import { appState } from './state.js';
import { loginUser } from './auth.js';
import { CONSTANTS } from './config.js';

window.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 Inicializando v2 Modular...");
  initFirebase();

  // Teste inicial de carga
  appState.servidores = await fetchCollection('servidores');
  
  // Garante utilizador Admin se o banco estiver limpo
  if (appState.servidores.length === 0) {
    const adminSrv = {
      id: CONSTANTS.DEFAULT_ADMIN_ID,
      cargo: 'DELEGADO',
      nome: 'ADMINISTRADOR DO SISTEMA',
      login: 'admin',
      sdpId: '8SDP',
      delegaciaId: 'DEL_8SDP_P',
      telefone: '(44)99999-9999',
      funcaoCRF: 'COORDENADOR',
      funcaoDP: 'SUPERINTENDENTE',
      nivelAcesso: 'ADMINISTRADOR'
    };
    appState.servidores.push(adminSrv);
    await syncDocToFirestore('servidores', adminSrv.id, adminSrv);
    console.log("👤 Usuário Administrador Padrão criado na v2!");
  }

  setupEventListeners();
  updateUI();
});

function updateUI() {
  const statusElem = document.getElementById('app-status');
  if (statusElem) {
    statusElem.innerHTML = `
      <div class="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900">
        <p class="font-bold">✅ Módulo v2 Conectado ao Firebase!</p>
        <p class="text-xs">Servidores no Banco: <strong>${appState.servidores.length}</strong> | Perfil Atual: <strong>${appState.profile}</strong></p>
      </div>
    `;
  }
}

function setupEventListeners() {
  const loginForm = document.getElementById('form-test-login');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const srvId = appState.servidores[0]?.id;
      const pass = document.getElementById('test-pass-input').value;

      try {
        const res = await loginUser(srvId, pass);
        if (res.success) {
          alert(`Login efetuado com sucesso como ${res.servidor.nome}!`);
          updateUI();
        } else {
          alert(res.message);
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }
}
