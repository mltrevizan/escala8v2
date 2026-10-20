// src/delegacias.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';

// Função utilitária segura para registro de logs sem quebrar por falta de exportação
async function tentarRegistrarLog(modulo, acao, detalhe) {
  try {
    const logsModule = await import('./logs.js');
    if (typeof logsModule.registrarLog === 'function') {
      await logsModule.registrarLog(modulo, acao, detalhe);
      return;
    }
  } catch (e) {
    // Se o módulo ou a função não existirem, ignora silenciosamente
  }
  console.log(`[LOG - ${modulo}] ${acao}: ${detalhe}`);
}

let modalDelegaciaInstance = null;
let modalSubdivisaoInstance = null;
let delegaciaEmEdicaoId = null;
let subdivisaoEmEdicaoId = null;

/**
 * Inicialização dos Módulos e Event Listeners
 */
export function initDelegacias() {
  const btnNovaDelegacia = document.getElementById('btnNovaDelegacia') || document.getElementById('btn-nova-delegacia');
  const btnNovaSubdivisao = document.getElementById('btnNovaSubdivisao') || document.getElementById('btn-nova-subdivisao');
  const formDelegacia = document.getElementById('formDelegacia');
  const formSubdivisao = document.getElementById('formSubdivisao');

  if (btnNovaDelegacia) {
    btnNovaDelegacia.onclick = () => abrirModalDelegacia();
  }

  if (btnNovaSubdivisao) {
    btnNovaSubdivisao.onclick = () => abrirModalSubdivisao();
  }

  if (formDelegacia) {
    formDelegacia.onsubmit = handleSalvarDelegacia;
  }

  if (formSubdivisao) {
    formSubdivisao.onsubmit = handleSalvarSubdivisao;
  }

  initFiltrosDelegacia();
  carregarListaSubdivisoes();
  renderizarTabelaDelegacias();
}

/**
 * Carrega e Inicializa Filtros de Busca e Subdivisão na Tela
 */
export function initFiltrosDelegacia() {
  const inputBusca = document.getElementById('buscaDelegacia') || document.getElementById('input-busca-delegacia');
  const selectSdp = document.getElementById('filtroSdpDelegacias') || document.getElementById('select-filtro-sdp');

  if (inputBusca) {
    inputBusca.oninput = () => renderizarTabelaDelegacias();
  }

  if (selectSdp) {
    selectSdp.onchange = () => renderizarTabelaDelegacias();
  }
}

/**
 * Preenche o select de subdivisões (SDPs) nos filtros e modais
 */
export function carregarListaSubdivisoes() {
  const selectFiltro = document.getElementById('filtroSdpDelegacias') || document.getElementById('select-filtro-sdp');
  const selectForm = document.getElementById('delSubdivisao');

  const sdps = [...(appState.sdps || [])].sort((a, b) => 
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true })
  );

  if (selectFiltro) {
    const valorAtual = selectFiltro.value;
    selectFiltro.innerHTML = '<option value="TODAS">Todas as Subdivisões</option>';
    sdps.forEach(sdp => {
      const opt = document.createElement('option');
      opt.value = sdp.id || sdp.nome;
      opt.textContent = sdp.nome;
      selectFiltro.appendChild(opt);
    });
    selectFiltro.value = valorAtual || 'TODAS';
  }

  if (selectForm) {
    const valorAtual = selectForm.value;
    selectForm.innerHTML = '<option value="">Selecione uma Subdivisão...</option>';
    sdps.forEach(sdp => {
      const opt = document.createElement('option');
      opt.value = sdp.id || sdp.nome;
      opt.textContent = sdp.nome;
      selectForm.appendChild(opt);
    });
    selectForm.value = valorAtual || '';
  }
}

/**
 * Renderiza a Tabela Principal de Delegacias
 */
export function renderizarTabelaDelegacias() {
  // Procura o container principal da aba no HTML
  let container = document.getElementById('tab-content-unidades') || 
                  document.getElementById('delegacias-container') || 
                  document.getElementById('tab-content-delegacias');

  if (!container) return;

  // Se o container ainda não tiver a estrutura da tabela e filtros, injeta automaticamente
  let tbody = document.getElementById('tbodyDelegacias') || document.getElementById('tabela-delegacias-corpo');
  if (!tbody) {
    container.innerHTML = `
      <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="font-bold text-sm text-slate-800">Gestão de Delegacias e Subdivisões</h2>
            <p class="text-[11px] text-slate-500">Cadastros de unidades, regimes de plantão e consórcios</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="window.abrirModalDelegaciaDirect()" class="px-3 py-2 bg-black hover:bg-slate-800 text-[#BEA55A] border border-[#BEA55A] font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
              ➕ Nova Delegacia
            </button>
            <button onclick="window.abrirModalSubdivisaoDirect()" class="px-3 py-2 bg-[#2A2B2D] hover:bg-black text-white border border-slate-600 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">
              🏛️ Nova SDP
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🔍 Buscar Delegacia:</label>
            <input type="text" id="buscaDelegacia" placeholder="Filtrar por nome..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:outline-none">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-0.5">🏛️ Subdivisão (SDP):</label>
            <select id="filtroSdpDelegacias" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
              <option value="TODAS">Todas as Subdivisões</option>
            </select>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto font-sans">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
              <th class="p-3">Nome da Unidade</th>
              <th class="p-3">Subdivisão (SDP)</th>
              <th class="p-3">Regime</th>
              <th class="p-3">Tipo</th>
              <th class="p-3">Horários Padronizados</th>
              <th class="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody id="tbodyDelegacias" class="divide-y divide-slate-200"></tbody>
        </table>
      </div>
    `;

    initFiltrosDelegacia();
    carregarListaSubdivisoes();
    tbody = document.getElementById('tbodyDelegacias');
  }

  tbody.innerHTML = '';

  const busca = (document.getElementById('buscaDelegacia')?.value || document.getElementById('input-busca-delegacia')?.value || '').toLowerCase().trim();
  const sdpFiltro = document.getElementById('filtroSdpDelegacias')?.value || document.getElementById('select-filtro-sdp')?.value || 'TODAS';

  let lista = [...(appState.delegacias || [])];

  // Filtro por SDP
  if (sdpFiltro !== 'TODAS') {
    lista = lista.filter(d => 
      String(d.sdpId) === String(sdpFiltro) || 
      String(d.subdivisao) === String(sdpFiltro)
    );
  }

  // Filtro por Busca de Texto
  if (busca) {
    lista = lista.filter(d => 
      (d.nome || '').toLowerCase().includes(busca) ||
      (d.subdivisao || '').toLowerCase().includes(busca)
    );
  }

  // Ordenação Alfabética / Numérica Natural PT-BR
  lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true }));

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Nenhuma delegacia encontrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(del => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
      <td class="p-3 font-bold text-slate-900">${del.nome || '-'}</td>
      <td class="p-3 font-semibold text-slate-700">${del.subdivisao || del.sdpId || '-'}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 text-[10px] font-bold rounded border ${del.isConsorcio ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-300'}">
          ${del.isConsorcio ? 'Plantão Unificado' : 'Unidade Simples'}
        </span>
      </td>
      <td class="p-3 font-semibold text-slate-600">${del.tipo || 'UNIDADE'}</td>
      <td class="p-3 font-mono text-[11px] text-slate-500">
        P: ${del.plantaoConfig?.regime || 'ININTERRUPTA'}<br>
        S: ${del.sobreavisoConfig?.regime || 'INTERMITENTE'}
      </td>
      <td class="p-3 text-right space-x-1">
        <button onclick="window.abrirModalDelegaciaDirect('${del.id}')" class="px-2.5 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded font-bold text-[10px] shadow-xs cursor-pointer">
          ✏️ Editar
        </button>
        <button onclick="window.excluirDelegaciaDirect('${del.id}')" class="px-2.5 py-1 bg-[#E2001A] hover:bg-red-700 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer">
          🗑️ Excluir
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Abre o Modal de Cadastro / Edição de Delegacia
 */
export function abrirModalDelegacia(id = null) {
  delegaciaEmEdicaoId = id;
  carregarListaSubdivisoes();

  const elModal = document.getElementById('modalDelegacia');
  if (!elModal) return;

  if (!modalDelegaciaInstance && typeof bootstrap !== 'undefined') {
    modalDelegaciaInstance = new bootstrap.Modal(elModal);
  }

  const form = document.getElementById('formDelegacia');
  if (form) form.reset();

  const titulo = document.getElementById('modalDelegaciaTitulo');

  if (id) {
    if (titulo) titulo.textContent = 'Editar Delegacia';
    const del = (appState.delegacias || []).find(d => String(d.id) === String(id));
    if (del) {
      if (document.getElementById('delNome')) document.getElementById('delNome').value = del.nome || '';
      if (document.getElementById('delSubdivisao')) document.getElementById('delSubdivisao').value = del.sdpId || del.subdivisao || '';
      if (document.getElementById('delTipo')) document.getElementById('delTipo').value = del.tipo || 'UNIDADE';
      if (document.getElementById('delIsConsorcio')) document.getElementById('delIsConsorcio').checked = Boolean(del.isConsorcio);

      // Configurações de Plantão
      if (document.getElementById('plantaoRegime')) document.getElementById('plantaoRegime').value = del.plantaoConfig?.regime || 'ININTERRUPTA';
      if (document.getElementById('plantaoIntervalo')) document.getElementById('plantaoIntervalo').value = del.plantaoConfig?.intervalo || '24h';
      if (document.getElementById('plantaoUteis')) document.getElementById('plantaoUteis').value = del.plantaoConfig?.uteis || '08:00 às 08:00';
      if (document.getElementById('plantaoNaoUteis')) document.getElementById('plantaoNaoUteis').value = del.plantaoConfig?.naoUteis || '08:00 às 08:00';

      // Configurações de Sobreaviso
      if (document.getElementById('sobreavisoRegime')) document.getElementById('sobreavisoRegime').value = del.sobreavisoConfig?.regime || 'INTERMITENTE';
      if (document.getElementById('sobreavisoIntervalo')) document.getElementById('sobreavisoIntervalo').value = del.sobreavisoConfig?.intervalo || '24h';
      if (document.getElementById('sobreavisoUteis')) document.getElementById('sobreavisoUteis').value = del.sobreavisoConfig?.uteis || '18:00 às 08:00';
      if (document.getElementById('sobreavisoNaoUteis')) document.getElementById('sobreavisoNaoUteis').value = del.sobreavisoConfig?.naoUteis || '08:00 às 08:00';
    }
  } else {
    if (titulo) titulo.textContent = 'Nova Delegacia';
  }

  if (modalDelegaciaInstance) {
    modalDelegaciaInstance.show();
  } else {
    elModal.classList.remove('hidden');
    elModal.style.display = 'flex';
  }
}

/**
 * Event Handler para Salvar Delegacia do Formulário
 */
async function handleSalvarDelegacia(e) {
  e.preventDefault();

  const nomeInput = document.getElementById('delNome')?.value.trim();
  const selectSubdivisao = document.getElementById('delSubdivisao');
  
  if (!nomeInput || !selectSubdivisao || !selectSubdivisao.value) {
    alert('Por favor, preencha o Nome e a Subdivisão da Delegacia.');
    return;
  }

  const sdpValor = selectSubdivisao.value;
  const sdpTexto = selectSubdivisao.options[selectSubdivisao.selectedIndex].text;

  const dados = {
    id: delegaciaEmEdicaoId,
    nome: nomeInput,
    subdivisao: sdpTexto,
    sdpId: sdpValor,
    tipo: document.getElementById('delTipo')?.value || 'UNIDADE',
    isConsorcio: document.getElementById('delIsConsorcio')?.checked || false,
    delegaciasIds: [],
    
    plantaoConfig: {
      regime: document.getElementById('plantaoRegime')?.value || 'ININTERRUPTA',
      intervalo: document.getElementById('plantaoIntervalo')?.value || '24h',
      uteis: document.getElementById('plantaoUteis')?.value || '08:00 às 08:00',
      naoUteis: document.getElementById('plantaoNaoUteis')?.value || '08:00 às 08:00'
    },
    sobreavisoConfig: {
      regime: document.getElementById('sobreavisoRegime')?.value || 'INTERMITENTE',
      intervalo: document.getElementById('sobreavisoIntervalo')?.value || '24h',
      uteis: document.getElementById('sobreavisoUteis')?.value || '18:00 às 08:00',
      naoUteis: document.getElementById('sobreavisoNaoUteis')?.value || '08:00 às 08:00'
    },
    horarioUteis: document.getElementById('plantaoUteis')?.value || '08:00 às 08:00',
    horarioNaoUteis: document.getElementById('plantaoNaoUteis')?.value || '08:00 às 08:00'
  };

  const sucesso = await salvarDelegacia(dados);
  if (sucesso) {
    if (modalDelegaciaInstance) modalDelegaciaInstance.hide();
    const elModal = document.getElementById('modalDelegacia');
    if (elModal) {
      elModal.classList.add('hidden');
      elModal.style.display = 'none';
    }
  }
}

/**
 * Função Core para Salvar Delegacia no Firestore e Consolidado
 */
export async function salvarDelegacia(dadosForm) {
  try {
    const idExistente = dadosForm.id;
    const sdpValor = dadosForm.sdpId || dadosForm.subdivisao;

    const novaDelegacia = {
      id: idExistente || `del_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      nome: dadosForm.nome.trim(),
      subdivisao: dadosForm.subdivisao || sdpValor,
      sdpId: sdpValor,
      tipo: dadosForm.tipo || "UNIDADE",
      isConsorcio: Boolean(dadosForm.isConsorcio),
      delegaciasIds: Array.isArray(dadosForm.delegaciasIds) ? dadosForm.delegaciasIds : [],
      
      plantaoConfig: dadosForm.plantaoConfig || {
        intervalo: "24h",
        naoUteis: "08:00 às 08:00",
        regime: "ININTERRUPTA",
        uteis: "08:00 às 08:00"
      },
      sobreavisoConfig: dadosForm.sobreavisoConfig || {
        intervalo: "24h",
        naoUteis: "08:00 às 08:00",
        regime: "INTERMITENTE",
        uteis: "18:00 às 08:00"
      },
      horarioUteis: dadosForm.horarioUteis || "08:00 às 08:00",
      horarioNaoUteis: dadosForm.horarioNaoUteis || "08:00 às 08:00",
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    };

    let listaDelegacias = [...(appState.delegacias || [])];
    const index = listaDelegacias.findIndex(d => String(d.id) === String(novaDelegacia.id));

    if (index >= 0) {
      listaDelegacias[index] = novaDelegacia;
    } else {
      listaDelegacias.push(novaDelegacia);
    }

    // 1. Atualiza lote no Firestore (Consolidado de Delegacias)
    await syncDocToFirestore('consolidados', 'delegacias', {
      lista: listaDelegacias,
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. Sincroniza o array `delegaciasIds` dentro da SDP
    let listaSdps = [...(appState.sdps || [])];
    listaSdps = listaSdps.map(sdp => {
      if (String(sdp.id) === String(sdpValor) || String(sdp.nome) === String(novaDelegacia.subdivisao)) {
        const arr = Array.isArray(sdp.delegaciasIds) ? [...sdp.delegaciasIds] : [];
        if (!arr.includes(novaDelegacia.id)) arr.push(novaDelegacia.id);
        return { ...sdp, delegaciasIds: arr };
      }
      return sdp;
    });

    await syncDocToFirestore('consolidados', 'sdps', {
      lista: listaSdps,
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 3. Atualiza estado em memória
    appState.delegacias = listaDelegacias;
    appState.sdps = listaSdps;

    // 4. Incrementa versão de controle
    const db = firebase.firestore();
    await db.collection('controle').doc('versoes').set({
      delegacias: firebase.firestore.FieldValue.increment(1),
      sdps: firebase.firestore.FieldValue.increment(1),
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await tentarRegistrarLog('DELEGACIA', idExistente ? 'EDIÇÃO' : 'CRIAÇÃO', `Delegacia ${novaDelegacia.nome} salva com sucesso.`);

    renderizarTabelaDelegacias();
    return true;

  } catch (err) {
    console.error("Erro ao salvar delegacia:", err);
    alert("Erro ao salvar delegacia: " + err.message);
    return false;
  }
}

/**
 * Exclui uma Delegacia
 */
export async function excluirDelegacia(id) {
  const del = (appState.delegacias || []).find(d => String(d.id) === String(id));
  const nomeDel = del ? del.nome : id;

  if (!confirm(`Tem certeza que deseja excluir a delegacia "${nomeDel}"?`)) return;

  try {
    let listaDelegacias = (appState.delegacias || []).filter(d => String(d.id) !== String(id));

    await syncDocToFirestore('consolidados', 'delegacias', {
      lista: listaDelegacias,
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Remove do array de delegaciasIds na SDP
    let listaSdps = (appState.sdps || []).map(sdp => {
      if (Array.isArray(sdp.delegaciasIds)) {
        return {
          ...sdp,
          delegaciasIds: sdp.delegaciasIds.filter(delId => String(delId) !== String(id))
        };
      }
      return sdp;
    });

    await syncDocToFirestore('consolidados', 'sdps', {
      lista: listaSdps,
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    });

    appState.delegacias = listaDelegacias;
    appState.sdps = listaSdps;

    const db = firebase.firestore();
    await db.collection('controle').doc('versoes').set({
      delegacias: firebase.firestore.FieldValue.increment(1),
      sdps: firebase.firestore.FieldValue.increment(1),
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await tentarRegistrarLog('DELEGACIA', 'EXCLUSÃO', `Delegacia ${nomeDel} excluída.`);

    renderizarTabelaDelegacias();

  } catch (err) {
    console.error("Erro ao excluir delegacia:", err);
    alert("Erro ao excluir delegacia: " + err.message);
  }
}

/**
 * Modais e Operações de Subdivisão (SDP)
 */
export function abrirModalSubdivisao(id = null) {
  subdivisaoEmEdicaoId = id;
  const elModal = document.getElementById('modalSubdivisao');
  if (!elModal) return;

  if (!modalSubdivisaoInstance && typeof bootstrap !== 'undefined') {
    modalSubdivisaoInstance = new bootstrap.Modal(elModal);
  }

  const form = document.getElementById('formSubdivisao');
  if (form) form.reset();

  const titulo = document.getElementById('modalSubdivisaoTitulo');

  if (id) {
    if (titulo) titulo.textContent = 'Editar Subdivisão';
    const sdp = (appState.sdps || []).find(s => String(s.id) === String(id));
    if (sdp) {
      if (document.getElementById('sdpNome')) document.getElementById('sdpNome').value = sdp.nome || '';
    }
  } else {
    if (titulo) titulo.textContent = 'Nova Subdivisão';
  }

  if (modalSubdivisaoInstance) {
    modalSubdivisaoInstance.show();
  } else {
    elModal.classList.remove('hidden');
    elModal.style.display = 'flex';
  }
}

async function handleSalvarSubdivisao(e) {
  e.preventDefault();

  const nomeInput = document.getElementById('sdpNome')?.value.trim();
  if (!nomeInput) {
    alert('Por favor, informe o nome da Subdivisão.');
    return;
  }

  const dados = {
    id: subdivisaoEmEdicaoId,
    nome: nomeInput
  };

  const sucesso = await salvarSubdivisao(dados);
  if (sucesso) {
    if (modalSubdivisaoInstance) modalSubdivisaoInstance.hide();
    const elModal = document.getElementById('modalSubdivisao');
    if (elModal) {
      elModal.classList.add('hidden');
      elModal.style.display = 'none';
    }
  }
}

export async function salvarSubdivisao(dadosForm) {
  try {
    const idExistente = dadosForm.id;
    const novaSdp = {
      id: idExistente || `sdp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      nome: dadosForm.nome.trim(),
      delegaciasIds: [],
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    };

    let listaSdps = [...(appState.sdps || [])];
    const index = listaSdps.findIndex(s => String(s.id) === String(novaSdp.id));

    if (index >= 0) {
      listaSdps[index] = { ...listaSdps[index], nome: novaSdp.nome };
    } else {
      listaSdps.push(novaSdp);
    }

    await syncDocToFirestore('consolidados', 'sdps', {
      lista: listaSdps,
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    });

    appState.sdps = listaSdps;

    const db = firebase.firestore();
    await db.collection('controle').doc('versoes').set({
      sdps: firebase.firestore.FieldValue.increment(1),
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    carregarListaSubdivisoes();
    renderizarTabelaDelegacias();
    return true;

  } catch (err) {
    console.error("Erro ao salvar subdivisao:", err);
    alert("Erro ao salvar subdivisão: " + err.message);
    return false;
  }
}

/**
 * Helper Utility Functions
 */
export function carregarListaDelegaciasSelect(selectElementId, sdpFiltroId = null) {
  const select = typeof selectElementId === 'string'
    ? document.getElementById(selectElementId)
    : selectElementId;

  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = '<option value="">Selecione uma Delegacia...</option>';

  let lista = [...(appState.delegacias || [])];

  if (sdpFiltroId && sdpFiltroId !== 'TODAS') {
    lista = lista.filter(d => 
      String(d.sdpId) === String(sdpFiltroId) || 
      String(d.subdivisao) === String(sdpFiltroId)
    );
  }

  // Ordenação Alfabética e Numérica Natural PT-BR
  lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true }));

  lista.forEach(del => {
    const opt = document.createElement('option');
    opt.value = del.id;
    opt.textContent = del.nome;
    select.appendChild(opt);
  });

  select.value = valorAtual || '';
}

export function getDelegaciasAtivas() {
  return (appState.delegacias || []).filter(d => isUnidadeAtiva(d));
}

export function getDelegaciaById(id) {
  return (appState.delegacias || []).find(d => String(d.id) === String(id)) || null;
}

export function isUnidadeAtiva(delegacia) {
  if (!delegacia) return false;
  return delegacia.status !== 'INATIVA';
}

/**
 * Popula dropdowns de delegacias considerando apenas unidades ativas ou registradas em escalas
 */
export function popularDropdownDelegaciasComEscala(selectElementId, sdpFiltroId = null) {
  const select = typeof selectElementId === 'string' 
    ? document.getElementById(selectElementId) 
    : selectElementId;

  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = '<option value="TODAS">Todas as Delegacias</option>';

  let lista = [...(appState.delegacias || [])];

  if (sdpFiltroId && sdpFiltroId !== 'TODAS') {
    lista = lista.filter(d => 
      String(d.sdpId) === String(sdpFiltroId) || 
      String(d.subdivisao) === String(sdpFiltroId)
    );
  }

  // Ordenação Alfabética e Numérica Natural PT-BR
  lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true }));

  lista.forEach(del => {
    const opt = document.createElement('option');
    opt.value = del.id;
    opt.textContent = del.nome;
    select.appendChild(opt);
  });

  select.value = valorAtual || 'TODAS';
}

/**
 * Renderiza os cards das delegacias (requerido pelo app.js)
 */
export function renderDelegaciasCards(containerId = 'containerDelegaciasCards') {
  renderizarTabelaDelegacias();
}

/**
 * Renderiza os cards de subdivisões (requerido pelo app.js)
 */
export function renderSubdivisoesCards(containerId = 'containerSubdivisoesCards') {
  carregarListaSubdivisoes();
}

// Vincula atalhos globais diretos na janela para acionamento transparente
window.abrirModalDelegaciaDirect = abrirModalDelegacia;
window.abrirModalSubdivisaoDirect = abrirModalSubdivisao;
window.excluirDelegaciaDirect = excluirDelegacia;
