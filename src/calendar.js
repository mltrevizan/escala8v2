// src/calendar.js
import { appState } from './state.js';

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
    <div class="p-4 bg-slate-100 border-b flex flex-col md:flex-row items-center justify-between gap-3 font-sans">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-800 tracking-wide">
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

    <!-- Navegação do Mês -->
    <div class="p-4 bg-slate-50 border-b flex items-center justify-between font-sans">
      <button id="btn-prev-month" class="p-1.5 bg-white border hover:bg-slate-100 rounded-lg text-xs font-bold shadow-sm">◀ Anterior</button>
      <span class="font-bold text-sm text-slate-800 tracking-tight">${monthNames[currentMonth]} ${currentYear}</span>
      <button id="btn-next-month" class="p-1.5 bg-white border hover:bg-slate-100 rounded-lg text-xs font-bold shadow-sm">Próximo ▶</button>
    </div>

    <!-- Cabeçalho dos Dias -->
    <div class="grid grid-cols-7 text-center bg-slate-200 text-[11px] font-bold text-slate-700 border-b py-2 font-sans">
      <div class="text-red-700">Dom</div>
      <div>Seg</div>
      <div>Ter</div>
      <div>Qua</div>
      <div>Qui</div>
      <div>Sex</div>
      <div class="text-indigo-700">Sáb</div>
    </div>

    <!-- Grade do Mês -->
    <div class="grid grid-cols-7 auto-rows-fr bg-slate-300 gap-px border-b border-r font-sans">
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

    const bgDayClass = isWeekend ? 'bg-amber-50/40' : 'bg-white';

    html += `
      <div class="${bgDayClass} p-1.5 flex flex-col justify-between transition relative border-t border-l min-h-[120px] h-auto">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold ${isWeekend ? 'text-amber-800' : 'text-slate-800'}">${day}</span>
        </div>

        <div class="space-y-1.5 flex-1 flex flex-col justify-start">
    `;

    if (scope === 'CRF') {
      // Separação em 2 Períodos Fixos: Diurno (07h30-19h30) e Noturno (19h30-07h30)
      const diurnoEscalas = escalasDoDia.filter(e => e.turno === '12h (D)' || e.turno === '24h');
      const noturnoEscalas = escalasDoDia.filter(e => e.turno === '12h (N)');

      html += renderBalaoPeriodo('DIURNO', '07h30 às 19h30', diurnoEscalas, 'bg-amber-50 border-amber-200 text-amber-950');
      html += renderBalaoPeriodo('NOTURNO', '19h30 às 07h30', noturnoEscalas, 'bg-slate-100 border-slate-300 text-slate-900');
    } else {
      // Visão Delegacias (Pode conter 24h ou períodos customizados)
      if (escalasDoDia.length === 0) {
        html += `<span class="text-[9px] text-slate-300 italic block font-light">Sem plantão</span>`;
      } else {
        escalasDoDia.forEach(esc => {
          const srv = appState.servidores.find(s => s.id === esc.servidorId);
          const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
          const prefixo = isDel ? 'DEL.' : 'AG.';
          const nome = srv ? `${prefixo} ${srv.nome.split(' ')[0]}` : 'Policial';

          html += `
            <div class="text-[10px] p-1.5 rounded-lg border bg-blue-50 border-blue-200 text-blue-900 font-bold shadow-sm">
              ${nome} (${esc.turno || '24h'})
            </div>
          `;
        });
      }
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

// Renderiza o Balão Unificado do Período
function renderBalaoPeriodo(titulo, horario, escalasArray, bgStyle) {
  if (escalasArray.length === 0) {
    return `
      <div class="text-[9px] p-1 rounded-md border ${bgStyle} opacity-60 flex items-center justify-between">
        <span class="font-bold">${titulo}</span>
        <span class="text-[8px] text-slate-400 italic">Livre</span>
      </div>
    `;
  }

  // Função para ordenar: 1º Regular (Delegado depois Agente), 2º Extrajornada (Delegado depois Agente)
  const ordenarEscalas = (lista) => {
    return lista.sort((a, b) => {
      const srvA = appState.servidores.find(s => s.id === a.servidorId);
      const srvB = appState.servidores.find(s => s.id === b.servidorId);

      const isExtraA = a.tipo === 'EXTRAJORNADA' || a.tipo === 'SDP' ? 1 : 0;
      const isExtraB = b.tipo === 'EXTRAJORNADA' || b.tipo === 'SDP' ? 1 : 0;

      if (isExtraA !== isExtraB) return isExtraA - isExtraB; // Regular primeiro (0), Extra depois (1)

      const isDelA = srvA?.cargo?.toUpperCase().includes('DELEGADO') ? 0 : 1;
      const isDelB = srvB?.cargo?.toUpperCase().includes('DELEGADO') ? 0 : 1;

      return isDelA - isDelB; // Delegado (0) antes de Agente (1)
    });
  };

  const ordenadas = ordenarEscalas([...escalasArray]);

  // Montagem do conteúdo simplificado no calendário
  let listaHtml = ordenadas.map(esc => {
    const srv = appState.servidores.find(s => s.id === esc.servidorId);
    const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
    const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';

    const prefixo = isDel ? 'DEL.' : 'AG.';
    const nome = srv ? `${prefixo} ${srv.nome.split(' ')[0]}` : 'Policial';

    if (isExtra) {
      return `<div class="font-extrabold text-purple-700 leading-tight"><span class="bg-purple-600 text-white text-[7px] px-0.5 rounded mr-1">EXTRA</span>${nome}</div>`;
    }
    return `<div class="font-bold text-slate-900 leading-tight">${nome}</div>`;
  }).join('');

  // Montagem do Tooltip Rico
  let tooltipHtml = `
    <div class='p-2 space-y-1 text-left min-w-[210px] font-sans'>
      <div class='font-bold text-slate-900 border-b pb-1 text-xs'>${titulo} (${horario})</div>
  `;

  ordenadas.forEach(esc => {
    const srv = appState.servidores.find(s => s.id === esc.servidorId);
    const del = appState.delegacias.find(d => d.id === esc.delegaciaId);
    const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';

    tooltipHtml += `
      <div class='pt-1 border-t border-slate-100'>
        <div class='font-bold ${isExtra ? 'text-purple-700' : 'text-slate-800'} text-[11px]'>
          ${isExtra ? '[EXTRA] ' : ''}${srv?.nome || 'Não informado'}
        </div>
        <div class='text-[10px] text-slate-500'>${srv?.cargo || 'Agente'} • ${del?.nome || 'CRF'}</div>
        <div class='text-[10px] text-slate-500'><b>Tel:</b> ${srv?.telefone || '-'}</div>
      </div>
    `;
  });

  tooltipHtml += `</div>`;
  tooltipHtml = tooltipHtml.replace(/'/g, "&apos;");

  return `
    <div onmouseenter="window.mostrarTooltip(event, '${tooltipHtml}')"
         onmouseleave="window.ocultarTooltip()"
         class="p-1.5 rounded-lg border ${bgStyle} shadow-sm space-y-1">
      <div class="flex items-center justify-between border-b border-black/10 pb-0.5">
        <span class="text-[9px] font-black uppercase tracking-wider">${titulo}</span>
        <span class="text-[7.5px] opacity-75 font-mono">${horario}</span>
      </div>
      <div class="space-y-0.5 text-[9.5px]">
        ${listaHtml}
      </div>
    </div>
  `;
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

// Tooltip Flutuante
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
