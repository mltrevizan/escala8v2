// src/state.js
export const appState = {
  servidores: [],
  delegacias: [],
  escalas: [],
  currentUser: null,
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  calendarScope: 'CRF',          // Padrão: 'CRF' (Nível A) ou 'DELEGACIA' (Nível B)
  calendarMode: 'REGULAR',       // 'REGULAR' / 'SDP' (no CRF) ou 'PLANTONISTA' / 'SOBREAVISO' (na Delegacia)
  selectedDelegaciaId: null
};

export function normalizeText(text) {
  if (!text) return '';
  return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
