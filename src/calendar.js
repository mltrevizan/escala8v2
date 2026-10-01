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

  const hoje = new Date();
  const hojeAno = hoje.getFullYear();
  const hojeMes = hoje.getMonth();
  const hojeDia = hoje.getDate();

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const sdpFiltroAtual = appState.filtroSdp || 'TODOS';
  const delFiltroAtual = appState.filtroDelegaciaCrf || 'TODAS';

  const sdpsUnicas = [...new Set((appState.delegacias || []).map(d => d.subdivisao).filter(Boolean))].sort();

  let sdpOptions = `<option value="TODOS" ${sdpFiltroAtual === 'TODOS' ? 'selected' : ''}>Todas as SDPs / Regionais</option>`;
  sdpsUnicas.forEach(sdp => {
    sdpOptions += `<option value="${sdp}" ${sdpFiltroAtual === sdp ? 'selected' : ''}>${sdp}</option>`;
  });

  const delegaciasFiltradasSdp = (appState.delegacias || []).filter(d => {
    if (sdpFiltroAtual !== 'TODOS' && d.subdivisao !== sdpFiltroAtual) return false;
    return true;
  });

  let delCrfOptions = `<option value="TODAS" ${delFiltroAtual === 'TODAS' ? 'selected' : ''}>Todas as Delegacias</option>`;
  delegaciasFiltradasSdp.forEach(d => {
    delCrfOptions += `<option value="${d.id}" ${delFiltroAtual === d.id ? 'selected' : ''}>${d.nome}</option>`;
  });

  let delegaciasOptionsEscala = (appState.delegacias || []).map(d => 
    `<option value="${d.id}" ${selectedDelegaciaId === d.id ? 'selected' : ''}>${d.nome}</option>`
  ).join('');

  let html = `
    <!-- Topo de Controle -->
    <div class="p-3 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 font-sans">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-800 tracking-tight uppercase">
          ${scope === 'CRF' ? '🏛️ Escala Geral CRF' : '🏢 Escala por Delegacia / Plantão Unificado'}
        </span>
      </div>

      ${scope === 'DELEGACIA' ? `
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-600">Unidade:</label>
          <select id="select-calendar-delegacia" class="text-xs font-bold bg-slate-50 border border-slate-300 rounded-md p-1.5 shadow-xs">
            ${delegaciasOptionsEscala}
          </select>
        </div>
      ` : ''}
    </div>

    <!-- Navegação de Mês + Filtros -->
    <div class="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
      <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-xs">
        <button id="btn-prev-month" class="px-2.5 py-1 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold transition cursor-pointer">◀ Anterior</button>
        <span class="font-black text-xs text-slate-800 uppercase tracking-wider px-2 border-x border-slate-200">${monthNames[currentMonth]} ${currentYear}</span>
        <button id="btn-next-month" class="px-2.5 py-1 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold transition cursor-pointer">Próximo ▶</button>
      </div>

      ${scope === 'CRF' ? `
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-1.5">
            <label class="text-[11px] font-bold text-slate-600">SDP:</label>
            <select id="select-filtro-sdp" onchange="window.mudarFiltroSdp(this.value)" class="text-xs font-bold bg-white border border-slate-300 rounded-lg p-1.5 shadow-xs text-slate-800">
              ${sdpOptions}
            </select>
          </div>

          <div class="flex items-center gap-1.5">
            <label class="text-[11px] font-bold text-slate-600">Delegacia:</label>
            <select id="select-filtro-del-crf" onchange="window.mudarFiltroDelCrf(this.value)" class="text-xs font-bold bg-white border border-slate-300 rounded-lg p-1.5 shadow-xs text-slate-800">
              ${delCrfOptions}
            </select>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Cabeçalho Dias da Semana -->
    <div class="grid grid-cols-7 text-center bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 py-1.5 font-sans uppercase">
      <div class="text-red-600">Dom</div>
      <div>Seg</div>
      <div>Ter</div>
      <div>Qua</div>
      <div>Qui</div>
      <div>Sex</div>
      <div class="text-indigo-600">Sáb</div>
    </div>

    <!-- Grade do Mês -->
    <div class="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px border-b border-r border-slate-200 font-sans">
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="bg-slate-50/50 p-1"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const isHoje = (currentYear === hojeAno && currentMonth === hojeMes && day === hojeDia);
    const feriadoDoDia = (feriados || []).find(f => f.data === dateStr);

    let escalasDoDia = appState.escalas.filter(e => {
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

    if (scope === 'CRF') {
      if (sdpFiltroAtual !== 'TODOS') {
        escalasDoDia = escalasDoDia.filter(e => {
          const del = appState.delegacias.find(d => d.id === e.delegaciaId);
          return del && del.subdivisao === sdpFiltroAtual;
        });
      }

      if (delFiltroAtual !== 'TODAS') {
        escalasDoDia = escalasDoDia.filter(e => e.delegaciaId === delFiltroAtual);
      }
    }

    let bgDayClass = 'bg-white';
    if (feriadoDoDia) {
      bgDayClass = 'bg-rose-50/60';
    } else if (isWeekend) {
      bgDayClass = 'bg-amber-50/40';
    }

    const hojeBorderClass = isHoje 
      ? 'border-2 border-indigo-600 bg-indigo-50/20 shadow-inner z-10' 
      : 'border-t border-l border-slate-200/80';

    html += `
      <div class="${bgDayClass} ${hojeBorderClass} p-1 flex flex-col justify-between relative min-h-[115px] h-auto">
        <div class="flex items-center justify-between mb-1 px-0.5">
          <div class="flex items-center gap-1">
            <span class="cal-v1-day-num ${isHoje ? 'text-indigo-800' : (feriadoDoDia ? 'text-red-700' : (isWeekend ? 'text-amber-800' : 'text-slate-800'))}">
              ${day}
            </span>
            ${isHoje ? '<span class="text-[7px] bg-indigo-600 text-white font-extrabold px-1 rounded uppercase tracking-tighter">HOJE</span>' : ''}
          </div>

          ${feriadoDoDia ? `
            <span class="text-[7.5px] bg-red-100 text-red-800 border border-red-200 font-bold px-1 rounded truncate max-w-[75px]" title="${feriadoDoDia.descricao}">
              ${feriadoDoDia.descricao}
            </span>
          ` : ''}
        </div>

        <div class="space-y-1 flex-1 flex flex-col justify-start">
    `;

    if (scope === 'CRF') {
      const diurnoEscalas = escalasDoDia.filter(e => e.turno === '12h (D)' || e.turno === '24h');
      const noturnoEscalas = escalasDoDia.filter(e => e.turno === '12h (N)');

      html += renderBalaoPeriodo(
        'DIURNO', 
        '07h30 - 19h30', 
        diurnoEscalas, 
        'bg-amber-100/90 border-amber-300 text-amber-950 shadow-xs'
      );

      html += renderBalaoPeriodo(
        'NOTURNO', 
        '19h30 - 07h30', 
        noturnoEscalas, 
        'bg-indigo-50 border-indigo-200 text-indigo-950 shadow-xs'
      );
    } else {
      if (escalasDoDia.length === 0) {
        html += `<span class="text-[8.5px] text-slate-300 italic block font-light px-1">Livre</span>`;
      } else {
        escalasDoDia.forEach(esc => {
          const srv = appState.servidores.find(s => s.id === esc.servidorId);
          const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
          const prefixo = isDel ? 'DEL.' : 'APJ';
          const nomeCurto = srv ? formatarNomeOperacional(srv.nome, prefixo) : 'Policial';

          const isSobreaviso = esc.tipo === 'SOBREAVISO';
          const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';

          let cardStyle = 'bg-sky-100/90 border-sky-300 text-sky-950';
          let tagRotulo = 'PLANTÃO';
          let tagStyle = 'bg-sky-600 text-white';

          if (isSobreaviso) {
            cardStyle = 'bg-amber-100/90 border-amber-300 text-amber-950';
            tagRotulo = 'SOBREAVISO';
            tagStyle = 'bg-amber-600 text-white';
          } else if (isExtra) {
            cardStyle = 'bg-purple-100/90 border-purple-300 text-purple-950';
            tagRotulo = 'EXTRA';
            tagStyle = 'bg-purple-600 text-white';
          }

          html += `
            <div onclick="window.abrirModalDetalhesTurno('Escala Local', '${esc.data}', '${esc.id}')"
                 onmouseenter="window.mostrarTooltipEscala(event, '${esc.id}')"
                 onmouseleave="window.ocultarTooltip()"
                 class="p-1 rounded border ${cardStyle} font-semibold shadow-xs cursor-pointer hover:brightness-95 transition space-y-0.5">
              <div class="flex items-center justify-between gap-1">
                <span class="cal-v1-srv-name truncate block">${nomeCurto}</span>
                <span class="text-[6.5px] ${tagStyle} font-extrabold px-1 py-0.2 rounded shrink-0 uppercase">${tagRotulo}</span>
              </div>
              <div class="text-[7.5px] font-mono opacity-80">${esc.turno || '24h'}</div>
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
      <div class="p-0.5 px-1 rounded border ${bgStyle} opacity-40 flex items-center justify-between">
        <span class="cal-v1-header-title text-slate-600">${titulo}</span>
        <span class="text-[7.5px] text-slate-500 italic">Livre</span>
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

    const prefixo = isDel ? 'DEL.' : 'APJ';
    const nomeExibicao = srv ? formatarNomeOperacional(srv.nome, prefixo) : 'Policial';

    if (isExtra) {
      return `
        <div class="cal-v1-srv-name text-purple-900 flex items-center justify-between gap-1">
          <span class="truncate">${nomeExibicao}</span>
          <span class="cal-v1-tag-extra bg-purple-600 text-white rounded shrink-0 shadow-xs">EXTRA</span>
        </div>
      `;
    }
    return `
      <div class="cal-v1-srv-name text-slate-900 truncate">
        ${nomeExibicao}
      </div>
    `;
  }).join('');

  const isDiurno = titulo === 'DIURNO';
  const headerColorClass = isDiurno ? 'text-amber-900 border-amber-300/60' : 'text-indigo-900 border-indigo-200';

  return `
    <div onclick="window.abrirModalDetalhesTurno('${titulo}', '${horario}', '${idsString}')"
         onmouseenter="window.mostrarTooltipGrupo(event, '${titulo}', '${horario}', '${idsString}')"
         onmouseleave="window.ocultarTooltip()"
         class="p-1 rounded-md border ${bgStyle} space-y-0.5 cursor-pointer hover:brightness-95 hover:shadow-sm transition">
      <div class="flex items-center justify-between border-b pb-0.5 ${headerColorClass}">
        <span class="cal-v1-header-title uppercase">${titulo}</span>
        <span class="cal-v1-header-time opacity-80">${horario}</span>
      </div>
      <div class="space-y-0.5">
        ${listaHtml}
      </div>
    </div>
  `;
}

window.mudarFiltroSdp = function(valor) {
  appState.filtroSdp = valor;
  appState.filtroDelegaciaCrf = 'TODAS';
  renderCalendarGrid('calendar-crf-container', 'CRF');
};

window.mudarFiltroDelCrf = function(valor) {
  appState.filtroDelegaciaCrf = valor;
  renderCalendarGrid('calendar-crf-container', 'CRF');
};

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

// Modal Responsivo para Móvel
window.abrirModalDetalhesTurno = function(titulo, horario, idsString) {
  let modal = document.getElementById('modal-detalhes-turno');
  if (!modal) {
    criarModalDetalhesTurnoDOM();
    modal = document.getElementById('modal-detalhes-turno');
  }

  const ids = idsString.split(',');
  const escalas = appState.escalas.filter(e => ids.includes(e.id));

  const tituloEl = document.getElementById('modal-turno-titulo');
  const corpoEl = document.getElementById('modal-turno-corpo');

  if (tituloEl) tituloEl.innerHTML = `${titulo} <span class="text-xs font-mono font-normal text-slate-500">(${horario})</span>`;

  let htmlContent = '';

  if (escalas.length === 0) {
    htmlContent = `<p class="text-xs text-slate-500 italic p-4 text-center">Nenhum policial escalado para este período.</p>`;
  } else {
    escalas.forEach(esc => {
      const srv = appState.servidores.find(s => s.id === esc.servidorId);
      const del = appState.delegacias.find(d => d.id === esc.delegaciaId);
      const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';
      const isSobreaviso = esc.tipo === 'SOBREAVISO';

      const tagRotulo = isSobreaviso ? 'SOBREAVISO' : (isExtra ? 'EXTRAJORNADA' : 'PLANTÃO');
      const tagColor = isSobreaviso ? 'bg-amber-600 text-white' : (isExtra ? 'bg-purple-600 text-white' : 'bg-sky-600 text-white');

      htmlContent += `
        <div class="p-3 bg-slate-50 border rounded-xl space-y-1">
          <div class="font-bold text-slate-900 text-xs flex items-center justify-between">
            <span>${srv?.nome || 'Não informado'}</span>
            <span class="text-[9px] ${tagColor} px-1.5 py-0.5 rounded font-extrabold uppercase">${tagRotulo}</span>
          </div>
          <div class="text-xs text-slate-600"><b>Cargo:</b> ${srv?.cargo || 'APJ'}</div>
          <div class="text-xs text-slate-600"><b>Lotação / SDP:</b> ${del?.nome || 'CRF'}</div>
          <div class="text-xs text-slate-600"><b>Contato/Tel:</b> ${srv?.telefone || '-'}</div>
        </div>
      `;
    });
  }

  if (corpoEl) corpoEl.innerHTML = htmlContent;
  modal.classList.remove('hidden');
};

window.fecharModalDetalhesTurno = function() {
  document.getElementById('modal-detalhes-turno')?.classList.add('hidden');
};

function criarModalDetalhesTurnoDOM() {
  const modalHTML = `
    <div id="modal-detalhes-turno" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 id="modal-turno-titulo" class="font-black text-slate-900 text-sm"></h3>
          <button onclick="window.fecharModalDetalhesTurno()" class="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
        </div>

        <div id="modal-turno-corpo" class="space-y-2 overflow-y-auto flex-1 pr-1"></div>

        <div class="pt-2 border-t flex justify-end shrink-0">
          <button onclick="window.fecharModalDetalhesTurno()" class="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs">Fechar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.mostrarTooltipGrupo = function(event, titulo, horario, idsString) {
  if (window.innerWidth < 768) return;

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
        <div class="text-[10px] text-slate-600"><b>Cargo:</b> ${srv?.cargo || 'APJ'}</div>
        <div class="text-[10px] text-slate-600"><b>Lotação:</b> ${del?.nome || 'CRF'}</div>
        <div class="text-[10px] text-slate-600"><b>Telefone:</b> ${srv?.telefone || '-'}</div>
      </div>
    `;
  });

  content += `</div>`;
  exibirElementoTooltip(event, content);
};

window.mostrarTooltipEscala = function(event, escalaId) {
  if (window.innerWidth < 768) return;

  const esc = appState.escalas.find(e => e.id === escalaId);
  if (!esc) return;

  const srv = appState.servidores.find(s => s.id === esc.servidorId);
  const del = appState.delegacias.find(d => d.id === esc.delegaciaId);
  const isSobreaviso = esc.tipo === 'SOBREAVISO';

  const content = `
    <div class="p-2.5 space-y-1 text-left min-w-[200px] font-sans">
      <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 text-xs flex items-center justify-between">
        <span>${srv?.nome || 'Não informado'}</span>
        <span class="text-[8px] ${isSobreaviso ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'} px-1 rounded font-bold uppercase">${esc.tipo || 'PLANTÃO'}</span>
      </div>
      <div class="text-[10px] text-slate-600"><b>Cargo:</b> ${srv?.cargo || 'APJ'}</div>
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
