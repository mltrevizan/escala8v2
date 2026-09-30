// src/modals.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';
import { renderServidoresTable } from './servidores.js';
import { renderDelegaciasCards } from './delegacias.js';

// Injeta a estrutura HTML de todos os modais no DOM
export function initModalsModule() {
  const container = document.createElement('div');
  container.id = 'modals-root';
  container.innerHTML = `
    <!-- Modal Adicionar/Editar Escala -->
    <div id="modal-escala" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 id="modal-escala-titulo" class="font-bold text-slate-900 text-sm">Lançamento de Plantão</h3>
          <button onclick="window.fecharModalEscala()" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onsubmit="window.salvarEscalaModal(event)" class="space-y-3 text-xs">
          <input type="hidden" id="modal-escala-id">

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Data do Plantão:</label>
              <input type="date" id="modal-escala-data" required class="w-full border rounded-xl p-2 bg-slate-50 font-mono font-bold">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Tipo / Modalidade:</label>
              <select id="modal-escala-tipo" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-indigo-700"></select>
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Policial / Servidor:</label>
            <select id="modal-escala-servidor" required class="w-full border rounded-xl p-2 bg-slate-50 font-medium"></select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Unidade / Lotação:</label>
              <select id="modal-escala-delegacia" required class="w-full border rounded-xl p-2 bg-slate-50 font-medium"></select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Turno de Serviço:</label>
              <select id="modal-escala-turno" class="w-full border rounded-xl p-2 bg-slate-50 font-semibold">
                <option value="24h">24 Horas (Integral)</option>
                <option value="12h (D)">12 Horas (Diurno - 08h às 20h)</option>
                <option value="12h (N)">12 Horas (Noturno - 20h às 08h)</option>
              </select>
            </div>
          </div>

          <!-- Réplica Automática -->
          <div class="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-indigo-900 text-[11px]">⚡ Réplica Automática (Opcional):</span>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" id="chk-replicar-plantao" onchange="window.toggleReplicacaoOptions()" class="rounded text-indigo-600">
                <span class="text-[10px] font-bold text-indigo-700">Replicar Plantão</span>
              </label>
            </div>

            <div id="box-replicacao" class="hidden grid grid-cols-2 gap-2 pt-2 border-t border-indigo-200/60">
              <div>
                <label class="block font-semibold text-slate-600 text-[10px] mb-1">Frequência:</label>
                <select id="modal-replica-frequencia" class="w-full border rounded-lg p-1.5 bg-white text-[10px] font-bold">
                  <option value="1">A cada 1 dia (Diário)</option>
                  <option value="2">A cada 2 dias (48 horas)</option>
                  <option value="3">A cada 3 dias (72 horas)</option>
                  <option value="7">Semanalmente (Mesmo dia)</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-600 text-[10px] mb-1">Repetir quantas vezes?</label>
                <input type="number" id="modal-replica-qtd" min="1" max="15" value="3" class="w-full border rounded-lg p-1.5 bg-white font-mono font-bold">
              </div>
            </div>
          </div>

          <div class="pt-3 border-t flex items-center justify-between">
            <button type="button" id="btn-excluir-escala" onclick="window.excluirEscalaAtual()" class="hidden px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded-xl font-bold">
              🗑️ Excluir Plantão
            </button>
            
            <div class="flex justify-end gap-2 ml-auto">
              <button type="button" onclick="window.fecharModalEscala()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow">Salvar Plantão</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Editar Servidor -->
    <div id="modal-servidor" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-slate-900 text-sm">Editar Cadastro de Policial</h3>
          <button onclick="window.fecharModalServidor()" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onsubmit="window.salvarServidorModal(event)" class="space-y-3 text-xs">
          <input type="hidden" id="modal-srv-id">

          <div>
            <label class="block font-bold text-slate-700 mb-1">Nome Completo:</label>
            <input type="text" id="modal-srv-nome" required class="w-full border rounded-xl p-2 bg-slate-50 font-bold">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Cargo:</label>
              <input type="text" id="modal-srv-cargo" required class="w-full border rounded-xl p-2 bg-slate-50">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Login:</label>
              <input type="text" id="modal-srv-login" required class="w-full border rounded-xl p-2 bg-slate-50 font-mono">
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Telefone / Contato:</label>
            <input type="text" id="modal-srv-telefone" class="w-full border rounded-xl p-2 bg-slate-50">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Lotação (Delegacia):</label>
            <select id="modal-srv-delegacia" required class="w-full border rounded-xl p-2 bg-slate-50 font-medium"></select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Nível de Acesso:</label>
            <select id="modal-srv-nivel" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-indigo-700">
              <option value="APJ">APJ / Agente</option>
              <option value="DELEGADO">DELEGADO</option>
              <option value="SUPERINTENDENTE">SUPERINTENDENTE</option>
              <option value="COORDENADOR">COORDENADOR</option>
              <option value="ADMINISTRADOR">ADMINISTRADOR</option>
            </select>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2">
            <button type="button" onclick="window.fecharModalServidor()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow">Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Plantão Unificado -->
    <div id="modal-unificacao" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-slate-900 text-sm">Configurar Plantão Unificado</h3>
          <button onclick="window.fecharModalUnificacao()" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onsubmit="window.salvarUnificacao(event)" class="space-y-4 text-xs">
          <input type="hidden" id="modal-unificacao-id">
          
          <div>
            <label class="block font-bold text-slate-700 mb-1">Delegacia Principal:</label>
            <input type="text" id="modal-unificacao-nome" readonly class="w-full border rounded-xl p-2 bg-slate-100 text-slate-600 font-bold">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Selecione as Delegacias participantes deste Plantão Unificado:</label>
            <div id="modal-unificacao-lista" class="space-y-1.5 max-h-48 overflow-y-auto border p-2 rounded-xl bg-slate-50"></div>
          </div>

          <div class="pt-3 border-t flex justify-end gap-2">
            <button type="button" onclick="window.fecharModalUnificacao()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow">Salvar Unificação</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  setupModalFunctions();
}

// Funções Globais de Controle dos Modais
function setupModalFunctions() {
  // Modal de Escalas
  window.abrirModalEscala = function(dateStr = null, escalaId = null) {
    const modal = document.getElementById('modal-escala');
    if (!modal) return;

    const btnExcluir = document.getElementById('btn-excluir-escala');
    const tituloModal = document.getElementById('modal-escala-titulo');
    const chkReplicar = document.getElementById('chk-replicar-plantao');
    const boxReplicacao = document.getElementById('box-replicacao');

    if (chkReplicar) chkReplicar.checked = false;
    if (boxReplicacao) boxReplicacao.classList.add('hidden');

    const selectServidor = document.getElementById('modal-escala-servidor');
    selectServidor.innerHTML = appState.servidores
      .map(s => `<option value="${s.id}">${s.nome} (${s.cargo})</option>`)
      .join('');

    const selectDelegacia = document.getElementById('modal-escala-delegacia');
    selectDelegacia.innerHTML = appState.delegacias
      .map(d => `<option value="${d.id}">${d.nome}</option>`)
      .join('');

    const selectTipo = document.getElementById('modal-escala-tipo');
    if (selectTipo) {
      if (appState.calendarScope === 'CRF') {
        selectTipo.innerHTML = `
          <option value="REGULAR">Escala Regular (CRF)</option>
          <option value="SDP">Extrajornada (SDP)</option>
        `;
      } else {
        selectTipo.innerHTML = `
          <option value="PLANTONISTA">Plantão Local</option>
          <option value="SOBREAVISO">Sobreaviso</option>
        `;
      }
    }

    if (escalaId) {
      const esc = appState.escalas.find(e => e.id === escalaId);
      if (!esc) return;

      tituloModal.innerText = "Editar Plantão Cadastrado";
      document.getElementById('modal-escala-id').value = esc.id;
      document.getElementById('modal-escala-data').value = esc.data;
      document.getElementById('modal-escala-servidor').value = esc.servidorId;
      document.getElementById('modal-escala-delegacia').value = esc.delegaciaId;
      document.getElementById('modal-escala-tipo').value = esc.tipo;
      document.getElementById('modal-escala-turno').value = esc.turno || '24h';

      btnExcluir?.classList.remove('hidden');
    } else {
      tituloModal.innerText = "Lançar Novo Plantão";
      document.getElementById('modal-escala-id').value = '';
      document.getElementById('modal-escala-data').value = dateStr;
      btnExcluir?.classList.add('hidden');
    }

    modal.classList.remove('hidden');
  };

  window.fecharModalEscala = function() {
    document.getElementById('modal-escala')?.classList.add('hidden');
  };

  window.toggleReplicacaoOptions = function() {
    const chk = document.getElementById('chk-replicar-plantao');
    const box = document.getElementById('box-replicacao');
    if (chk && box) {
      if (chk.checked) box.classList.remove('hidden');
      else box.classList.add('hidden');
    }
  };

  window.salvarEscalaModal = async function(e) {
    e.preventDefault();

    const escalaIdExistente = document.getElementById('modal-escala-id').value;
    const dataOriginal = document.getElementById('modal-escala-data').value;
    const servidorId = document.getElementById('modal-escala-servidor').value;
    const delegaciaId = document.getElementById('modal-escala-delegacia').value;
    const tipo = document.getElementById('modal-escala-tipo').value;
    const turno = document.getElementById('modal-escala-turno').value;
    const chkReplicar = document.getElementById('chk-replicar-plantao')?.checked;

    if (escalaIdExistente) {
      const escObj = appState.escalas.find(e => e.id === escalaIdExistente);
      if (escObj) {
        escObj.data = dataOriginal;
        escObj.servidorId = servidorId;
        escObj.delegaciaId = delegaciaId;
        escObj.tipo = tipo;
        escObj.turno = turno;

        await syncDocToFirestore('escalas', escObj.id, escObj);
      }
    } else {
      let diasParaInserir = [dataOriginal];

      if (chkReplicar) {
        const passoDias = parseInt(document.getElementById('modal-replica-frequencia').value) || 1;
        const qtdReplicas = parseInt(document.getElementById('modal-replica-qtd').value) || 1;

        let baseDate = new Date(dataOriginal + 'T00:00:00');
        for (let i = 1; i <= qtdReplicas; i++) {
          baseDate.setDate(baseDate.getDate() + passoDias);
          diasParaInserir.push(baseDate.toISOString().split('T')[0]);
        }
      }

      for (const dt of diasParaInserir) {
        const newId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const novaEscala = {
          id: newId,
          data: dt,
          servidorId,
          delegaciaId,
          tipo,
          turno,
          scope: appState.calendarScope,
          sdpId: '8SDP'
        };

        appState.escalas.push(novaEscala);
        await syncDocToFirestore('escalas', novaEscala.id, novaEscala);
      }
    }

    window.fecharModalEscala();
    const currentContainer = appState.calendarScope === 'CRF' ? 'calendar-crf-container' : 'calendar-delegacia-container';
    renderCalendarGrid(currentContainer, appState.calendarScope);
  };

  window.excluirEscalaAtual = async function() {
    const escalaId = document.getElementById('modal-escala-id').value;
    if (!escalaId) return;

    if (!confirm("Tem certeza de que deseja excluir este plantão da escala?")) return;

    appState.escalas = appState.escalas.filter(e => e.id !== escalaId);
    await syncDocToFirestore('escalas', escalaId, null, true);

    window.fecharModalEscala();
    const currentContainer = appState.calendarScope === 'CRF' ? 'calendar-crf-container' : 'calendar-delegacia-container';
    renderCalendarGrid(currentContainer, appState.calendarScope);
  };

  // Modal de Servidores
  window.editarServidor = function(servidorId) {
    const srv = appState.servidores.find(s => s.id === servidorId);
    if (!srv) return;

    const modal = document.getElementById('modal-servidor');
    if (!modal) return;

    document.getElementById('modal-srv-id').value = srv.id;
    document.getElementById('modal-srv-nome').value = srv.nome || '';
    document.getElementById('modal-srv-cargo').value = srv.cargo || 'AGENTE';
    document.getElementById('modal-srv-login').value = srv.login || '';
    document.getElementById('modal-srv-telefone').value = srv.telefone || '';
    document.getElementById('modal-srv-nivel').value = srv.nivelAcesso || 'APJ';

    const selectDelegacia = document.getElementById('modal-srv-delegacia');
    if (selectDelegacia) {
      selectDelegacia.innerHTML = appState.delegacias
        .map(d => `<option value="${d.nome}" ${d.nome === srv.delegaciaId ? 'selected' : ''}>${d.nome}</option>`)
        .join('');
    }

    modal.classList.remove('hidden');
  };

  window.fecharModalServidor = function() {
    document.getElementById('modal-servidor')?.classList.add('hidden');
  };

  window.salvarServidorModal = async function(e) {
    e.preventDefault();

    const id = document.getElementById('modal-srv-id').value;
    const srvObj = appState.servidores.find(s => s.id === id);

    if (srvObj) {
      srvObj.nome = document.getElementById('modal-srv-nome').value.toUpperCase();
      srvObj.cargo = document.getElementById('modal-srv-cargo').value.toUpperCase();
      srvObj.login = document.getElementById('modal-srv-login').value.toLowerCase();
      srvObj.telefone = document.getElementById('modal-srv-telefone').value;
      srvObj.delegaciaId = document.getElementById('modal-srv-delegacia').value;
      srvObj.nivelAcesso = document.getElementById('modal-srv-nivel').value;

      await syncDocToFirestore('servidores', srvObj.id, srvObj);

      window.fecharModalServidor();
      renderServidoresTable('servidores-table-container');
      alert("Dados do policial atualizados com sucesso!");
    }
  };

  // Modal de Unificação de Plantão
  window.gerenciarUnificacao = function(delegaciaId) {
    const del = appState.delegacias.find(d => d.id === delegaciaId);
    if (!del) return;

    const modal = document.getElementById('modal-unificacao');
    if (!modal) return;

    document.getElementById('modal-unificacao-id').value = del.id;
    document.getElementById('modal-unificacao-nome').value = del.nome;

    const containerLista = document.getElementById('modal-unificacao-lista');
    const delegaciasIndividuais = appState.delegacias.filter(d => !d.isUnificado);

    containerLista.innerHTML = delegaciasIndividuais.map(d => {
      const isChecked = del.delegaciasIds && del.delegaciasIds.includes(d.id);
      return `
        <label class="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 border">
          <input type="checkbox" value="${d.id}" ${isChecked ? 'checked' : ''} class="chk-unificacao-del rounded text-indigo-600 focus:ring-indigo-500">
          <span>${d.nome}</span>
        </label>
      `;
    }).join('');

    modal.classList.remove('hidden');
  };

  window.fecharModalUnificacao = function() {
    document.getElementById('modal-unificacao')?.classList.add('hidden');
  };

  window.salvarUnificacao = async function(e) {
    e.preventDefault();

    const delId = document.getElementById('modal-unificacao-id').value;
    const checkboxes = document.querySelectorAll('.chk-unificacao-del:checked');
    const idsSelecionados = Array.from(checkboxes).map(cb => cb.value);

    const delObj = appState.delegacias.find(d => d.id === delId);
    if (delObj) {
      delObj.isUnificado = idsSelecionados.length > 1;
      delObj.delegaciasIds = idsSelecionados.length > 0 ? idsSelecionados : [delId];

      await syncDocToFirestore('delegacias', delObj.id, delObj);
      
      window.fecharModalUnificacao();
      renderDelegaciasCards('delegacias-container');
      renderCalendarGrid(appState.calendarScope === 'CRF' ? 'calendar-crf-container' : 'calendar-delegacia-container', appState.calendarScope);
      alert("Configuração salva com sucesso!");
    }
  };
}
