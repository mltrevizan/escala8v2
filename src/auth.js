// src/auth.js
import { appState, normalizeText } from './state.js';
import { applyUIPermissions, isProtectedAdminAccount } from './permissions.js';
import { loadAllDataFromFirestore, syncDocToFirestore, obterMetricasLeitura } from './db.js';
import { criarContaFirebaseAuth } from './authSync.js';

let loginSearchState = {
  servidorSelecionado: null
};

function obterEmailAutenticacao(srv) {
  if (!srv) return '';  
  
  if (srv.emailRecuperacao && srv.emailRecuperacao.includes('@')) {
    return srv.emailRecuperacao.toLowerCase().trim();
  }
  
  if (srv.email && srv.email.includes('@')) {
    return srv.email.toLowerCase().trim();
  }

  const loginBase = srv.login ? srv.login.toLowerCase().trim() : normalizeText(srv.nome || '').replace(/\s+/g, '.');
  return `${loginBase}@policiacivil.pr.gov.br`;
}

export function initAuthModule() {
  if (!window.firebase || !firebase.auth) {
    console.error("Firebase Auth não carregado no index.html");
    return;
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      await loadAllDataFromFirestore();

      const srv = (appState.servidores || []).find(s => {
        const emailSrv = obterEmailAutenticacao(s);
        return emailSrv === user.email.toLowerCase() || 
               (s.email && s.email.toLowerCase() === user.email.toLowerCase()) ||
               (s.emailRecuperacao && s.emailRecuperacao.toLowerCase() === user.email.toLowerCase());
      });

      appState.currentUser = {
        uid: user.uid,
        id: srv ? String(srv.id) : user.uid,
        servidorId: srv ? String(srv.id) : null,
        email: user.email,
        login: srv ? srv.login : user.email.split('@')[0],
        nome: srv ? srv.nome : (user.displayName || 'ADMINISTRADOR DO SISTEMA'),
        cargo: srv ? srv.cargo : 'DELEGADO',
        perfil: srv ? (srv.nivelAcesso || srv.perfil) : 'Administrador',
        delegaciaId: srv ? srv.delegaciaId : null,
        subdivisao: srv ? srv.subdivisao : '8ª SDP',
        forcarTrocaSenha: srv?.forcarTrocaSenha || srv?.senhaResetada || false
      };

      if (appState.servidores && appState.servidores.length > 0) {
        appState.servidores.forEach(s => {
          if (s._telefoneOriginal) {
            s.telefone = s._telefoneOriginal;
          }
        });
      }

    } else {
      appState.currentUser = null;
      await loadAllDataFromFirestore();
    }

    renderUserStatusHeader();
    applyUIPermissions();
    
    if (window.switchTab && appState.activeTab) {
      window.switchTab(appState.activeTab);
    } else if (window.renderCalendarGrid) {
      window.renderCalendarGrid(
        appState.activeTab === 'crf' ? 'calendar-crf-container' : 'calendar-delegacia-container', 
        appState.activeTab === 'crf' ? 'CRF' : 'DELEGACIA'
      );
    }
  });

  renderUserStatusHeader();
}

window.atualizarBadgeLeiturasAdmin = function() {
  const el = document.getElementById('badge-leituras-admin-val');
  if (el && typeof obterMetricasLeitura === 'function') {
    const metricas = obterMetricasLeitura();
    el.innerText = `${metricas.total} docs`;
  }
};

window.exibirModalMetricasLeitura = function() {
  const metricas = typeof obterMetricasLeitura === 'function' ? obterMetricasLeitura() : { total: 0, historico: [] };
  
  let modal = document.getElementById('modal-metricas-leituras');
  if (modal) modal.remove();

  const linhas = metricas.historico.map(h => `
    <tr class="border-b border-slate-100 text-[11px] font-mono">
      <td class="p-2 text-slate-500">${h.hora}</td>
      <td class="p-2 font-bold text-slate-800">${h.colecao}</td>
      <td class="p-2 text-right font-bold text-amber-800">+${h.quantidadeDocs}</td>
      <td class="p-2 text-right text-slate-600">${h.acumulado}</td>
    </tr>
  `).join('');

  const modalHtml = `
    <div id="modal-metricas-leituras" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-3 border-t-4 border-amber-500">
        <div class="flex items-center justify-between border-b pb-2">
          <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
            📊 Auditoria de Leituras no Firestore
          </h3>
          <button type="button" onclick="document.getElementById('modal-metricas-leituras').remove()" class="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
        </div>

        <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
          <span class="font-bold text-amber-900">Total Acumulado na Sessão:</span>
          <span class="font-mono text-base font-black text-amber-900">${metricas.total} documentos</span>
        </div>

        <div class="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-100 text-[10px] text-slate-600 font-bold uppercase border-b">
                <th class="p-2">Hora</th>
                <th class="p-2">Coleção</th>
                <th class="p-2 text-right">Docs</th>
                <th class="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${linhas || '<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Nenhuma leitura gravada ainda.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="pt-2 border-t flex justify-end">
          <button type="button" onclick="document.getElementById('modal-metricas-leituras').remove()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

export function renderUserStatusHeader() {
  const container = document.getElementById('app-status');
  if (!container) return;

  const user = appState.currentUser;

  if (user) {
    const perfilStr = user.perfil || 'Visualizador';
    const isAdmin = perfilStr.toUpperCase() === 'ADMINISTRADOR';

    let badgePerfilClass = 'bg-slate-100 text-slate-800 border-slate-300';
    if (isAdmin) badgePerfilClass = 'bg-black text-[#BEA55A] border-[#BEA55A] font-extrabold';
    else if (perfilStr.toUpperCase() === 'DELEGADO') badgePerfilClass = 'bg-[#F7F3E8] text-[#5A4716] border-[#BEA55A] font-bold';
    else if (perfilStr.toUpperCase() === 'COORDENADOR') badgePerfilClass = 'bg-[#2A2B2D] text-white border-[#57585A] font-bold';

    const metricas = typeof obterMetricasLeitura === 'function' ? obterMetricasLeitura() : { total: 0 };

    const widgetLeiturasHtml = isAdmin ? `
      <button onclick="window.exibirModalMetricasLeitura()" title="Clique para ver o relatório detalhado de leituras da sessão" class="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-mono font-bold text-[11px] rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1">
        <span>📊 Leituras:</span>
        <span id="badge-leituras-admin-val">${metricas.total} docs</span>
      </button>
    ` : '';

    container.innerHTML = `
      <div class="flex items-center gap-2 font-sans">
        ${widgetLeiturasHtml}
        <div class="text-right hidden sm:block">
          <span class="block text-xs font-bold text-slate-900">${user.nome}</span>
          <span class="text-[9.5px] px-1.5 py-0.2 rounded border ${badgePerfilClass}">${perfilStr}</span>
        </div>
        <button onclick="window.fazerLogoutApp()" class="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1">
          🚪 Sair
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="window.abrirModalLoginApp()" class="px-3.5 py-1.5 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold rounded-xl font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 font-sans">
        🔑 Entrar / Login
      </button>
    `;
  }
}

window.abrirModalLoginApp = function() {
  let modal = document.getElementById('modal-login-app');
  if (!modal) {
    criarModalLoginDOM();
    modal = document.getElementById('modal-login-app');
  }

  loginSearchState.servidorSelecionado = null;

  const inputNome = document.getElementById('login-nome-busca');
  const inputEmailHidden = document.getElementById('login-email-hidden');
  const inputPassword = document.getElementById('login-password');
  const containerSugestoes = document.getElementById('login-sugestoes-lista');

  if (inputNome) inputNome.value = '';
  if (inputEmailHidden) inputEmailHidden.value = '';
  if (inputPassword) inputPassword.value = '';
  if (containerSugestoes) containerSugestoes.innerHTML = '';

  document.getElementById('login-erro-msg')?.classList.add('hidden');
  document.getElementById('login-badge-servidor-sel')?.classList.add('hidden');

  modal.classList.remove('hidden');
};

window.fecharModalLoginApp = function() {
  document.getElementById('modal-login-app')?.classList.add('hidden');
};

window.forcarAtualizacaoListaServidoresLogin = async function() {
  const containerSugestoes = document.getElementById('login-sugestoes-lista');
  const inputNome = document.getElementById('login-nome-busca');
  const termoAtual = inputNome?.value || '';

  if (containerSugestoes) {
    containerSugestoes.innerHTML = `<div class="p-3 text-center text-amber-800 bg-amber-50 font-bold text-xs animate-pulse">🔄 Buscando dados atualizados no servidor...</div>`;
  }

  try {
    await loadAllDataFromFirestore(true);
    if (typeof window.filtrarPolicialLogin === 'function') {
      window.filtrarPolicialLogin(termoAtual);
    }
  } catch (err) {
    console.error("Erro ao forçar atualização no login:", err);
  }
};

window.filtrarPolicialLogin = function(termo) {
  const containerSugestoes = document.getElementById('login-sugestoes-lista');
  const badgeSel = document.getElementById('login-badge-servidor-sel');
  if (!containerSugestoes) return;

  const busca = (termo || '').toLowerCase().trim();

  if (badgeSel) badgeSel.classList.add('hidden');
  loginSearchState.servidorSelecionado = null;
  document.getElementById('login-email-hidden').value = '';

  if (busca.length < 2) {
    containerSugestoes.innerHTML = '';
    return;
  }

  const servidoresMatcheados = (appState.servidores || []).filter(srv => {
    const nomeNorm = (srv.nome || '').toLowerCase();
    const cargoNorm = (srv.cargo || '').toLowerCase();
    const loginNorm = (srv.login || '').toLowerCase();
    return nomeNorm.includes(busca) || cargoNorm.includes(busca) || loginNorm.includes(busca);
  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  containerSugestoes.innerHTML = '';

  if (servidoresMatcheados.length === 0) {
    containerSugestoes.innerHTML = `
      <div class="p-3 text-center space-y-2">
        <div class="text-slate-500 italic text-xs">Nenhum policial localizado com esse nome.</div>
        <button type="button" onclick="window.forcarAtualizacaoListaServidoresLogin()" class="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs cursor-pointer shadow-xs">
          🔄 Não encontrou seu nome? Clique para atualizar a lista
        </button>
      </div>
    `;
    return;
  }

  servidoresMatcheados.slice(0, 6).forEach(srv => {
    const del = (appState.delegacias || []).find(d => String(d.id) === String(srv.delegaciaId));
    const emailCalculado = obterEmailAutenticacao(srv);
    const nivelExibicao = srv.nivelAcesso || srv.perfil || 'APJ';

    const itemDiv = document.createElement('div');
    itemDiv.className = 'p-2 hover:bg-indigo-50 border-b border-slate-100 cursor-pointer transition flex items-center justify-between font-sans';
    itemDiv.innerHTML = `
      <div>
        <span class="font-bold text-slate-900 block text-xs">${srv.nome}</span>
        <span class="text-[10px] text-slate-500">${srv.cargo || 'APJ'} • ${del ? del.nome : (srv.delegaciaNome || '8ª SDP')}</span>
      </div>
      <span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">${nivelExibicao}</span>
    `;

    itemDiv.onclick = () => {
      window.selecionarPolicialLogin(srv.id, srv.nome, emailCalculado, srv.cargo || 'APJ');
    };

    containerSugestoes.appendChild(itemDiv);
  });

  const footerAtualizar = document.createElement('div');
  footerAtualizar.className = 'p-1.5 bg-slate-50 border-t border-slate-200 text-center';
  footerAtualizar.innerHTML = `
    <button type="button" onclick="window.forcarAtualizacaoListaServidoresLogin()" class="text-[10px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer">
      🔄 Não encontrou seu nome na lista? Clique para atualizar
    </button>
  `;
  containerSugestoes.appendChild(footerAtualizar);
};

window.selecionarPolicialLogin = function(id, nome, email, cargo) {
  loginSearchState.servidorSelecionado = { id, nome, email, cargo };

  const inputNome = document.getElementById('login-nome-busca');
  const inputEmailHidden = document.getElementById('login-email-hidden');
  const containerSugestoes = document.getElementById('login-sugestoes-lista');
  const badgeSel = document.getElementById('login-badge-servidor-sel');
  const textoBadge = document.getElementById('login-badge-texto');

  if (inputNome) inputNome.value = nome;
  if (inputEmailHidden) inputEmailHidden.value = email;
  if (containerSugestoes) containerSugestoes.innerHTML = '';

  if (badgeSel && textoBadge) {
    textoBadge.innerText = `Selecionado: ${nome} (${cargo})`;
    badgeSel.classList.remove('hidden');
  }
};

window.executarLoginFirebase = async function(e) {
  if (e) e.preventDefault();

  const emailInput = document.getElementById('login-email-hidden')?.value?.trim().toLowerCase();
  const password = document.getElementById('login-password')?.value;
  const msgErro = document.getElementById('login-erro-msg');

  if (!emailInput || !password) {
    if (msgErro) {
      msgErro.innerText = "Por favor, selecione o policial e digite a senha.";
      msgErro.classList.remove('hidden');
    }
    return;
  }

  try {
    msgErro?.classList.add('hidden');
    let userCredential = null;

    let srv = (appState.servidores || []).find(s => 
      obterEmailAutenticacao(s) === emailInput || 
      (s.email && s.email.toLowerCase() === emailInput) ||
      (s.emailRecuperacao && s.emailRecuperacao.toLowerCase() === emailInput)
    );

    if (!srv && typeof loadAllDataFromFirestore === 'function') {
      await loadAllDataFromFirestore(true);
      srv = (appState.servidores || []).find(s => 
        obterEmailAutenticacao(s) === emailInput || 
        (s.email && s.email.toLowerCase() === emailInput) ||
        (s.emailRecuperacao && s.emailRecuperacao.toLowerCase() === emailInput)
      );
    }

    const estaComResetPendente = srv?.forcarTrocaSenha || srv?.senhaResetada;

    const emailsParaTestar = new Set();
    if (emailInput) emailsParaTestar.add(emailInput);
    if (srv?.emailRecuperacao) emailsParaTestar.add(srv.emailRecuperacao.toLowerCase().trim());
    if (srv?.email) emailsParaTestar.add(srv.email.toLowerCase().trim());
    
    const loginBase = srv?.login ? srv.login.toLowerCase().trim() : normalizeText(srv?.nome || '').replace(/\s+/g, '.');
    if (loginBase) emailsParaTestar.add(`${loginBase}@policiacivil.pr.gov.br`);

    let ultimoErro = null;
    for (const emailTeste of emailsParaTestar) {
      if (!emailTeste || !emailTeste.includes('@')) continue;
      try {
        userCredential = await firebase.auth().signInWithEmailAndPassword(emailTeste, password);
        if (userCredential) break;
      } catch (authErr) {
        ultimoErro = authErr;
      }
    }

    if (!userCredential && password === 'Central123' && srv) {
      const emailCorpPadrao = `${loginBase}@policiacivil.pr.gov.br`;
      try {
        await criarContaFirebaseAuth(srv, 'Central123');
      } catch (cErr) {
        // Ignora se a conta já existia
      }
      try {
        userCredential = await firebase.auth().signInWithEmailAndPassword(emailCorpPadrao, 'Central123');
      } catch (fErr) {
        ultimoErro = fErr;
      }
    }

    if (!userCredential) {
      throw ultimoErro || new Error("Senha incorreta ou acesso não localizado.");
    }

    window.fecharModalLoginApp();

    if (password === 'Central123' || estaComResetPendente) {
      window.abrirModalTrocarSenhaObrigatoria(userCredential.user);
    } else {
      const nomeSrv = loginSearchState.servidorSelecionado?.nome || srv?.nome || 'Usuário';
      alert(`Bem-vindo, ${nomeSrv}!`);
    }

  } catch (err) {
    console.error("Erro no login:", err);
    if (msgErro) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msgErro.innerText = "Senha incorreta ou credenciais de acesso inválidas. Se esqueceu a sua nova senha, utilize a redefinição por e-mail ou solicite o reset ao administrador.";
      } else {
        msgErro.innerText = `Erro de Autenticação: ${err.message}`;
      }
      msgErro.classList.remove('hidden');
    }
  }
};

window.solicitarRecuperacaoSenha = async function() {
  const emailSel = document.getElementById('login-email-hidden')?.value;
  let emailPrompt = prompt("Digite o seu 'E-mail para recuperação de senha' para receber o link de redefinição:", emailSel && emailSel.includes('@') ? emailSel : '');

  if (!emailPrompt) return;
  emailPrompt = emailPrompt.trim().toLowerCase();

  if (!emailPrompt.includes('@')) {
    alert("Por favor, digite um e-mail válido.");
    return;
  }

  try {
    await firebase.auth().sendPasswordResetEmail(emailPrompt);
    alert(`Enviamos um e-mail de redefinição de senha para: ${emailPrompt}\n\nVerifique a sua caixa de entrada ou spam e siga as instruções.`);
  } catch (err) {
    console.error("Erro ao enviar e-mail de redefinição:", err);
    alert(`Erro ao solicitar redefinição: ${err.message}`);
  }
};

window.fazerLogoutApp = async function() {
  if (confirm("Deseja realmente encerrar a sessão?")) {
    await firebase.auth().signOut();
    appState.currentUser = null;
    
    renderUserStatusHeader();
    applyUIPermissions();
    
    if (window.switchTab) {
      window.switchTab('crf');
    }
  }
};

let userParaTrocaSenha = null;

window.abrirModalTrocarSenhaObrigatoria = function(user) {
  userParaTrocaSenha = user;
  let modal = document.getElementById('modal-trocar-senha-obrigatoria');
  if (!modal) {
    criarModalTrocarSenhaDOM();
    modal = document.getElementById('modal-trocar-senha-obrigatoria');
  }

  const srv = (appState.servidores || []).find(s => 
    obterEmailAutenticacao(s) === (user.email || '').toLowerCase() || 
    (s.email && s.email.toLowerCase() === (user.email || '').toLowerCase()) ||
    (s.emailRecuperacao && s.emailRecuperacao.toLowerCase() === (user.email || '').toLowerCase())
  );

  document.getElementById('pwd-email-recuperacao').value = (srv?.email && !srv.email.endsWith('@policiacivil.pr.gov.br')) ? srv.email : (srv?.emailRecuperacao || '');
  document.getElementById('pwd-nova').value = '';
  document.getElementById('pwd-confirma').value = '';
  document.getElementById('pwd-erro-msg')?.classList.add('hidden');

  modal.classList.remove('hidden');
};

window.cancelarTrocaSenhaObrigatoria = async function() {
  const confirma = confirm("A alteração da senha e cadastro do e-mail de recuperação são obrigatórios para acessar o sistema. Se cancelar, sua sessão será encerrada. Deseja sair?");
  
  if (confirma) {
    document.getElementById('modal-trocar-senha-obrigatoria')?.classList.add('hidden');
    await firebase.auth().signOut();
    appState.currentUser = null;
    
    if (typeof renderUserStatusHeader === 'function') renderUserStatusHeader();
    if (typeof applyUIPermissions === 'function') applyUIPermissions();
    if (window.switchTab) window.switchTab('crf');
    
    alert("Sessão encerrada por segurança.");
  }
};

// 🔑 CADASTRO DE NOVA SENHA E CRIAÇÃO GARANTIDA DA NOVA CONTA VIA REST API
window.salvarNovaSenhaObrigatoria = async function(e) {
  if (e) e.preventDefault();
  const novoEmail = document.getElementById('pwd-email-recuperacao')?.value.trim().toLowerCase();
  const elNova = document.getElementById('pwd-nova');
  const nova = elNova ? elNova.value : '';
  const confirma = document.getElementById('pwd-confirma')?.value;
  const msgErro = document.getElementById('pwd-erro-msg');

  if (!novoEmail || !novoEmail.includes('@')) {
    if (msgErro) {
      msgErro.innerText = "Por favor, insira um e-mail válido para recuperação de senha.";
      msgErro.classList.remove('hidden');
    }
    return;
  }

  if (nova.length < 6) {
    if (msgErro) {
      msgErro.innerText = "A nova senha deve ter no mínimo 6 caracteres.";
      msgErro.classList.remove('hidden');
    }
    return;
  }

  if (nova === 'Central123') {
    if (msgErro) {
      msgErro.innerText = "Você deve escolher uma senha diferente da senha padrão Central123.";
      msgErro.classList.remove('hidden');
    }
    return;
  }

  if (nova !== confirma) {
    if (msgErro) {
      msgErro.innerText = "A confirmação de senha não confere com a nova senha.";
      msgErro.classList.remove('hidden');
    }
    return;
  }

  try {
    msgErro?.classList.add('hidden');
    const user = firebase.auth().currentUser;

    if (!user) {
      alert("Sessão expirada. Por favor, faça login novamente.");
      window.location.reload();
      return;
    }

    const srvId = appState.currentUser?.servidorId || appState.currentUser?.id;
    let srv = (appState.servidores || []).find(s => String(s.id) === String(srvId));

    if (!srv) {
      srv = (appState.servidores || []).find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
    }

    // 1. Atualiza a senha da conta atualmente conectada
    await user.updatePassword(nova);

    // 2. CRIA A NOVA CONTA REAL NO FIREBASE AUTH VIA REST API (Garante criação no console sem conflito de sessão)
    const apiKey = firebase.app().options.apiKey;
    if (apiKey) {
      try {
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: novoEmail,
            password: nova,
            returnSecureToken: true
          })
        });

        const resData = await response.json();
        if (response.ok) {
          console.log("[Firebase Auth REST] Novo usuário registrado no Firebase Auth:", resData.email);
        } else if (resData.error && resData.error.message === 'EMAIL_EXISTS') {
          console.log("[Firebase Auth REST] O e-mail informado já existe no Auth. A senha atualizada será utilizada para a autenticação.");
        } else {
          console.warn("[Firebase Auth REST] Aviso na API ao registrar:", resData.error?.message);
        }
      } catch (restErr) {
        console.warn("[Firebase Auth REST] Erro na requisição REST de criação de conta:", restErr.message);
      }
    }

    // 3. ATUALIZA A FICHA DO POLICIAL NO FIRESTORE
    if (srv) {
      srv.email = novoEmail;
      srv.emailRecuperacao = novoEmail;
      srv.senhaResetada = false;
      srv.forcarTrocaSenha = false;

      const idx = (appState.servidores || []).findIndex(s => String(s.id) === String(srv.id));
      if (idx >= 0) appState.servidores[idx] = srv;

      if (typeof syncDocToFirestore === 'function') {
        await syncDocToFirestore('servidores', srv.id, srv);
      }
    }

    if (appState.currentUser) {
      appState.currentUser.email = novoEmail;
      appState.currentUser.forcarTrocaSenha = false;
    }

    alert("E-mail real e nova senha cadastrados com sucesso no Firebase Auth!");
    document.getElementById('modal-trocar-senha-obrigatoria')?.classList.add('hidden');

    if (typeof renderUserStatusHeader === 'function') renderUserStatusHeader();
    if (typeof applyUIPermissions === 'function') applyUIPermissions();

  } catch (err) {
    console.error("Erro ao salvar nova senha:", err);

    if (err.code === 'auth/requires-recent-login') {
      alert("Por questões de segurança, faça o login novamente com 'Central123' para confirmar a alteração do e-mail e senha.");
      await firebase.auth().signOut();
      window.location.reload();
    } else {
      if (msgErro) {
        msgErro.innerText = `Erro ao salvar cadastro: ${err.message}`;
        msgErro.classList.remove('hidden');
      }
    }
  }
};

window.resetarAcessoServidorAdmin = async function(servidorId) {
  if (!servidorId) return;

  const srv = (appState.servidores || []).find(s => String(s.id) === String(servidorId));
  if (!srv) {
    alert("Servidor não localizado na memória.");
    return;
  }

  const confirmacao = confirm(
    `ATENÇÃO - RESET DE ACESSO:\n\n` +
    `Deseja realmente resetar o acesso do policial "${srv.nome}"?\n\n` +
    `• A senha temporária voltará a ser: Central123\n` +
    `• O policial será solicitado a cadastrar o e-mail real no próximo login.`
  );

  if (!confirmacao) return;

  try {
    srv.forcarTrocaSenha = true;
    srv.senhaResetada = true;

    await syncDocToFirestore('servidores', srv.id, srv);

    alert(`Sucesso! O acesso de ${srv.nome} foi resetado.\nOrientação: Peça ao policial para selecionar o nome dele na tela de login e digitar a senha temporária Central123.`);

  } catch (err) {
    console.error("Erro ao efetuar reset administrativo:", err);
    alert(`Erro ao atualizar dados no Firestore: ${err.message}`);
  }
};

function criarModalLoginDOM() {
  document.getElementById('modal-login-app')?.remove();

  const modalHTML = `
    <div id="modal-login-app" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 flex flex-col border-t-4 border-pcpr-gold">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-lg">🔐</span>
            <h3 class="font-bold text-slate-900 text-sm">Acesso ao Sistema de Escalas PCPR</h3>
          </div>
          <button type="button" onclick="window.fecharModalLoginApp()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <form onsubmit="window.executarLoginFirebase(event)" class="space-y-3 text-xs">
          <div id="login-erro-msg" class="hidden p-2 bg-red-100 text-red-800 border border-red-200 font-bold rounded-lg text-[11px] text-center"></div>

          <input type="hidden" id="login-email-hidden">

          <div class="relative">
            <label class="block font-bold text-slate-700 mb-1">Identifique-se pelo seu Nome ou Login:</label>
            <input type="text" id="login-nome-busca" oninput="window.filtrarPolicialLogin(this.value)" placeholder="🔍 Digite 'ADMIN' ou as primeiras letras do seu nome..." autocomplete="off" class="w-full border rounded-xl p-2.5 bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
            
            <div id="login-sugestoes-lista" class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl max-h-48 overflow-y-auto z-20"></div>
          </div>

          <div id="login-badge-servidor-sel" class="hidden p-2 bg-[#F7F3E8] border border-[#BEA55A] rounded-xl text-[#5A4716] font-bold text-xs flex items-center justify-between">
            <span id="login-badge-texto"></span>
            <span class="text-emerald-700">✓</span>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-bold text-slate-700">Senha:</label>
              <button type="button" onclick="window.solicitarRecuperacaoSenha()" class="text-[11px] text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer">Esqueci minha senha</button>
            </div>
            <input type="password" id="login-password" required placeholder="Senha de Acesso" class="w-full border rounded-xl p-2.5 bg-slate-50 font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
          </div>

          <div class="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onclick="window.fecharModalLoginApp()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-black text-pcpr-gold border border-pcpr-gold hover:bg-slate-800 rounded-xl font-bold shadow-xs cursor-pointer">Entrar no Sistema</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function criarModalTrocarSenhaDOM() {
  document.getElementById('modal-trocar-senha-obrigatoria')?.remove();

  const modalHTML = `
    <div id="modal-trocar-senha-obrigatoria" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans" onclick="if(event.target === this) window.cancelarTrocaSenhaObrigatoria()">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 flex flex-col border-t-4 border-amber-500 relative">
        
        <button type="button" onclick="window.cancelarTrocaSenhaObrigatoria()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer" title="Cancelar e Sair">
          ✕
        </button>

        <div class="border-b pb-3 shrink-0 pr-6">
          <div class="flex items-center gap-2">
            <span class="text-xl">⚠️</span>
            <h3 class="font-bold text-slate-900 text-sm">Cadastro de Acesso e Nova Senha</h3>
          </div>
          <p class="text-[11px] text-slate-500 mt-1">Por questões de segurança, registre o seu e-mail funcional/pessoal para recuperação e cadastre uma nova senha pessoal.</p>
        </div>

        <form onsubmit="window.salvarNovaSenhaObrigatoria(event)" class="space-y-3 text-xs">
          <div id="pwd-erro-msg" class="hidden p-2 bg-red-100 text-red-800 border border-red-200 font-bold rounded-lg text-[11px] text-center"></div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">E-mail para recuperação de senha:</label>
            <input type="email" id="pwd-email-recuperacao" required placeholder="exemplo@policiacivil.pr.gov.br" class="w-full border rounded-xl p-2.5 bg-slate-50 font-medium text-slate-900 focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
            <span class="text-[10px] text-slate-400 block mt-0.5">Utilizado para enviar o link de redefinição caso esqueça a senha futuramente.</span>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Nova Senha Pessoal:</label>
            <input type="password" id="pwd-nova" required minlength="6" placeholder="Mínimo 6 caracteres" class="w-full border rounded-xl p-2.5 bg-slate-50 font-medium text-slate-900 focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Confirme a Nova Senha:</label>
            <input type="password" id="pwd-confirma" required minlength="6" placeholder="Repita a nova senha" class="w-full border rounded-xl p-2.5 bg-slate-50 font-medium text-slate-900 focus:ring-2 focus:ring-pcpr-gold focus:outline-none">
          </div>

          <div class="pt-3 border-t flex items-center justify-between gap-2 shrink-0">
            <button type="button" onclick="window.cancelarTrocaSenhaObrigatoria()" class="px-4 py-2.5 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
              Cancelar e Sair
            </button>
            <button type="submit" class="px-4 py-2.5 bg-black text-[#BEA55A] border border-[#BEA55A] hover:bg-slate-800 rounded-xl font-bold shadow-xs cursor-pointer text-center">
              💾 Salvar Dados e Acessar
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
