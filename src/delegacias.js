// src/delegacias.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

let delegaciasFiltroState = {
  busca: '',
  sdp: 'TODAS'
};

export function renderDelegaciasCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const html = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Hierarquia de SDPs e Delegacias</h2>
          <p class="text-[11px] text-slate-500">Gestão de Subdivisões (Tronco) e Unidades Vinculadas (Galhos)</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="window.abrirModalGerenciarSdps()" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ⚙️ Gerenciar SDPs
          </button>
          <button onclick="window.abrirModalDelegacia()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ➕ Nova Delegacia
          </button>
        </div>
      </div>

      <!-- Barra de Filtro e Digitação -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
        <div class="sm:col-span-2">
          <input type="text" id="filtro-del-busca" oninput="window.atualizarFiltrosDelegaciasList()" placeholder="🔍 Filtrar por nome da delegacia ou SDP..." class="w-full text-xs border border-slate-300 rounded-xl p-2 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>
        <div>
          <select id="filtro-del-sdp" onchange="window.atualizarFiltrosDelegaciasList()" class="w-full text-xs border border-slate-300 rounded-xl p-2 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500">
            <!-- Popula dinamicamente -->
          </select>
        </div>
      </div>
    </div>

    <!-- Lista Estruturada Tronco e Galhos -->
    <div id="lista-delegacias-tronco" class="p-4 space-y-6 font-sans"></div>
  `;

  container.innerHTML = html;
  window.popularFiltroSdpsSelect();
  window.renderizarListaTroncoGalhos();
}

window.popularFiltroSdpsSelect = function() {
  const select = document.getElementById('filtro-del-sdp');
  if (!select) return;

  const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
  (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim().toUpperCase()); });
  (appState.sdps || []).forEach(s => { if (s.nome) setSdps.add(s.nome.trim().toUpperCase()); });

  const sdpsUnicas = [...setSdps].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let opts = `<option value="TODAS">Todas as SDPs (Subdivisões)</option>`;
  sdpsUnicas.forEach(sdp => {
    opts += `<option value="${sdp}">${sdp}</option>`;
  });

  select.innerHTML = opts;
};

window.atualizarFiltrosDelegaciasList = function() {
  delegaciasFiltroState.busca = document.getElementById('filtro-del-busca')?.value?.toLowerCase() || '';
  delegaciasFiltroState.sdp = document.getElementById('filtro-del-sdp')?.value || 'TODAS';

  window.renderizarListaTroncoGalhos();
};

window.renderizarListaTroncoGalhos = function() {
  const container = document.getElementById('lista-delegacias-tronco');
  if (!container) return;

  const { busca, sdp } = delegaciasFiltroState;

  const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
  (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim().toUpperCase()); });
  (appState.sdps || []).forEach(s => { if (s.nome) setSdps.add(s.nome.trim().toUpperCase()); });

  let sdpsLista = [...setSdps].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (sdp !== 'TODAS') {
    sdpsLista = sdpsLista.filter(s => s === sdp);
  }

  if (sdpsLista.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic text-center p-8">Nenhuma subdivisão localizada para os filtros.</p>`;
    return;
  }

  let htmlTotal = '';

  sdpsLista.forEach(sdpNome => {
    let delVinculadas = (appState.delegacias || []).filter(d => {
      const delSdp = (d.subdivisao || '8ª SDP').trim().toUpperCase();
      if (delSdp !== sdpNome) return false;

      if (busca) {
        const bateuNome = (d.nome || '').toLowerCase().includes(busca);
        const bateuSdp = delSdp.toLowerCase().includes(busca);
        if (!bateuNome && !bateuSdp) return false;
      }

      return true;
    });

    if (busca && delVinculadas.length === 0 && !sdpNome.toLowerCase().includes(busca)) {
      return;
    }

    let linhasTabela = delVinculadas.map(del => {
      const p = del.plantaoConfig || {};
      const s = del.sobreavisoConfig || {};

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
          <td class="p-3 font-bold text-slate-900 uppercase">
            <span class="text-sm block">${del.nome}</span>
          </td>
          <td class="p-3 font-mono text-[11px] text-slate-700">
            <span class="font-bold text-slate-800 block">Plantão: ${p.intervalo \vert{}\vert{} '24h'} (${p.regime || 'ININTERRUPTA'})</span>
            <span class="text-slate-500 text-[10px] block">Úteis: ${p.uteis \vert{}\vert{} '08:00 às 08:00'} \vert{} Não Úteis: ${p.naoUteis || '08:00 às 08:00'}</span>
          </td>
          <td class="p-3 font-mono text-[11px] text-amber-950 bg-amber-50/40 rounded-lg">
            <span class="font-bold block">Sobreaviso: ${s.intervalo \vert{}\vert{} '24h'} (${s.regime || 'INTERMITENTE'})</span>
            <span class="text-amber-800/80 text-[10px] block">Úteis: ${s.uteis \vert{}\vert{} '18:00 às 08:00'} \vert{} Não Úteis: ${s.naoUteis || '08:00 às 08:00'}</span>
          </td>
          <td class="p-3 text-right space-x-1">
            <button onclick="window.abrirModalDelegacia('${del.id}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-md shadow-xs cursor-pointer">
              ✏️ Editar
            </button>
            <button onclick="window.excluirDelegacia('${del.id}')" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-md shadow-xs cursor-pointer">
              🗑 Excluir
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (delVinculadas.length === 0) {
      linhasTabela = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Nenhuma delegacia vinculada a esta SDP.</td></tr>`;
    }

    htmlTotal += `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div class="p-3 bg-slate-800 text-white flex items-center justify-between font-bold text-xs uppercase tracking-wider">
          <div class="flex items-center gap-2">
            <span>🏛️ TRONCO: ${sdpNome}</span>
            <span class="px-2 py-0.5 bg-slate-700 text-slate-200 font-extrabold text-[10px] rounded-full">${delVinculadas.length} Unidades</span>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr class="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <th class="p-2.5">Delegacia / Sigla</th>
                <th class="p-2.5">Regime de Plantão Local</th>
                <th class="p-2.5">Regime de Sobreaviso</th>
                <th class="p-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">${linhasTabela}</tbody>
          </table>
        </div>
      </div>
    `;
  });

  container.innerHTML = htmlTotal;
};

window.abrirModalDelegacia = function(delId = null) {
  let modal = document.getElementById('modal-delegacia');
  if (!modal) {
    criarModalDelegaciaDOM();
    modal = document.getElementById('modal-delegacia');
  }

  const selectSdp = document.getElementById('del-sdp');
  const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
  (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim().toUpperCase()); });
  (appState.sdps || []).forEach(s => { if (s.nome) setSdps.add(s.nome.trim().toUpperCase()); });

  let sdpOpts = ``;
  [...setSdps].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach(s => {
    sdpOpts += `<option value="${s}">${s}</option>`;
  });
  if (selectSdp) selectSdp.innerHTML = sdpOpts;

  const inputId = document.getElementById('del-id');
  const inputNome = document.getElementById('del-nome');

  const selPRegime = document.getElementById('del-p-regime');
  const selPIntervalo = document.getElementById('del-p-intervalo');
  const inputPUteis = document.getElementById('del-p-uteis');
  const inputPNaoUteis = document.getElementById('del-p-nao-uteis');

  const selSRegime = document.getElementById('del-s-regime');
  const selSIntervalo = document.getElementById('del-s-intervalo');
  const inputSUteis = document.getElementById('del-s-uteis');
  const inputSNaoUteis = document.getElementById('del-s-nao-uteis');

  if (delId) {
    const del = (appState.delegacias || []).find(d => d.id === delId);
    if (del) {
      inputId.value = del.id;
      inputNome.value = del.nome || '';
      selectSdp.value = (del.subdivisao || '8ª SDP').trim().toUpperCase();

      const p = del.plantaoConfig || {};
      selPRegime.value = p.regime || 'ININTERRUPTA';
      selPIntervalo.value = p.intervalo || '24h';
      inputPUteis.value = p.uteis || del.horarioUteis || '08:00 às 08:00';
      inputPNaoUteis.value = p.naoUteis || del.horarioNaoUteis || '08:00 às 08:00';

      const s = del.sobreavisoConfig || {};
      selSRegime.value = s.regime || 'INTERMITENTE';
      selSIntervalo.value = s.intervalo || '24h';
      inputSUteis.value = s.uteis || '18:00 às 08:00';
      inputSNaoUteis.value = s.naoUteis || '08:00 às 08:00';
    }
  } else {
    inputId.value = '';
    inputNome.value = '';

    selPRegime.value = 'ININTERRUPTA';
    selPIntervalo.value = '24h';
    inputPUteis.value = '08:00 às 08:00';
    inputPNaoUteis.value = '08:00 às 08:00';

    selSRegime.value = 'INTERMITENTE';
    selSIntervalo.value = '24h';
    inputSUteis.value = '18:00 às 08:00';
    inputSNaoUteis.value = '08:00 às 08:00';
  }

  modal.classList.remove('hidden');
};

window.fecharModalDelegacia = function() {
  document.getElementById('modal-delegacia')?.classList.add('hidden');
};

window.salvarDelegaciaModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('del-id').value;
  const nome = document.getElementById('del-nome').value.toUpperCase().trim();
  const subdivisao = document.getElementById('del-sdp').value.toUpperCase().trim();

  const plantaoConfig = {
    regime: document.getElementById('del-p-regime').value,
    intervalo: document.getElementById('del-p-intervalo').value,
    uteis: document.getElementById('del-p-uteis').value.toUpperCase().trim(),
    naoUteis: document.getElementById('del-p-nao-uteis').value.toUpperCase().trim()
  };

  const sobreavisoConfig = {
    regime: document.getElementById('del-s-regime').value,
    intervalo: document.getElementById('del-s-intervalo').value,
    uteis: document.getElementById('del-s-uteis').value.toUpperCase().trim(),
    naoUteis: document.getElementById('del-s-nao-uteis').value.toUpperCase().trim()
  };

  const targetId = id || ('del_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));

  let delObj = (appState.delegacias || []).find(d => d.id === targetId) || { id: targetId };

  delObj.nome = nome;
  delObj.subdivisao = subdivisao;
  delObj.plantaoConfig = plantaoConfig;
  delObj.sobreavisoConfig = sobreavisoConfig;
  delObj.horarioUteis = plantaoConfig.uteis;
  delObj.horarioNaoUteis = plantaoConfig.naoUteis;

  if (!appState.delegacias) appState.delegacias = [];
  if (!id) appState.delegacias.push(delObj);

  await syncDocToFirestore('delegacias', targetId, delObj);

  alert("Delegacia salva com sucesso!");
  window.fecharModalDelegacia();

  renderDelegaciasCards('delegacias-container');
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
};

window.excluirDelegacia = async function(id) {
  if (!confirm("Deseja realmente excluir esta delegacia?")) return;

  appState.delegacias = (appState.delegacias || []).filter(d => d.id !== id);
  await syncDocToFirestore('delegacias', id, null, true);

  renderDelegaciasCards('delegacias-container');
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
};

window.abrirModalGerenciarSdps = function() {
  let modal = document.getElementById('modal-gerenciar-sdps');
  if (!modal) {
    criarModalGerenciarSdpsDOM();
    modal = document.getElementById('modal-gerenciar-sdps');
  }

  window.renderizarListaSdpsModal();
  modal.classList.remove('hidden');
};

window.fecharModalGerenciarSdps = function() {
  document.getElementById('modal-gerenciar-sdps')?.classList.add('hidden');
};

window.renderizarListaSdpsModal = function() {
  const container = document.getElementById('lista-sdps-modal-corpo');
  if (!container) return;

  const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
  (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim().toUpperCase()); });
  (appState.sdps || []).forEach(s => { if (s.nome) setSdps.add(s.nome.trim().toUpperCase()); });

  const sdps = [...setSdps].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  container.innerHTML = sdps.map((sdpNome) => `
    <div class="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
      <span>🏛️ ${sdpNome}</span>
      <div class="space-x-1">
        <button onclick="window.editarNomeSdpPrompt('${sdpNome}')" class="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold">Editar</button>
        <button onclick="window.excluirSdpModal('${sdpNome}')" class="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold">Excluir</button>
      </div>
    </div>
  `).join('');
};

window.salvarNovaSdpModal = async function(e) {
  e.preventDefault();

  const input = document.getElementById('modal-sdp-novo-nome');
  const nomeSdp = input.value.toUpperCase().trim();

  if (!nomeSdp) return;

  if (!appState.sdps) appState.sdps = [];
  const exists = appState.sdps.some(s => s.nome === nomeSdp);

  if (!exists) {
    const newSdpId = 'sdp_' + Date.now();
    const sdpObj = { id: newSdpId, nome: nomeSdp };
    appState.sdps.push(sdpObj);
    await syncDocToFirestore('sdps', newSdpId, sdpObj);
  }

  input.value = '';
  window.renderizarListaSdpsModal();
  renderDelegaciasCards('delegacias-container');
};

window.editarNomeSdpPrompt = async function(nomeAntigo) {
  const novoNome = prompt("Digite o novo nome para a Subdivisão (SDP):", nomeAntigo);
  if (!novoNome || novoNome.toUpperCase().trim() === nomeAntigo) return;

  const nomeFormatado = novoNome.toUpperCase().trim();

  (appState.delegacias || []).forEach(async d => {
    if ((d.subdivisao || '').toUpperCase() === nomeAntigo) {
      d.subdivisao = nomeFormatado;
      await syncDocToFirestore('delegacias', d.id, d);
    }
  });

  if (!appState.sdps) appState.sdps = [];
  const sdpObj = appState.sdps.find(s => s.nome === nomeAntigo);
  if (sdpObj) {
    sdpObj.nome = nomeFormatado;
    await syncDocToFirestore('sdps', sdpObj.id, sdpObj);
  } else {
    const newSdpId = 'sdp_' + Date.now();
    const newObj = { id: newSdpId, nome: nomeFormatado };
    appState.sdps.push(newObj);
    await syncDocToFirestore('sdps', newSdpId, newObj);
  }

  alert("Subdivisão (SDP) atualizada em todas as delegacias!");
  window.renderizarListaSdpsModal();
  renderDelegaciasCards('delegacias-container');
};

window.excluirSdpModal = async function(nomeSdp) {
  const vinculos = (appState.delegacias || []).filter(d => (d.subdivisao || '').toUpperCase() === nomeSdp);

  if (vinculos.length > 0) {
    alert(`Não é possível excluir a ${nomeSdp} pois existem ${vinculos.length} delegacia(s) vinculadas a ela. Realoque as delegacias primeiro.`);
    return;
  }

  if (!confirm(`Deseja realmente remover a ${nomeSdp}?`)) return;

  appState.sdps = (appState.sdps || []).filter(s => s.nome !== nomeSdp);
  
  const sdpObj = (appState.sdps || []).find(s => s.nome === nomeSdp);
  if (sdpObj) {
    await syncDocToFirestore('sdps', sdpObj.id, null, true);
  }

  window.renderizarListaSdpsModal();
  renderDelegaciasCards('delegacias-container');
};

function criarModalDelegaciaDOM() {
  const modalHTML = `
    <div id="modal-delegacia" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">Cadastro de Delegacia (Galho)</h3>
          <button type="button" onclick="window.fecharModalDelegacia()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarDelegaciaModal(event)" class="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="del-id">

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Subdivisão / Tronco (SDP):</label>
              <select id="del-sdp" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900 uppercase"></select>
            </div>
            <div class="sm:col-span-2">
              <label class="block font-bold text-slate-700 mb-1">Sigla / Nome da Delegacia:</label>
              <input type="text" id="del-nome" required oninput="this.value = this.value.toUpperCase()" placeholder="EX: 1ª SDP / DEL LEOPOLIS" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900 uppercase">
            </div>
          </div>

          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <span class="font-bold text-slate-900 text-xs block">🏢 Configuração do Plantão Local</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Regime:</label>
                <select id="del-p-regime" class="w-full border rounded-lg p-1.5 font-bold bg-white text-slate-800">
                  <option value="ININTERRUPTA">ININTERRUPTA (24h direto)</option>
                  <option value="INTERMITENTE">INTERMITENTE (Suspensão Noturna)</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Duração do Turno:</label>
                <select id="del-p-intervalo" class="w-full border rounded-lg p-1.5 font-bold bg-white text-slate-800">
                  <option value="12h">12 Horas</option>
                  <option value="24h">24 Horas (1 Dia)</option>
                  <option value="2 dias">2 Dias</option>
                  <option value="3 dias">3 Dias</option>
                  <option value="4 dias">4 Dias</option>
                  <option value="7 dias">7 Dias (1 Semana)</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Horário Dias Úteis:</label>
                <input type="text" id="del-p-uteis" oninput="this.value = this.value.toUpperCase()" placeholder="08:00 às 08:00" class="w-full border rounded-lg p-1.5 font-mono text-slate-800 bg-white">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Horário Fins de Semana / Feriados:</label>
                <input type="text" id="del-p-nao-uteis" oninput="this.value = this.value.toUpperCase()" placeholder="08:00 às 08:00" class="w-full border rounded-lg p-1.5 font-mono text-slate-800 bg-white">
              </div>
            </div>
          </div>

          <div class="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-2">
            <span class="font-bold text-amber-950 text-xs block">📞 Configuração do Sobreaviso</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-amber-900 mb-0.5">Regime:</label>
                <select id="del-s-regime" class="w-full border rounded-lg p-1.5 font-bold bg-white text-slate-800">
                  <option value="INTERMITENTE">INTERMITENTE</option>
                  <option value="ININTERRUPTA">ININTERRUPTA</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-amber-900 mb-0.5">Duração do Turno:</label>
                <select id="del-s-intervalo" class="w-full border rounded-lg p-1.5 font-bold bg-white text-slate-800">
                  <option value="24h">24 Horas (1 Dia)</option>
                  <option value="2 dias">2 Dias</option>
                  <option value="3 dias">3 Dias</option>
                  <option value="7 dias">7 Dias (1 Semana)</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-amber-900 mb-0.5">Horário Dias Úteis:</label>
                <input type="text" id="del-s-uteis" oninput="this.value = this.value.toUpperCase()" placeholder="18:00 às 08:00" class="w-full border rounded-lg p-1.5 font-mono text-slate-800 bg-white">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-amber-900 mb-0.5">Horário Fins de Semana / Feriados:</label>
                <input type="text" id="del-s-nao-uteis" oninput="this.value = this.value.toUpperCase()" placeholder="08:00 às 08:00" class="w-full border rounded-lg p-1.5 font-mono text-slate-800 bg-white">
              </div>
            </div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalDelegacia()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">Salvar Delegacia</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function criarModalGerenciarSdpsDOM() {
  const modalHTML = `
    <div id="modal-gerenciar-sdps" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">🏛️ Gerenciar Subdivisões (SDPs)</h3>
          <button type="button" onclick="window.fecharModalGerenciarSdps()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarNovaSdpModal(event)" class="flex gap-2">
          <input type="text" id="modal-sdp-novo-nome" required oninput="this.value = this.value.toUpperCase()" placeholder="EX: 9ª SDP" class="flex-1 border rounded-xl p-2 bg-slate-50 font-bold text-slate-900 text-xs uppercase">
          <button type="submit" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer">➕ Adicionar</button>
        </form>

        <div class="space-y-2 pt-2 border-t flex-1 overflow-y-auto pr-1">
          <label class="block font-bold text-slate-700 text-xs mb-1">Subdivisões Existentes:</label>
          <div id="lista-sdps-modal-corpo" class="space-y-1.5"></div>
        </div>

        <div class="pt-3 border-t flex justify-end shrink-0">
          <button type="button" onclick="window.fecharModalGerenciarSdps()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs cursor-pointer">Fechar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
