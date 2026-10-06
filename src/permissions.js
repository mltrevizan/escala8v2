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
  const perfilStr = (appState.currentUser.perfil || appState.currentUser.cargo || appState.currentUser.nivelAcesso || '').toUpperCase().trim();
  
  if (perfilStr.includes('ADMIN')) return PERFIS.ADMINISTRADOR;
  if (perfilStr.includes('COORDENADOR')) return PERFIS.COORDENADOR;
  if (perfilStr.includes('DELEGADO')) return PERFIS.DELEGADO;
  if (perfilStr.includes('SUPERINTENDENTE')) return PERFIS.SUPERINTENDENTE;
  if (perfilStr.includes('APJ') || perfilStr.includes('AGENTE')) return PERFIS.APJ;

  return PERFIS.VISUALIZADOR;
}

/**
 * Alias em inglês para obter o perfil do usuário logado (exigido por servidores.js)
 */
export function getCurrentUserRole() {
  return getPerfilUsuarioLogado();
}

/**
 * Retorna a delegacia em que o usuário logado está lotado
 */
export function getDelegaciaIdUsuarioLogado() {
  return appState.currentUser?.delegaciaId || null;
}

/**
 * Alias em inglês exigido pelo servidores.js
 */
export function getCurrentUserDelegaciaId() {
  return getDelegaciaIdUsuarioLogado();
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

/**
 * Verifica de forma rigorosa se a conta de um servidor é a conta protegida de Administrador do Sistema
 */
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
// 5. APLICAÇÃO DE PERMISSÕES NA INTERFACE (UI)
// =========================================================================

export function applyUIPermissions() {
  const perfil = getPerfilUsuarioLogado();

  const abasMap = {
    'tab-btn-gestao-crf': podeAcessarAbaGestaoCrf(),
    'tab-btn-gestao-delegacias': podeAcessarAbaGestaoDelegacias(),
    'tab-btn-servidores': podeAcessarAbaServidores(),
    'tab-btn-ferias': podeAcessarAbaFérias(),
    'tab-btn-feriados': podeAcessarAbaFeriados(),
    'tab-btn-delegacias': podeAcessarAbaDelegacias()
  };

  Object.keys(abasMap).forEach(tabId => {
    const el = document.getElementById(tabId);
    if (el) {
      if (abasMap[tabId]) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  if (appState.activeTab === 'gestao-crf' && !podeAcessarAbaGestaoCrf()) {
    if (window.switchTab) window.switchTab('delegacia');
  } else if (appState.activeTab === 'gestao-delegacias' && !podeAcessarAbaGestaoDelegacias()) {
    if (window.switchTab) window.switchTab('delegacia');
  } else if (appState.activeTab === 'servidores' && !podeAcessarAbaServidores()) {
    if (window.switchTab) window.switchTab('delegacia');
  } else if (appState.activeTab === 'delegacias' && !podeAcessarAbaDelegacias()) {
    if (window.switchTab) window.switchTab('delegacia');
  }
}

// =========================================================================
// 6. REGULAÇÃO DE EXIBIÇÃO DE CONTATOS / TELEFONE
// =========================================================================

/**
 * Libera a visualização de telefone:
 * - Sempre liberado para usuários logados.
 * - No modo público (VISUALIZADOR), liberado se a data do plantão for ONTÉM, HOJE ou AMANHÃ.
 */
export function podeVisualizarTelefoneServidor(dataPlantaoIso = null) {
  const perfil = getPerfilUsuarioLogado();

  // Usuários autenticados (Admin, Coord, Del, Super, APJ) visualizam sempre
  if (perfil !== PERFIS.VISUALIZADOR) {
    return true;
  }

  // Se não foi informada uma data específica, por padrão bloqueia no modo público
  if (!dataPlantaoIso) {
    return false;
  }

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

    // Retorna verdadeiro se a data for ontem, hoje ou amanhã
    return dataAlvo >= ontem && dataAlvo <= amanha;
  } catch (e) {
    return false;
  }
}

export function canViewPhoneForDate(dataPlantaoIso = null) {
  return podeVisualizarTelefoneServidor(dataPlantaoIso);
}

// =========================================================================
// 7. COMPATIBILIDADE INTEGRAL (SERVIDORES / CALENDAR / MODALS / AUTH)
// =========================================================================

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
