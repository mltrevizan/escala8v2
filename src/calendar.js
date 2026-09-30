// src/calendar.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

export function renderCalendarGrid(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentYear, currentMonth, calendarScope, calendarMode, selectedDelegaciaId } = appState;
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Opções de delegacias para o filtro Nível B
  let delegaciasOptions = appState.delegacias.map(d => 
    `<option value="${d.id}" ${selectedDelegaciaId === d.id ? 'selected' : ''}>${d.nome}</option>`
  ).join('');

  let html = `
    <!-- Barra Superior: Alternância entre Nível A (CRF) e Nível B (Delegacia) -->
    <div class="p-4 bg-slate-100 border-b flex flex-col md:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-2 bg-slate-200 p-1 rounded-xl">
        <button id="btn-scope-crf" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${calendarScope === 'CRF' ? 'bg-indigo-700 text-white shadow' : 'text-slate-700 hover:text-slate-900'}">
          🏛️ Plantão CRF (Geral & Extrajornada)
        </button>
        <button id="btn-scope-delegacia" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${calendarScope === 'DELEGACIA' ? 'bg-indigo-700 text-white shadow' : 'text-slate-700 hover:text-slate-900'}">
          🏢 Plantão por Delegacia / Consórcio
        </button>
      </div>

      ${calendarScope === 'DELEGACIA' ? `
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-slate-700">Unidade:</label>
          <select id="select-calendar-delegacia" class="text-xs font-bold bg-white border border-slate-300 rounded-lg p-1.5 shadow-sm">
            ${delegaciasOptions}
          </select>
        </div>
      ` : ''}
    </div>

    <!-- Navegação de Mês e Filtro de Turnos/Modos -->
    <div class="p-4 bg-slate-50 border-b flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <button id="btn-prev-month" class="p-1.5 bg-white border hover:bg-slate-100 rounded-lg text-xs font-bold shadow-sm">◀ Anterior</button>
        <span class="font-bold text-sm text-slate-800 min-w-[140px] text-center">${monthNames[currentMonth]} ${currentYear}</span>
        <button id="btn-next-month" class="p-1.5 bg-white border hover:bg-slate-100 rounded-lg text-xs font-bold shadow-sm">Próximo ▶</button>
      </div>

      <!-- Sub-filtros conforme a escala escolhida -->
      <div class="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-xs font-bold">
        ${calendarScope === 'CRF' ? `
          <button id="btn-mode-regular" class="px-3 py-1 rounded-lg transition ${calendarMode === 'REGULAR' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600'}">Escala Regular</button>
          <button id="btn-mode-sdp" class="px-3 py-1 rounded-lg transition ${calendarMode === 'SDP' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600'}">Extrajornada (SDP)</button>
        ` : `
          <button id="btn-mode-plantonista" class="px-3 py-1 rounded-lg transition ${calendarMode === 'PLANTONISTA' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600'}">Plantão Local</button>
          <button id="btn-mode-sobreaviso" class="px-3 py-1 rounded-lg transition ${calendarMode === 'SOBREAVISO' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600'}">Sobreaviso</button>
        `}
      </div>
    </div>

    <!-- Cabeçalho dos Dias da Semana -->
    <div class="grid grid-cols-7 text-center bg-slate-100 text-[11px] font-bold text-slate-600 border-b py-2">
      <div class="text-red-600">Dom</div>
      <div>Seg</div>
      <div>Ter</div>
      <div>Qua</div>
      <div>Qui</div>
      <div>Sex</div>
      <div class="text-indigo-600">Sáb</div>
    </div>

    <!-- Grade do Mês -->
    <div class="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px">
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="bg-slate-50/50 min-h-[95px] p-1"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Filtragem Estrita com base na Escala Ativa
    const escalasDoDia = appState.escalas.filter(e => {
      if (e.data !== dateStr) return false;
      if (e.scope !== calendarScope) return false;
      if (e.tipo !== calendarMode) return false;
      
      // Se for nível B (Delegacia), filtra por consórcio ou ID direto
      if (calendarScope === 'DELEGACIA') {
        const delObj = appState.delegacias.find(d => d.id === selectedDelegaciaId);
        if (delObj && delObj.delegaciasIds) {
          return delObj.delegaciasIds.includes(e.delegaciaId);
        }
        return e.delegaciaId === selectedDelegaciaId;
      }
      return true;
    });

    html += `
      <div class="bg-white min-h-[95px] p-1.5 flex flex-col justify-between hover:bg-indigo-50/20 transition relative group border-t border-l">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold ${isWeekend ? 'text-indigo-600' : 'text-slate-700'}">${day}</span>
          <button onclick="window.abrirModalEscala('${dateStr}')" class="opacity-0 group-hover:opacity-100 text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white px-1.5 py-0.5 rounded font-bold transition shadow">
            + Adicionar
          </button>
        </div>

        <div class="space-y-1 flex-1 overflow-y-auto max-h-[75px]">
    `;

    if (escalasDoDia.length === 0) {
      html += `<span class="text-[9px] text-slate-300 italic block font-light">Livre</span>`;
    } else {
      escalasDoDia.forEach(esc => {
        const servidor = appState.servidores.find(s => s.id === esc.servidorId);
        const nomeExibicao = servidor ? servidor.nome.split(' ')[0] : 'Policial';

        html += `
          <div class="text-[10px] p-1 rounded font-semibold bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center justify-between group/item">
            <span class="truncate">${nomeExibicao}</span>
            <div class="flex items-center gap-1">
              <span class="text-[8px] bg-indigo-200 px-1 rounded text-indigo-800">${esc.turno || '24h'}</span>
              <button onclick="window.removerEscala('${esc.id}')" class="hidden group-hover/item:inline text-red-600 hover:text-red-800 font-bold ml-1">✕</button>
            </div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;

  setupCalendarEvents();
}

function setupCalendarEvents() {
  document.getElementById('btn-scope-crf')?.addEventListener('click', () => {
    appState.calendarScope = 'CRF';
    appState.calendarMode = 'REGULAR';
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('btn-scope-delegacia')?.addEventListener('click', () => {
    appState.calendarScope = 'DELEGACIA';
    appState.calendarMode = 'PLANTONISTA';
    if (!appState.selectedDelegaciaId && appState.delegacias.length > 0) {
      appState.selectedDelegaciaId = appState.delegacias[0].id;
    }
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('select-calendar-delegacia')?.addEventListener('change', (e) => {
    appState.selectedDelegaciaId = e.target.value;
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('btn-prev-month')?.addEventListener('click', () => {
    if (appState.currentMonth === 0) {
      appState.currentMonth = 11;
      appState.currentYear--;
    } else {
      appState.currentMonth--;
    }
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('btn-next-month')?.addEventListener('click', () => {
    if (appState.currentMonth === 11) {
      appState.currentMonth = 0;
      appState.currentYear++;
    } else {
      appState.currentMonth++;
    }
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('btn-mode-regular')?.addEventListener('click', () => {
    appState.calendarMode = 'REGULAR';
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('btn-mode-sdp')?.addEventListener('click', () => {
    appState.calendarMode = 'SDP';
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('btn-mode-plantonista')?.addEventListener('click', () => {
    appState.calendarMode = 'PLANTONISTA';
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('btn-mode-sobreaviso')?.addEventListener('click', () => {
    appState.calendarMode = 'SOBREAVISO';
    renderCalendarGrid('calendar-container');
  });
}

// Funções do Modal
window.abrirModalEscala = function(dateStr) {
  const modal = document.getElementById('modal-escala');
  if (!modal) return;

  document.getElementById('modal-escala-data').value = dateStr;
  
  const selectServidor = document.getElementById('modal-escala-servidor');
  selectServidor.innerHTML = appState.servidores
    .map(s => `<option value="${s.id}">${s.nome} (${s.cargo})</option>`)
    .join('');

  const selectDelegacia = document.getElementById('modal-escala-delegacia');
  selectDelegacia.innerHTML = appState.delegacias
    .map(d => `<option value="${d.id}">${d.nome}</option>`)
    .join('');

  modal.classList.remove('hidden');
};

window.fecharModalEscala = function() {
  document.getElementById('modal-escala')?.classList.add('hidden');
};

window.salvarEscalaModal = async function(e) {
  e.preventDefault();

  const data = document.getElementById('modal-escala-data').value;
  const servidorId = document.getElementById('modal-escala-servidor').value;
  const delegaciaId = document.getElementById('modal-escala-delegacia').value;
  const turno = document.getElementById('modal-escala-turno').value;

  const escalaId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  const novaEscala = {
    id: escalaId,
    data,
    servidorId,
    delegaciaId,
    turno,
    scope: appState.calendarScope, // 'CRF' ou 'DELEGACIA'
    tipo: appState.calendarMode,    // 'REGULAR', 'SDP', 'PLANTONISTA' ou 'SOBREAVISO'
    sdpId: '8SDP'
  };

  appState.escalas.push(novaEscala);
  await syncDocToFirestore('escalas', novaEscala.id, novaEscala);

  window.fecharModalEscala();
  renderCalendarGrid('calendar-container');
};

window.removerEscala = async function(escalaId) {
  if (!confirm("Deseja realmente remover este plantão da escala?")) return;

  appState.escalas = appState.escalas.filter(e => e.id !== escalaId);
  await syncDocToFirestore('escalas', escalaId, null, true);

  renderCalendarGrid('calendar-container');
};
