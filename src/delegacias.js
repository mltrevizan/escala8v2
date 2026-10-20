import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';

// Função utilitária segura para registo de logs sem quebrar por falta de exportação
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
  const btnNovaDelegacia = document.getElementById('btnNovaDelegacia');
  const btnNovaSubdivisao = document.getElementById('btnNovaSubdivisao');
  const formDelegacia = document.getElementById('formDelegacia');
  const formSubdivisao = document.getElementById('formSubdivisao');

  if (btnNovaDelegacia) {
    btnNovaDelegacia.addEventListener('click', () => abrirModalDelegacia());
  }

  if (btnNovaSubdivisao) {
    btnNovaSubdivisao.addEventListener('click', () => abrirModalSubdivisao());
  }

  if (formDelegacia) {
    formDelegacia.addEventListener('submit', handleSalvarDelegacia);
  }

  if (formSubdivisao) {
    formSubdivisao.addEventListener('submit', handleSalvarSubdivisao);
  }

  initFiltrosDelegacia();
  carregarListaSubdivisoes();
  renderizarTabelaDelegacias();
}

/**
 * Carrega e Inicializa Filtros de Busca e Subdivisão na Tela
 */
export function initFiltrosDelegacia() {
  const inputBusca = document.getElementById('buscaDelegacia');
  const selectSdp = document.getElementById('filtroSdpDelegacias');

  if (inputBusca) {
    inputBusca.addEventListener('input', () => renderizarTabelaDelegacias());
  }

  if (selectSdp) {
    selectSdp.addEventListener('change', () => renderizarTabelaDelegacias());
  }
}

/**
 * Preenche o select de subdivisões (SDPs) nos filtros e modais
 */
export function carregarListaSubdivisoes() {
  const selectFiltro = document.getElementById('filtroSdpDelegacias');
  const selectForm = document.getElementById('delSubdivisao');

  const sdps = appState.sdps || [];

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
  const tbody = document.getElementById('tbodyDelegacias');
  if (!tbody) return;

  tbody.innerHTML = '';

  const busca = (document.getElementById('buscaDelegacia')?.value || '').toLowerCase();
  const sdpFiltro = document.getElementById('filtroSdpDelegacias')?.value || 'TODAS';

  let lista = appState.delegacias || [];

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

  // Ordenação Alfabética / Numérica Natural
  lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true }));

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma delegacia encontrada.</td></tr>`;
    return;
  }

  lista.forEach(del => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${del.nome || '-'}</strong></td>
      <td>${del.subdivisao || del.sdpId || '-'}</td>
      <td><span class="badge ${del.isConsorcio ? 'bg-warning text-dark' : 'bg-secondary'}">${del.isConsorcio ? 'Plantão Unificado' : 'Unidade Simples'}</span></td>
      <td>${del.tipo || 'UNIDADE'}</td>
      <td>
        <small class="text-muted">
          P: ${del.plantaoConfig?.regime || 'ININTERRUPTA'}<br>
          S: ${del.sobreavisoConfig?.regime || 'INTERMITENTE'}
        </small>
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary me-1 btn-editar-del" data-id="${del.id}" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-excluir-del" data-id="${del.id}" title="Excluir">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Event Listeners nos Botões de Ação
  tbody.querySelectorAll('.btn-editar-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      abrirModalDelegacia(id);
    });
  });

  tbody.querySelectorAll('.btn-excluir-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      excluirDelegacia(id);
    });
  });
}

/**
 * Abre o Modal de Cadastro / Edição de Delegacia
 */
export function abrirModalDelegacia(id = null) {
  delegaciaEmEdicaoId = id;
  carregarListaSubdivisoes();

  const elModal = document.getElementById('modalDelegacia');
  if (!elModal) return;

  if (!modalDelegaciaInstance) {
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

  modalDelegaciaInstance.show();
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
    sdpId: sdpValor, // Preserva e garante o ID relacional da SDP
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
  if (sucesso && modalDelegaciaInstance) {
    modalDelegaciaInstance.hide();
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
      sdpId: sdpValor, // ESTRUTURA COMPLETA V1
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

  if (!modalSubdivisaoInstance) {
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

  modalSubdivisaoInstance.show();
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
  if (sucesso && modalSubdivisaoInstance) {
    modalSubdivisaoInstance.hide();
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
  const select = document.getElementById(selectElementId);
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = '<option value="">Selecione uma Delegacia...</option>';

  let lista = appState.delegacias || [];

  if (sdpFiltroId && sdpFiltroId !== 'TODAS') {
    lista = lista.filter(d => 
      String(d.sdpId) === String(sdpFiltroId) || 
      String(d.subdivisao) === String(sdpFiltroId)
    );
  }

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
