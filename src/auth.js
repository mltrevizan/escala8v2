// src/auth.js
import { appState, hashPassword, normalizeText } from './state.js';
import { fetchCollection, syncDocToFirestore } from './db.js';
import { CONSTANTS } from './config.js';

export async function loginUser(servidorId, passwordInput) {
  const srv = appState.servidores.find(s => s.id === servidorId);
  if (!srv) throw new Error("Servidor não encontrado.");

  const expectedDefaultPass = (srv.nivelAcesso === 'ADMINISTRADOR' || srv.login === 'admin') 
    ? CONSTANTS.SENHA_PADRAO_ADMIN 
    : CONSTANTS.SENHA_PADRAO_PRIMEIRO_ACESSO;

  let remoteHash = null;
  const creds = await fetchCollection('credenciais');
  const userCred = creds.find(c => c.id === srv.id || c.servidorId === srv.id);
  if (userCred) remoteHash = userCred.hash;

  const inputHash = await hashPassword(passwordInput);
  const activeHash = appState.credentialsMap[srv.id] || remoteHash;

  const isValid = activeHash ? (inputHash === activeHash) : (passwordInput === expectedDefaultPass);

  if (isValid) {
    appState.currentUserServidorId = srv.id;
    appState.profile = srv.nivelAcesso || 'APJ';
    return { success: true, servidor: srv, isFirstAccess: !activeHash && (passwordInput === expectedDefaultPass) };
  } else {
    return { success: false, message: "Senha incorreta!" };
  }
}

export function logoutUser() {
  appState.currentUserServidorId = null;
  appState.profile = 'VISUALIZADOR';
}
