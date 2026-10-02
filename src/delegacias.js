// src/delegacias.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

export function renderDelegaciasCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const delegacias = appState.delegacias || [];

  let html = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Gestão de Delegacias e Unidades</h2>
          <p class="text-[11px] text-slate-500">Configuração de regime, horários e unificação de plantões</p>
        </div>
        <div class="flex gap-2">
          <button onclick="window.abrirModalDelegacia()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ➕ Nova Unidade / Delegacia
          </button>
        </div>
      </div>
    </div>

    <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-sans">
  `;

  if (delegacias.length === 0) {
    html += `<p class="col-span-full text-xs text-slate-400 italic text-center p-8">Nenhuma delegacia cadastrada.</p>`;
  } else {
    html += delegacias.map(del => {
      const pConfig = del.plantaoConfig || {};
      const sConfig = del.sobreavisoConfig || {};

      return `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between space-y-3 hover:border-slate-300 transition">
          <div>
            <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <span class="font-black text-slate-900 text-sm uppercase block">${del.nome}</span>
                <span class="text-[10px] text-slate-500 font-bold uppercase">Subdivisão: ${del.subdivisao || '8ª SDP'}</span>
              </div>
              <span class="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded uppercase">${del.municipio || 'PR'}</span>
            </div>

            <div class="pt-2.5 space-y-2 text-xs">
              <!-- Config de Plantão -->
              <div class="p-2 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span class="font-bold text-slate-800 text-[11px] block">🏢 Plantão Local</span>
                <div class="text-[10px] text-slate-600 grid grid-cols-2 gap-1 font-mono">
                  <span>Regime: <b>${pConfig.regime || 'ININTERRUPTA'}</b></span>
                  <span>Turno: <b>${pConfig.intervalo || '24h'}</b></span>
                  <span class="col-span-2">Úteis: ${pConfig.uteis || del.horarioUteis || '08:00 às 08:00'}</span>
                  <span class="col-span-2">Não Úteis: ${pConfig.naoUteis || del.horarioNaoUteis || '08:00 às 08:00'}</span>
                </div>
              </div>

              <!-- Config de Sobreaviso -->
              <div class="p-2 bg-amber-50/50 rounded-xl border border-amber-200/60 space-y-1">
                <span class="font-bold text-amber-950 text-[11px] block">📞 Sobreaviso</span>
                <div class="text-[10px] text-amber-900 grid grid-cols-2 gap-1 font-mono">
                  <span>Regime: <b>${sConfig.regime || 'INTERMITENTE'}</b></span>
                  <span>Turno: <b>${sConfig.intervalo || '24h'}</b></span>
                  <span class="col-span-2">Úteis: ${sConfig.uteis || '18:00 às 08:00'}</span>
                  <span class="col-span-2">Não Úteis: ${sConfig.naoUteis || '08:00 às 08:00'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100 flex justify-end gap-2">
            <button onclick="window.abrirModalDelegacia('${del.id}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition">
              ✏️ Editar
            </button>
            <button onclick="window.excluirDelegacia('${del.id}')" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition">
              🗑️️ Excluir
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  html += `</div>`;
  container.innerHTML = html;
}

window.abrirModalDelegacia = function(delId = null) {
  let modal = document.getElementById('modal-delegacia');
  if (!modal) {
    criarModalDelegaciaDOM();
    modal = document.getElementById('modal-delegacia');
  }

  const inputId = document.getElementById('del-id');
  const inputNome = document.getElementById('del-nome');
  const inputSdp = document.getElementById('del-sdp');
  const inputMunicipio = document.getElementById('del-municipio');

  // Plantão
  const selPRegime = document.getElementById('del-p-regime');
  const selPIntervalo = document.getElementById('del-p-intervalo');
  const inputPUteis = document.getElementById('del-p-uteis');
  const inputPNaoUteis = document.getElementById('del-p-nao-uteis');

  // Sobreaviso
  const selSRegime = document.getElementById('del-s-regime');
  const selSIntervalo = document.getElementById('del-s-intervalo');
  const inputSUteis = document.getElementById('del-s-uteis');
  const inputSNaoUteis = document.getElementById('del-s-nao-uteis');

  if (delId) {
    const del = (appState.delegacias || []).find(d => d.id === delId);
    if (del) {
      inputId.value = del.id;
      inputNome.value = del.nome || '';
      inputSdp.value = del.subdivisao || '8ª SDP';
      inputMunicipio.value = del.municipio || '';

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
    inputSdp.value = '8ª SDP';
    inputMunicipio.value = '';

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
  const municipio = document.getElementById('del-municipio').value.toUpperCase().trim();

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
  delObj.municipio = municipio;
  delObj.plantaoConfig = plantaoConfig;
  delObj.sobreavisoConfig = sobreavisoConfig;
  delObj.horarioUteis = plantaoConfig.uteis;
  delObj.horarioNaoUteis = plantaoConfig.naoUteis;

  if (!appState.delegacias) appState.delegacias = [];
  if (!id) appState.delegacias.push(delObj);

  await syncDocToFirestore('delegacias', targetId, delObj);

  alert("Unidade cadastrada/atualizada com sucesso!");
  window.fecharModalDelegacia();

  renderDelegaciasCards('delegacias-container');
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
};

window.excluirDelegacia = async function(id) {
  if (!confirm("Deseja realmente remover esta unidade policial?")) return;

  appState.delegacias = (appState.delegacias || []).filter(d => d.id !== id);
  await syncDocToFirestore('delegacias', id, null, true);

  renderDelegaciasCards('delegacias-container');
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
};

function criarModalDelegaciaDOM() {
  const modalHTML = `
    <div id="modal-delegacia" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">Cadastro de Unidade / Delegacia</h3>
          <button type="button" onclick="window.fecharModalDelegacia()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarDelegaciaModal(event)" class="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="del-id">

          <!-- Identificação -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div class="sm:col-span-2">
              <label class="block font-bold text-slate-700 mb-1">Sigla / Nome da Delegacia:</label>
              <input type="text" id="del-nome" required oninput="this.value = this.value.toUpperCase()" placeholder="EX: 1ª SDP / DEL LEOPOLIS" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900 uppercase">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Subdivisão / SDP:</label>
              <input type="text" id="del-sdp" required oninput="this.value = this.value.toUpperCase()" placeholder="EX: 8ª SDP" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900 uppercase">
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Município:</label>
            <input type="text" id="del-municipio" oninput="this.value = this.value.toUpperCase()" placeholder="EX: PARANAVAÍ" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900 uppercase">
          </div>

          <!-- Parâmetros Plantão Local -->
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

          <!-- Parâmetros Sobreaviso -->
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
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">Salvar Unidade</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
