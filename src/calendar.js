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
  const { currentYear, currentMonth, selectedDelegaciaId, feriados } = appState;
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
    <!-- Topo / Controle do Calendário -->
    <div class="p-3 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-2 font-sans">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-800 tracking-tight uppercase">
          ${scope === 'CRF' ? '🏛️ Escala Geral CRF & Extrajornada' : '🏢 Escala por Delegacia / Plantão Unificado'}
        </span>
      </div>

      ${scope === 'DELEGACIA' ? `
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-600">Unidade:</label>
          <select id="select-calendar-delegacia" class="text-xs font-bold bg-slate-50 border border-slate-300 rounded-md p-1 shadow-xs">
            ${delegaciasOptions}
          </select>
        </div>
      ` : ''}
    </div>

    <!-- Navegação de Mês -->
    <div class="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between font-sans">
      <button id="btn-prev-month" class="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold shadow-xs">◀ Anterior</button>
      <span class="font-extrabold text-xs text-slate-800 uppercase tracking-wider">${monthNames[currentMonth]} ${currentYear}</span>
      <button id="btn-next-month" class="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold shadow-xs">Próximo ▶</button>
    </div>

    <!-- Cabeçalho dos Dias da Semana -->
    <div class="grid grid-cols-7 text-center bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 py-1.5 font-sans uppercase">
      <div class="text-red-600">Dom</div>
      <div>Seg</div>
      <div>Ter</div>
      <div>Qua</div>
      <div>Qui</div>
      <div>Sex</div>
      <div class="text-indigo-600">Sáb</div>
    </div>

    <!-- Grade do Mês - Padrão v1 -->
    <div class="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px border-b border-r border-slate-200 font-sans">
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="bg-slate-50/50 p-1"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const feriadoDoDia = (feriados || []).find(f => f.data === dateStr);

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

    // Fundo exato v1: Feriado rosa/suave, Final de Semana amarelado sutil, Dia comum branco
    let bgDayClass = 'bg-white';
    if (feriadoDoDia) {
      bgDayClass = 'bg-red-50/40';
    } else if (isWeekend) {
      bgDayClass = 'bg-amber-50/30';
    }

    html += `
      <div class="${bgDayClass} p-1 flex flex-col justify-between relative border-t border-l border-slate-200/80 min-h-[115px] h-auto">
        <div class="flex items-center justify-between mb-1 px-0.5">
          <span class="text-[11px] font-extrabold ${feriadoDoDia ? 'text-red-700' : (isWeekend ? 'text-amber-800' : 'text-slate-800')}">${day}</span>
          ${feriadoDoDia ? `
            <span class="text-[7.5px] bg-red-100 text-red-800 border border-red-200 font-bold px-1 rounded truncate max-w-[80px]" title="${feriadoDoDia.descricao}">
              ${feriadoDoDia.descricao}
            </span>
          ` : ''}
        </div>

        <div class="space-y-1 flex-1 flex flex-col justify-start">
    `;

    if (scope === 'CRF') {
      const diurnoEscalas = escalasDoDia.filter(e => e.turno === '12h (D)' || e.turno === '24h');
      const noturnoEscalas = escalasDoDia.filter(e => e.turno === '12h (N)');

      // Estilo exato dos balões da v1
      html += renderBalaoPeriodo('DIURNO', '07h30 - 19h30', diurnoEscalas, 'bg-[#FFFBEB] border-[#FDE68A] text-amber-950');
      html += renderBalaoPeriodo('NOTURNO', '19h30 - 07h30', noturnoEscalas, 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-900');
    } else {
      if (escalasDoDia.length === 0) {
        html += `<span class="text-[8.5px] text-slate-300 italic block font-light px-1">Livre</span>`;
      } else {
        escalasDoDia.forEach(esc => {
          const srv = appState.servidores.find(s => s.id === esc.servidorId);
          const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
          const prefixo = isDel ? 'DEL.' : 'AG.';
          const nomeCurto = srv ? formatarNomeOperacional(srv.nome, prefixo) : 'Policial';

          html += `
            <div onmouseenter="window.mostrarTooltipEscala(event, '${esc.id}')"
                 onmouseleave="window.ocultarTooltip()"
                 class="text-[9.5px] p-1 rounded border bg-blue-50/80 border-blue-200 text-blue-950 font-semibold shadow-2xs cursor-pointer hover:bg-blue-100 transition">
              <span class="truncate block">${nomeCurto} (${esc.turno || '24h'})</span>
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

function formatarNomeOperacional(nomeCompleto, prefixo) {
  if (!nomeCompleto) return prefixo;
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length === 1) return `${prefixo} ${partes[0]}`;
  
  const primeiroNome = partes[0];
  const ultimoSobrenome = partes[partes.length - 1];
  
  return `${prefixo} ${primeiroNome} ${ultimoSobrenome}`;
}

function renderBalaoPeriodo(titulo, horario, escalasArray, bgStyle) {
  if (escalasArray.length === 0) {
    return `
      <div class="text-[8.5px] p-0.5 px-1 rounded border ${bgStyle} opacity-35 flex items-center justify-between">
        <span class="font-semibold text-slate-500">${titulo}</span>
        <span class="text-[7.5px] text-slate-400 italic">Livre</span>
      </div>
    `;
  }

  const ordenarEscalas = (lista) => {
    return lista.sort((a, b) => {
      const srvA = appState.servidores.find(s => s.id === a.servidorId);
      const srvB = appState.servidores.find(s => s.id === b.servidorId);

      const isExtraA = a.tipo === 'EXTRAJORNADA' || a.tipo === 'SDP' ? 1 : 0;
      const isExtraB = b.tipo === 'EXTRAJORNADA' || b.tipo === 'SDP' ? 1 : 0;

      if (isExtraA !== isExtraB) return isExtraA - isExtraB;

      const isDelA = srvA?.cargo?.toUpperCase().includes('DELEGADO') ? 0 : 1;
      const isDelB = srvB?.cargo?.toUpperCase().includes('DELEGADO') ? 0 : 1;

      return isDelA - isDelB;
    });
  };

  const ordenadas = ordenarEscalas([...escalasArray]);
  const idsString = ordenadas.map(e => e.id).join(',');

  let listaHtml = ordenadas.map(esc => {
    const srv = appState.servidores.find(s => s.id === esc.servidorId);
    const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
    const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';

    const prefixo = isDel ? 'DEL.' : 'AG.';
    const nomeExibicao = srv ? formatarNomeOperacional(srv.nome, prefixo) : 'Policial';

    if (isExtra) {
      return `
        <div class="font-bold text-purple-900 leading-tight flex items-center justify-between gap-1">
          <span class="truncate">${nomeExibicao}</span>
          <span class="bg-purple-600 text-white text-[6.5px] font-black px-0.5 rounded shrink-0">EXTRA</span>
        </div>
      `;
    }
    return `
      <div class="font-semibold text-slate-800 leading-tight truncate">
        ${nomeExibicao}
      </div>
    `;
  }).join('');

  return `
    <div onmouseenter="window.mostrarTooltipGrupo(event, '${titulo}', '${horario}', '${idsString}')"
         onmouseleave="window.ocultarTooltip()"
         class="p-1 rounded-md border ${bgStyle} shadow-2xs space-y-0.5 cursor-pointer hover:shadow-xs transition">
      <div class="flex items-center justify-between border-b border-black/5 pb-0.5">
        <span class="text-[8.5px] font-bold tracking-wider uppercase text-slate-700">${titulo}</span>
        <span class="text-[7.5px] font-mono text-slate-400 font-medium">${horario}</span>
      </div>
      <div class="space-y-0.5 text-[9px]">
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

// Tooltip Flutuante v1
window.mostrarTooltipGrupo = function(event, titulo, horario, idsString) {
  const ids = idsString.split(',');
  const escalas = appState.escalas.filter(e => ids.includes(e.id));

  let content = `
    <div class="p-2.5 space-y-1.5 text-left min-w-[220px] font-sans">
      <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 text-xs flex items-center justify-between">
        <span>${titulo}</span>
        <span class="text-[10px] font-mono text-slate-500">${horario}</span>
      </div>
  `;

  escalas.forEach(esc => {
    const srv = appState.servidores.find(s => s.id === esc.servidorId);
    const del = appState.delegacias.find(d => d.id === esc.delegaciaId);
    const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';

    content += `
      <div class="pt-1 border-t border-slate-100 space-y-0.5">
        <div class="font-bold ${isExtra ? 'text-purple-800' : 'text-slate-800'} text-xs flex items-center justify-between">
          <span>${srv?.nome || 'Não informado'}</span>
          ${isExtra ? '<span class="text-[8px] bg-purple-100 text-purple-800 px-1 rounded font-bold">EXTRA</span>' : ''}
        </div>
        <div class="text-[10px] text-slate-600"><b>Cargo:</b> ${srv?.cargo || 'Agente'}</div>
        <div class="text-[10px] text-slate-600"><b>Lotação:</b> ${del?.nome || 'CRF'}</div>
        <div class="text-[10px] text-slate-600"><b>Telefone:</b> ${srv?.telefone || '-'}</div>
      </div>
    `;
  });

  content += `</div>`;
  exibirElementoTooltip(event, content);
};

window.mostrarTooltipEscala = function(event, escalaId) {
  const esc = appState.escalas.find(e => e.id === escalaId);
  if (!esc) return;

  const srv = appState.servidores.find(s => s.id === esc.servidorId);
  const del = appState.delegacias.find(d => d.id === esc.delegaciaId);

  const content = `
    <div class="p-2.5 space-y-1 text-left min-w-[200px] font-sans">
      <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 text-xs">${srv?.nome || 'Não informado'}</div>
      <div class="text-[10px] text-slate-600"><b>Cargo:</b> ${srv?.cargo || 'Agente'}</div>
      <div class="text-[10px] text-slate-600"><b>Lotação:</b> ${del?.nome || 'Delegacia'}</div>
      <div class="text-[10px] text-slate-600"><b>Turno:</b> ${esc.turno || '24h'}</div>
      <div class="text-[10px] text-slate-600"><b>Telefone:</b> ${srv?.telefone || '-'}</div>
    </div>
  `;

  exibirElementoTooltip(event, content);
};

function exibirElementoTooltip(event, htmlContent) {
  let tooltip = document.getElementById('global-calendar-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'global-calendar-tooltip';
    tooltip.className = 'fixed z-50 bg-white border border-slate-200 shadow-xl rounded-xl text-slate-800 text-xs pointer-events-none transition-opacity duration-150 opacity-0';
    document.body.appendChild(tooltip);
  }

  tooltip.innerHTML = htmlContent;

  tooltip.style.left = '0px';
  tooltip.style.top = '0px';
  
  const tooltipRect = tooltip.getBoundingClientRect();
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  let posX = event.clientX + 14;
  let posY = event.clientY + 14;

  if (posX + tooltipRect.width > screenWidth - 10) {
    posX = event.clientX - tooltipRect.width - 10;
  }

  if (posY + tooltipRect.height > screenHeight - 10) {
    posY = event.clientY - tooltipRect.height - 10;
  }

  tooltip.style.left = `${Math.max(10, posX)}px`;
  tooltip.style.top = `${Math.max(10, posY)}px`;
  tooltip.classList.remove('opacity-0');
}

window.ocultarTooltip = function() {
  const tooltip = document.getElementById('global-calendar-tooltip');
  if (tooltip) {
    tooltip.classList.add('opacity-0');
  }
};
