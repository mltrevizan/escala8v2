// src/permissions.js
import { appState, normalizeText } from './state.js';

/**
 * Módulo de Controle Central de Permissões e Perfis (Escala8 v2)
 * Perfis oficiais: ADMINISTRADOR, COORDENADOR, DELEGADO, SUPERINTENDENTE, APJ, VISUALIZADOR
 */

export const PERFIS = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  COORDENADOR: 'COORDENADOR',
  DELEGADO: 'DELEGADO',
  SUPERINTENDENTE: 'SUPERINTENDENTE',
  APJ: 'APJ',
  VISUALIZADOR: 'VISUALIZADOR'
};

/**
 * Retorna o perfil do usuário logado ou VISUALIZADOR se não houver login
 */
export function getPerfilUsuarioLogado() {
  if (!appState.currentUser) return PERFIS.VISUALIZADOR;
  
  const rawStr = String(appState.currentUser.perfil || appState.currentUser.nivelAcesso || appState.currentUser.cargo || '').toUpperCase().trim();
  
  if (rawStr.includes('ADMIN')) return PERFIS.ADMINISTRADOR;
  if (rawStr.includes('COORDENADOR')) return PERFIS.COORDENADOR;
  if (rawStr.includes('DELEGADO')) return PERFIS.DELEGADO;
  if (rawStr.includes('SUPERINTENDENTE')) return PERFIS.SUPERINTENDENTE;
  if (rawStr.includes('APJ') || rawStr.includes('AGENTE') || rawStr.includes('INVESTIGADOR') || rawStr.includes('ESCRIVÃO')) return PERFIS.APJ;

  return PERFIS.VISUALIZADOR;
}

export function getCurrentUserRole() {
  return getPerfilUsuarioLogado();
}

export function getDelegaciaIdUsuarioLogado() {
  return appState.currentUser?.delegaciaId || null;
}

export function getCurrentUserDelegaciaId() {
  return getDelegaciaIdUsuarioLogado();
}

export function getSubdivisaoUsuarioLogado() {
  const userDelId = getDelegaciaIdUsuarioLogado();
  if (!userDelId || !appState.delegacias) return null;
  const delObj = appState.delegacias.find(d => d.id === userDelId);
  return delObj?.subdivisao ? delObj.subdivisao.trim().toUpperCase() : null;
}

export function isProtectedAdminAccount(servidorObj) {
  if (!servidorObj) return false;
  const nomeNorm = normalizeText(servidorObj.nome || '');
  const loginNorm = normalizeText(servidorObj.login || '');
  const perfilNorm = (servidorObj.nivelAcesso || servidorObj.perfil || '').toUpperCase();

  const isNomeAdmin = nomeNorm === 'administrador do sistema' || nomeNorm === 'admin' || nomeNorm === 'administrador';
  const isLoginAdmin = loginNorm === 'admin' || loginNorm === 'administrador';
  
  return isNomeAdmin || isLoginAdmin || (perfilNorm === 'ADMINISTRADOR' && isNomeAdmin);
}

// =========================================================================
// REGRAS DE ACESSO ÀS ABAS
// =========================================================================

export function podeAcessarAbaGestaoCrf() {
  const perfil = getPerfilUsuarioLogado();
  return perfil === PERFIS.ADMINISTRADOR || perfil === PERFIS.COORDENADOR;
}

export function podeAcessarAbaGestaoDelegacias() {
  const perfil = getPerfilUsuarioLogado();
  return [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.SUPERINTENDENTE].includes(perfil);
}

export function podeAcessarAbaServidores() {
  const perfil = getPerfilUsuarioLogado();
  return [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.SUPERINTENDENTE].includes(perfil);
}

export function podeAcessarAbaFérias() {
  const perfil = getPerfilUsuarioLogado();
  return [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.SUPERINTENDENTE].includes(perfil);
}

export function podeAcessarAbaFeriados() {
  const perfil = getPerfilUsuarioLogado();
  return [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.SUPERINTENDENTE].includes(perfil);
}

export function podeAcessarAbaDelegacias() {
  const perfil = getPerfilUsuarioLogado();
  return perfil === PERFIS.ADMINISTRADOR || perfil === PERFIS.COORDENADOR;
}

// =========================================================================
// REGRAS DE MANIPULAÇÃO DE ESCALAS, SERVIDORES E FÉRIAS
// =========================================================================

export function podeModificarEscalaDelegacia(delegaciaAlvoId) {
  const perfil = getPerfilUsuarioLogado();
  if (perfil === PERFIS.ADMINISTRADOR) return true;

  if (perfil === PERFIS.COORDENADOR) {
    const sdpUser = getSubdivisaoUsuarioLogado();
    if (!sdpUser) return false;
    const delAlvo = (appState.delegacias || []).find(d => d.id === delegaciaAlvoId);
    return delAlvo && delAlvo.subdivisao && delAlvo.subdivisao.trim().toUpperCase() === sdpUser;
  }

  if (perfil === PERFIS.DELEGADO || perfil === PERFIS.SUPERINTENDENTE) {
    const userDelId = getDelegaciaIdUsuarioLogado();
    return userDelId && String(userDelId) === String(delegaciaAlvoId);
  }

  return false;
}

export function podeModificarEscalaCrfGeral() {
  const perfil = getPerfilUsuarioLogado();
  return perfil === PERFIS.ADMINISTRADOR || perfil === PERFIS.COORDENADOR;
}

export function podeTrocarDelegadoCrf() {
  const perfil = getPerfilUsuarioLogado();
  return [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO].includes(perfil);
}

export function podeTrocarOuIncluirApjCrf() {
  const perfil = getPerfilUsuarioLogado();
  return [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.SUPERINTENDENTE, PERFIS.APJ].includes(perfil);
}

export function podeModificarServidor(servidorAlvo) {
  const perfil = getPerfilUsuarioLogado();
  if (perfil === PERFIS.ADMINISTRADOR) return true;

  if (perfil === PERFIS.COORDENADOR) {
    const sdpUser = getSubdivisaoUsuarioLogado();
    if (!sdpUser) return false;
    const delAlvo = (appState.delegacias || []).find(d => d.id === servidorAlvo?.delegaciaId);
    return delAlvo && delAlvo.subdivisao && delAlvo.subdivisao.trim().toUpperCase() === sdpUser;
  }

  if (perfil === PERFIS.DELEGADO || perfil === PERFIS.SUPERINTENDENTE) {
    const userDelId = getDelegaciaIdUsuarioLogado();
    return userDelId && servidorAlvo && String(userDelId) === String(servidorAlvo.delegaciaId);
  }

  return false;
}

export function obterPerfisAtribuiveis() {
  const perfil = getPerfilUsuarioLogado();

  if (perfil === PERFIS.ADMINISTRADOR) {
    return [PERFIS.ADMINISTRADOR, PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.SUPERINTENDENTE, PERFIS.APJ, PERFIS.VISUALIZADOR];
  }
  if (perfil === PERFIS.COORDENADOR) {
    return [PERFIS.COORDENADOR, PERFIS.DELEGADO, PERFIS.SUPERINTENDENTE, PERFIS.APJ, PERFIS.VISUALIZADOR];
  }
  if (perfil === PERFIS.DELEGADO) {
    return [PERFIS.SUPERINTENDENTE, PERFIS.APJ, PERFIS.VISUALIZADOR];
  }
  if (perfil === PERFIS.SUPERINTENDENTE) {
    return [PERFIS.APJ, PERFIS.VISUALIZADOR];
  }

  return [PERFIS.VISUALIZADOR];
}

export function podeResetarSenhaPolicial(servidorAlvo) {
  return podeModificarServidor(servidorAlvo);
}

export function podeModificarFeriasServidor(servidorAlvo) {
  return podeModificarServidor(servidorAlvo);
}

export function podeCadastrarFeriado(tipoFeriado, delegaciaAlvoId = null) {
  const perfil = getPerfilUsuarioLogado();
  if (perfil === PERFIS.ADMINISTRADOR) return true;

  if (perfil === PERFIS.COORDENADOR) {
    if (tipoFeriado === 'MUNICIPAL' && delegaciaAlvoId) {
      const sdpUser = getSubdivisaoUsuarioLogado();
      const delAlvo = (appState.delegacias || []).find(d => d.id === delegaciaAlvoId);
      return delAlvo && delAlvo.subdivisao && delAlvo.subdivisao.trim().toUpperCase() === sdpUser;
    }
    return true;
  }

  if (perfil === PERFIS.DELEGADO || perfil === PERFIS.SUPERINTENDENTE) {
    if (tipoFeriado === 'MUNICIPAL') {
      const userDelId = getDelegaciaIdUsuarioLogado();
      return userDelId && String(userDelId) === String(delegaciaAlvoId);
    }
    return false;
  }

  return false;
}

// =========================================================================
// APLICAÇÃO E ATUALIZAÇÃO RIGOROSA DA INTERFACE (UI)
// =========================================================================

export function applyUIPermissions() {
  const perfil = getPerfilUsuarioLogado();
  let styleEl = document.getElementById('dynamic-permissions-style');

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-permissions-style';
    document.head.appendChild(styleEl);
  }

  if (perfil === PERFIS.VISUALIZADOR) {
    // Força a ocultação das abas administrativas no modo público
    styleEl.innerHTML = `
      #tab-btn-unidades, #tab-btn-delegacias, #tab-btn-gestao-crf, #tab-btn-gestao-del, 
      #tab-btn-gestao-delegacias, #tab-btn-servidores, #tab-btn-ferias, #tab-btn-feriados {
        display: none !important;
        visibility: hidden !important;
      }
    `;

    if (['unidades', 'delegacias', 'gestao-crf', 'gestao-del', 'gestao-delegacias', 'servidores', 'ferias', 'feriados'].includes(appState.activeTab)) {
      appState.activeTab = 'crf';
      if (typeof window.switchTab === 'function') {
        window.switchTab('crf');
      }
    }
  } else {
    // Limpa a regra de restrição CSS para usuários logados
    styleEl.innerHTML = '';

    // Mapeia e ativa individualmente cada botão no HTML conforme a permissão do perfil logado
    const abasMap = {
      'tab-btn-gestao-crf': podeAcessarAbaGestaoCrf(),
      'tab-btn-gestao-del': podeAcessarAbaGestaoDelegacias(),
      'tab-btn-feriados': podeAcessarAbaFeriados(),
      'tab-btn-unidades': podeAcessarAbaDelegacias(),
      'tab-btn-servidores': podeAcessarAbaServidores(),
      'tab-btn-ferias': podeAcessarAbaFérias()
    };

    Object.keys(abasMap).forEach(btnId => {
      const el = document.getElementById(btnId);
      if (el) {
        if (abasMap[btnId]) {
          el.classList.remove('hidden');
          el.style.setProperty('display', '', 'important');
        } else {
          el.classList.add('hidden');
          el.style.setProperty('display', 'none', 'important');
        }
      }
    });
  }
}

// Execução automática ao carregar o script
applyUIPermissions();

// =========================================================================
// REGULAÇÃO DE EXIBIÇÃO DE CONTATOS / TELEFONE E COMPATIBILIDADES
// =========================================================================

export function podeVisualizarTelefoneServidor(dataPlantaoIso = null) {
  const perfil = getPerfilUsuarioLogado();
  if (perfil !== PERFIS.VISUALIZADOR) return true;
  if (!dataPlantaoIso) return false;

  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);

    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);

    const parts = String(dataPlantaoIso).split('T')[0].split('-').map(Number);
    if (parts.length !== 3) return false;

    const dataAlvo = new Date(parts[0], parts[1] - 1, parts[2]);
    dataAlvo.setHours(0, 0, 0, 0);

    return dataAlvo >= ontem && dataAlvo <= amanha;
  } catch (e) {
    return false;
  }
}

export function canViewPhoneForDate(dataPlantaoIso = null) {
  return podeVisualizarTelefoneServidor(dataPlantaoIso);
}

export function getAllowedRolesForCreation() {
  return obterPerfisAtribuiveis();
}

export function canEditServidor(servidorAlvo) {
  return podeModificarServidor(servidorAlvo);
}

export function canResetPassword(servidorAlvo) {
  return podeResetarSenhaPolicial(servidorAlvo);
}

export function hasPermission(permissionName, targetDelegaciaId = null) {
  const perfil = getPerfilUsuarioLogado();
  if (perfil === PERFIS.ADMINISTRADOR) return true;

  switch (permissionName) {
    case 'EDIT_DELEGACIA_SCHEDULE':
    case 'EDIT_SCHEDULE':
      return podeModificarEscalaDelegacia(targetDelegaciaId || appState.selectedDelegaciaId);
    case 'EDIT_CRF_SCHEDULE':
      return podeModificarEscalaCrfGeral() || podeTrocarDelegadoCrf() || podeTrocarOuIncluirApjCrf();
    case 'VIEW_PHONE':
    case 'VIEW_PHONE_NUMBER':
      return podeVisualizarTelefoneServidor();
    case 'MANAGE_SERVIDORES':
      return podeAcessarAbaServidores();
    case 'MANAGE_FERIAS':
      return podeAcessarAbaFérias();
    case 'MANAGE_FERIADOS':
      return podeAcessarAbaFeriados();
    case 'MANAGE_DELEGACIAS':
      return podeAcessarAbaDelegacias();
    default:
      return perfil !== PERFIS.VISUALIZADOR;
  }
}

export function canEditSchedule(delegaciaId = null) {
  return podeModificarEscalaDelegacia(delegaciaId || appState.selectedDelegaciaId);
}

export function canEditCRF() {
  return podeModificarEscalaCrfGeral() || podeTrocarDelegadoCrf() || podeTrocarOuIncluirApjCrf();
}

export function isAdmin() {
  return getPerfilUsuarioLogado() === PERFIS.ADMINISTRADOR;
}
