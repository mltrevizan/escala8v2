// src/feriados.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';

export function renderFeriadosModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentYear, feriados } = appState;

  // Ordena os feriados por data
  const feriadosOrdenados = [...(feriados || [])].sort((a, b) => a.data.localeCompare(b.data));

  let html = `
    <div class="p-4 bg-slate-50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
      <div>
        <h2 class="font-bold text-sm text-slate-800">Cadastro e Gestão de Feriados</h2>
        <p class="text-[11px] text-slate-500">Feriados cadastrados destacam os dias automaticamente no calendário e na gestão</p>
      </div>
      <button onclick="window.abrirModalFeriado()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1">
        ➕ Novo Feriado
      </button>
    </div>

    <!-- Tabela de Feriados -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse font-sans">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b font-bold uppercase tracking-wider">
            <th class="p-3">Data</th>
            <th class="p-3">Descrição / Nome do Feriado</th>
            <th class="p-3">Tipo / Abrangência</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
  `;

  if (feriadosOrdenados.length === 0) {
    html += `
      <tr>
        <td colspan="4" class="p-6 text-center text-slate-500 italic">
          Nenhum feriado cadastrado até o momento.
        </td>
      </tr>
    `;
  } else {
    feriadosOrdenados.forEach(f => {
      const dataBr = formatarDataBr(f.data);
      const isAnoAtual = f.data.startsWith(String(currentYear));

      html += `
        <tr class="hover:bg-slate-50 transition ${isAnoAtual ? 'font-semibold text-slate-900' : 'text-slate-500'}">
          <td class="p-3 font-mono font-bold">${dataBr}</td>
          <td class="p-3 font-bold">${f.descricao}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeTipoFeriado(f.tipo)}">
              ${f.tipo || 'Nacional'}
            </span>
          </td>
          <td class="p-3 text-right space-x-1">
            <button onclick="window.abrirModalFeriado('${f.id}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow">
              Editar
            </button>
            <button onclick="window.excluirFeriado('${f.id}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow">
              Excluir
            </button>
          </td>
        </tr>
      `;
    });
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function getBadgeTipoFeriado(tipo) {
  if (tipo === 'Estadual') return 'bg-purple-100 text-purple-900 border-purple-300';
  if (tipo === 'Municipal') return 'bg-amber-100 text-amber-900 border-amber-300';
  return 'bg-blue-100 text-blue-900 border-blue-300'; // Nacional
}

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  if (parts.length < 3) return dataIso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Janela Modal para Cadastro de Feriado
window.abrirModalFeriado = function(feriadoId = null) {
  let modal = document.getElementById('modal-feriado');
  if (!modal) {
    criarModalFeriadoDOM();
    modal = document.getElementById('modal-feriado');
  }

  const inputId = document.getElementById('modal-feriado-id');
  const inputData = document.getElementById('modal-feriado-data');
  const inputDesc = document.getElementById('modal-feriado-desc');
  const selectTipo = document.getElementById('modal-feriado-tipo');

  if (feriadoId) {
    const feriadoObj = appState.feriados.find(f => f.id === feriadoId);
    if (feriadoObj) {
      inputId.value = feriadoObj.id;
      inputData.value = feriadoObj.data;
      inputDesc.value = feriadoObj.descricao;
      selectTipo.value = feriadoObj.tipo || 'Nacional';
    }
  } else {
    inputId.value = '';
    inputData.value = new Date().toISOString().split('T')[0];
    inputDesc.value = '';
    selectTipo.value = 'Nacional';
  }

  modal.classList.remove('hidden');
};

window.fecharModalFeriado = function() {
  document.getElementById('modal-feriado')?.classList.add('hidden');
};

window.salvarFeriadoModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('modal-feriado-id').value;
  const data = document.getElementById('modal-feriado-data').value;
  const descricao = document.getElementById('modal-feriado-desc').value.trim();
  const tipo = document.getElementById('modal-feriado-tipo').value;

  if (!data || !descricao) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  if (id) {
    const feriadoObj = appState.feriados.find(f => f.id === id);
    if (feriadoObj) {
      feriadoObj.data = data;
      feriadoObj.descricao = descricao;
      feriadoObj.tipo = tipo;
      await syncDocToFirestore('feriados', feriadoObj.id, feriadoObj);
    }
  } else {
    const newId = 'fer_' + Date.now();
    const novoFeriado = { id: newId, data, descricao, tipo };
    if (!appState.feriados) appState.feriados = [];
    appState.feriados.push(novoFeriado);
    await syncDocToFirestore('feriados', novoFeriado.id, novoFeriado);
  }

  window.fecharModalFeriado();
  renderFeriadosModule('feriados-container');
};

window.excluirFeriado = async function(feriadoId) {
  if (!confirm("Deseja realmente remover este feriado?")) return;

  appState.feriados = appState.feriados.filter(f => f.id !== feriadoId);
  await syncDocToFirestore('feriados', feriadoId, null, true);

  renderFeriadosModule('feriados-container');
};

function criarModalFeriadoDOM() {
  const modalHTML = `
    <div id="modal-feriado" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-slate-900 text-sm">Cadastrar / Editar Feriado</h3>
          <button onclick="window.fecharModalFeriado()" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onsubmit="window.salvarFeriadoModal(event)" class="space-y-3 text-xs">
          <input type="hidden" id="modal-feriado-id">

          <div>
            <label class="block font-bold text-slate-700 mb-1">Data do Feriado:</label>
            <input type="date" id="modal-feriado-data" required class="w-full border rounded-xl p-2 bg-slate-50 font-mono font-bold">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Descrição / Nome:</label>
            <input type="text" id="modal-feriado-desc" placeholder="Ex: Independência do Brasil" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Abrangência:</label>
            <select id="modal-feriado-tipo" class="w-full border rounded-xl p-2 bg-slate-50 font-bold">
              <option value="Nacional">Nacional</option>
              <option value="Estadual">Estadual</option>
              <option value="Municipal">Municipal</option>
            </select>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2">
            <button type="button" onclick="window.fecharModalFeriado()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow">Salvar Feriado</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
