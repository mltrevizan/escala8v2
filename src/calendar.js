// src/calendar.js
import { appState } from './state.js';
import { syncDocToFirestore } from './db.js';

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

export function renderCalendarGrid(containerId, scope = 'CRF') {
  const container = document.getElementById(containerId);
  if (!container) return;

  appState.calendarScope = scope;
  const { currentYear, currentMonth, selectedDelegaciaId } = appState;
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  let delegaciasOptions = appState.delegacias.map(d => 
    `<option value="${d.id}" ${selectedDelegaciaId === d.id ? 'selected' : ''}>${d.nome}</option>`
  ).join('');

  let html = `
    <!-- Barra Superior da Escala -->
    <div class="p-4 bg-slate-100 border-b flex flex-col md:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-700 font-mono">
          ${scope === 'CRF' ? '🏛️ ESCALA GERAL CRF & SDP' : '🏢 ESCALA POR DELEGACIA / PLANTÃO UNIFICADO'}
        </span>
      </div>

      ${scope === 'DELEGACIA' ? `
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-slate-700">Unidade / Lotação:</label>
          <select id="select-calendar-delegacia" class="text-xs font-bold bg-white border border-slate-300 rounded-lg p-1.5 shadow-sm">
            ${delegaciasOptions}
          </select>
        </div>
      ` : ''}
    </div>

    <!-- Navegação de Mês -->
    <div class="p-4 bg-slate-50 border-b flex items-center justify-between">
      <button id="btn-prev-month" class="p-1.5 bg-white border hover:bg-slate-100 rounded-lg text-xs font-bold shadow-sm">◀ Anterior</button>
      <span class="font-bold text-sm text-slate-800">${monthNames[currentMonth]} ${currentYear}</span>
      <button id="btn-next-month" class="p-1.5 bg-white border hover:bg-slate-100 rounded-lg text-xs font-bold shadow-sm">Próximo ▶</button>
    </div>

    <!-- Dias da Semana -->
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
    html += `<div class="bg-slate-50/50 min-h-[100px] p-1"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const escalasDoDia = appState.escalas.filter(e => {
      if (e.data !== dateStr) return false;
      if (e.scope !== scope) return false;
      
      if (scope === 'DELEGACIA') {
        const delObj = appState.delegacias.find(d => d.id === selectedDelegaciaId);
        if (delObj && delObj.delegaciasIds) {
          return delObj.delegaciasIds.includes(e.delegaciaId);
        }
        return e.delegaciaId === selectedDelegaciaId;
      }
      return true;
    });

    html += `
      <div class="bg-white min-h-[100px] p-1.5 flex flex-col justify-between hover:bg-indigo-50/20 transition relative group border-t border-l">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold ${isWeekend ? 'text-indigo-600' : 'text-slate-700'}">${day}</span>
          <button onclick="window.abrirModalEscala('${dateStr}')" class="opacity-0 group-hover:opacity-100 text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white px-1.5 py-0.5 rounded font-bold transition shadow">
            + Plantão
          </button>
        </div>

        <div class="space-y-1 flex-1 overflow-y-auto max-h-[85px]">
    `;

    if (escalasDoDia.length === 0) {
      html += `<span class="text-[9px] text-slate-300 italic block font-light">Livre</span>`;
    } else {
      escalasDoDia.forEach(esc => {
        const servidor = appState.servidores.find(s => s.id === esc.servidorId);
        const nomeExibicao = servidor ? servidor.nome.split(' ')[0] : 'Policial';
        
        const isExtraOuSobreaviso = esc.tipo === 'SDP' || esc.tipo === 'SOBREAVISO';
        const badgeClass = isExtraOuSobreaviso 
          ? 'bg-amber-100 text-amber-900 border-amber-300' 
          : 'bg-indigo-50 text-indigo-900 border-indigo-200';
        
        const labelTipo = esc.tipo === 'SDP' ? 'SDP' : (esc.tipo === 'SOBREAVISO' ? 'SOB' : (esc.turno || '24h'));

        html += `
          <div class="text-[10px] p-1 rounded font-semibold border ${badgeClass} flex items-center justify-between group/item">
            <span class="truncate">${nomeExibicao}</span>
            <div class="flex items-center gap-1">
              <span class="text-[8px] px-1 rounded font-bold ${isExtraOuSobreaviso ? 'bg-amber-200 text-amber-900' : 'bg-indigo-200 text-indigo-800'}">${labelTipo}</span>
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

  setupCalendarEvents(containerId, scope);
}

function setupCalendarEvents(containerId, scope) {
  document.getElementById('select-calendar-delegacia')?.addEventListener('change', (e) => {
    appState.selectedDelegaciaId = e.target.value;
    renderCalendarGrid(containerId, scope);
  });

  document.getElementById('btn-prev-month')?.addEventListener('click', () => {
    if (appState.currentMonth === 0) {
      appState.currentMonth = 11;
      appState.currentYear--;
    } else {
      appState.currentMonth--;
    }
    renderCalendarGrid(containerId, scope);
  });

  document.getElementById('btn-next-month')?.addEventListener('click', () => {
    if (appState.currentMonth === 11) {
      appState.currentMonth = 0;
      appState.currentYear++;
    } else {
      appState.currentMonth++;
    }
    renderCalendarGrid(containerId, scope);
  });
}

// Modal
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
  const tipo = document.getElementById('modal-escala-tipo').value;
  const turno = document.getElementById('modal-escala-turno').value;

  const escalaId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  const novaEscala = {
    id: escalaId,
    data,
    servidorId,
    delegaciaId,
    tipo,
    turno,
    scope: appState.calendarScope,
    sdpId: '8SDP'
  };

  appState.escalas.push(novaEscala);
  await syncDocToFirestore('escalas', novaEscala.id, novaEscala);

  window.fecharModalEscala();
  const currentContainer = appState.calendarScope === 'CRF' ? 'calendar-crf-container' : 'calendar-delegacia-container';
  renderCalendarGrid(currentContainer, appState.calendarScope);
};

window.removerEscala = async function(escalaId) {
  if (!confirm("Deseja realmente remover este plantão da escala?")) return;

  appState.escalas = appState.escalas.filter(e => e.id !== escalaId);
  await syncDocToFirestore('escalas', escalaId, null, true);

  const currentContainer = appState.calendarScope === 'CRF' ? 'calendar-crf-container' : 'calendar-delegacia-container';
  renderCalendarGrid(currentContainer, appState.calendarScope);
};
