// src/delegacias.js
import { appState, normalizeText } from './state.js';
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

  // Auto-correção de subdivisões das delegacias com base no mapeamento da região
  await autocorrigirSubdivisoesDelegacias();
}

// Garante que 7ª SDP, 8ª SDP e 21ª SDP existam e ajusta a subdivisão das delegacias
async function autocorrigirSubdivisoesDelegacias() {
  if (!appState.delegacias) return;

  let houveAlteracao = false;

  for (const del of appState.delegacias) {
    const nomeNorm = normalizeText(del.nome || '');
    let sdpCorreta = '';

    // Mapeamento das Regionais por Delegacia
    if (nomeNorm.includes('umuarama') || nomeNorm.includes('altônia') || nomeNorm.includes('altonia') ||
        nomeNorm.includes('iporã') || nomeNorm.includes('ipora') || nomeNorm.includes('pérola') || 
        nomeNorm.includes('perola') || nomeNorm.includes('icaraíma') || nomeNorm.includes('icaraima') ||
        nomeNorm.includes('xambrê') || nomeNorm.includes('xambre') || nomeNorm.includes('alto piquiri') ||
        nomeNorm.includes('cruzeiro do oeste')) {
      sdpCorreta = '7ª SDP';
    } else if (nomeNorm.includes('cianorte') || nomeNorm.includes('goioerê') || nomeNorm.includes('goioere')) {
      sdpCorreta = '21ª SDP';
    } else if (nomeNorm.includes('paranavaí') || nomeNorm.includes('paranavai') || nomeNorm.includes('loanda') ||
               nomeNorm.includes('nova esperança') || nomeNorm.includes('nova esperanca') || 
               nomeNorm.includes('nova londrina') || nomeNorm.includes('paranacity') || 
               nomeNorm.includes('paraíso do norte') || nomeNorm.includes('paraiso do norte') ||
               nomeNorm.includes('terra rica') || nomeNorm.includes('alto paraná') || nomeNorm.includes('alto parana') ||
               nomeNorm.includes('santa isabel')) {
      sdpCorreta = '8ª SDP';
    }

    if (sdpCorreta && del.subdivisao !== sdpCorreta) {
      del.subdivisao = sdpCorreta;
      await syncDocToFirestore('delegacias', del.id, del);
      houveAlteracao = true;
    }
  }

  if (houveAlteracao) {
    console.log("Subdivisões das delegacias auto-corrigidas com sucesso!");
  }
}

export function renderDelegaciasCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const subdivisoesUnicas = getListaSdpsUnicas();

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
            <th class="p-3">Subdivisão / SDP</th>
            <th class="p-3">Regras do Plantão Local</th>
            <th class="p-3">Regras do Sobreaviso</th>
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

function getListaSdpsUnicas() {
  const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
  (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(d.subdivisao.trim()); });
  (appState.servidores || []).forEach(s => { if (s.subdivisao) setSdps.add(s.subdivisao.trim()); });
  return [...setSdps].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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

    if (subFiltro !== 'TODAS' && normalizeText(del.subdivisao || '') !== normalizeText(subFiltro)) {
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
    const isUnificado = Boolean(del.delegaciasIds && Array.isArray(del.delegaciasIds) && del.delegaciasIds.length > 0);
    const isSede = del.tipo === 'SEDE' || del.id === 'del_crf';

    let badgeTipo = 'bg-sky-100 text-sky-900 border-sky-300 font-medium';
    let rotuloTipo = 'DELEGACIA LOCAL';

    if (isSede) {
      badgeTipo = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      rotuloTipo = 'SEDE / CRF';
    } else if (isUnificado) {
      badgeTipo = 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
      rotuloTipo = 'PLANTÃO UNIFICADO';
    }

    const pConfig = del.plantaoConfig || {
      regime: del.regimeEscala || 'ININTERRUPTA',
      intervalo: del.intervaloSucessao || '24h',
      uteis: del.horarioUteis || del.horario24h || '08:00 às 08:00',
      naoUteis: del.horarioNaoUteis || del.horario12h || '08:00 às 08:00'
    };

    const sConfig = del.sobreavisoConfig || {
      regime: 'INTERMITENTE',
      intervalo: '24h',
      uteis: '18:00 às 08:00',
      naoUteis: '08:00 às 08:00'
    };

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-bold text-slate-900">
          ${del.nome}
          ${isUnificado ? `<div class="text-[10px] font-normal text-purple-800">Participantes: ${del.delegaciasIds.map(id => appState.delegacias.find(d => d.id === id)?.nome).filter(Boolean).join(', ')}</div>` : ''}
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] uppercase border ${badgeTipo}">
            ${rotuloTipo}
          </span>
        </td>
        <td class="p-3 text-slate-800 font-bold">${del.subdivisao || '8ª SDP'}</td>
        <td class="p-3 font-mono text-[10.5px] text-slate-700 bg-sky-50/40 rounded-lg">
          <div><b>Regime:</b> ${pConfig.regime} (${pConfig.intervalo})</div>
          <div><b>Úteis:</b> ${pConfig.uteis}</div>
          <div><b>Não Úteis:</b> ${pConfig.naoUteis}</div>
        </td>
        <td class="p-3 font-mono text-[10.5px] text-slate-700 bg-amber-50/40 rounded-lg">
          <div><b>Regime:</b> ${sConfig.regime} (${sConfig.intervalo})</div>
          <div><b>Úteis:</b> ${sConfig.uteis}</div>
          <div><b>Não Úteis:</b> ${sConfig.naoUteis}</div>
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

window.abrirModalDelegacia = function(delId = null) {
  const modalAntigo = document.getElementById('modal-delegacia');
  if (modalAntigo) modalAntigo.remove();

  criarModalDelegaciaDOM();
  const modal = document.getElementById('modal-delegacia');

  const inputId = document.getElementById('modal-del-id');
  const selectTipoCadastro = document.getElementById('modal-del-tipo-cadastro');
  const inputNome = document.getElementById('modal-del-nome');
  const selectSdp = document.getElementById('modal-del-sdp');

  const pRegime = document.getElementById('modal-plantao-regime');
  const pIntervalo = document.getElementById('modal-plantao-intervalo');
  const pUteis = document.getElementById('modal-plantao-uteis');
  const pNaoUteis = document.getElementById('modal-plantao-nao-uteis');

  const sRegime = document.getElementById('modal-sobreaviso-regime');
  const sIntervalo = document.getElementById('modal-sobreaviso-intervalo');
  const sUteis = document.getElementById('modal-sobreaviso-uteis');
  const sNaoUteis = document.getElementById('modal-sobreaviso-nao-uteis');

  // Preenche seletor de SDPs dinamicamente
  const sdpsCadastradas = getListaSdpsUnicas();
  let sdpOptions = sdpsCadastradas.map(s => `<option value="${s}">${s}</option>`).join('');
  if (selectSdp) selectSdp.innerHTML = sdpOptions;

  // Preenche checkboxes para Plantão Unificado
  const containerVinculacao = document.getElementById('container-vinculo-delegacias');
  let delegaciasCheckboxes = (appState.delegacias || [])
    .filter(d => !delId || d.id !== delId)
    .map(d => `
      <label class="flex items-center gap-2 text-xs text-slate-700 bg-white p-1.5 rounded border border-slate-200">
        <input type="checkbox" name="vinculo_del_ids" value="${d.id}" class="rounded text-indigo-600 focus:ring-indigo-500">
        <span>${d.nome} (${d.subdivisao})</span>
      </label>
    `).join('');

  if (containerVinculacao) {
    containerVinculacao.innerHTML = delegaciasCheckboxes || `<p class="text-[11px] text-slate-500 italic">Nenhuma outra delegacia cadastrada.</p>`;
  }

  if (delId) {
    const del = appState.delegacias.find(d => d.id === delId);
    if (del) {
      inputId.value = del.id;
      inputNome.value = del.nome || '';
      
      const isUnif = Boolean(del.delegaciasIds && del.delegaciasIds.length > 0);
      selectTipoCadastro.value = isUnif ? 'UNIFICADO' : 'DELEGACIA';
      
      if (selectSdp) selectSdp.value = del.subdivisao || '8ª SDP';

      if (del.delegaciasIds) {
        document.querySelectorAll('input[name="vinculo_del_ids"]').forEach(chk => {
          if (del.delegaciasIds.includes(chk.value)) chk.checked = true;
        });
      }

      const pConfig = del.plantaoConfig || {};
      pRegime.value = pConfig.regime || del.regimeEscala || 'ININTERRUPTA';
      pIntervalo.value = pConfig.intervalo || del.intervaloSucessao || '24h';
      pUteis.value = pConfig.uteis || del.horarioUteis || del.horario24h || '08:00 às 08:00';
      pNaoUteis.value = pConfig.naoUteis || del.horarioNaoUteis || del.horario12h || '08:00 às 08:00';

      const sConfig = del.sobreavisoConfig || {};
      sRegime.value = sConfig.regime || 'INTERMITENTE';
      sIntervalo.value = sConfig.intervalo || '24h';
      sUteis.value = sConfig.uteis || '18:00 às 08:00';
      sNaoUteis.value = sConfig.naoUteis || '08:00 às 08:00';
    }
  } else {
    inputId.value = '';
    inputNome.value = '';
    selectTipoCadastro.value = 'DELEGACIA';
    if (selectSdp) selectSdp.value = '8ª SDP';

    pRegime.value = 'ININTERRUPTA';
    pIntervalo.value = '24h';
    pUteis.value = '08:00 às 08:00';
    pNaoUteis.value = '08:00 às 08:00';

    sRegime.value = 'INTERMITENTE';
    sIntervalo.value = '24h';
    sUteis.value = '18:00 às 08:00';
    sNaoUteis.value = '08:00 às 08:00';
  }

  window.mudarTipoCadastroModal();
  modal.classList.remove('hidden');
};

window.mudarTipoCadastroModal = function() {
  const tipo = document.getElementById('modal-del-tipo-cadastro')?.value;
  const boxUnificacao = document.getElementById('box-unificacao-delegacias');

  if (tipo === 'UNIFICADO') {
    boxUnificacao?.classList.remove('hidden');
  } else {
    boxUnificacao?.classList.add('hidden');
  }
};

window.fecharModalDelegacia = function() {
  document.getElementById('modal-delegacia')?.classList.add('hidden');
};

window.salvarDelegaciaModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('modal-del-id').value;
  const tipoCadastro = document.getElementById('modal-del-tipo-cadastro').value;
  const nome = document.getElementById('modal-del-nome').value.trim();
  const subdivisao = document.getElementById('modal-del-sdp').value;

  const vinculosIds = [];
  if (tipoCadastro === 'UNIFICADO') {
    document.querySelectorAll('input[name="vinculo_del_ids"]:checked').forEach(chk => {
      vinculosIds.push(chk.value);
    });
  }

  const plantaoConfig = {
    regime: document.getElementById('modal-plantao-regime').value,
    intervalo: document.getElementById('modal-plantao-intervalo').value,
    uteis: document.getElementById('modal-plantao-uteis').value.trim(),
    naoUteis: document.getElementById('modal-plantao-nao-uteis').value.trim()
  };

  const sobreavisoConfig = {
    regime: document.getElementById('modal-sobreaviso-regime').value,
    intervalo: document.getElementById('modal-sobreaviso-intervalo').value,
    uteis: document.getElementById('modal-sobreaviso-uteis').value.trim(),
    naoUteis: document.getElementById('modal-sobreaviso-nao-uteis').value.trim()
  };

  if (!nome) {
    alert("Informe o nome da unidade.");
    return;
  }

  let delAlvoId = id;

  if (delAlvoId) {
    const del = appState.delegacias.find(d => d.id === delAlvoId);
    if (del) {
      del.nome = nome;
      del.subdivisao = subdivisao;
      del.tipo = 'UNIDADE';
      del.delegaciasIds = tipoCadastro === 'UNIFICADO' ? vinculosIds : [];
      del.plantaoConfig = plantaoConfig;
      del.sobreavisoConfig = sobreavisoConfig;
      del.horarioUteis = plantaoConfig.uteis;
      del.horarioNaoUteis = plantaoConfig.naoUteis;

      await syncDocToFirestore('delegacias', del.id, del);
    }
  } else {
    delAlvoId = 'del_' + Date.now();
    const novaDel = {
      id: delAlvoId,
      nome,
      subdivisao,
      tipo: 'UNIDADE',
      delegaciasIds: tipoCadastro === 'UNIFICADO' ? vinculosIds : [],
      plantaoConfig,
      sobreavisoConfig,
      horarioUteis: plantaoConfig.uteis,
      horarioNaoUteis: plantaoConfig.naoUteis
    };

    if (!appState.delegacias) appState.delegacias = [];
    appState.delegacias.push(novaDel);

    await syncDocToFirestore('delegacias', delAlvoId, novaDel);
  }

  // Sincronização bidirecional do Plantão Unificado
  if (tipoCadastro === 'UNIFICADO') {
    const todasParticipantes = [delAlvoId, ...vinculosIds];

    for (const pId of todasParticipantes) {
      const pDel = appState.delegacias.find(d => d.id === pId);
      if (pDel) {
        pDel.delegaciasIds = todasParticipantes.filter(xId => xId !== pId);
        await syncDocToFirestore('delegacias', pDel.id, pDel);
      }
    }
  } else {
    for (const pDel of appState.delegacias) {
      if (pDel.delegaciasIds && pDel.delegaciasIds.includes(delAlvoId)) {
        pDel.delegaciasIds = pDel.delegaciasIds.filter(xId => xId !== delAlvoId);
        await syncDocToFirestore('delegacias', pDel.id, pDel);
      }
    }
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
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-slate-900 text-sm">Cadastrar / Editar Delegacia ou Plantão Unificado</h3>
          <button type="button" onclick="window.fecharModalDelegacia()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarDelegaciaModal(event)" class="space-y-4 text-xs">
          <input type="hidden" id="modal-del-id">

          <!-- Escolha do Tipo de Cadastro -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
            <div class="sm:col-span-1">
              <label class="block font-bold text-slate-800 mb-1">Tipo de Registro:</label>
              <select id="modal-del-tipo-cadastro" onchange="window.mudarTipoCadastroModal()" class="w-full border rounded-lg p-2 bg-white font-bold text-indigo-950">
                <option value="DELEGACIA">Delegacia Local</option>
                <option value="UNIFICADO">Plantão Unificado</option>
              </select>
            </div>

            <div class="sm:col-span-2">
              <label class="block font-bold text-slate-800 mb-1">Nome Completo da Delegacia:</label>
              <input type="text" id="modal-del-nome" required placeholder="Ex: Delegacia de Polícia de Loanda" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-900">
            </div>
          </div>

          <!-- Seletor de SDP -->
          <div>
            <label class="block font-bold text-slate-700 mb-1">Subdivisão / Regional (SDP):</label>
            <select id="modal-del-sdp" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
          </div>

          <!-- Seleção de Delegacias Integrantes (Apenas quando for Plantão Unificado) -->
          <div id="box-unificacao-delegacias" class="hidden bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-2">
            <label class="block font-bold text-purple-950">Marque as Delegacias Participantes deste Plantão Unificado:</label>
            <div id="container-vinculo-delegacias" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1"></div>
          </div>

          <!-- SEÇÃO 1: PLANTÃO ORDINÁRIO LOCAL -->
          <div class="p-3.5 bg-sky-50/70 rounded-2xl border border-sky-200 space-y-3">
            <span class="font-black text-sky-950 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <span>🚔</span> Configurações do Plantão Local
            </span>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Regime:</label>
                <select id="modal-plantao-regime" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
                  <option value="ININTERRUPTA">Ininterrupta (Sem Intervalo)</option>
                  <option value="INTERMITENTE">Intermitente (Com Pausa)</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Intervalo de Sucessão:</label>
                <select id="modal-plantao-intervalo" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
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

              <div>
                <label class="block font-bold text-emerald-900 text-[11px] mb-1">⏰ Horário (Dias Úteis):</label>
                <input type="text" id="modal-plantao-uteis" placeholder="08:00 às 08:00" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
              </div>

              <div>
                <label class="block font-bold text-amber-900 text-[11px] mb-1">⏰ Horário (Finais de Semana / Feriados):</label>
                <input type="text" id="modal-plantao-nao-uteis" placeholder="08:00 às 08:00" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
              </div>
            </div>
          </div>

          <!-- SEÇÃO 2: PLANTÃO DE SOBREAVISO -->
          <div class="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
            <span class="font-black text-amber-950 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <span>📞</span> Configurações do Plantão de Sobreaviso
            </span>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Regime:</label>
                <select id="modal-sobreaviso-regime" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
                  <option value="INTERMITENTE" selected>Intermitente (Com Pausa)</option>
                  <option value="ININTERRUPTA">Ininterrupta (Sem Intervalo)</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Intervalo de Sucessão:</label>
                <select id="modal-sobreaviso-intervalo" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
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

              <div>
                <label class="block font-bold text-emerald-900 text-[11px] mb-1">⏰ Horário (Dias Úteis):</label>
                <input type="text" id="modal-sobreaviso-uteis" placeholder="18:00 às 08:00" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
              </div>

              <div>
                <label class="block font-bold text-amber-900 text-[11px] mb-1">⏰ Horário (Finais de Semana / Feriados):</label>
                <input type="text" id="modal-sobreaviso-nao-uteis" placeholder="08:00 às 08:00" class="w-full border rounded-lg p-2 bg-white font-bold text-slate-800">
              </div>
            </div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2">
            <button type="button" onclick="window.fecharModalDelegacia()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">Salvar Cadastro</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
