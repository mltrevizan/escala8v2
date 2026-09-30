// src/calendar.js
import { appState } from './state.js';

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

export function renderCalendarGrid(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentYear, currentMonth, calendarMode } = appState;
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  let html = `
    <div class="p-4 bg-slate-50 border-b flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <button id="btn-prev-month" class="p-1.5 bg-white border hover:bg-slate-100 rounded-lg text-xs font-bold shadow-sm">◀ Anterior</button>
        <span class="font-bold text-sm text-slate-800 min-w-[140px] text-center">${monthNames[currentMonth]} ${currentYear}</span>
        <button id="btn-next-month" class="p-1.5 bg-white border hover:bg-slate-100 rounded-lg text-xs font-bold shadow-sm">Próximo ▶</button>
      </div>

      <div class="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-xs font-bold">
        <button id="btn-mode-plantonista" class="px-3 py-1 rounded-lg transition ${calendarMode === 'PLANTONISTA' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}">Plantonista</button>
        <button id="btn-mode-sobreaviso" class="px-3 py-1 rounded-lg transition ${calendarMode === 'SOBREAVISO' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}">Sobreaviso</button>
        <button id="btn-mode-sdp" class="px-3 py-1 rounded-lg transition ${calendarMode === 'SDP' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}">SDP Extra</button>
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

    <!-- Grade dos Dias -->
    <div class="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px">
  `;

  // Espaços em branco antes do 1º dia do mês
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="bg-slate-50/50 min-h-[90px] p-1"></div>`;
  }

  // Renderiza cada dia do mês
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Filtra escalas cadastradas para o dia atual
    const escalasDoDia = appState.escalas.filter(e => e.data === dateStr && e.tipo === calendarMode);

    html += `
      <div class="bg-white min-h-[90px] p-1.5 flex flex-col justify-between hover:bg-indigo-50/30 transition relative group border-t border-l">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold ${isWeekend ? 'text-indigo-600' : 'text-slate-700'}">${day}</span>
          <button onclick="window.adicionarEscala('${dateStr}')" class="opacity-0 group-hover:opacity-100 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold transition shadow">
            + Plantão
          </button>
        </div>

        <div class="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[70px]">
    `;

    if (escalasDoDia.length === 0) {
      html += `<span class="text-[9px] text-slate-300 italic block font-light">Sem escala</span>`;
    } else {
      escalasDoDia.forEach(esc => {
        const servidor = appState.servidores.find(s => s.id === esc.servidorId);
        const nomeExibicao = servidor ? servidor.nome.split(' ')[0] : 'Servidor';

        html += `
          <div class="text-[10px] p-1 rounded font-semibold bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center justify-between">
            <span class="truncate">${nomeExibicao}</span>
            <span class="text-[8px] bg-indigo-200 px-1 rounded text-indigo-800">${esc.turno || '24h'}</span>
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

  document.getElementById('btn-mode-plantonista')?.addEventListener('click', () => {
    appState.calendarMode = 'PLANTONISTA';
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('btn-mode-sobreaviso')?.addEventListener('click', () => {
    appState.calendarMode = 'SOBREAVISO';
    renderCalendarGrid('calendar-container');
  });

  document.getElementById('btn-mode-sdp')?.addEventListener('click', () => {
    appState.calendarMode = 'SDP';
    renderCalendarGrid('calendar-container');
  });
}
