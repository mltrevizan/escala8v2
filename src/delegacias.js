// src/delegacias.js
import { appState } from './state.js';
import { syncDocToFirestore, fetchCollection } from './db.js';

export async function initDelegaciasModule() {
  if (!appState.delegacias || appState.delegacias.length === 0) {
    const doBanco = await fetchCollection('delegacias');
    if (doBanco && doBanco.length > 0) {
      appState.delegacias = doBanco;
    } else {
      appState.delegacias = appState.delegacias || [];
    }
  }
}

export function renderDelegaciasCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const subdivisoesUnicas = [...new Set((appState.delegacias || []).map(d => d.subdivisao).filter(Boolean))].sort();

  let subOptions = `<option value="TODAS">Todas as Subdivisões</option>`;
  subdivisoesUnicas.forEach(s => {
    subOptions += `<option value="${s}">${s}</option>`;
  });

  let html = `
    <!-- Barra Superior de Filtros e Ações -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Unidades Policiais e Plantões Unificados</h2>
          <p class="text-[11px] text-slate-500">Mapeamento de delegacias locais e agrupamentos de plantão unificado</p>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="window.abrirModalDelegacia()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer">
            ➕ Nova Unidade / Plantão
          </button>
        </div>
      </div>

      <!-- Barra de Filtros em Tempo Real -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔍 Busca Rápida (Nome da Unidade):</label>
          <input type="text" id="filtro-delegacia-busca" oninput="window.filtrarDelegaciasInline()" placeholder="Digite o nome da unidade..." class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔰 Subdivisão / Regional:</label>
          <select id="filtro-delegacia-subdivisao" onchange="window.filtrarDelegaciasInline()" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-bold text-slate-800">
            ${subOptions}
          </select>
        </div>
      </div>

      <div id="delegacia-count-summary" class="flex items-center justify-end text-[11px] text-slate-500 font-medium">
        Exibindo <b class="text-slate-800 mx-1">0</b> unidades cadastradas.
      </div>
    </div>

    <!-- Tabela em Lista de Delegacias -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse font-sans">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Nome da Unidade / Plantão</th>
            <th class="p-3">Tipo</th>
            <th class="p-3">Subdivisão</th>
            <th class="p-3">Regime & Intervalo Sucessão</th>
            <th class="p-3">Horários Padrão (Úteis / Não Úteis)</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-delegacias-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  window.filtrarDelegaciasInline();
}

window.filtrarDelegaciasInline = function() {
  const tbody = document.getElementById('tabela-delegacias-corpo');
  if (!tbody) return;

  const busca = document.getElementById('filtro-delegacia-busca')?.value?.toLowerCase() || '';
  const subFiltro = document.getElementById('filtro-delegacia-subdivisao')?.value || 'TODAS';

  const delegaciasFiltradas = (appState.delegacias || []).filter(del => {
    if (busca) {
      const nomeNorm = (del.nome || '').toLowerCase();
      if (!nomeNorm.includes(busca)) return false;
    }

    if (subFiltro !== 'TODAS' && del.subdivisao !== subFiltro) {
      return false;
    }

    return true;
  });

  delegaciasFiltradas.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const countEl = document.getElementById('delegacia-count-summary');
  if (countEl) {
    countEl.innerHTML = `Exibindo <b class="text-slate-800 mx-1">${delegaciasFiltradas.length}</b> de ${appState.delegacias.length} unidades cadastradas.`;
  }

  if (delegaciasFiltradas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-6 text-center text-slate-500 italic">
          Nenhuma unidade localizada. Clique em "Nova Unidade / Plantão" para cadastrar.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = delegaciasFiltradas.map(del => {
    const isUnificado = Boolean(del.delegaciasIds && del.delegaciasIds.length > 0);
    const isSede = del.tipo === 'SEDE' || del.id === 'del_crf';

    let badgeTipo = 'bg-slate-100 text-slate-800 border-slate-300';
    if (isSede) badgeTipo = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
    else if (isUnificado) badgeTipo = 'bg-purple-100 text-purple-900 border-purple-300 font-bold';

    const regimeTxt = del.regimeEscala || 'ININTERRUPTA';
    const intervaloTxt = del.intervaloSucessao || '24h';

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-bold text-slate-900">${del.nome}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeTipo}">
            ${isSede ? 'SEDE / CRF' : (isUnificado ? 'PLANTÃO UNIFICADO' : 'DELEGACIA LOCAL')}
          </span>
        </td>
        <td class="p-3 text-slate-600 font-medium">${del.subdivisao || '8ª SDP'}</td>
        <td class="p-3 text-slate-700">
          <div class="font-bold text-[10px] uppercase text-indigo-950">${regimeTxt}</div>
          <div class="text-[10px] font-mono text-slate-500">Ciclo: <b>${intervaloTxt}</b></div>
        </td>
        <td class="p-3 font-mono text-[11px] text-slate-700">
          <div><b>Dias Úteis:</b> ${del.horarioUteis || del.horario24h || '08:00 às 08:00'}</div>
          <div><b>Fins de Semana/Feriados:</b> ${del.horarioNaoUteis || del.horario12h || '08:00 às 08:00'}</div>
        </td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.abrirModalDelegacia('${del.id}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-xs transition cursor-pointer">
            Editar
          </button>
          <button onclick="window.excluirDelegacia('${del.id}')" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-xs transition cursor-pointer">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

// MODAL PARAMETRIZAÇÃO DE HORÁRIOS E UNIDADES
window.abrirModalDelegacia = function(delId = null) {
  let modal = document.getElementById('modal-delegacia');
  if (!modal) {
    criarModalDelegaciaDOM();
    modal = document.getElementById('modal-delegacia');
  }

  const inputId = document.getElementById('modal-del-id');
  const inputNome = document.getElementById('modal-del-nome');
  const inputSub = document.getElementById('modal-del-subdivisao');
  const selectRegime = document.getElementById('modal-del-regime');
  const selectIntervalo = document.getElementById('modal-del-intervalo');
  const inputUteis = document.getElementById('modal-del-uteis');
  const inputNaoUteis = document.getElementById('modal-del-nao-uteis');

  if (delId) {
    const del = appState.delegacias.find(d => d.id === delId);
    if (del) {
      inputId.value = del.id;
      inputNome.value = del.nome || '';
      inputSub.value = del.subdivisao || '8ª SDP';
      selectRegime.value = del.regimeEscala || 'ININTERRUPTA';
      selectIntervalo.value = del.intervaloSucessao || '24h';
      inputUteis.value = del.horarioUteis || del.horario24h || '08:00 às 08:00';
      inputNaoUteis.value = del.horarioNaoUteis || del.horario12h || '08:00 às 08:00';
    }
  } else {
    inputId.value = '';
    inputNome.value = '';
    inputSub.value = '8ª SDP';
    selectRegime.value = 'ININTERRUPTA';
    selectIntervalo.value = '24h';
    inputUteis.value = '08:00 às 08:00';
    inputNaoUteis.value = '08:00 às 08:00';
  }

  modal.classList.remove('hidden');
};

window.fecharModalDelegacia = function() {
  document.getElementById('modal-delegacia')?.classList.add('hidden');
};

window.salvarDelegaciaModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('modal-del-id').value;
  const nome = document.getElementById('modal-del-nome').value.trim();
  const subdivisao = document.getElementById('modal-del-subdivisao').value.trim();
  const regimeEscala = document.getElementById('modal-del-regime').value;
  const intervaloSucessao = document.getElementById('modal-del-intervalo').value;
  const horarioUteis = document.getElementById('modal-del-uteis').value.trim();
  const horarioNaoUteis = document.getElementById('modal-del-nao-uteis').value.trim();

  if (!nome) {
    alert("Informe o nome da unidade.");
    return;
  }

  if (id) {
    const del = appState.delegacias.find(d => d.id === id);
    if (del) {
      del.nome = nome;
      del.subdivisao = subdivisao;
      del.regimeEscala = regimeEscala;
      del.intervaloSucessao = intervaloSucessao;
      del.horarioUteis = horarioUteis;
      del.horarioNaoUteis = horarioNaoUteis;

      await syncDocToFirestore('delegacias', del.id, del);
    }
  } else {
    const newId = 'del_' + Date.now();
    const novaDel = {
      id: newId,
      nome,
      subdivisao,
      regimeEscala,
      intervaloSucessao,
      horarioUteis,
      horarioNaoUteis,
      tipo: 'UNIDADE'
    };

    if (!appState.delegacias) appState.delegacias = [];
    appState.delegacias.push(novaDel);

    await syncDocToFirestore('delegacias', novaDel.id, novaDel);
  }

  window.fecharModalDelegacia();
  renderDelegaciasCards('delegacias-container');
};

window.excluirDelegacia = async function(delId) {
  const del = appState.delegacias.find(d => d.id === delId);
  const nome = del ? del.nome : 'esta unidade';

  if (!confirm(`Deseja realmente EXCLUIR a unidade "${nome}"?`)) return;

  appState.delegacias = appState.delegacias.filter(d => d.id !== delId);
  await syncDocToFirestore('delegacias', delId, null, true);

  renderDelegaciasCards('delegacias-container');
};

function criarModalDelegaciaDOM() {
  const modalHTML = `
    <div id="modal-delegacia" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-slate-900 text-sm">Parametrização de Unidade / Delegacia</h3>
          <button type="button" onclick="window.fecharModalDelegacia()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarDelegaciaModal(event)" class="space-y-3 text-xs">
          <input type="hidden" id="modal-del-id">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nome da Delegacia / Plantão:</label>
              <input type="text" id="modal-del-nome" required placeholder="Ex: Delegacia de Polícia de Loanda" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Subdivisão / Regional:</label>
              <input type="text" id="modal-del-subdivisao" placeholder="Ex: 8ª SDP" class="w-full border rounded-xl p-2 bg-slate-50 font-bold">
            </div>
          </div>

          <!-- Tipo de Regime e Intervalo de Sucessão -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label class="block font-bold text-indigo-950 mb-1">Regime da Escala:</label>
              <select id="modal-del-regime" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
                <option value="ININTERRUPTA">Ininterrupta (Sem Intervalo)</option>
                <option value="INTERMITENTE">Intermitente (Com Pausa)</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-indigo-950 mb-1">Intervalo de Sucessão:</label>
              <select id="modal-del-intervalo" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
                <option value="12h">12 Horas</option>
                <option value="24h" selected>24 Horas (1 Dia)</option>
                <option value="2 dias">2 Dias</option>
                <option value="3 dias">3 Dias</option>
                <option value="4 dias">4 Dias</option>
                <option value="5 dias">5 Dias</option>
                <option value="6 dias">6 Dias</option>
                <option value="7 dias">7 Dias (1 Semana)</option>
              </select>
            </div>
          </div>

          <!-- Horários Padrão para Dias Úteis e Não Úteis -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
              <label class="block font-bold text-emerald-950 text-[11px]">⏰ Horário Padrão (Dias Úteis):</label>
              <input type="text" id="modal-del-uteis" placeholder="08:00 às 08:00" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
            </div>

            <div class="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-1">
              <label class="block font-bold text-amber-950 text-[11px]">⏰ Horário Padrão (Finais de Semana / Feriados):</label>
              <input type="text" id="modal-del-nao-uteis" placeholder="08:00 às 08:00" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
            </div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2">
            <button type="button" onclick="window.fecharModalDelegacia()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">Salvar Parametrização</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
