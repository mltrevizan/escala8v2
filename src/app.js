// src/app.js
import { initFirebase, fetchCollection, syncDocToFirestore } from './db.js';
import { appState } from './state.js';
import { renderServidoresTable, processCSVImport } from './servidores.js';
import { CONSTANTS } from './config.js';

window.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 Inicializando v2 Modular...");
  initFirebase();

  // Carga inicial dos servidores
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
  }

  updateUI();
  setupEventListeners();
});

function updateUI() {
  const statusElem = document.getElementById('app-status');
  if (statusElem) {
    statusElem.innerHTML = `
      <span class="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-1 rounded-full">
        ✅ Conectado ao Firebase (${appState.servidores.length} Servidores)
      </span>
    `;
  }

  renderServidoresTable('servidores-table-container');
}

function setupEventListeners() {
  const csvInput = document.getElementById('csv-file-input');
  if (csvInput) {
    csvInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const importedCount = await processCSVImport(evt.target.result);
          alert(`Sucesso! ${importedCount} servidores foram importados e gravados no Firestore.`);
          updateUI();
        } catch (err) {
          alert("Erro ao processar CSV: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
}
