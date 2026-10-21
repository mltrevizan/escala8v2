// src/delegacias.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

let delegaciasFiltroState = { busca: '', sdp: 'TODAS' };

function limparSujeiraHorario(str) {
  if (!str) return '08:00 às 08:00';
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').replace(/ert\{\}/gi, '').trim();
}

function extrairHorariosInicioFim(strHorario, padraoInicio = '08:00', padraoFim = '08:00') {
  if (!strHorario || typeof strHorario !== 'string') {
    return { inicio: padraoInicio, fim: padraoFim };
  }

  const partes = strHorario.split(/\s+às\s+/i);
  if (partes.length === 2) {
    const inicio = partes[0].trim().slice(0, 5);
    const fim = partes[1].trim().slice(0, 5);
    return {
      inicio: /^\d{2}:\d{2}$/.test(inicio) ? inicio : padraoInicio,
      fim: /^\d{2}:\d{2}$/.test(fim) ? fim : padraoFim
    };
  }

  return { inicio: padraoInicio, fim: padraoFim };
}

export function popularDropdownDelegaciasComEscala(selectElementId = 'select-calendar-delegacia') {
  const select = document.getElementById(selectElementId) || document.getElementById('select-escala-delegacia');
  if (!select) return null;

  const escalas = appState.escalas || [];
  const delegacias = appState.delegacias || [];

  const idsComEscala = new Set(
    escalas
      .filter(e => e.delegaciaId || e.delegacia)
      .map(e => String(e.delegaciaId || e.delegacia).trim())
  );

  const delegaciasComEscala = delegacias.filter(d => 
    idsComEscala.has(String(d.id)) || idsComEscala.has(String(d.nome).trim())
  );

  if (delegaciasComEscala.length === 0) {
    select.innerHTML = `<option value="">Nenhuma delegacia com escala registrada</option>`;
    select.disabled = true;
    appState.selectedDelegaciaId = null;
    return null;
  }

  delegaciasComEscala.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true }));

  let optionsHTML = delegaciasComEscala
    .map(del => `<option value="${del.id}">${del.nome}</option>`)
    .join('');

  select.innerHTML = optionsHTML;
  select.disabled = false;

  const primeiraDelegaciaId = delegaciasComEscala[0].id;

  if (!appState.selectedDelegaciaId || !delegaciasComEscala.some(d => String(d.id) === String(appState.selectedDelegaciaId))) {
    appState.selectedDelegaciaId = primeiraDelegaciaId;
  }

  select.value = appState.selectedDelegaciaId;
  return appState.selectedDelegaciaId;
}

export function renderDelegaciasCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const html = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Hierarquia de SDPs e Delegacias</h2>
          <p class="text-[11px] text-slate-500">Gestão de Subdivisões (SDPs), Plantões Unificados e Unidades Vinculadas</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="window.abrirModalGerenciarSdps()" class="px-3 py-2 bg-[#2A2B2D] hover:bg-black text-white border border-slate-600 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ⚙ Gerenciar SDPs
          </button>
          <button onclick="window.abrirModalDelegacia()" class="px-3 py-2 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
            ➕ Nova Delegacia
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
        <div class="sm:col-span-2">
          <input type="text" id="filtro-del-busca" oninput="window.atualizarFiltrosDelegaciasList()" placeholder="🔍 Filtrar por nome da delegacia ou SDP..." class="w-full text-xs border border-slate-300 rounded-xl p-2 bg-white font-medium focus:outline-none">
        </div>
        <div>
          <select id="filtro-del-sdp" onchange="window.atualizarFiltrosDelegaciasList()" class="w-full text-xs border border-slate-300 rounded-xl p-2 bg-white font-bold text-slate-800">
          </select>
        </div>
      </div>
    </div>

    <div id="lista-delegacias-tronco" class="p-4 space-y-6 font-sans"></div>
  `;

  container.innerHTML = html;
  window.popularFiltroSdpsSelect();
  window.renderizarListaTroncoGalhos();
}

export function popularFiltroSdpsSelect() {
  const select = document.getElementById('filtro-del-sdp');
  if (!select) return;

  const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
  (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim().toUpperCase()); });
  (appState.sdps || []).forEach(s => { if (s.nome) setSdps.add(s.nome.trim().toUpperCase()); });

  let opts = `<option value="TODAS">Todas as SDPs (Subdivisões)</option>`;
  [...setSdps].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).forEach(sdp => {
    opts += `<option value="${sdp}">${sdp}</option>`;
  });

  select.innerHTML = opts;
}

export function atualizarFiltrosDelegaciasList() {
  delegaciasFiltroState.busca = document.getElementById('filtro-del-busca')?.value?.toLowerCase() || '';
  delegaciasFiltroState.sdp = document.getElementById('filtro-del-sdp')?.value || 'TODAS';

  window.renderizarListaTroncoGalhos();
}

export function renderizarListaTroncoGalhos() {
  const container = document.getElementById('lista-delegacias-tronco');
  if (!container) return;

  const { busca, sdp } = delegaciasFiltroState;

  const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
  (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim().toUpperCase()); });
  (appState.sdps || []).forEach(s => { if (s.nome) setSdps.add(s.nome.trim().toUpperCase()); });

  let sdpsLista = [...setSdps].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

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

    let linhasTabela = '';
    if (delVinculadas.length === 0) {
      linhasTabela = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Nenhuma delegacia vinculada a esta SDP.</td></tr>`;
    } else {
      linhasTabela = delVinculadas.map(del => {
        const p = del.plantaoConfig || {};
        const s = del.sobreavisoConfig || {};
        const pIntervalo = p.intervalo || '24h';
        const pRegime = p.regime || 'ININTERRUPTA';
        
        const pUteis = limparSujeiraHorario(p.uteis || del.horarioUteis);
        const pNaoUteis = limparSujeiraHorario(p.naoUteis || del.horarioNaoUteis);

        const sIntervalo = s.intervalo || '24h';
        const sRegime = s.regime || 'INTERMITENTE';
        const sUteis = limparSujeiraHorario(s.uteis || '18:00 às 08:00');
        const sNaoUteis = limparSujeiraHorario(s.naoUteis || '08:00 às 08:00');

        const idsConsorcio = Array.isArray(del.delegaciasIds) ? del.delegaciasIds : [];
        const nomesConsorcio = (appState.delegacias || [])
          .filter(d => idsConsorcio.includes(String(d.id)) && String(d.id) !== String(del.id))
          .map(d => d.nome);

        const textoConsorcio = nomesConsorcio.length > 0 
          ? `<span class="block text-[10px] text-amber-700 font-bold mt-1">🤝 Plantão Unificado com: ${nomesConsorcio.join(', ')}</span>`
          : '';

        return `
          <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
            <td class="p-3 font-bold text-slate-900 uppercase">
              <span class="text-sm block">${del.nome}</span>${textoConsorcio}
            </td>
            <td class="p-3 font-mono text-[11px] text-slate-700">
              <span class="font-bold text-slate-800 block">Plantão: ${pIntervalo} (${pRegime})</span>
              <span class="text-slate-500 text-[10px] block">Úteis: ${pUteis} \vert{} Não Úteis: ${pNaoUteis}</span>
            </td>
            <td class="p-3 font-mono text-[11px] text-[#5A4716] bg-[#F7F3E8] rounded-lg border border-[#BEA55A]/40">
              <span class="font-bold block">Sobreaviso: ${sIntervalo} (${sRegime})</span>
              <span class="text-[#5A4716]/80 text-[10px] block">Úteis: ${sUteis} \vert{} Não Úteis: ${sNaoUteis}</span>
            </td>
            <td class="p-3 text-right space-x-1">
              <button onclick="window.abrirModalPlantaoUnificado('${del.id}')" class="px-2.5 py-1 bg-black text-pcpr-gold hover:bg-slate-800 border border-pcpr-gold rounded font-bold text-[10px] shadow-xs cursor-pointer" title="Configurar Plantão Unificado">
                🤝 Plantão Unificado
              </button>
              <button onclick="window.abrirModalDelegacia('${del.id}')" class="px-2.5 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded font-bold text-[10px] shadow-xs cursor-pointer">
                ✏️ Editar
              </button>
              <button onclick="window.excluirDelegacia('${del.id}')" class="px-2.5 py-1 bg-[#E2001A] hover:bg-red-700 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer">
                🗑 Excluir
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    const qtdUnidades = delVinculadas.length;

    htmlTotal += `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div class="p-3 bg-black text-white flex items-center justify-between font-bold text-xs uppercase tracking-wider border-b border-[#BEA55A]">
          <div class="flex items-center gap-2">
            <span>🏛️ SUBDIVISÃO: ${sdpNome}</span>
            <span class="px-2 py-0.5 bg-slate-800 text-pcpr-gold border border-pcpr-gold font-extrabold text-[10px] rounded-full">${qtdUnidades} Unidades</span>
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
}

// 🔴 ADICIONADO 'export' explícito para evitar Uncaught SyntaxError no app.js
export function abrirModalDelegacia(delId = null) {
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
  [...setSdps].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).forEach(s => {
    sdpOpts += `<option value="${s}">${s}</option>`;
  });
  if (selectSdp) selectSdp.innerHTML = sdpOpts;

  const inputId = document.getElementById('del-id');
  const inputNome = document.getElementById('del-nome');

  const selPRegime = document.getElementById('del-p-regime');
  const selPIntervalo = document.getElementById('del-p-intervalo');
  
  const inPUteisInicio = document.getElementById('del-p-uteis-inicio');
  const inPUteisFim = document.getElementById('del-p-uteis-fim');
  const inPNaoUteisInicio = document.getElementById('del-p-nao-uteis-inicio');
  const inPNaoUteisFim = document.getElementById('del-p-nao-uteis-fim');

  const selSRegime = document.getElementById('del-s-regime');
  const selSIntervalo = document.getElementById('del-s-intervalo');
  
  const inSUteisInicio = document.getElementById('del-s-uteis-inicio');
  const inSUteisFim = document.getElementById('del-s-uteis-fim');
  const inSNaoUteisInicio = document.getElementById('del-s-nao-uteis-inicio');
  const inSNaoUteisFim = document.getElementById('del-s-nao-uteis-fim');

  if (delId) {
    const del = (appState.delegacias || []).find(d => d.id === delId);
    if (del) {
      inputId.value = del.id;
      inputNome.value = del.nome || '';
      selectSdp.value = (del.subdivisao || '8ª SDP').trim().toUpperCase();

      const p = del.plantaoConfig || {};
      selPRegime.value = p.regime || 'ININTERRUPTA';
      selPIntervalo.value = p.intervalo || '24h';

      const pU = extrairHorariosInicioFim(p.uteis || del.horarioUteis, '08:00', '08:00');
      inPUteisInicio.value = pU.inicio;
      inPUteisFim.value = pU.fim;

      const pNU = extrairHorariosInicioFim(p.naoUteis || del.horarioNaoUteis, '08:00', '08:00');
      inPNaoUteisInicio.value = pNU.inicio;
      inPNaoUteisFim.value = pNU.fim;

      const s = del.sobreavisoConfig || {};
      selSRegime.value = s.regime || 'INTERMITENTE';
      selSIntervalo.value = s.intervalo || '24h';

      const sU = extrairHorariosInicioFim(s.uteis, '18:00', '08:00');
      inSUteisInicio.value = sU.inicio;
      inSUteisFim.value = sU.fim;

      const sNU = extrairHorariosInicioFim(s.naoUteis, '08:00', '08:00');
      inSNaoUteisInicio.value = sNU.inicio;
      inSNaoUteisFim.value = sNU.fim;
    }
  } else {
    inputId.value = '';
    inputNome.value = '';

    selPRegime.value = 'ININTERRUPTA';
    selPIntervalo.value = '24h';
    inPUteisInicio.value = '08:00';
    inPUteisFim.value = '08:00';
    inPNaoUteisInicio.value = '08:00';
    inPNaoUteisFim.value = '08:00';

    selSRegime.value = 'INTERMITENTE';
    selSIntervalo.value = '24h';
    inSUteisInicio.value = '18:00';
    inSUteisFim.value = '08:00';
    inSNaoUteisInicio.value = '08:00';
    inSNaoUteisFim.value = '08:00';
  }

  modal.classList.remove('hidden');
}

export function fecharModalDelegacia() {
  document.getElementById('modal-delegacia')?.classList.add('hidden');
}

export async function salvarDelegaciaModal(e) {
  e.preventDefault();

  try {
    const id = document.getElementById('del-id')?.value;
    const nomeInput = document.getElementById('del-nome')?.value || '';
    const sdpInput = document.getElementById('del-sdp')?.value || '8ª SDP';

    const nome = nomeInput.toUpperCase().trim();
    const subdivisao = sdpInput.toUpperCase().trim();

    if (!nome) {
      alert("Por favor, preencha o nome da delegacia.");
      return;
    }

    const pUInicio = document.getElementById('del-p-uteis-inicio')?.value || '08:00';
    const pUFim = document.getElementById('del-p-uteis-fim')?.value || '08:00';
    const pNUInicio = document.getElementById('del-p-nao-uteis-inicio')?.value || '08:00';
    const pNUFim = document.getElementById('del-p-nao-uteis-fim')?.value || '08:00';

    const sUInicio = document.getElementById('del-s-uteis-inicio')?.value || '18:00';
    const sUFim = document.getElementById('del-s-uteis-fim')?.value || '08:00';
    const sNUInicio = document.getElementById('del-s-nao-uteis-inicio')?.value || '08:00';
    const sNUFim = document.getElementById('del-s-nao-uteis-fim')?.value || '08:00';

    const pUteisStr = `${pUInicio} às ${pUFim}`;
    const pNaoUteisStr = `${pNUInicio} às ${pNUFim}`;
    const sUteisStr = `${sUInicio} às ${sUFim}`;
    const sNaoUteisStr = `${sNUInicio} às ${sNUFim}`;

    const plantaoConfig = {
      regime: document.getElementById('del-p-regime')?.value || 'ININTERRUPTA',
      intervalo: document.getElementById('del-p-intervalo')?.value || '24h',
      uteis: pUteisStr,
      naoUteis: pNaoUteisStr
    };

    const sobreavisoConfig = {
      regime: document.getElementById('del-s-regime')?.value || 'INTERMITENTE',
      intervalo: document.getElementById('del-s-intervalo')?.value || '24h',
      uteis: sUteisStr,
      naoUteis: sNaoUteisStr
    };

    const targetId = id || ('del_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
    let delObj = (appState.delegacias || []).find(d => String(d.id) === String(targetId)) || { id: targetId };

    delObj.nome = nome;
    delObj.subdivisao = subdivisao;
    delObj.plantaoConfig = plantaoConfig;
    delObj.sobreavisoConfig = sobreavisoConfig;
    delObj.horarioUteis = plantaoConfig.uteis;
    delObj.horarioNaoUteis = plantaoConfig.naoUteis;

    if (!appState.delegacias) appState.delegacias = [];
    const idx = appState.delegacias.findIndex(d => String(d.id) === String(targetId));
    if (idx >= 0) {
      appState.delegacias[idx] = delObj;
    } else {
      appState.delegacias.push(delObj);
    }

    await syncDocToFirestore('delegacias', targetId, delObj);

    alert("Configurações da Delegacia salvas com sucesso!");
    window.fecharModalDelegacia();

    if (typeof renderDelegaciasCards === 'function') {
      renderDelegaciasCards('delegacias-container');
    }
    if (typeof window.atualizarInfoParametrizacaoUnidade === 'function') {
      window.atualizarInfoParametrizacaoUnidade();
    }
    if (typeof renderCalendarGrid === 'function' && appState.activeTab === 'delegacia') {
      renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
    }

  } catch (err) {
    console.error("Erro ao salvar dados da delegacia:", err);
    alert(`Erro ao salvar alterações da delegacia: ${err.message}`);
  }
}

// 🔴 ADICIONADO 'export' explícito
export async function excluirDelegacia(id) {
  if (!confirm("Deseja realmente excluir esta delegacia?")) return;

  appState.delegacias = (appState.delegacias || []).filter(d => d.id !== id);
  await syncDocToFirestore('delegacias', id, null, true);

  renderDelegaciasCards('delegacias-container');
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
}

function criarModalDelegaciaDOM() {
  document.getElementById('modal-delegacia')?.remove();

  const modalHTML = `
    <div id="modal-delegacia" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">Cadastro de Delegacia</h3>
          <button type="button" onclick="window.fecharModalDelegacia()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarDelegaciaModal(event)" class="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="del-id">

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Subdivisao (SDP):</label>
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
                <div class="flex items-center gap-1">
                  <input type="time" id="del-p-uteis-inicio" required class="w-full border rounded-lg p-1 font-mono text-xs bg-white text-center font-bold">
                  <span class="text-[10px] font-bold text-slate-400">às</span>
                  <input type="time" id="del-p-uteis-fim" required class="w-full border rounded-lg p-1 font-mono text-xs bg-white text-center font-bold">
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Fins de Semana / Feriados:</label>
                <div class="flex items-center gap-1">
                  <input type="time" id="del-p-nao-uteis-inicio" required class="w-full border rounded-lg p-1 font-mono text-xs bg-white text-center font-bold">
                  <span class="text-[10px] font-bold text-slate-400">às</span>
                  <input type="time" id="del-p-nao-uteis-fim" required class="w-full border rounded-lg p-1 font-mono text-xs bg-white text-center font-bold">
                </div>
              </div>
            </div>
          </div>

          <div class="p-3 bg-[#F7F3E8] rounded-2xl border border-[#BEA55A]/80 space-y-2">
            <span class="font-bold text-[#5A4716] text-xs block">📞 Configuração do Sobreaviso</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-[#5A4716] mb-0.5">Regime:</label>
                <select id="del-s-regime" class="w-full border rounded-lg p-1.5 font-bold bg-white text-slate-800">
                  <option value="INTERMITENTE">INTERMITENTE</option>
                  <option value="ININTERRUPTA">ININTERRUPTA</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-[#5A4716] mb-0.5">Duração do Turno:</label>
                <select id="del-s-intervalo" class="w-full border rounded-lg p-1.5 font-bold bg-white text-slate-800">
                  <option value="24h">24 Horas (1 Dia)</option>
                  <option value="2 dias">2 Dias</option>
                  <option value="3 dias">3 Dias</option>
                  <option value="7 dias">7 Dias (1 Semana)</option>
                </select>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-[#5A4716] mb-0.5">Horário Dias Úteis:</label>
                <div class="flex items-center gap-1">
                  <input type="time" id="del-s-uteis-inicio" required class="w-full border rounded-lg p-1 font-mono text-xs bg-white text-center font-bold">
                  <span class="text-[10px] font-bold text-[#5A4716]/60">às</span>
                  <input type="time" id="del-s-uteis-fim" required class="w-full border rounded-lg p-1 font-mono text-xs bg-white text-center font-bold">
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-[#5A4716] mb-0.5">Fins de Semana / Feriados:</label>
                <div class="flex items-center gap-1">
                  <input type="time" id="del-s-nao-uteis-inicio" required class="w-full border rounded-lg p-1 font-mono text-xs bg-white text-center font-bold">
                  <span class="text-[10px] font-bold text-[#5A4716]/60">às</span>
                  <input type="time" id="del-s-nao-uteis-fim" required class="w-full border rounded-lg p-1 font-mono text-xs bg-white text-center font-bold">
                </div>
              </div>
            </div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalDelegacia()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-black text-pcpr-gold border border-pcpr-gold hover:bg-slate-800 rounded-xl font-bold shadow-xs cursor-pointer">Salvar Delegacia</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ==========================================
// MÓDULO DE GERENCIAMENTO DE SDPs (SEM VÍNCULO DE DELEGACIAS)
// ==========================================

export window.abrirModalGerenciarSdps = function() {
  let modal = document.getElementById('modal-sdp-lista');
  if (!modal) {
    criarModalSdpListaDOM();
    modal = document.getElementById('modal-sdp-lista');
  }

  window.renderizarListaSdpsModal();
  modal.classList.remove('hidden');
};

export window.fecharModalSdpLista = function() {
  document.getElementById('modal-sdp-lista')?.classList.add('hidden');
};

export window.renderizarListaSdpsModal = function() {
  const container = document.getElementById('sdp-lista-corpo');
  if (!container) return;

  const sdps = [...(appState.sdps || [])].sort((a, b) => 
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true })
  );

  if (sdps.length === 0) {
    container.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-slate-400 italic">Nenhuma SDP cadastrada.</td></tr>`;
    return;
  }

  container.innerHTML = sdps.map(sdp => `
    <tr class="hover:bg-slate-50 border-b border-slate-200 text-xs">
      <td class="p-3 font-bold text-slate-900">${sdp.nome}</td>
      <td class="p-3 text-right space-x-1">
        <button onclick="window.abrirModalEditarSdp('${sdp.id}')" class="px-2.5 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded font-bold text-[10px] shadow-xs cursor-pointer">
          ✏️ Editar
        </button>
        <button onclick="window.excluirSdpModalDirect('${sdp.id}')" class="px-2.5 py-1 bg-[#E2001A] hover:bg-red-700 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer">
          🗑 Excluir
        </button>
      </td>
    </tr>
  `).join('');
};

export window.abrirModalNovaSdp = function() {
  document.getElementById('sdp-form-id').value = '';
  document.getElementById('sdp-form-nome').value = '';
  document.getElementById('modal-sdp-form-titulo').innerText = '➕ Nova Subdivisão (SDP)';
  document.getElementById('modal-sdp-form')?.classList.remove('hidden');
};

export window.abrirModalEditarSdp = function(sdpId) {
  const sdp = (appState.sdps || []).find(s => String(s.id) === String(sdpId));
  if (!sdp) return;

  document.getElementById('sdp-form-id').value = sdp.id;
  document.getElementById('sdp-form-nome').value = sdp.nome || '';
  document.getElementById('modal-sdp-form-titulo').innerText = '✏️ Editar Subdivisão (SDP)';
  document.getElementById('modal-sdp-form')?.classList.remove('hidden');
};

export window.fecharModalSdpForm = function() {
  document.getElementById('modal-sdp-form')?.classList.add('hidden');
};

export window.salvarSdpForm = async function(e) {
  e.preventDefault();

  try {
    const id = document.getElementById('sdp-form-id')?.value;
    const nomeInput = document.getElementById('sdp-form-nome')?.value || '';
    const nome = nomeInput.toUpperCase().trim();

    if (!nome) {
      alert("Por favor, informe o nome da Subdivisão (SDP).");
      return;
    }

    const targetId = id || ('sdp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
    let sdpObj = (appState.sdps || []).find(s => String(s.id) === String(targetId)) || { id: targetId };

    const nomeAntigo = sdpObj.nome;
    sdpObj.nome = nome;

    if (!appState.sdps) appState.sdps = [];
    const idx = appState.sdps.findIndex(s => String(s.id) === String(targetId));
    if (idx >= 0) {
      appState.sdps[idx] = sdpObj;
    } else {
      appState.sdps.push(sdpObj);
    }

    if (nomeAntigo && nomeAntigo !== nome) {
      (appState.delegacias || []).forEach(del => {
        if ((del.subdivisao || '').trim().toUpperCase() === nomeAntigo.trim().toUpperCase()) {
          del.subdivisao = nome;
          syncDocToFirestore('delegacias', del.id, del);
        }
      });
    }

    await syncDocToFirestore('sdps', targetId, sdpObj);

    alert("Subdivisão (SDP) salva com sucesso!");
    window.fecharModalSdpForm();
    window.renderizarListaSdpsModal();

    if (typeof renderDelegaciasCards === 'function') {
      renderDelegaciasCards('delegacias-container');
    }

  } catch (err) {
    console.error("Erro ao salvar SDP:", err);
    alert(`Erro ao salvar alterações da Subdivisão: ${err.message}`);
  }
};

export window.excluirSdpModalDirect = async function(id) {
  if (!id) return;

  const sdp = (appState.sdps || []).find(s => String(s.id) === String(id));
  const nomeSdp = sdp ? sdp.nome : 'esta SDP';

  if (!confirm(`Tem certeza que deseja excluir a Subdivisão "${nomeSdp}"?\n\nAs delegacias vinculadas não serão excluídas, apenas ficarão sem SDP associada.`)) {
    return;
  }

  try {
    appState.sdps = (appState.sdps || []).filter(s => String(s.id) !== String(id));

    if (sdp && sdp.nome) {
      const nomeUpper = sdp.nome.trim().toUpperCase();
      (appState.delegacias || []).forEach(del => {
        if ((del.subdivisao || '').trim().toUpperCase() === nomeUpper) {
          del.subdivisao = '';
          syncDocToFirestore('delegacias', del.id, del);
        }
      });
    }

    await syncDocToFirestore('sdps', id, null, true);

    alert(`Subdivisão "${nomeSdp}" excluída com sucesso!`);
    window.renderizarListaSdpsModal();

    if (typeof renderDelegaciasCards === 'function') {
      renderDelegaciasCards('delegacias-container');
    }

  } catch (err) {
    console.error("Erro ao excluir SDP:", err);
    alert(`Erro ao excluir Subdivisão: ${err.message}`);
  }
};

function criarModalSdpListaDOM() {
  document.getElementById('modal-sdp-lista')?.remove();

  const modalHTML = `
    <div id="modal-sdp-lista" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">🏛️ Gerenciamento de Subdivisões (SDPs)</h3>
          <button type="button" onclick="window.fecharModalSdpLista()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <div class="flex justify-between items-center shrink-0">
          <span class="text-xs text-slate-500 font-medium">Subdivisões cadastradas no sistema:</span>
          <button onclick="window.abrirModalNovaSdp()" class="px-3 py-1.5 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
            ➕ Nova SDP
          </button>
        </div>

        <div class="overflow-x-auto border border-slate-200 rounded-xl flex-1 max-h-60 overflow-y-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
              <tr>
                <th class="p-3">Nome da Subdivisão</th>
                <th class="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="sdp-lista-corpo" class="divide-y divide-slate-200"></tbody>
          </table>
        </div>

        <div class="pt-3 border-t flex justify-end shrink-0">
          <button type="button" onclick="window.fecharModalSdpLista()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Fechar</button>
        </div>
      </div>
    </div>

    <!-- FORMULÁRIO COMPLEMENTAR NOVA / EDITAR SDP -->
    <div id="modal-sdp-form" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 id="modal-sdp-form-titulo" class="font-bold text-slate-900 text-sm">➕ Nova Subdivisão (SDP)</h3>
          <button type="button" onclick="window.fecharModalSdpForm()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarSdpForm(event)" class="space-y-4 text-xs">
          <input type="hidden" id="sdp-form-id">

          <div>
            <label class="block font-bold text-slate-700 mb-1">Nome / Título da Subdivisão (SDP):</label>
            <input type="text" id="sdp-form-nome" required oninput="this.value = this.value.toUpperCase()" placeholder="EX: 7ª SDP / 8ª SDP / 21ª SDP" class="w-full border rounded-xl p-2.5 bg-slate-50 font-bold text-slate-900 uppercase">
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalSdpForm()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-black text-pcpr-gold border border-pcpr-gold hover:bg-slate-800 rounded-xl font-bold shadow-xs cursor-pointer">Salvar SDP</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ==========================================
// MÓDULO PLANTÃO UNIFICADO / CONSÓRCIO
// ==========================================

export window.abrirModalPlantaoUnificado = function(delId) {
  let modal = document.getElementById('modal-plantao-unificado');
  if (!modal) {
    criarModalPlantaoUnificadoDOM();
    modal = document.getElementById('modal-plantao-unificado');
  }

  const delTarget = (appState.delegacias || []).find(d => String(d.id) === String(delId));
  if (!delTarget) return;

  document.getElementById('unificado-target-id').value = delTarget.id;
  document.getElementById('unificado-target-nome').innerText = delTarget.nome;

  window.renderizarCheckboxesPlantaoUnificado(delTarget);
  modal.classList.remove('hidden');
};

export window.fecharModalPlantaoUnificado = function() {
  document.getElementById('modal-plantao-unificado')?.classList.add('hidden');
};

export window.renderizarCheckboxesPlantaoUnificado = function(delTarget) {
  const container = document.getElementById('unificado-delegacias-lista');
  if (!container) return;

  const idsVinculados = new Set(Array.isArray(delTarget.delegaciasIds) ? delTarget.delegaciasIds.map(String) : []);

  const todasDelegacias = (appState.delegacias || []).filter(d => String(d.id) !== String(delTarget.id));

  todasDelegacias.sort((a, b) => {
    const vA = idsVinculados.has(String(a.id)) ? 1 : 0;
    const vB = idsVinculados.has(String(b.id)) ? 1 : 0;

    if (vA !== vB) return vB - vA;
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true });
  });

  if (todasDelegacias.length === 0) {
    container.innerHTML = `<p class="text-slate-400 italic text-center p-4">Nenhuma outra delegacia disponível para consórcio.</p>`;
    return;
  }

  container.innerHTML = todasDelegacias.map(del => {
    const isChecked = idsVinculados.has(String(del.id));

    return `
      <label class="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer ${isChecked ? 'bg-amber-50/60 border-amber-300' : 'bg-white'}">
        <input type="checkbox" name="unificado-check" value="${del.id}" ${isChecked ? 'checked' : ''} class="rounded text-black focus:ring-slate-500 w-4 h-4 cursor-pointer">
        <div class="flex-1 min-w-0">
          <span class="font-bold text-slate-900 text-xs block truncate">${del.nome}</span>
          <span class="text-[10px] text-slate-500 block">${del.subdivisao ? 'SDP: ' + del.subdivisao : 'Sem SDP'}</span>
        </div>
        ${isChecked ? '<span class="px-2 py-0.5 text-[9px] font-extrabold bg-amber-200 text-amber-900 rounded-md">VINCULADA</span>' : ''}
      </label>
    `;
  }).join('');
};

export window.salvarPlantaoUnificadoModal = async function(e) {
  e.preventDefault();

  try {
    const targetId = document.getElementById('unificado-target-id')?.value;
    const delTarget = (appState.delegacias || []).find(d => String(d.id) === String(targetId));

    if (!delTarget) return;

    const checkboxes = document.querySelectorAll('input[name="unificado-check"]:checked');
    const idsSelecionados = Array.from(checkboxes).map(cb => String(cb.value));

    if (!idsSelecionados.includes(String(delTarget.id))) {
      idsSelecionados.push(String(delTarget.id));
    }

    delTarget.isConsorcio = idsSelecionados.length > 1;
    delTarget.delegaciasIds = idsSelecionados;

    await syncDocToFirestore('delegacias', delTarget.id, delTarget);

    for (const outraDel of (appState.delegacias || [])) {
      if (String(outraDel.id) === String(delTarget.id)) continue;

      let arrOutra = Array.isArray(outraDel.delegaciasIds) ? [...outraDel.delegaciasIds] : [];

      if (idsSelecionados.includes(String(outraDel.id))) {
        if (!arrOutra.includes(String(delTarget.id))) arrOutra.push(String(delTarget.id));
        outraDel.isConsorcio = true;
      } else {
        arrOutra = arrOutra.filter(id => id !== String(delTarget.id));
        outraDel.isConsorcio = arrOutra.length > 1;
      }

      outraDel.delegaciasIds = arrOutra;
      await syncDocToFirestore('delegacias', outraDel.id, outraDel);
    }

    alert("Vinculação de Plantão Unificado atualizada com sucesso!");
    window.fecharModalPlantaoUnificado();

    if (typeof renderDelegaciasCards === 'function') {
      renderDelegaciasCards('delegacias-container');
    }

  } catch (err) {
    console.error("Erro ao salvar Plantão Unificado:", err);
    alert(`Erro ao atualizar Plantão Unificado: ${err.message}`);
  }
};

function criarModalPlantaoUnificadoDOM() {
  document.getElementById('modal-plantao-unificado')?.remove();

  const modalHTML = `
    <div id="modal-plantao-unificado" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <div>
            <h3 class="font-bold text-slate-900 text-sm">🤝 Configurar Plantão Unificado (Consórcio)</h3>
            <p class="text-[11px] text-slate-500">Unidade Principal: <b id="unificado-target-nome" class="text-slate-900">...</b></p>
          </div>
          <button type="button" onclick="window.fecharModalPlantaoUnificado()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarPlantaoUnificadoModal(event)" class="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="unificado-target-id">

          <div>
            <label class="block font-bold text-slate-800 mb-1">Selecione as Delegacias Consorciadas:</label>
            <p class="text-[10px] text-slate-500 mb-2">As unidades marcadas compartilharão as escalas de plantão unificado de forma recíproca. Desmarcar promoverá a desvinculação.</p>
            <div id="unificado-delegacias-lista" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded-xl bg-slate-50"></div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalPlantaoUnificado()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-black text-pcpr-gold border border-pcpr-gold hover:bg-slate-800 rounded-xl font-bold shadow-xs cursor-pointer">Salvar Plantão Unificado</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Mapeamento de Atalhos Globais
window.abrirModalDelegaciaDirect = abrirModalDelegacia;
window.abrirModalSubdivisaoDirect = abrirModalGerenciarSdps;
window.excluirDelegaciaDirect = excluirDelegacia;
