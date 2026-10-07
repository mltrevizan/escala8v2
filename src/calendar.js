// src/calendar.js
import { appState, normalizeText } from './state.js';
import { hasPermission, canViewPhoneForDate, getPerfilUsuarioLogado, isProtectedAdminAccount, PERFIS } from './permissions.js';
import { abrirModalHistoricoLogs, registrarLogTroca } from './logs.js';
import { syncDocToFirestore } from './db.js';

window.abrirModalHistoricoLogs = abrirModalHistoricoLogs;

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}

/**
 * Localiza de forma ultra-robusta o ID do servidor do usuário logado
 */
function obterServidorIdUsuarioLogado() {
  const user = appState.currentUser;
  if (!user) return '';

  const lista = appState.servidores || [];

  const idsBusca = [user.servidorId, user.id, user.uid].filter(Boolean).map(String);
  let srvEncontrado = lista.find(s => idsBusca.includes(String(s.id)));
  if (srvEncontrado) return String(srvEncontrado.id);

  const loginUser = normalizeText(user.login || user.email || '').split('@')[0];
  if (loginUser) {
    srvEncontrado = lista.find(s => {
      const loginSrv = normalizeText(s.login || s.email || '').split('@')[0];
      return loginSrv && loginSrv === loginUser;
    });
    if (srvEncontrado) return String(srvEncontrado.id);
  }

  const nomeUser = normalizeText(user.nome || user.displayName || '');
  if (nomeUser) {
    srvEncontrado = lista.find(s => normalizeText(s.nome) === nomeUser);
    if (srvEncontrado) return String(srvEncontrado.id);
  }

  return idsBusca[0] || '';
}

function saoMesmoPolicial(idA, idB) {
  if (!idA || !idB) return false;
  if (String(idA) === String(idB)) return true;

  const srvA = (appState.servidores || []).find(s => String(s.id) === String(idA));
  const srvB = (appState.servidores || []).find(s => String(s.id) === String(idB));

  if (srvA && srvB && srvA.id === srvB.id) return true;
  return false;
}

function obterHorarioTurnoTexto(esc) {
  if (!esc) return '08:00 às 08:00';

  const turno = (esc.turno || '24h').toLowerCase().trim();
  const del = (appState.delegacias || []).find(d => String(d.id) === String(esc.delegaciaId));
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

/**
 * Função global para alteração direta da delegacia no filtro do calendário
 */
window.mudarDelegaciaCalendario = function(delegaciaId) {
  appState.selectedDelegaciaId = String(delegaciaId);
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
};

function obterOpcoesDelegaciaEscala(selectedDelegaciaId, scope) {
  const isPublico = !appState.currentUser;
  const { currentYear, currentMonth, escalas, delegacias } = appState;

  let listaDelegacias = [...(delegacias || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  if (isPublico && scope === 'DELEGACIA') {
    const mesPrefixo = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    const delegaciasComEscala = new Set(
      (escalas || [])
        .filter(e => e.scope === 'DELEGACIA' && e.data && e.data.startsWith(mesPrefixo))
        .map(e => String(e.delegaciaId))
    );

    listaDelegacias = listaDelegacias.filter(d => {
      const bateuId = delegaciasComEscala.has(String(d.id));
      const bateuUnificada = d.delegaciasIds && d.delegaciasIds.some(unfId => delegaciasComEscala.has(String(unfId)));
      return bateuId || bateuUnificada;
    });
  }

  if (listaDelegacias.length === 0) {
    return `<option value="">Nenhuma delegacia disponível</option>`;
  }

  // Determina qual ID deve vir selecionado
  let targetId = appState.selectedDelegaciaId || selectedDelegaciaId;
  
  if (!targetId && !isPublico && appState.currentUser?.delegaciaId) {
    targetId = String(appState.currentUser.delegaciaId);
    appState.selectedDelegaciaId = targetId;
  } else if (!targetId && listaDelegacias.length > 0) {
    targetId = String(listaDelegacias[0].id);
    appState.selectedDelegaciaId = targetId;
  }

  return listaDelegacias.map(d => 
    `<option value="${d.id}" ${String(targetId) === String(d.id) ? 'selected' : ''}>${d.nome}</option>`
  ).join('');
}

export function renderCalendarGrid(containerId, scope = 'CRF') {
  const container = document.getElementById(containerId);
  if (!container) return;

  appState.calendarScope = scope;

  // Garante inicialização padrão da delegacia do usuário logado se ainda não houver seleção
  if (scope === 'DELEGACIA' && appState.currentUser && appState.currentUser.delegaciaId) {
    if (!appState.selectedDelegaciaId) {
      appState.selectedDelegaciaId = String(appState.currentUser.delegaciaId);
    }
  }

  const { currentYear, currentMonth, selectedDelegaciaId, feriados } = appState;
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  const isPublico = !appState.currentUser;
  const usuarioLogadoSrvId = obterServidorIdUsuarioLogado();

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
    </div>

    <!-- Navegação de Mês + Seletor de Unidade e Botão de Logs alinhados à direita -->
    <div class="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
      <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-xs">
        <button id="btn-prev-month" class="px-2.5 py-1 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold transition cursor-pointer">◀ Anterior</button>
        <span class="font-black text-xs text-slate-800 uppercase tracking-wider px-2 border-x border-slate-200">${monthNames[currentMonth]} ${currentYear}</span>
        <button id="btn-next-month" class="px-2.5 py-1 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold transition cursor-pointer">Próximo ▶</button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        ${scope === 'DELEGACIA' ? `
          <div class="flex items-center gap-1.5">
            <label class="text-xs font-medium text-slate-600">Unidade / Plantão:</label>
            <select id="select-calendar-delegacia" onchange="window.mudarDelegaciaCalendario(this.value)" class="text-xs font-bold bg-white border border-slate-300 rounded-lg p-1.5 shadow-xs text-slate-800">
              ${delegaciasOptionsEscala}
            </select>
          </div>
        ` : `
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
        `}

        ${!isPublico ? `
          <button type="button" onclick="window.abrirModalHistoricoLogs('${scope}', '${scope === 'DELEGACIA' ? (appState.selectedDelegaciaId || selectedDelegaciaId) : ''}')" class="px-3 py-1.5 bg-slate-800 hover:bg-black text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1">
            📋 Logs
          </button>
        ` : ''}
      </div>
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
    const delObj = (appState.delegacias || []).find(d => String(d.id) === String(currentSelectedDelId));

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
          return String(e.delegaciaId) === String(currentSelectedDelId) || delObj.delegaciasIds.includes(e.delegaciaId);
        }
        return String(e.delegaciaId) === String(currentSelectedDelId);
      }
      return true;
    });

    if (scope === 'CRF') {
      if (sdpFiltroAtual !== 'TODOS') {
        escalasDoDia = escalasDoDia.filter(e => {
          const srv = (appState.servidores || []).find(s => String(s.id) === String(e.servidorId));
          const del = (appState.delegacias || []).find(d => String(d.id) === String(e.delegaciaId));

          const sdpDel = del?.subdivisao ? padronizarSdpStr(del.subdivisao) : '';
          const sdpSrv = srv?.subdivisao ? padronizarSdpStr(srv.subdivisao) : '';

          return sdpDel === sdpFiltroAtual || sdpSrv === sdpFiltroAtual;
        });
      }

      if (delFiltroAtual !== 'TODAS') {
        escalasDoDia = escalasDoDia.filter(e => String(e.delegaciaId) === String(delFiltroAtual));
      }
    }

    const usuarioEstaEscaladoNoDia = !isPublico && usuarioLogadoSrvId && escalasDoDia.some(e => saoMesmoPolicial(e.servidorId, usuarioLogadoSrvId));

    let bgDayClass = 'bg-white';
    if (feriadoDoDia) {
      bgDayClass = 'bg-rose-50/60';
    } else if (isWeekend) {
      bgDayClass = 'bg-amber-50/40';
    }

    let hojeBorderClass = 'border-t border-l border-slate-200/80';
    if (isHoje) {
      hojeBorderClass = 'border-2 border-black bg-slate-100/50 shadow-inner z-10';
    } else if (usuarioEstaEscaladoNoDia) {
      hojeBorderClass = 'border-2 border-[#BEA55A] bg-[#F7F3E8]/50 shadow-xs z-10';
    }

    html += `
      <div class="${bgDayClass} ${hojeBorderClass} p-1 flex flex-col justify-between relative min-h-[115px] h-auto">
        <div class="flex items-center justify-between mb-1 px-0.5">
          <div class="flex items-center gap-1">
            <span class="cal-v1-day-num ${isHoje ? 'text-black font-black' : (feriadoDoDia ? 'text-red-700' : (isWeekend ? 'text-amber-800' : 'text-slate-800'))}">
              ${day}
            </span>
            ${isHoje ? '<span class="text-[7px] bg-black text-pcpr-gold font-extrabold px-1 rounded uppercase tracking-tighter">HOJE</span>' : ''}
            ${(!isHoje && usuarioEstaEscaladoNoDia) ? '<span class="text-[7px] bg-[#BEA55A] text-black font-extrabold px-1 rounded uppercase tracking-tighter" title="Seu Plantão">MEU PLANTÃO</span>' : ''}
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
            const srv = (appState.servidores || []).find(s => String(s.id) === String(esc.servidorId));
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
    const srvA = (appState.servidores || []).find(s => String(s.id) === String(a.servidorId));
    const srvB = (appState.servidores || []).find(s => String(s.id) === String(b.servidorId));

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
    const srv = (appState.servidores || []).find(s => String(s.id) === String(esc.servidorId));
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
      const srv = (appState.servidores || []).find(s => String(s.id) === String(esc.servidorId));
      const delServidor = (appState.delegacias || []).find(d => String(d.id) === String(srv?.delegaciaId));
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
  const perfilUser = getPerfilUsuarioLogado();
  const userDelId = appState.currentUser?.delegaciaId;

  const eMesmaDelegaciaSuper = scopeAtual === 'DELEGACIA' && String(selectedDelId) === String(userDelId);

  const podeTrocarDel = [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO].includes(perfilUser) || (perfilUser === PERFIS.SUPERINTENDENTE && eMesmaDelegaciaSuper);
  const podeTrocarApj = [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.APJ].includes(perfilUser) || (perfilUser === PERFIS.SUPERINTENDENTE && (scopeAtual === 'CRF' || eMesmaDelegaciaSuper));
  const podeVincularApj = [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.APJ].includes(perfilUser) || (perfilUser === PERFIS.SUPERINTENDENTE && (scopeAtual === 'CRF' || eMesmaDelegaciaSuper));

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
    const plantaoRegular = escalasDoGrupo.filter(esc => esc.tipo !== 'EXTRAJORNADA' && esc.tipo !== 'SDP');

    const temApjNoPlantaoRegular = plantaoRegular.some(esc => {
      const srv = (appState.servidores || []).find(s => String(s.id) === String(esc.servidorId));
      return srv && !(srv.cargo || '').toUpperCase().includes('DELEGADO');
    });

    let cardsHtml = escalasDoGrupo.map(esc => {
      const srv = (appState.servidores || []).find(s => String(s.id) === String(esc.servidorId));
      const delServidor = (appState.delegacias || []).find(d => String(d.id) === String(srv?.delegaciaId));
      const lotacaoOrigem = delServidor ? delServidor.nome : (srv?.delegaciaNome || 'Central CRF');

      const isDel = srv?.cargo?.toUpperCase().includes('DELEGADO');
      const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';
      const telExibicao = podeVerTelefone ? (srv?.telefone || 'Não informado') : '🔒 [Acesso Restrito]';
      const horarioEfetivo = obterHorarioTurnoTexto(esc);

      let btnDelHtml = '';
      if (isDel && podeTrocarDel && !isExtra) {
        btnDelHtml = `<button onclick="window.abrirModalTrocarDelegado('${esc.id}', '${dataIso}', '${esc.turno || horarioGrupo}')" class="px-2 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded-lg font-bold text-[10px] cursor-pointer">🔄 Trocar Delegado</button>`;
      }

      let btnVincularApjHtml = '';
      if (isDel && !temApjNoPlantaoRegular && podeVincularApj && !isExtra) {
        btnVincularApjHtml = `<button onclick="window.abrirModalVincularApjAcao('${esc.id}', '${dataIso}', '${esc.turno || horarioGrupo}')" class="px-2 py-1 bg-[#BEA55A] hover:bg-[#AF9340] text-black font-extrabold border border-black rounded-lg text-[10px] cursor-pointer shadow-xs">🔗 Vincular APJ</button>`;
      }

      let btnApjHtml = '';
      if (!isDel && podeTrocarApj && !isExtra) {
        btnApjHtml = `<button onclick="window.abrirModalTrocarApj('${esc.id}', '${dataIso}', '${esc.turno || horarioGrupo}')" class="px-2 py-1 bg-black text-pcpr-gold hover:bg-slate-800 border border-pcpr-gold rounded-lg font-bold text-[10px] cursor-pointer">🔄 Trocar APJ</button>`;
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

    if (appState.currentUser) {
      cardsHtml += `
        <div class="pt-2 flex justify-between items-center border-t border-slate-200">
          <button type="button" onclick="window.fecharModalDetalhesPlantao(); window.abrirModalHistoricoLogs('${scopeAtual}', '${selectedDelId}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-bold text-[10px] cursor-pointer flex items-center gap-1">
            📋 Logs de Alterações
          </button>
        </div>
      `;
    }

    containerConteudo.innerHTML = `<div class="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">${cardsHtml}</div>`;
  }

  modal.classList.remove('hidden');
};

window.fecharModalDetalhesPlantao = function() {
  document.getElementById('modal-detalhes-plantao')?.classList.add('hidden');
};

// =========================================================================
// MODAIS DE AÇÃO COM RECORREÇÃO DA POOL E DAS TRAVAS POR PERFIL
// =========================================================================

// --- A) MODAL TROCAR DELEGADO ---
window.abrirModalTrocarDelegado = function(escalaId, dataIso, turnoStr) {
  let modal = document.getElementById('modal-acao-trocar-delegado');
  if (!modal) {
    criarModalAcaoTrocarDelegadoDOM();
    modal = document.getElementById('modal-acao-trocar-delegado');
  }

  const esc = (appState.escalas || []).find(e => String(e.id) === String(escalaId));
  if (!esc) return;

  const srvAtual = (appState.servidores || []).find(s => String(s.id) === String(esc.servidorId));
  const perfil = getPerfilUsuarioLogado();
  const userSrvId = obterServidorIdUsuarioLogado();

  document.getElementById('m-del-escala-id').value = escalaId;
  document.getElementById('m-del-filtro-busca').value = '';
  
  const selectDelModal = document.getElementById('m-del-filtro-delegacia');
  if (selectDelModal) {
    let opts = `<option value="TODAS" selected>Todas as Delegacias</option>`;
    (appState.delegacias || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).forEach(d => {
      opts += `<option value="${d.id}">${d.nome}</option>`;
    });
    selectDelModal.innerHTML = opts;
  }

  window.atualizarSelectTrocarDelegadoModal(esc, srvAtual, perfil, userSrvId);
  modal.classList.remove('hidden');
};

window.atualizarSelectTrocarDelegadoModal = function(esc, srvAtual, perfil, userSrvId) {
  const selectNovo = document.getElementById('m-del-novo-id');
  if (!selectNovo) return;

  const busca = (document.getElementById('m-del-filtro-busca')?.value || '').toLowerCase().trim();
  const delFiltro = document.getElementById('m-del-filtro-delegacia')?.value || 'TODAS';

  const isPerfilDelegado = perfil === PERFIS.DELEGADO;
  const souEuEscalado = srvAtual && saoMesmoPolicial(srvAtual.id, userSrvId);

  let poolDelegados = (appState.servidores || []).filter(s => {
    if (isProtectedAdminAccount(s) || (s.nome || '').toUpperCase().includes('ADMINISTRADOR DO SISTEMA') || s.login === 'admin') {
      return false;
    }

    const cargoU = (s.cargo || '').toUpperCase();
    if (!cargoU.includes('DELEGADO')) return false;

    if (isPerfilDelegado && !souEuEscalado) {
      return saoMesmoPolicial(s.id, userSrvId);
    }

    if (delFiltro !== 'TODAS' && String(s.delegaciaId) !== String(delFiltro)) return false;
    if (busca && !(s.nome || '').toLowerCase().includes(busca)) return false;

    return true;
  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  let opts = `<option value="">Selecione o Novo Delegado (${poolDelegados.length})...</option>`;
  poolDelegados.forEach(d => {
    const isSelecionado = (isPerfilDelegado && !souEuEscalado && saoMesmoPolicial(d.id, userSrvId));
    opts += `<option value="${d.id}" ${isSelecionado ? 'selected' : ''}>DEL. ${d.nome}</option>`;
  });

  selectNovo.innerHTML = opts;

  if (isPerfilDelegado && !souEuEscalado) {
    if (userSrvId) selectNovo.value = userSrvId;
    selectNovo.disabled = true;
  } else {
    selectNovo.disabled = false;
  }
};

window.salvarTrocaDelegadoSubmit = async function(e) {
  e.preventDefault();

  const escId = document.getElementById('m-del-escala-id').value;
  const selectNovo = document.getElementById('m-del-novo-id');
  const novoServidorId = selectNovo.value;

  if (!novoServidorId) {
    alert("Selecione o novo Delegado para efetuar a troca.");
    return;
  }

  const esc = (appState.escalas || []).find(e => String(e.id) === String(escId));
  if (!esc) return;

  const srvAnterior = (appState.servidores || []).find(s => String(s.id) === String(esc.servidorId));
  const srvNovo = (appState.servidores || []).find(s => String(s.id) === String(novoServidorId));

  esc.servidorId = novoServidorId;

  try {
    await syncDocToFirestore('escalas', esc.id, esc);

    await registrarLogTroca({
      scope: esc.scope,
      delegaciaId: esc.delegaciaId,
      tipoAcao: 'TROCA_DELEGADO',
      detalhes: `Troca do Delegado ${srvAnterior ? srvAnterior.nome : 'Anterior'} pelo DEL. ${srvNovo ? srvNovo.nome : 'Novo'} no plantão do dia ${formatarDataBr(esc.data)} (${esc.turno || '24h'}).`,
      dataPlantao: esc.data,
      turno: esc.turno
    });

    document.getElementById('modal-acao-trocar-delegado')?.classList.add('hidden');
    window.fecharModalDetalhesPlantao();

    renderCalendarGrid(appState.calendarScope === 'CRF' ? 'calendar-crf-container' : 'calendar-delegacia-container', appState.calendarScope);
    alert(`Troca efetuada com sucesso! Substituído por DEL. ${srvNovo ? srvNovo.nome : ''}.`);
  } catch (err) {
    console.error("Erro ao salvar troca no Firestore:", err);
    alert(`Erro ao gravar troca no banco de dados: ${err.message}`);
  }
};

// --- B) MODAL TROCAR APJ ---
window.abrirModalTrocarApj = function(escalaId, dataIso, turnoStr) {
  let modal = document.getElementById('modal-acao-trocar-apj');
  if (!modal) {
    criarModalAcaoTrocarApjDOM();
    modal = document.getElementById('modal-acao-trocar-apj');
  }

  const esc = (appState.escalas || []).find(e => String(e.id) === String(escalaId));
  if (!esc) return;

  const srvAtual = (appState.servidores || []).find(s => String(s.id) === String(esc.servidorId));
  const perfil = getPerfilUsuarioLogado();
  const userSrvId = obterServidorIdUsuarioLogado();

  document.getElementById('m-apj-escala-id').value = escalaId;
  document.getElementById('m-apj-filtro-busca').value = '';

  const selectDelModal = document.getElementById('m-apj-filtro-delegacia');
  if (selectDelModal) {
    let opts = `<option value="TODAS" selected>Todas as Delegacias</option>`;
    (appState.delegacias || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).forEach(d => {
      opts += `<option value="${d.id}">${d.nome}</option>`;
    });
    selectDelModal.innerHTML = opts;
  }

  window.atualizarSelectTrocarApjModal(esc, srvAtual, perfil, userSrvId);
  modal.classList.remove('hidden');
};

window.atualizarSelectTrocarApjModal = function(esc, srvAtual, perfil, userSrvId) {
  const selectNovo = document.getElementById('m-apj-novo-id');
  if (!selectNovo) return;

  const busca = (document.getElementById('m-apj-filtro-busca')?.value || '').toLowerCase().trim();
  const delFiltro = document.getElementById('m-apj-filtro-delegacia')?.value || 'TODAS';

  const isPerfilApj = perfil === PERFIS.APJ;
  const souEuEscalado = srvAtual && saoMesmoPolicial(srvAtual.id, userSrvId);

  let poolApjs = (appState.servidores || []).filter(s => {
    if (isProtectedAdminAccount(s) || (s.nome || '').toUpperCase().includes('ADMINISTRADOR DO SISTEMA') || s.login === 'admin') {
      return false;
    }

    const cargoU = (s.cargo || '').toUpperCase();
    if (cargoU.includes('DELEGADO')) return false;

    if (isPerfilApj && !souEuEscalado) {
      return saoMesmoPolicial(s.id, userSrvId);
    }

    if (delFiltro !== 'TODAS' && String(s.delegaciaId) !== String(delFiltro)) return false;
    if (busca && !(s.nome || '').toLowerCase().includes(busca)) return false;

    return true;
  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  let opts = `<option value="">Selecione o Novo APJ (${poolApjs.length})...</option>`;
  poolApjs.forEach(a => {
    const isSelecionado = (isPerfilApj && !souEuEscalado && saoMesmoPolicial(a.id, userSrvId));
    opts += `<option value="${a.id}" ${isSelecionado ? 'selected' : ''}>${a.nome} (${a.cargo || 'APJ'})</option>`;
  });

  selectNovo.innerHTML = opts;

  if (isPerfilApj && !souEuEscalado) {
    if (userSrvId) selectNovo.value = userSrvId;
    selectNovo.disabled = true;
  } else {
    selectNovo.disabled = false;
  }
};

window.salvarTrocaApjSubmit = async function(e) {
  e.preventDefault();

  const escId = document.getElementById('m-apj-escala-id').value;
  const selectNovo = document.getElementById('m-apj-novo-id');
  const novoServidorId = selectNovo.value;

  if (!novoServidorId) {
    alert("Selecione o novo APJ para efetuar a troca.");
    return;
  }

  const esc = (appState.escalas || []).find(e => String(e.id) === String(escId));
  if (!esc) return;

  const srvAnterior = (appState.servidores || []).find(s => String(s.id) === String(esc.servidorId));
  const srvNovo = (appState.servidores || []).find(s => String(s.id) === String(novoServidorId));

  esc.servidorId = novoServidorId;

  try {
    await syncDocToFirestore('escalas', esc.id, esc);

    await registrarLogTroca({
      scope: esc.scope,
      delegaciaId: esc.delegaciaId,
      tipoAcao: 'TROCA_APJ',
      detalhes: `Troca do APJ ${srvAnterior ? srvAnterior.nome : 'Anterior'} pelo APJ ${srvNovo ? srvNovo.nome : 'Novo'} no plantão do dia ${formatarDataBr(esc.data)} (${esc.turno || '24h'}).`,
      dataPlantao: esc.data,
      turno: esc.turno
    });

    document.getElementById('modal-acao-trocar-apj')?.classList.add('hidden');
    window.fecharModalDetalhesPlantao();

    renderCalendarGrid(appState.calendarScope === 'CRF' ? 'calendar-crf-container' : 'calendar-delegacia-container', appState.calendarScope);
    alert(`Troca efetuada e gravada com sucesso! Substituído por APJ ${srvNovo ? srvNovo.nome : ''}.`);
  } catch (err) {
    console.error("Erro ao salvar troca APJ no Firestore:", err);
    alert(`Erro ao gravar troca no banco de dados: ${err.message}`);
  }
};

// --- C) MODAL VINCULAR APJ ---
window.abrirModalVincularApjAcao = function(escalaDelegadoId, dataIso, turnoStr) {
  let modal = document.getElementById('modal-acao-vincular-apj');
  if (!modal) {
    criarModalAcaoVincularApjDOM();
    modal = document.getElementById('modal-acao-vincular-apj');
  }

  const perfil = getPerfilUsuarioLogado();
  const userSrvId = obterServidorIdUsuarioLogado();

  document.getElementById('m-vinc-escala-id').value = escalaDelegadoId;
  document.getElementById('m-vinc-data-iso').value = dataIso;
  document.getElementById('m-vinc-turno-str').value = turnoStr;
  document.getElementById('m-vinc-filtro-busca').value = '';

  const selectDelModal = document.getElementById('m-vinc-filtro-delegacia');
  if (selectDelModal) {
    let opts = `<option value="TODAS" selected>Todas as Delegacias</option>`;
    (appState.delegacias || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).forEach(d => {
      opts += `<option value="${d.id}">${d.nome}</option>`;
    });
    selectDelModal.innerHTML = opts;
  }

  window.atualizarSelectVincularApjModal(perfil, userSrvId);
  modal.classList.remove('hidden');
};

window.atualizarSelectVincularApjModal = function(perfil, userSrvId) {
  const selectApj = document.getElementById('m-vinc-apj-id');
  if (!selectApj) return;

  const busca = (document.getElementById('m-vinc-filtro-busca')?.value || '').toLowerCase().trim();
  const delFiltro = document.getElementById('m-vinc-filtro-delegacia')?.value || 'TODAS';

  const isPerfilApj = perfil === PERFIS.APJ;

  let poolApjs = (appState.servidores || []).filter(s => {
    if (isProtectedAdminAccount(s) || (s.nome || '').toUpperCase().includes('ADMINISTRADOR DO SISTEMA') || s.login === 'admin') {
      return false;
    }

    const cargoU = (s.cargo || '').toUpperCase();
    if (cargoU.includes('DELEGADO')) return false;

    if (isPerfilApj) {
      return saoMesmoPolicial(s.id, userSrvId);
    }

    if (delFiltro !== 'TODAS' && String(s.delegaciaId) !== String(delFiltro)) return false;
    if (busca && !(s.nome || '').toLowerCase().includes(busca)) return false;

    return true;
  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  let opts = `<option value="">Selecione o APJ a Vincular (${poolApjs.length})...</option>`;
  poolApjs.forEach(a => {
    const isSelecionado = saoMesmoPolicial(a.id, userSrvId);
    opts += `<option value="${a.id}" ${isSelecionado ? 'selected' : ''}>${a.nome} (${a.cargo || 'APJ'})</option>`;
  });

  selectApj.innerHTML = opts;

  if (isPerfilApj) {
    if (userSrvId) selectApj.value = userSrvId;
    selectApj.disabled = true;
  } else {
    if (userSrvId && poolApjs.some(a => saoMesmoPolicial(a.id, userSrvId))) {
      selectApj.value = userSrvId;
    }
    selectApj.disabled = false;
  }
};

window.salvarVincularApjSubmit = async function(e) {
  e.preventDefault();

  const escDelId = document.getElementById('m-vinc-escala-id').value;
  const dataIso = document.getElementById('m-vinc-data-iso').value;
  const turnoStr = document.getElementById('m-vinc-turno-str').value;
  const selectApj = document.getElementById('m-vinc-apj-id');
  const apjId = selectApj.value;

  if (!apjId) {
    alert("Selecione um APJ para vincular ao plantão.");
    return;
  }

  const escDel = (appState.escalas || []).find(e => String(e.id) === String(escDelId));
  const srvApj = (appState.servidores || []).find(s => String(s.id) === String(apjId));
  const srvDel = escDel ? (appState.servidores || []).find(s => String(s.id) === String(escDel.servidorId)) : null;

  const newEscId = 'esc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const novaEscala = {
    id: newEscId,
    data: dataIso,
    servidorId: apjId,
    delegaciaId: srvApj ? srvApj.delegaciaId : '',
    scope: 'CRF',
    tipo: 'PLANTÃO',
    turno: turnoStr
  };

  if (!appState.escalas) appState.escalas = [];
  appState.escalas.push(novaEscala);

  try {
    await syncDocToFirestore('escalas', newEscId, novaEscala);

    await registrarLogTroca({
      scope: 'CRF',
      delegaciaId: null,
      tipoAcao: 'VINCULAR_APJ',
      detalhes: `Inclusão/Vinculação do APJ ${srvApj ? srvApj.nome : 'Policial'} ao plantão CRF do dia ${formatarDataBr(dataIso)} (${turnoStr}) junto com o DEL. ${srvDel ? srvDel.nome : 'Delegado'}.`,
      dataPlantao: dataIso,
      turno: turnoStr
    });

    document.getElementById('modal-acao-vincular-apj')?.classList.add('hidden');
    window.fecharModalDetalhesPlantao();

    renderCalendarGrid('calendar-crf-container', 'CRF');
    alert(`Sucesso! APJ ${srvApj ? srvApj.nome : ''} vinculado e gravado na escala da CRF.`);
  } catch (err) {
    console.error("Erro ao vincular APJ no Firestore:", err);
    alert(`Erro ao gravar vinculação no banco de dados: ${err.message}`);
  }
};

// --- CRIAÇÃO DOS DOMs DOS MODAIS DE AÇÃO ---
function criarModalAcaoTrocarDelegadoDOM() {
  const html = `
    <div id="modal-acao-trocar-delegado" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 font-sans border-t-4 border-pcpr-gold">
        <div class="flex items-center justify-between border-b pb-2.5">
          <h3 class="font-bold text-slate-900 text-sm">🔄 Substituir Delegado no Plantão</h3>
          <button type="button" onclick="document.getElementById('modal-acao-trocar-delegado').classList.add('hidden')" class="text-slate-400 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarTrocaDelegadoSubmit(event)" class="space-y-3 text-xs">
          <input type="hidden" id="m-del-escala-id">

          <div class="p-2 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Filtrar por Delegacia:</label>
                <select id="m-del-filtro-delegacia" onchange="window.atualizarSelectTrocarDelegadoModal()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800"></select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Busca por Digitação:</label>
                <input type="text" id="m-del-filtro-busca" oninput="window.atualizarSelectTrocarDelegadoModal()" placeholder="Digite o nome..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:outline-none">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-800 mb-1">Selecione o Novo Delegado:</label>
              <select id="m-del-novo-id" required class="w-full border rounded-xl p-2 bg-white font-bold text-slate-900"></select>
            </div>
          </div>

          <div class="pt-2 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="document.getElementById('modal-acao-trocar-delegado').classList.add('hidden')" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-black text-[#BEA55A] hover:bg-slate-800 border border-[#BEA55A] rounded-xl font-bold cursor-pointer">Confirmar Troca</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

function criarModalAcaoTrocarApjDOM() {
  const html = `
    <div id="modal-acao-trocar-apj" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 font-sans border-t-4 border-pcpr-gold">
        <div class="flex items-center justify-between border-b pb-2.5">
          <h3 class="font-bold text-slate-900 text-sm">🔄 Substituir APJ no Plantão</h3>
          <button type="button" onclick="document.getElementById('modal-acao-trocar-apj').classList.add('hidden')" class="text-slate-400 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarTrocaApjSubmit(event)" class="space-y-3 text-xs">
          <input type="hidden" id="m-apj-escala-id">

          <div class="p-2 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Filtrar por Delegacia:</label>
                <select id="m-apj-filtro-delegacia" onchange="window.atualizarSelectTrocarApjModal()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800"></select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Busca por Digitação:</label>
                <input type="text" id="m-apj-filtro-busca" oninput="window.atualizarSelectTrocarApjModal()" placeholder="Digite o nome..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:outline-none">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-800 mb-1">Selecione o Novo APJ:</label>
              <select id="m-apj-novo-id" required class="w-full border rounded-xl p-2 bg-white font-bold text-slate-900"></select>
            </div>
          </div>

          <div class="pt-2 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="document.getElementById('modal-acao-trocar-apj').classList.add('hidden')" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-black text-[#BEA55A] hover:bg-slate-800 border border-[#BEA55A] rounded-xl font-bold cursor-pointer">Confirmar Troca</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

function criarModalAcaoVincularApjDOM() {
  const html = `
    <div id="modal-acao-vincular-apj" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 font-sans border-t-4 border-pcpr-gold">
        <div class="flex items-center justify-between border-b pb-2.5">
          <h3 class="font-bold text-slate-900 text-sm">🔗 Vincular APJ ao Plantão CRF</h3>
          <button type="button" onclick="document.getElementById('modal-acao-vincular-apj').classList.add('hidden')" class="text-slate-400 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.salvarVincularApjSubmit(event)" class="space-y-3 text-xs">
          <input type="hidden" id="m-vinc-escala-id">
          <input type="hidden" id="m-vinc-data-iso">
          <input type="hidden" id="m-vinc-turno-str">

          <div class="p-2 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Filtrar por Delegacia:</label>
                <select id="m-vinc-filtro-delegacia" onchange="window.atualizarSelectVincularApjModal()" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800"></select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Busca por Digitação:</label>
                <input type="text" id="m-vinc-filtro-busca" oninput="window.atualizarSelectVincularApjModal()" placeholder="Digite o nome..." class="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:outline-none">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-800 mb-1">Selecione o APJ a Vincular:</label>
              <select id="m-vinc-apj-id" required class="w-full border rounded-xl p-2 bg-white font-bold text-slate-900"></select>
            </div>
          </div>

          <div class="pt-2 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="document.getElementById('modal-acao-vincular-apj').classList.add('hidden')" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-[#BEA55A] hover:bg-[#AF9340] text-black font-extrabold border border-black rounded-xl shadow-xs cursor-pointer">Confirmar Vinculação</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
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
