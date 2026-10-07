// src/calendar.js
import { appState, normalizeText } from './state.js';
import { hasPermission, canViewPhoneForDate, getPerfilUsuarioLogado, PERFIS } from './permissions.js';
import { abrirModalHistoricoLogs, registrarLogTroca } from './logs.js';

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

function obterHorarioTurnoTexto(esc) {
  if (!esc) return '08:00 às 08:00';

  const turno = (esc.turno || '24h').toLowerCase().trim();
  const del = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);
  const isSobreaviso = esc.tipo === 'SOBREAVISO';
  const config = isSobreaviso ? del?.sobreavisoConfig : del?.plantaoConfig;

  if (turno.includes('12h (d)')) return '07:30 às 19:30';
  if (turno.includes('12h (n)')) return '19:30 às 07:30 (do dia seguinte)';

  const hUteis = config?.uteis || del?.horarioUteis || '08:00 às 08:00';
  const hNaoUteis = config?.naoUteis || del?.horarioNaoUteis || '08:00 às 08:00';

  if (esc.data) {
    const parts = esc.data.split('-').map(Number);
    if (parts.length === 3) {
      const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const dayOfWeek = dObj.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return hNaoUteis;
      }
    }
  }

  if (turno.includes('dias') || turno.includes('dia')) {
    const numDias = parseInt(turno, 10) || 1;
    const parts = esc.data.split('-').map(Number);
    if (parts.length === 3) {
      const dFim = new Date(parts[0], parts[1] - 1, parts[2] + numDias);
      const dd = String(dFim.getDate()).padStart(2, '0');
      const mm = String(dFim.getMonth() + 1).padStart(2, '0');
      return `Entrada 08:00 (dia ${parts[2]}) às 08:00 (dia ${dd}/${mm})`;
    }
  }

  return hUteis;
}

function obterOpcoesDelegaciaEscala(selectedDelegaciaId, scope) {
  const isPublico = !appState.currentUser;
  const { currentYear, currentMonth, escalas, delegacias } = appState;

  let listaDelegacias = [...(delegacias || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  if (isPublico && scope === 'DELEGACIA') {
    const mesPrefixo = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    const delegaciasComEscala = new Set(
      (escalas || [])
        .filter(e => e.scope === 'DELEGACIA' && e.data && e.data.startsWith(mesPrefixo))
        .map(e => e.delegaciaId)
    );

    listaDelegacias = listaDelegacias.filter(d => {
      const bateuId = delegaciasComEscala.has(d.id);
      const bateuUnificada = d.delegaciasIds && d.delegaciasIds.some(unfId => delegaciasComEscala.has(unfId));
      return bateuId || bateuUnificada;
    });

    if (listaDelegacias.length > 0) {
      const selectedExiste = listaDelegacias.some(d => d.id === selectedDelegaciaId);
      if (!selectedExiste) {
        appState.selectedDelegaciaId = listaDelegacias[0].id;
      }
    }
  }

  if (listaDelegacias.length === 0) {
    return `<option value="">Nenhuma delegacia com escala neste mês</option>`;
  }

  const targetId = appState.selectedDelegaciaId || selectedDelegaciaId;

  return listaDelegacias.map(d => 
    `<option value="${d.id}" ${targetId === d.id ? 'selected' : ''}>${d.nome}</option>`
  ).join('');
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

  const padronizarSdpStr = (txt) => {
    if (!txt) return '';
    let norm = txt.trim();
    if (norm.startsWith('7')) return '7ª SDP';
    if (norm.startsWith('8')) return '8ª SDP';
    if (norm.startsWith('21')) return '21ª SDP';
    return norm;
  };

  const setSdps = new Set(['7ª SDP', '8ª SDP', '21ª SDP']);
  (appState.delegacias || []).forEach(d => { if (d.subdivisao) setSdps.add(padronizarSdpStr(d.subdivisao)); });
  (appState.servidores || []).forEach(s => { if (s.subdivisao) setSdps.add(padronizarSdpStr(s.subdivisao)); });
  (appState.escalas || []).forEach(e => { if (e.sdpId) setSdps.add(padronizarSdpStr(e.sdpId)); });

  const sdpsUnicas = [...setSdps].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let sdpOptions = `<option value="TODOS" ${sdpFiltroAtual === 'TODOS' ? 'selected' : ''}>Todas as SDPs</option>`;
  sdpsUnicas.forEach(sdp => {
    sdpOptions += `<option value="${sdp}" ${sdpFiltroAtual === sdp ? 'selected' : ''}>${sdp}</option>`;
  });

  const delegaciasFiltradasSdp = (appState.delegacias || []).filter(d => {
    if (sdpFiltroAtual !== 'TODOS') {
      return padronizarSdpStr(d.subdivisao) === sdpFiltroAtual;
    }
    return true;
  });

  let delCrfOptions = `<option value="TODAS" ${delFiltroAtual === 'TODAS' ? 'selected' : ''}>Todas as Delegacias</option>`;
  delegaciasFiltradasSdp.forEach(d => {
    delCrfOptions += `<option value="${d.id}" ${delFiltroAtual === d.id ? 'selected' : ''}>${d.nome}</option>`;
  });

  let delegaciasOptionsEscala = obterOpcoesDelegaciaEscala(selectedDelegaciaId, scope);

  let html = `
    <!-- Topo de Controle -->
    <div class="p-3 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 font-sans">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-800 tracking-tight uppercase">
          ${scope === 'CRF' ? '🏛️ Escala Geral CRF' : '🏢 Escala por Delegacia'}
        </span>
      </div>

      ${scope === 'DELEGACIA' ? `
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-600">Unidade / Plantão:</label>
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

  const currentSelectedDelId = appState.selectedDelegaciaId || selectedDelegaciaId;

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const isHoje = (currentYear === hojeAno && currentMonth === hojeMes && day === hojeDia);
    const delObj = (appState.delegacias || []).find(d => d.id === currentSelectedDelId);

    const feriadoDoDia = (feriados || []).find(f => {
      if (f.data !== dateStr) return false;
      if (scope === 'CRF') return f.tipo === 'NACIONAL' || f.tipo === 'ESTADUAL';

      if (f.tipo === 'NACIONAL' || f.tipo === 'ESTADUAL') return true;
      if (f.tipo === 'MUNICIPAL') {
        const ids = f.delegaciasIds || [];
        const bateuId = ids.includes(currentSelectedDelId);
        const bateuUnificado = delObj?.delegaciasIds && delObj.delegaciasIds.some(unfId => ids.includes(unfId));
        return bateuId || bateuUnificado;
      }
      return false;
    });

    let escalasDoDia = (appState.escalas || []).filter(e => {
      if (e.data !== dateStr) return false;
      if (e.scope !== scope) return false;
      
      if (scope === 'DELEGACIA') {
        if (delObj && delObj.delegaciasIds && delObj.delegaciasIds.length > 0) {
          return e.delegaciaId === currentSelectedDelId || delObj.delegaciasIds.includes(e.delegaciaId);
        }
        return e.delegaciaId === currentSelectedDelId;
      }
      return true;
    });

    if (scope === 'CRF') {
      if (sdpFiltroAtual !== 'TODOS') {
        escalasDoDia = escalasDoDia.filter(e => {
          const srv = (appState.servidores || []).find(s => s.id === e.servidorId);
          const del = (appState.delegacias || []).find(d => d.id === e.delegaciaId);

          const sdpDel = del?.subdivisao ? padronizarSdpStr(del.subdivisao) : '';
          const sdpSrv = srv?.subdivisao ? padronizarSdpStr(srv.subdivisao) : '';

          return sdpDel === sdpFiltroAtual || sdpSrv === sdpFiltroAtual;
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
      ? 'border-2 border-black bg-slate-100/50 shadow-inner z-10' 
      : 'border-t border-l border-slate-200/80';

    html += `
      <div class="${bgDayClass} ${hojeBorderClass} p-1 flex flex-col justify-between relative min-h-[115px] h-auto">
        <div class="flex items-center justify-between mb-1 px-0.5">
          <div class="flex items-center gap-1">
            <span class="cal-v1-day-num ${isHoje ? 'text-black font-black' : (feriadoDoDia ? 'text-red-700' : (isWeekend ? 'text-amber-800' : 'text-slate-800'))}">
              ${day}
            </span>
            ${isHoje ? '<span class="text-[7px] bg-black text-pcpr-gold font-extrabold px-1 rounded uppercase tracking-tighter">HOJE</span>' : ''}
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

      html += renderBalaoPeriodo('DIURNO', '07h30 - 19h30', diurnoEscalas, 'bg-[#F7F3E8] border-[#BEA55A] text-[#5A4716] shadow-xs', dateStr);
      html += renderBalaoPeriodo('NOTURNO', '19h30 - 07h30', noturnoEscalas, 'bg-[#2A2B2D] border-[#57585A] text-[#F0F1F2] shadow-xs', dateStr);
    } else {
      if (escalasDoDia.length === 0) {
        html += `<span class="text-[8.5px] text-slate-300 italic block font-light px-1">Livre</span>`;
      } else {
        const gruposDelegacia = {};
        escalasDoDia.forEach(esc => {
          const key = `${esc.tipo || 'PLANTÃO'}_${esc.vtr || ''}_${esc.turno || '24h'}`;
          if (!gruposDelegacia[key]) gruposDelegacia[key] = [];
          gruposDelegacia[key].push(esc);
        });

        const chavesOrdenadas = Object.keys(gruposDelegacia).sort((a, b) => {
          const tipoA = a.split('_')[0];
          const tipoB = b.split('_')[0];

          const peso = (tipo) => {
            if (tipo === 'PLANTÃO') return 1;
            if (tipo === 'SOBREAVISO') return 2;
            return 3;
          };

          return peso(tipoA) - peso(tipoB);
        });

        chavesOrdenadas.forEach(key => {
          const grupo = gruposDelegacia[key];
          const primeiraEsc = grupo[0];
          const isSobreaviso = primeiraEsc.tipo === 'SOBREAVISO';
          const isExtra = primeiraEsc.tipo === 'EXTRAJORNADA' || primeiraEsc.tipo === 'SDP';

          let cardStyle = 'bg-[#F7F3E8] border-[#BEA55A] text-[#5A4716]';
          let rotuloTipo = 'PLANTÃO';

          if (isSobreaviso) {
            cardStyle = 'bg-[#2A2B2D] border-[#57585A] text-[#F0F1F2] shadow-xs';
            rotuloTipo = 'SOBREAVISO';
          } else if (isExtra) {
            cardStyle = 'bg-slate-700 border-slate-800 text-slate-100 shadow-xs';
            rotuloTipo = 'EXTRA';
          }

          const idsString = grupo.map(e => e.id).join(',');

          let nomesHtml = grupo.map(esc => {
            const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
            const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
            const prefixo = isDel ? 'DEL.' : 'APJ';
            
            let corTexto = 'text-slate-900';
            if (isSobreaviso) corTexto = 'text-white font-semibold';
            else if (isExtra) corTexto = 'text-slate-100 font-bold';

            return `<div class="cal-v1-srv-name truncate block ${corTexto}">${srv ? formatarNomeOperacional(srv.nome, prefixo) : 'Policial'}</div>`;
          }).join('');

          html += `
            <div onclick="event.stopPropagation(); window.abrirModalDetalhesTurno('${rotuloTipo}', '${primeiraEsc.turno || '24h'}', '${idsString}', '${dateStr}')"
                 onmouseenter="window.mostrarTooltipGrupo(event, '${rotuloTipo}', '${primeiraEsc.turno || '24h'}', '${idsString}')"
                 onmouseleave="window.ocultarTooltip()"
                 class="p-1 rounded border ${cardStyle} font-semibold shadow-xs cursor-pointer hover:brightness-95 transition space-y-0.5">
              ${primeiraEsc.vtr ? `<div class="text-[8px] bg-black text-[#BEA55A] border border-[#BEA55A]/40 font-black px-1 py-0.2 rounded truncate uppercase">🚘 ${primeiraEsc.vtr}</div>` : ''}
              ${nomesHtml}
              <div class="text-[7.5px] font-mono flex items-center justify-between opacity-90 border-t ${isSobreaviso ? 'border-white/20 text-slate-300' : (isExtra ? 'border-slate-500/60 text-pcpr-gold font-bold' : 'border-black/10 text-slate-700')} pt-0.5">
                <span>${primeiraEsc.turno || '24h'}</span>
                <span class="font-bold uppercase tracking-tight">${rotuloTipo}</span>
              </div>
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

function renderBalaoPeriodo(titulo, horario, escalasArray, bgStyle, dateStr) {
  if (escalasArray.length === 0) {
    return `
      <div class="p-0.5 px-1 rounded border ${bgStyle} opacity-40 flex items-center justify-between">
        <span class="cal-v1-header-title">${titulo}</span>
        <span class="text-[7.5px] italic opacity-80">Livre</span>
      </div>
    `;
  }

  const ordenadas = [...escalasArray].sort((a, b) => {
    const srvA = (appState.servidores || []).find(s => s.id === a.servidorId);
    const srvB = (appState.servidores || []).find(s => s.id === b.servidorId);

    const isExtraA = a.tipo === 'EXTRAJORNADA' || a.tipo === 'SDP' ? 1 : 0;
    const isExtraB = b.tipo === 'EXTRAJORNADA' || b.tipo === 'SDP' ? 1 : 0;

    if (isExtraA !== isExtraB) return isExtraA - isExtraB;

    const isDelA = srvA?.cargo?.toUpperCase().includes('DELEGADO') ? 0 : 1;
    const isDelB = srvB?.cargo?.toUpperCase().includes('DELEGADO') ? 0 : 1;

    return isDelA - isDelB;
  });

  const idsString = ordenadas.map(e => e.id).join(',');
  const isNoturno = titulo === 'NOTURNO';

  let listaHtml = ordenadas.map(esc => {
    const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
    const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';

    const prefixo = isDel ? 'DEL.' : 'APJ';
    const nomeExibicao = srv ? formatarNomeOperacional(srv.nome, prefixo) : 'Policial';

    if (isExtra) {
      return `
        <div class="cal-v1-srv-name text-[#BEA55A] font-bold flex items-center justify-between gap-1">
          <span class="truncate">${nomeExibicao}</span>
          <span class="cal-v1-tag-extra bg-black text-[#BEA55A] border border-[#BEA55A] rounded shrink-0 shadow-xs">EXTRA</span>
        </div>
      `;
    }

    const corNome = isNoturno ? 'text-white' : 'text-[#3E300E]';
    return `
      <div class="cal-v1-srv-name ${corNome} truncate">
        ${nomeExibicao}
      </div>
    `;
  }).join('');

  const headerColorClass = isNoturno ? 'border-white/20 text-slate-300' : 'border-[#BEA55A]/50 text-[#5A4716]';

  return `
    <div onclick="event.stopPropagation(); window.abrirModalDetalhesTurno('${titulo}', '${horario}', '${idsString}', '${dateStr}')"
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
  const container = document.getElementById(containerId);
  if (!container) return;

  const selectDel = container.querySelector('#select-calendar-delegacia');
  if (selectDel) {
    selectDel.addEventListener('change', (e) => {
      appState.selectedDelegaciaId = e.target.value;
      renderCalendarGrid(containerId, scope);
    });
  }

  const btnPrev = container.querySelector('#btn-prev-month');
  if (btnPrev) {
    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      if (appState.currentMonth === 0) {
        appState.currentMonth = 11;
        appState.currentYear--;
      } else {
        appState.currentMonth--;
      }
      renderCalendarGrid(containerId, scope);
    });
  }

  const btnNext = container.querySelector('#btn-next-month');
  if (btnNext) {
    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      if (appState.currentMonth === 11) {
        appState.currentMonth = 0;
        appState.currentYear++;
      } else {
        appState.currentMonth++;
      }
      renderCalendarGrid(containerId, scope);
    });
  }
}

window.mostrarTooltipGrupo = function(event, titulo, horario, idsString) {
  if (window.innerWidth < 768) return;

  try {
    const ids = idsString.split(',');
    const escalas = (appState.escalas || []).filter(e => ids.includes(e.id));
    const primeiraEscala = escalas[0];

    const podeVerTelefone = canViewPhoneForDate(primeiraEscala?.data);

    let content = `
      <div class="p-2.5 space-y-1.5 text-left min-w-[220px] font-sans">
        <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 text-xs flex items-center justify-between">
          <span>${titulo}</span>
          <span class="text-[10px] font-mono text-slate-500">${horario}</span>
        </div>
    `;

    escalas.forEach(esc => {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      const delServidor = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);
      const lotacaoOrigem = delServidor ? delServidor.nome : (srv?.delegaciaNome || 'Central CRF');

      const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';
      const telExibicao = podeVerTelefone ? (srv?.telefone || '-') : '🔒 [Acesso Restrito]';
      const horarioEfetivo = obterHorarioTurnoTexto(esc);

      content += `
        <div class="pt-1 border-t border-slate-100 space-y-0.5">
          <div class="font-bold ${isExtra ? 'text-amber-700' : 'text-slate-800'} text-xs flex items-center justify-between">
            <span>${srv?.nome || 'Não informado'}</span>
            ${isExtra ? '<span class="text-[8px] bg-slate-700 text-pcpr-gold border border-slate-800 px-1 rounded font-bold">EXTRA</span>' : ''}
          </div>
          <div class="text-[10px] text-slate-600"><b>Cargo:</b> ${srv?.cargo || 'APJ'}</div>
          <div class="text-[10px] text-slate-600"><b>Lotação de Origem:</b> ${lotacaoOrigem}</div>
          <div class="text-[10px] text-slate-600"><b>Horário do Turno:</b> ${horarioEfetivo}</div>
          <div class="text-[10px] text-slate-600"><b>Telefone:</b> ${telExibicao}</div>
        </div>
      `;
    });

    content += `</div>`;
    exibirElementoTooltip(event, content);
  } catch (err) {
    console.error("Erro tooltip grupo:", err);
  }
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

  let posX = event.clientX + 14;
  let posY = event.clientY + 14;

  if (posX + tooltipRect.width > screenWidth - 10) {
    posX = event.clientX - tooltipRect.width - 10;
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

// =========================================================================
// MODAL DE DETALHES DIRECIONADO AO BALÃO / TURNO ESPECÍFICO
// =========================================================================
window.abrirModalDetalhesTurno = function(tituloGrupo, horarioGrupo, idsString, dataIso) {
  let modal = document.getElementById('modal-detalhes-plantao');
  if (!modal) {
    criarModalDetalhesPlantaoDOM();
    modal = document.getElementById('modal-detalhes-plantao');
  }

  const containerConteudo = document.getElementById('modal-detalhes-conteudo');
  const tituloModalEl = document.getElementById('modal-detalhes-titulo-sub');
  if (!containerConteudo) return;

  const scopeAtual = appState.calendarScope || 'CRF';
  const selectedDelId = appState.selectedDelegaciaId;

  const ids = idsString.split(',');
  const escalasDoGrupo = (appState.escalas || []).filter(e => ids.includes(e.id));
  
  const podeVerTelefone = canViewPhoneForDate(dataIso);
  const showBtnApj = hasPermission('SHOW_BTN_INCLUIR_TROCAR_APJ');
  const showBtnDel = hasPermission('SHOW_BTN_TROCAR_DELEGADO');
  
  const perfilUser = getPerfilUsuarioLogado();
  const podeVincularApj = scopeAtual === 'CRF' && [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.APJ].includes(perfilUser);

  if (tituloModalEl) {
    tituloModalEl.innerText = `${tituloGrupo} (${horarioGrupo}) • ${formatarDataBr(dataIso)}`;
  }

  if (escalasDoGrupo.length === 0) {
    containerConteudo.innerHTML = `
      <div class="p-6 text-center text-slate-400 italic font-sans text-xs">
        Nenhum registro localizado para este turno (${formatarDataBr(dataIso)}).
      </div>
    `;
  } else {
    // Verifica se no turno da CRF não há nenhum APJ cadastrado
    const temApjNoTurno = escalasDoGrupo.some(esc => {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      return srv && !(srv.cargo || '').toUpperCase().includes('DELEGADO');
    });

    let cardsHtml = escalasDoGrupo.map(esc => {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      const delServidor = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);
      const lotacaoOrigem = delServidor ? delServidor.nome : (srv?.delegaciaNome || 'Central CRF');

      const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
      const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';
      const telExibicao = podeVerTelefone ? (srv?.telefone || 'Não informado') : '🔒 [Acesso Restrito]';
      const horarioEfetivo = obterHorarioTurnoTexto(esc);

      let btnDelHtml = '';
      if (isDel && showBtnDel && !isExtra) {
        btnDelHtml = '<button onclick="window.abrirModalTrocarDelegado(\'' + esc.id + '\')" class="px-2 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded-lg font-bold text-[10px] cursor-pointer">🔄 Trocar Delegado</button>';
      }

      // BOTÃO DE VINCULAR APJ: DOURADO PCPR, APENAS NA CRF QUANDO O TURNO NÃO TIVER APJ
      let btnVincularApjHtml = '';
      if (isDel && !temApjNoTurno && podeVincularApj && !isExtra) {
        btnVincularApjHtml = '<button onclick="window.abrirModalVincularApjSimplificado(\'' + esc.id + '\', \'' + dataIso + '\', \'' + (esc.turno || horarioGrupo) + '\')" class="px-2 py-1 bg-[#BEA55A] hover:bg-[#AF9340] text-black font-extrabold border border-black rounded-lg text-[10px] cursor-pointer shadow-xs">🔗 Vincular APJ</button>';
      }

      let btnApjHtml = '';
      if (!isDel && showBtnApj && !isExtra) {
        btnApjHtml = '<button onclick="window.abrirModalIncluirTrocarAPJ(\'' + esc.id + '\')" class="px-2 py-1 bg-black text-pcpr-gold hover:bg-slate-800 border border-pcpr-gold rounded-lg font-bold text-[10px] cursor-pointer">🔄 Trocar APJ</button>';
      }

      return `
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 font-sans space-y-2">
          <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <span class="text-[10px] uppercase font-extrabold ${isDel ? 'text-[#5A4716]' : 'text-slate-500'}">
              ${isDel ? 'Delegado Responsável' : 'APJ / Agente Integrante'}
            </span>
            <span class="text-[9px] ${isExtra ? 'bg-slate-700 text-pcpr-gold border border-slate-800 font-black' : 'bg-slate-200 text-slate-700 font-bold'} px-1.5 py-0.5 rounded font-mono uppercase">
              ${isExtra ? 'EXTRAJORNADA' : (esc.tipo || 'PLANTÃO')} • ${esc.turno || horarioGrupo}
            </span>
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-slate-900 text-xs block">${srv ? srv.nome : 'Policial Não Informado'}</span>
              <span class="text-[10px] text-slate-500 font-semibold">${srv ? srv.cargo : 'APJ'}</span>
            </div>

            <div class="text-[11px] text-slate-600 space-y-0.5 font-medium border-t border-slate-200/60 pt-1">
              <div><b>Lotação de Origem:</b> ${lotacaoOrigem}</div>
              <div><b>Horário do Turno:</b> <span class="font-mono font-bold text-slate-800">${horarioEfetivo}</span></div>
              <div><b>Telefone de Plantão:</b> <span class="font-mono text-slate-800">${telExibicao}</span></div>
            </div>
          </div>

          <div class="flex justify-end gap-1 pt-1 border-t border-slate-200">
            ${btnDelHtml}
            ${btnVincularApjHtml}
            ${btnApjHtml}
          </div>
        </div>
      `;
    }).join('');

    // Botão de acesso rápido aos Logs no rodapé do Modal
    cardsHtml += `
      <div class="pt-2 flex justify-between items-center border-t border-slate-200">
        <button type="button" onclick="window.fecharModalDetalhesPlantao(); abrirModalHistoricoLogs('${scopeAtual}', '${selectedDelId}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-bold text-[10px] cursor-pointer flex items-center gap-1">
          📋 Logs de Alterações
        </button>
      </div>
    `;

    containerConteudo.innerHTML = `<div class="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">${cardsHtml}</div>`;
  }

  modal.classList.remove('hidden');
};

window.fecharModalDetalhesPlantao = function() {
  document.getElementById('modal-detalhes-plantao')?.classList.add('hidden');
};

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}

function criarModalDetalhesPlantaoDOM() {
  const modalHTML = `
    <div id="modal-detalhes-plantao" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 flex flex-col border-t-4 border-pcpr-gold">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <div>
            <h3 class="font-bold text-slate-900 text-sm flex items-center gap-1.5">📅 Detalhes do Turno</h3>
            <p id="modal-detalhes-titulo-sub" class="text-[11px] text-slate-500 font-medium"></p>
          </div>
          <button type="button" onclick="window.fecharModalDetalhesPlantao()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <div id="modal-detalhes-conteudo"></div>

        <div class="pt-2 border-t flex justify-end shrink-0">
          <button type="button" onclick="window.fecharModalDetalhesPlantao()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
