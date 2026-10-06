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
  const perfilStr = (appState.currentUser.perfil || appState.currentUser.cargo || '').toUpperCase().trim();
  
  if (perfilStr.includes('ADMIN')) return PERFIS.ADMINISTRADOR;
  if (perfilStr.includes('COORDENADOR')) return PERFIS.COORDENADOR;
  if (perfilStr.includes('DELEGADO')) return PERFIS.DELEGADO;
  if (perfilStr.includes('SUPERINTENDENTE')) return PERFIS.SUPERINTENDENTE;
  if (perfilStr.includes('APJ') || perfilStr.includes('AGENTE')) return PERFIS.APJ;

  return PERFIS.VISUALIZADOR;
}

/**
 * Retorna a delegacia em que o usuário logado está lotado
 */
export function getDelegaciaIdUsuarioLogado() {
  return appState.currentUser?.delegaciaId || null;
}

/**
 * Retorna a Subdivisão (SDP) da delegacia do usuário logado
 */
export function getSubdivisaoUsuarioLogado() {
  const userDelId = getDelegaciaIdUsuarioLogado();
  if (!userDelId || !appState.delegacias) return null;
  const delObj = appState.delegacias.find(d => d.id === userDelId);
  return delObj?.subdivisao ? delObj.subdivisao.trim().toUpperCase() : null;
}

// =========================================================================
// 1. REGRAS DE ACESSO ÀS ABAS / MÓDULOS DO SISTEMA
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
// 2. REGRAS DE MANIPULAÇÃO DE ESCALAS (CRF E DELEGACIAS)
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

// =========================================================================
// 3. REGRAS DE MANIPULAÇÃO DE SERVIDORES E PERFIS
// =========================================================================

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
    return [
      PERFIS.ADMINISTRADOR,
      PERFIS.COORDENADOR,
      PERFIS.DELEGADO,
      PERFIS.SUPERINTENDENTE,
      PERFIS.APJ,
      PERFIS.VISUALIZADOR
    ];
  }

  if (perfil === PERFIS.COORDENADOR) {
    return [
      PERFIS.COORDENADOR,
      PERFIS.DELEGADO,
      PERFIS.SUPERINTENDENTE,
      PERFIS.APJ,
      PERFIS.VISUALIZADOR
    ];
  }

  if (perfil === PERFIS.DELEGADO) {
    return [
      PERFIS.SUPERINTENDENTE,
      PERFIS.APJ,
      PERFIS.VISUALIZADOR
    ];
  }

  if (perfil === PERFIS.SUPERINTENDENTE) {
    return [
      PERFIS.APJ,
      PERFIS.VISUALIZADOR
    ];
  }

  return [PERFIS.VISUALIZADOR];
}

export function podeResetarSenhaPolicial(servidorAlvo) {
  return podeModificarServidor(servidorAlvo);
}

// =========================================================================
// 4. REGRAS DE FÉRIAS E FERIADOS
// =========================================================================

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
// 5. COMPATIBILIDADE INTEGRAL (INTERFACE / SERVIDORES / CALENDAR / MODALS)
// =========================================================================

export function podeVisualizarTelefoneServidor() {
  const perfil = getPerfilUsuarioLogado();
  return perfil !== PERFIS.VISUALIZADOR;
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

export function canViewPhoneForDate() {
  return podeVisualizarTelefoneServidor();
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
