// src/authSync.js
import { appState, normalizeText } from './state.js';

// SENHA PADRÃO ATUALIZADA
const SENHA_PADRAO_INICIAL = 'Central123';

/**
 * Retorna o e-mail no padrão do Firebase Auth a partir das informações do servidor.
 * Prioriza o e-mail real de recuperação caso já esteja cadastrado.
 */
export function gerarEmailAuth(srv) {
  if (!srv) return '';
  if (srv.email && srv.email.includes('@')) {
    return srv.email.toLowerCase().trim();
  }
  const loginBase = srv.login ? srv.login.toLowerCase().trim() : normalizeText(srv.nome || '').replace(/\s+/g, '.');
  return `${loginBase}@policiacivil.pr.gov.br`;
}

/**
 * Cria individualmente uma conta de acesso no Firebase Auth para um novo servidor
 */
export async function criarContaFirebaseAuth(servidor, senha = SENHA_PADRAO_INICIAL) {
  const emailAuth = gerarEmailAuth(servidor);
  
  try {
    // Utiliza uma instância secundária do Firebase para não deslogar o Administrador ativo
    let secondaryApp = firebase.apps.find(app => app.name === 'SecondaryApp');
    if (!secondaryApp) {
      secondaryApp = firebase.initializeApp(firebase.app().options, 'SecondaryApp');
    }

    const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(emailAuth, senha);
    await userCredential.user.updateProfile({
      displayName: servidor.nome
    });

    // Encerra a sessão na instância secundária
    await secondaryApp.auth().signOut();
    console.log(`Conta criada com sucesso no Firebase Auth: ${emailAuth}`);
    return { success: true, email: emailAuth };

  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log(`Conta ${emailAuth} já existe no Firebase Auth.`);
      return { success: true, alreadyExists: true, email: emailAuth };
    }
    console.error(`Erro ao criar conta no Firebase Auth para ${emailAuth}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Executa a varredura e cadastramento de TODOS os servidores do banco no Firebase Auth
 */
window.sincronizarTodosServidoresAuth = async function() {
  if (!appState.currentUser || (appState.currentUser.perfil || '').toUpperCase() !== 'ADMINISTRADOR') {
    alert("Operação restrita ao Administrador do Sistema.");
    return;
  }

  const listaServidores = appState.servidores || [];
  if (listaServidores.length === 0) {
    alert("Nenhum servidor localizado no banco de dados para sincronizar.");
    return;
  }

  const confirmacao = confirm(
    `Deseja criar as credenciais no Firebase Auth para todos os ${listaServidores.length} servidores cadastrados?\n\nSenha Padrão Inicial: ${SENHA_PADRAO_INICIAL}`
  );
  if (!confirmacao) return;

  let criados = 0;
  let jaExistentes = 0;
  let erros = 0;

  const btnSync = document.getElementById('btn-sync-auth-lote');
  if (btnSync) {
    btnSync.disabled = true;
    btnSync.innerText = '⏳ Sincronizando credenciais...';
  }

  for (const srv of listaServidores) {
    const res = await criarContaFirebaseAuth(srv, SENHA_PADRAO_INICIAL);
    if (res.success) {
      if (res.alreadyExists) jaExistentes++;
      else criados++;
    } else {
      erros++;
    }
  }

  if (btnSync) {
    btnSync.disabled = false;
    btnSync.innerText = '⚡ Sincronizar Usuários no Auth';
  }

  alert(
    `Sincronização Concluída!\n\n` +
    `• Contas Novas Criadas: ${criados}\n` +
    `• Contas Já Existentes: ${jaExistentes}\n` +
    `• Falhas/Erros: ${erros}\n\n` +
    `Senha padrão atribuída: ${SENHA_PADRAO_INICIAL}`
  );
};
