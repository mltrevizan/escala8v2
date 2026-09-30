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
    <!-- Barra Superior -->
    <div class="p-4 bg-slate-100 border-b flex flex-col md:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-800 font-sans tracking-wide">
          ${scope === 'CRF' ? '🏛️ ESCALA GERAL CRF & EXTRAJORNADA' : '🏢 ESCALA POR DELEGACIA / PLANTÃO UNIFICADO'}
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
      <span class="font-bold text-sm text-slate-800 tracking-tight">${monthNames[currentMonth]} ${currentYear}</span>
      <button id="btn-next-month" class="p-1.5 bg-white border hover:bg-slate-100 rounded-lg text-xs font-bold shadow-sm">Próximo ▶</button>
    </div>

    <!-- Cabeçalho dos Dias da Semana -->
    <div class="grid grid-cols-7 text-center bg-slate-200 text-[11px] font-bold text-slate-700 border-b py-2">
      <div class="text-red-700">Dom</div>
      <div>Seg</div>
      <div>Ter</div>
      <div>Qua</div>
      <div>Qui</div>
      <div>Sex</div>
      <div class="text-indigo-700">Sáb</div>
    </div>

    <!-- Grade do Mês Dinâmica -->
    <div class="grid grid-cols-7 auto-rows-fr bg-slate-300 gap-px border-b border-r">
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="bg-slate-100/60 p-2"></div>`;
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

    // Fundo diferenciado para Fins de Semana e Feriados
    const bgDayClass = isWeekend ? 'bg-amber-50/40' : 'bg-white';

    html += `
      <div class="${bgDayClass} p-1.5 flex flex-col justify-between transition relative group border-t border-l h-auto min-h-[110px]">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-bold font-sans ${isWeekend ? 'text-amber-800' : 'text-slate-800'}">${day}</span>
          <button onclick="window.abrirModalEscala('${dateStr}')" class="opacity-0 group-hover:opacity-100 text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white px-1.5 py-0.5 rounded font-bold transition shadow">
            + Plantão
          </button>
        </div>

        <div class="space-y-1.5 flex-1">
    `;

    if (escalasDoDia.length === 0) {
      html += `<span class="text-[9px] text-slate-300 italic block font-light">Livre</span>`;
    } else {
      escalasDoDia.forEach(esc => {
        const servidor = appState.servidores.find(s => s.id === esc.servidorId);
        const delegacia = appState.delegacias.find(d => d.id === esc.delegaciaId);
        
        const isDelegado = servidor?.cargo?.toUpperCase().includes('DELEGADO');
        const prefixoCargo = isDelegado ? 'DEL.' : 'AG.';
        const nomeFormatado = servidor ? `${prefixoCargo} ${servidor.nome.split(' ')[0]}` : 'Policial';

        const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';
        const isSobreaviso = esc.tipo === 'SOBREAVISO';

        // Padrão Visual v1: A cor do card indica o PERÍODO
        let cardBgClass = 'bg-blue-50 border-blue-200 text-blue-950 hover:bg-blue-100'; // Turno Regular (Ex: Diurno / 24h)
        if (esc.turno === '12h (N)') {
          cardBgClass = 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200'; // Turno Noturno
        } else if (isSobreaviso) {
          cardBgClass = 'bg-purple-50 border-purple-200 text-purple-950 hover:bg-purple-100';
        }

        // Nome do Policial em ROXO se for Extrajornada
        const nomeColorClass = isExtra ? 'text-purple-700 font-extrabold' : 'text-slate-900 font-bold';
        const tagExtra = isExtra ? `<span class="text-[8px] bg-purple-600 text-white font-extrabold px-1 rounded mr-1">EXTRA</span>` : '';

        // Descrição textual interna do turno
        const turnoDesc = getTurnoTexto(esc.turno);

        // Tooltip Rico no Hover
        const tooltipText = `
          <div class='p-2 space-y-1 text-left min-w-[190px] font-sans'>
            <div class='font-bold text-slate-900 border-b pb-1'>${servidor?.nome || 'Não informado'}</div>
            <div class='text-[10px] text-slate-600'><b>Cargo:</b> ${servidor?.cargo || 'Agente'}</div>
            <div class='text-[10px] text-slate-600'><b>Lotação:</b> ${delegacia?.nome || 'CRF'}</div>
            <div class='text-[10px] text-slate-600'><b>Modalidade:</b> ${isExtra ? 'Extrajornada' : esc.tipo}</div>
            <div class='text-[10px] text-slate-600'><b>Horário:</b> ${getHorarioExtenso(esc.turno)}</div>
            <div class='text-[10px] text-slate-600'><b>Contato:</b> ${servidor?.telefone || '-'}</div>
          </div>
        `.replace(/'/g, "&apos;");

        html += `
          <div onclick="window.abrirModalEscala(null, '${esc.id}')" 
               onmouseenter="window.mostrarTooltip(event, '${tooltipText}')"
               onmouseleave="window.ocultarTooltip()"
               class="text-[10px] p-1.5 rounded-lg border ${cardBgClass} flex flex-col justify-between cursor-pointer shadow-sm hover:shadow transition">
            <div class="flex items-center justify-between leading-tight mb-0.5">
              <span class="${nomeColorClass} truncate">${tagExtra}${nomeFormatado}</span>
            </div>
            <div class="text-[8px] text-slate-500 font-medium leading-none">
              ${turnoDesc}
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

function getTurnoTexto(turno) {
  if (turno === '12h (D)') return 'Diurno • 08h às 20h';
  if (turno === '12h (N)') return 'Noturno • 20h às 08h';
  return 'Integral • 24 Horas';
}

function getHorarioExtenso(turno) {
  if (turno === '12h (D)') return '12h Diurno (08:00 às 20:00)';
  if (turno === '12h (N)') return '12h Noturno (20:00 às 08:00)';
  return '24h Integral (08:00 às 08:00)';
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

// Tooltip Flutuante Inteligente
window.mostrarTooltip = function(event, htmlContent) {
  let tooltip = document.getElementById('global-calendar-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'global-calendar-tooltip';
    tooltip.className = 'fixed z-50 bg-white border border-slate-300 shadow-xl rounded-xl text-slate-800 text-xs pointer-events-none transition-opacity duration-150 opacity-0';
    document.body.appendChild(tooltip);
  }

  tooltip.innerHTML = htmlContent;
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
  tooltip.classList.remove('opacity-0');
};

window.ocultarTooltip = function() {
  const tooltip = document.getElementById('global-calendar-tooltip');
  if (tooltip) {
    tooltip.classList.add('opacity-0');
  }
};
