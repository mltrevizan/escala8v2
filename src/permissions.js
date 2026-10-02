// src/permissions.js
import { appState } from './state.js';

/**
 * Retorna o perfil de acesso normalizado do utilizador logado
 */
export function getCurrentUserRole() {
  if (!appState.currentUser) return 'VISUALIZADOR';
  const role = (appState.currentUser.perfil || appState.currentUser.nivelAcesso || '').toUpperCase();
  if (role.includes('ADMIN')) return 'ADMINISTRADOR';
  if (role.includes('COORDENADOR')) return 'COORDENADOR';
  if (role.includes('SUPERINTENDENTE')) return 'SUPERINTENDENTE';
  if (role.includes('DELEGADO')) return 'DELEGADO';
  if (role.includes('APJ') || role.includes('INVESTIGADOR') || role.includes('ESCRIVÃO')) return 'APJ';
  return 'VISUALIZADOR';
}

/**
 * Retorna o ID da delegacia vinculada ao utilizador logado
 */
export function getCurrentUserDelegaciaId() {
  return appState.currentUser ? appState.currentUser.delegaciaId : null;
}

/**
 * Verifica se o utilizador pode gerir uma unidade específica
 */
export function canManageDelegacia(targetDelegaciaId) {
  const role = getCurrentUserRole();
  if (['ADMINISTRADOR', 'COORDENADOR'].includes(role)) return true;
  if (['DELEGADO', 'SUPERINTENDENTE'].includes(role)) {
    const userDelId = getCurrentUserDelegaciaId();
    return userDelId && userDelId === targetDelegaciaId;
  }
  return false;
}

/**
 * Avalia permissões pontuais de ação no sistema
 */
export function hasPermission(action, contextData = null) {
  const role = getCurrentUserRole();

  switch (action) {
    // ABA GESTÃO CRF
    case 'VIEW_GESTAO_CRF':
      return ['ADMINISTRADOR', 'COORDENADOR'].includes(role);

    case 'EDIT_CRF_SCALES':
      return ['ADMINISTRADOR', 'COORDENADOR'].includes(role);

    case 'RESTORE_CRF_BACKUP': // Exclusivo do Administrador
      return role === 'ADMINISTRADOR';

    // ABA GESTÃO DELEGACIAS
    case 'VIEW_GESTAO_DELEGACIAS':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'EDIT_LOCAL_DELEGACIA_SCALE':
      if (['ADMINISTRADOR', 'COORDENADOR'].includes(role)) return true;
      if (['DELEGADO', 'SUPERINTENDENTE'].includes(role)) {
        return contextData ? canManageDelegacia(contextData.delegaciaId) : true;
      }
      return false;

    case 'DELETE_MASS_DELEGACIA': // Exclusão em lote na Gestão Delegacia
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    // ABA SERVIDORES
    case 'VIEW_SERVIDORES':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'EDIT_SERVIDOR':
      if (['ADMINISTRADOR', 'COORDENADOR'].includes(role)) return true;
      if (['DELEGADO', 'SUPERINTENDENTE'].includes(role)) {
        return contextData ? canManageDelegacia(contextData.delegaciaId) : true;
      }
      return false;

    // ABA DELEGACIAS (UNIDADES)
    case 'VIEW_UNIDADES':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'EDIT_UNIDADE_CONFIG':
      if (['ADMINISTRADOR', 'COORDENADOR'].includes(role)) return true;
      if (['DELEGADO', 'SUPERINTENDENTE'].includes(role)) {
        return contextData ? canManageDelegacia(contextData.id) : true;
      }
      return false;

    // ABA FERIADOS
    case 'MANAGE_FERIADO_LOCAL': // Feriados municipais/unificados
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'MANAGE_FERIADO_NACIONAL_ESTADUAL': // Feriados gerais
      return ['ADMINISTRADOR', 'COORDENADOR'].includes(role);

    // BOTOES DIRETOS NO CALENDÁRIO / POP-UP DE TURNOS
    case 'SHOW_BTN_INCLUIR_TROCAR_APJ':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO', 'APJ'].includes(role);

    case 'SHOW_BTN_TROCAR_DELEGADO':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'VIEW_PHONE_NUMBERS': // Oculta telefone para visualizadores públicos
      return role !== 'VISUALIZADOR';

    default:
      return false;
  }
}

/**
 * Retorna as opções de nível de acesso que o utilizador atual tem permissão para conceder
 */
export function getAllowedRolesForCreation() {
  const role = getCurrentUserRole();

  if (role === 'ADMINISTRADOR') {
    return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO', 'APJ', 'VISUALIZADOR'];
  }
  if (role === 'COORDENADOR') {
    // Coordenador NÃO pode criar ou conceder permissão de ADMINISTRADOR
    return ['COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO', 'APJ', 'VISUALIZADOR'];
  }
  if (role === 'DELEGADO') {
    return ['DELEGADO', 'SUPERINTENDENTE', 'APJ'];
  }
  if (role === 'SUPERINTENDENTE') {
    return ['APJ'];
  }

  return [];
}

/**
 * Validação de segurança para impedir alteração/rebaixamento do poder de Administrador
 */
export function isProtectedAdminAccount(targetServidor) {
  if (!targetServidor) return false;
  const targetRole = (targetServidor.nivelAcesso || targetServidor.perfil || '').toUpperCase();
  return targetRole.includes('ADMIN');
}

/**
 * Aplica restrições na interface gráfica (DOM) em tempo real
 */
export function applyUIPermissions() {
  const role = getCurrentUserRole();
  const isLogged = !!appState.currentUser;
  const userDelId = getCurrentUserDelegaciaId();

  // 1. Visibilidade das Abas do Sistema
  const btnGestaoCrf = document.getElementById('tab-btn-gestao-crf');
  const btnGestaoDel = document.getElementById('tab-btn-gestao-del');
  const btnServidores = document.getElementById('tab-btn-servidores');
  const btnDelegacias = document.getElementById('tab-btn-unidades');
  const btnFerias = document.getElementById('tab-btn-ferias');

  if (btnGestaoCrf) btnGestaoCrf.style.display = hasPermission('VIEW_GESTAO_CRF') ? '' : 'none';
  if (btnGestaoDel) btnGestaoDel.style.display = hasPermission('VIEW_GESTAO_DELEGACIAS') ? '' : 'none';
  if (btnServidores) btnServidores.style.display = hasPermission('VIEW_SERVIDORES') ? '' : 'none';
  if (btnDelegacias) btnDelegacias.style.display = hasPermission('VIEW_UNIDADES') ? '' : 'none';
  if (btnFerias) btnFerias.style.display = isLogged ? '' : 'none';

  // 2. Trava de Seleção de Delegacia para Delegados e Superintendentes na Gestão Delegacias
  if (['DELEGADO', 'SUPERINTENDENTE'].includes(role) && userDelId) {
    const selectDelGestao = document.getElementById('gestao-del-select-unidade');
    if (selectDelGestao && selectDelGestao.value !== userDelId) {
      selectDelGestao.value = userDelId;
      selectDelGestao.disabled = true; // Trava o seletor para a sua própria delegacia
      if (appState.selectedDelegaciaId !== userDelId) {
        appState.selectedDelegaciaId = userDelId;
      }
    }
  }

  // 3. Redirecionamento de segurança se tentar acessar aba não autorizada
  if (!isLogged && ['gestao-crf', 'gestao-del', 'servidores', 'unidades', 'ferias'].includes(appState.activeTab)) {
    if (window.switchTab) window.switchTab('crf');
  } else if (role === 'APJ' && ['gestao-crf', 'gestao-del'].includes(appState.activeTab)) {
    if (window.switchTab) window.switchTab('crf');
  } else if (['DELEGADO', 'SUPERINTENDENTE'].includes(role) && appState.activeTab === 'gestao-crf') {
    if (window.switchTab) window.switchTab('gestao-del');
  }
}
