// src/permissions.js
import { appState } from './state.js';

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

export function getCurrentUserDelegaciaId() {
  return appState.currentUser ? appState.currentUser.delegaciaId : null;
}

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
 * Avalia se o telefone pode ser exibido.
 * Se o utilizador for VISUALIZADOR (não logado), exibe APENAS para: Ontem, Hoje e Amanhã.
 */
export function canViewPhoneForDate(dataIso) {
  const role = getCurrentUserRole();
  if (role !== 'VISUALIZADOR') return true;

  if (!dataIso) return false;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const dtEscala = new Date(ano, mes - 1, dia);
  dtEscala.setHours(0, 0, 0, 0);

  const diffDias = Math.round((dtEscala - hoje) / (1000 * 60 * 60 * 24));
  return diffDias >= -1 && diffDias <= 1; // -1 (Ontem), 0 (Hoje), +1 (Amanhã)
}

export function hasPermission(action, contextData = null) {
  const role = getCurrentUserRole();

  switch (action) {
    case 'VIEW_GESTAO_CRF':
      return ['ADMINISTRADOR', 'COORDENADOR'].includes(role);

    case 'EDIT_CRF_SCALES':
      return ['ADMINISTRADOR', 'COORDENADOR'].includes(role);

    case 'RESTORE_CRF_BACKUP':
      return role === 'ADMINISTRADOR';

    case 'VIEW_GESTAO_DELEGACIAS':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'EDIT_LOCAL_DELEGACIA_SCALE':
      if (['ADMINISTRADOR', 'COORDENADOR'].includes(role)) return true;
      if (['DELEGADO', 'SUPERINTENDENTE'].includes(role)) {
        return contextData ? canManageDelegacia(contextData.delegaciaId) : true;
      }
      return false;

    case 'DELETE_MASS_DELEGACIA':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'VIEW_SERVIDORES':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'EDIT_SERVIDOR':
      if (['ADMINISTRADOR', 'COORDENADOR'].includes(role)) return true;
      if (['DELEGADO', 'SUPERINTENDENTE'].includes(role)) {
        return contextData ? canManageDelegacia(contextData.delegaciaId) : true;
      }
      return false;

    case 'VIEW_UNIDADES':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'EDIT_UNIDADE_CONFIG':
      if (['ADMINISTRADOR', 'COORDENADOR'].includes(role)) return true;
      if (['DELEGADO', 'SUPERINTENDENTE'].includes(role)) {
        return contextData ? canManageDelegacia(contextData.id) : true;
      }
      return false;

    case 'MANAGE_FERIADO_LOCAL':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    case 'MANAGE_FERIADO_NACIONAL_ESTADUAL':
      return ['ADMINISTRADOR', 'COORDENADOR'].includes(role);

    case 'SHOW_BTN_INCLUIR_TROCAR_APJ':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO', 'APJ'].includes(role);

    case 'SHOW_BTN_TROCAR_DELEGADO':
      return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO'].includes(role);

    default:
      return false;
  }
}

export function getAllowedRolesForCreation() {
  const role = getCurrentUserRole();

  if (role === 'ADMINISTRADOR') {
    return ['ADMINISTRADOR', 'COORDENADOR', 'SUPERINTENDENTE', 'DELEGADO', 'APJ', 'VISUALIZADOR'];
  }
  if (role === 'COORDENADOR') {
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

export function isProtectedAdminAccount(targetServidor) {
  if (!targetServidor) return false;
  const targetRole = (targetServidor.nivelAcesso || targetServidor.perfil || '').toUpperCase();
  return targetRole.includes('ADMIN');
}

/**
 * Aplica as restrições na interface gráfica (DOM) em tempo real
 */
export function applyUIPermissions() {
  const role = getCurrentUserRole();
  const isLogged = !!appState.currentUser;
  const userDelId = getCurrentUserDelegaciaId();

  const btnGestaoCrf = document.getElementById('tab-btn-gestao-crf');
  const btnGestaoDel = document.getElementById('tab-btn-gestao-del');
  const btnServidores = document.getElementById('tab-btn-servidores');
  const btnDelegacias = document.getElementById('tab-btn-unidades');
  const btnFerias = document.getElementById('tab-btn-ferias');
  const btnFeriados = document.getElementById('tab-btn-feriados');

  if (btnGestaoCrf) btnGestaoCrf.style.display = hasPermission('VIEW_GESTAO_CRF') ? '' : 'none';
  if (btnGestaoDel) btnGestaoDel.style.display = hasPermission('VIEW_GESTAO_DELEGACIAS') ? '' : 'none';
  if (btnServidores) btnServidores.style.display = hasPermission('VIEW_SERVIDORES') ? '' : 'none';
  if (btnDelegacias) btnDelegacias.style.display = hasPermission('VIEW_UNIDADES') ? '' : 'none';
  if (btnFerias) btnFerias.style.display = isLogged ? '' : 'none';
  
  // Oculta a aba Feriados para o público geral (apenas utilizadores logados acedem)
  if (btnFeriados) btnFeriados.style.display = isLogged ? '' : 'none';

  if (['DELEGADO', 'SUPERINTENDENTE'].includes(role) && userDelId) {
    const selectDelGestao = document.getElementById('gestao-del-select-unidade');
    if (selectDelGestao) {
      selectDelGestao.value = userDelId;
      selectDelGestao.disabled = true;
      appState.selectedDelegaciaId = userDelId;
    }
  }

  if (!isLogged && ['gestao-crf', 'gestao-del', 'servidores', 'unidades', 'ferias', 'feriados'].includes(appState.activeTab)) {
    if (window.switchTab) window.switchTab('crf');
  } else if (role === 'APJ' && ['gestao-crf', 'gestao-del'].includes(appState.activeTab)) {
    if (window.switchTab) window.switchTab('crf');
  } else if (['DELEGADO', 'SUPERINTENDENTE'].includes(role) && appState.activeTab === 'gestao-crf') {
    if (window.switchTab) window.switchTab('gestao-del');
  }
}
