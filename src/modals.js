// src/modals.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';

export function initModalsModule() {
  criarModalEscalaDOM();
  criarModalGeradorLoteDOM();
}

window.abrirModalEscala = function(dataSugerida = null, escalaId = null, scopeTarget = 'CRF') {
  let modal = document.getElementById('modal-escala');
  if (!modal) {
    criarModalEscalaDOM();
    modal = document.getElementById('modal-escala');
  }

  const inputId = document.getElementById('modal-esc-id');
  const selectScope = document.getElementById('modal-esc-scope');
  const inputData = document.getElementById('modal-esc-data');
  const selectTipo = document.getElementById('modal-esc-tipo');
  const selectTurno = document.getElementById('modal-esc-turno');
  const selectDelegacia = document.getElementById('modal-esc-delegacia');
  const buscaSrvInput = document.getElementById('modal-esc-busca-srv');

  if (selectScope) selectScope.value = scopeTarget;

  // 1. Opções de Tipo ajustadas por Escopo
  if (scopeTarget === 'CRF') {
    selectTipo.innerHTML = `
      <option value="REGULAR">REGULAR</option>
      <option value="EXTRAJORNADA">EXTRAJORNADA</option>
    `;
  } else {
    selectTipo.innerHTML = `
      <option value="PLANTÃO">PLANTÃO</option>
      <option value="SOBREAVISO">SOBREAVISO</option>
      <option value="EXTRAJORNADA">EXTRAJORNADA</option>
    `;
  }

  // 2. Preenche seletor de delegacias
  let delOptions = (appState.delegacias || []).map(d => 
    `<option value="${d.id}">${d.nome}</option>`
  ).join('');
  if (selectDelegacia) selectDelegacia.innerHTML = delOptions;

  // Pré-seleciona a delegacia ativa na Gestão por Delegacias
  if (scopeTarget === 'DELEGACIA' && appState.selectedDelegaciaId) {
    if (selectDelegacia) selectDelegacia.value = appState.selectedDelegaciaId;
  }

  // 3. Sugestão Inteligente de Próxima Data e Turno
  const hojeIso = getHojeISO();
  let dataInicial = dataSugerida || hojeIso;
  
  if (inputData) inputData.value = dataInicial;

  if (scopeTarget === 'CRF') {
    const horaAtual = new Date().getHours();
    selectTurno.value = horaAtual >= 18 ? '12h (N)' : '12h (D)';
  } else {
    selectTurno.value = '24h';
  }

  if (buscaSrvInput) buscaSrvInput.value = '';

  // 4. Edição ou Inclusão
  if (escalaId) {
    const esc = (appState.escalas || []).find(e => e.id === escalaId);
    if (esc) {
      inputId.value = esc.id;
      inputData.value = esc.data;
      selectTipo.value = (esc.tipo === 'SDP' ? 'EXTRAJORNADA' : (esc.tipo || 'REGULAR'));
      selectTurno.value = esc.turno || '12h (D)';
      if (selectDelegacia) selectDelegacia.value = esc.delegaciaId || (appState.delegacias[0]?.id || '');

      renderListaServidoresCheckboxes([esc.servidorId]);
    }
  } else {
    inputId.value = '';
    renderListaServidoresCheckboxes([]);
  }

  modal.classList.remove('hidden');
};

window.fecharModalEscala = function() {
  document.getElementById('modal-escala')?.classList.add('hidden');
};

window.filtrarServidoresModalInline = function() {
  const busca = document.getElementById('modal-esc-busca-srv')?.value?.toLowerCase() || '';
  const cards = document.querySelectorAll('.srv-checkbox-item');

  cards.forEach(card => {
    const nome = card.getAttribute('data-nome') || '';
    const cargo = card.getAttribute('data-cargo') || '';
    if (nome.includes(busca) || cargo.includes(busca)) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
};

function renderListaServidoresCheckboxes(idsSelecionados = []) {
  const container = document.getElementById('modal-esc-servidores-lista');
  if (!container) return;

  const listaSrv = [...(appState.servidores || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  if (listaSrv.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic p-2">Nenhum servidor cadastrado no sistema.</p>`;
    return;
  }

  container.innerHTML = listaSrv.map(srv => {
    const isChecked = idsSelecionados.includes(srv.id);
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    const isDel = (srv.cargo || '').toUpperCase().includes('DELEGADO');

    return `
      <label class="srv-checkbox-item flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer select-none"
             data-nome="${(srv.nome || '').toLowerCase()}" data-cargo="${(srv.cargo || '').toLowerCase()}">
        <div class="flex items-center gap-2.5">
          <input type="checkbox" name="modal_srv_ids" value="${srv.id}" ${isChecked ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4">
          <div>
            <div class="font-bold text-slate-900 text-xs">${srv.nome}</div>
            <div class="text-[10px] text-slate-500">${srv.cargo || 'APJ'} • ${del ? del.nome : (srv.delegaciaNome || 'Sem Lotação')}</div>
          </div>
        </div>
        ${isDel ? '<span class="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">DEL</span>' : ''}
      </label>
    `;
  }).join('');
}

window.salvarEscalaModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('modal-esc-id').value;
  const scope = document.getElementById('modal-esc-scope').value;
  const dataIso = document.getElementById('modal-esc-data').value;
  const tipo = document.getElementById('modal-esc-tipo').value;
  const turno = document.getElementById('modal-esc-turno').value;
  const delegaciaId = document.getElementById('modal-esc-delegacia').value;

  const checkboxes = document.querySelectorAll('input[name="modal_srv_ids"]:checked');
  const servidoresIds = Array.from(checkboxes).map(cb => cb.value);

  if (!dataIso) {
    alert("Selecione a data do plantão.");
    return;
  }

  if (servidoresIds.length === 0) {
    alert("Selecione pelo menos um policial para o plantão.");
    return;
  }

  const delAlvo = (appState.delegacias || []).find(d => d.id === delegaciaId);

  // Validação de Lotação / Plantão Unificado na Gestão por Delegacias
  if (scope === 'DELEGACIA' && delAlvo) {
    const foraDaLotacao = [];

    servidoresIds.forEach(sId => {
      const srv = (appState.servidores || []).find(s => s.id === sId);
      if (srv) {
        const pertenceDireto = srv.delegaciaId === delAlvo.id;
        const pertenceUnificado = delAlvo.delegaciasIds && delAlvo.delegaciasIds.includes(srv.delegaciaId);

        if (!pertenceDireto && !pertenceUnificado) {
          foraDaLotacao.push(srv.nome);
        }
      }
    });

    if (foraDaLotacao.length > 0) {
      const confirma = confirm(
        `⚠️ ATENÇÃO: O(s) seguinte(s) policial(is) não pertencem à lotação de "${delAlvo.nome}" nem a um Plantão Unificado com ela:\n\n` +
        `- ${foraDaLotacao.join('\n- ')}\n\n` +
        `Deseja realmente confirmar a inclusão na escala dessa unidade?`
      );
      if (!confirma) return;
    }
  }

  if (id) {
    // Edição individual
    const esc = (appState.escalas || []).find(e => e.id === id);
    if (esc) {
      esc.data = dataIso;
      esc.tipo = tipo;
      esc.turno = turno;
      esc.delegaciaId = delegaciaId;
      esc.servidorId = servidoresIds[0];
      await syncDocToFirestore('escalas', esc.id, esc);
    }
  } else {
    // Inclusão de múltiplos policiais selecionados
    for (const sId of servidoresIds) {
      const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const novaEscala = {
        id: newEscId,
        data: dataIso,
        servidorId: sId,
        delegaciaId: delegaciaId,
        scope: scope,
        tipo: tipo,
        turno: turno
      };

      if (!appState.escalas) appState.escalas = [];
      appState.escalas.push(novaEscala);
      await syncDocToFirestore('escalas', newEscId, novaEscala);
    }
  }

  window.fecharModalEscala();

  if (scope === 'CRF') window.filtrarTabelaCrfInline();
  else window.filtrarTabelaDelInline();
};

function getHojeISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function criarModalEscalaDOM() {
  const modalHTML = `
    <div id="modal-escala" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 class="font-bold text-slate-900 text-sm">Lançamento de Plantão / Escala</h3>
          <button type="button" onclick="window.fecharModalEscala()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarEscalaModal(event)" class="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
          <input type="hidden" id="modal-esc-id">
          <input type="hidden" id="modal-esc-scope">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Data do Plantão:</label>
              <input type="date" id="modal-esc-data" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Tipo de Plantão:</label>
              <select id="modal-esc-tipo" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Turno / Duração:</label>
              <select id="modal-esc-turno" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
                <option value="12h (D)">12h (D) - Diurno</option>
                <option value="12h (N)">12h (N) - Noturno</option>
                <option value="24h">24h - Integral</option>
                <option value="2 dias">2 Dias</option>
                <option value="3 dias">3 Dias</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Unidade / Lotação:</label>
              <select id="modal-esc-delegacia" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900"></select>
            </div>
          </div>

          <!-- FILTRO E SELEÇÃO DE POLICIAIS -->
          <div class="space-y-2 pt-2 border-t">
            <div class="flex items-center justify-between">
              <label class="block font-bold text-slate-800">Selecione o(s) Policial(is):</label>
              <span class="text-[10px] text-slate-500">Permite seleção múltipla</span>
            </div>

            <div>
              <input type="text" id="modal-esc-busca-srv" oninput="window.filtrarServidoresModalInline()" placeholder="🔍 Digite para filtrar policial..." class="w-full text-xs border border-slate-300 rounded-xl p-2 bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </div>

            <div id="modal-esc-servidores-lista" class="space-y-1.5 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200"></div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalEscala()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">Salvar Plantão</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function criarModalGeradorLoteDOM() {
  // Estrutura do gerador em lote
}
