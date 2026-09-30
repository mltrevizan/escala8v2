// src/state.js
import { CONSTANTS } from './config.js';

export const appState = {
  profile: 'VISUALIZADOR',
  currentUserServidorId: null,
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  calendarMode: 'PLANTONISTA',
  servidores: [],
  escalas: [],
  sobreavisos: [],
  sdps: [],
  delegacias: [],
  feriados: [],
  ferias: [],
  auditLogs: [],
  credentialsMap: {}
};

export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function hashPassword(text) {
  if (!text) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
