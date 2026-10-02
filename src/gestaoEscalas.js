// src/calendar.js
import { appState, normalizeText } from './state.js';

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

  let delegaciasOptionsEscala = (appState.delegacias || []).map(d => 
    `<option value="${d.id}" ${selectedDelegaciaId === d.id ? 'selected' : ''}>${d.nome}</option>`
  ).join('');

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

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const isHoje = (currentYear === hojeAno && currentMonth === hojeMes && day === hojeDia);
    const delObj = (appState.delegacias || []).find(d => d.id === selectedDelegaciaId);

    const feriadoDoDia = (feriados || []).find(f => {
      if (f.data !== dateStr) return false;
      if (scope === 'CRF') return f.tipo === 'NACIONAL' || f.tipo === 'ESTADUAL';

      if (f.tipo === 'NACIONAL' || f.tipo === 'ESTADUAL') return true;
      if (f.tipo === 'MUNICIPAL') {
        const ids = f.delegaciasIds || [];
        const bateuId = ids.includes(selectedDelegaciaId);
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
          return e.delegaciaId === selectedDelegaciaId || delObj.delegaciasIds.includes(e.delegaciaId);
        }
        return e.delegaciaId === selectedDelegaciaId;
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

      html += renderBalaoPeriodo('DIURNO', '07h30 - 19h30', diurnoEscalas, 'bg-[#F7F3E8] border-[#BEA55A] text-[#5A4716] shadow-xs');
      html += renderBalaoPeriodo('NOTURNO', '19h30 - 07h30', noturnoEscalas, 'bg-[#2A2B2D] border-[#57585A] text-[#F0F1F2] shadow-xs');
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

          // MESMA COR PARA SOBREAVISO E EXTRAJORNADA: BLACK & PCPR GOLD
          let cardStyle = 'bg-[#F7F3E8] border-[#BEA55A] text-[#5A4716]';
          let rotuloTipo = 'PLANTÃO';

          if (isSobreaviso) {
            cardStyle = 'bg-black border-[#BEA55A] text-[#BEA55A]';
            rotuloTipo = 'SOBREAVISO';
          } else if (isExtra) {
            cardStyle = 'bg-black border-[#BEA55A] text-[#BEA55A]';
            rotuloTipo = 'EXTRA';
          }

          const idsString = grupo.map(e => e.id).join(',');

          let nomesHtml = grupo.map(esc => {
            const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
            const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
            const prefixo = isDel ? 'DEL.' : 'APJ';
            const corTexto = (isSobreaviso || isExtra) ? 'text-[#BEA55A]' : 'text-slate-900';
            return `<div class="cal-v1-srv-name truncate block ${corTexto}">${srv ? formatarNomeOperacional(srv.nome, prefixo) : 'Policial'}</div>`;
          }).join('');

          html += `
            <div onclick="window.abrirModalDetalhesTurno('Escala Local', '${primeiraEsc.data}', '${idsString}')"
                 onmouseenter="window.mostrarTooltipGrupo(event, '${rotuloTipo}', '${primeiraEsc.turno || '24h'}', '${idsString}')"
                 onmouseleave="window.ocultarTooltip()"
                 class="p-1 rounded border ${cardStyle} font-semibold shadow-xs cursor-pointer hover:brightness-95 transition space-y-0.5">
              ${primeiraEsc.vtr ? `<div class="text-[8px] bg-black text-pcpr-gold font-black px-1 py-0.2 rounded truncate uppercase">🚘 ${primeiraEsc.vtr}</div>` : ''}
              ${nomesHtml}
              <div class="text-[7.5px] font-mono flex items-center justify-between opacity-90 border-t ${(isSobreaviso || isExtra) ? 'border-pcpr-gold/30 text-pcpr-gold' : 'border-black/10 text-slate-700'} pt-0.5">
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

function renderBalaoPeriodo(titulo, horario, escalasArray, bgStyle) {
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

    // TAG E TEXTO DE EXTRAJORNADA EM COR DOURADA PCPR
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
    btnPrev.addEventListener('click', () => {
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
    btnNext.addEventListener('click', () => {
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

      content += `
        <div class="pt-1 border-t border-slate-100 space-y-0.5">
          <div class="font-bold ${isExtra ? 'text-amber-800' : 'text-slate-800'} text-xs flex items-center justify-between">
            <span>${srv?.nome || 'Não informado'}</span>
            ${isExtra ? '<span class="text-[8px] bg-black text-pcpr-gold border border-pcpr-gold px-1 rounded font-bold">EXTRA</span>' : ''}
          </div>
          <div class="text-[10px] text-slate-600"><b>Cargo:</b> ${srv?.cargo || 'APJ'}</div>
          <div class="text-[10px] text-slate-600"><b>Lotação de Origem:</b> ${lotacaoOrigem}</div>
          <div class="text-[10px] text-slate-600"><b>Telefone:</b> ${srv?.telefone || '-'}</div>
        </div>
      `;
    });

    content += `</div>`;
    exibirElementoTooltip(event, content);
  } catch (err) {
    console.error("Erro tooltip grupo:", err);
  }
};

window.mostrarTooltipEscala = function(event, escalaId) {
  if (window.innerWidth < 768) return;

  try {
    const esc = (appState.escalas || []).find(e => e.id === escalaId);
    if (!esc) return;

    const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
    const delEscala = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);
    const delServidor = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);
    const lotacaoOrigem = delServidor ? delServidor.nome : (srv?.delegaciaNome || 'Lotação não informada');

    const isSobreaviso = esc.tipo === 'SOBREAVISO';

    const { entradaStr, saidaStr } = calcularHorariosEntradaSaida(esc, delEscala);

    const content = `
      <div class="p-2.5 space-y-1 text-left min-w-[220px] font-sans">
        <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 text-xs flex items-center justify-between">
          <span>${srv?.nome || 'Não informado'}</span>
          <span class="text-[8px] ${isSobreaviso ? 'bg-black text-pcpr-gold border border-pcpr-gold' : 'bg-[#F7F3E8] text-[#5A4716] border border-[#BEA55A]'} px-1 rounded font-bold uppercase">${esc.tipo || 'PLANTÃO'}</span>
        </div>
        <div class="text-[10px] text-slate-600"><b>Cargo:</b> ${srv?.cargo || 'APJ'}</div>
        <div class="text-[10px] text-slate-600"><b>Lotação de Origem:</b> ${lotacaoOrigem}</div>
        <div class="text-[10px] text-slate-600"><b>Unidade do Plantão:</b> ${delEscala ? delEscala.nome : 'Unidade Local'}</div>
        <div class="text-[10px] text-emerald-800 font-mono"><b>Entrada:</b> ${entradaStr}</div>
        <div class="text-[10px] text-rose-800 font-mono"><b>Saída:</b> ${saidaStr}</div>
        <div class="text-[10px] text-slate-600"><b>Telefone:</b> ${srv?.telefone || '-'}</div>
      </div>
    `;

    exibirElementoTooltip(event, content);
  } catch (err) {
    console.error("Erro tooltip escala:", err);
  }
};

function calcularHorariosEntradaSaida(escala, delObj) {
  const isSobreaviso = escala.tipo === 'SOBREAVISO';
  let config = isSobreaviso ? delObj?.sobreavisoConfig : delObj?.plantaoConfig;

  const dtInicioIso = escala.dataInicio || escala.data;

  const [anoIn, mesIn, diaIn] = dtInicioIso.split('-').map(Number);
  const dtInObj = new Date(anoIn, mesIn - 1, diaIn);
  const dayOfWeekIn = dtInObj.getDay();
  const isFimDeSemanaIn = (dayOfWeekIn === 0 || dayOfWeekIn === 6);

  let horarioTexto = '08:00 às 08:00';
  if (config) {
    horarioTexto = isFimDeSemanaIn ? (config.naoUteis || '08:00 às 08:00') : (config.uteis || '08:00 às 08:00');
  } else if (delObj) {
    horarioTexto = isFimDeSemanaIn ? (delObj.horarioNaoUteis || '08:00 às 08:00') : (delObj.horarioUteis || '08:00 às 08:00');
  }

  let horaIn = '08:00', horaOut = '08:00';
  if (horarioTexto.includes('às')) {
    const partes = horarioTexto.split('às').map(p => p.trim());
    horaIn = partes[0] || '08:00';
    horaOut = partes[1] || '08:00';
  }

  const dtBrIn = `${String(diaIn).padStart(2, '0')}/${String(mesIn).padStart(2, '0')}/${anoIn}`;

  let dtBrOut = dtBrIn;
  if (escala.dataFim) {
    const [anoOut, mesOut, diaOut] = escala.dataFim.split('-').map(Number);
    dtBrOut = `${String(diaOut).padStart(2, '0')}/${String(mesOut).padStart(2, '0')}/${anoOut}`;
  } else {
    let duracaoDias = 1;
    if (escala.turno && escala.turno.includes('dias')) {
      duracaoDias = parseInt(escala.turno) || 1;
    }
    const dtSaidaObj = new Date(anoIn, mesIn - 1, diaIn + duracaoDias);
    const ddOut = String(dtSaidaObj.getDate()).padStart(2, '0');
    const mmOut = String(dtSaidaObj.getMonth() + 1).padStart(2, '0');
    const yyOut = dtSaidaObj.getFullYear();
    dtBrOut = `${ddOut}/${mmOut}/${yyOut}`;
  }

  return {
    entradaStr: `${dtBrIn} às ${horaIn}`,
    saidaStr: `${dtBrOut} às ${horaOut}`
  };
}

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
