// src/db.js
import { appState } from './state.js';

let isCarregandoDados = false;
const CHAVE_LOCAL_VERSOES = 'escala8_versoes_cache';
const CHAVE_LOCAL_DADOS = 'escala8_dados_cache';
const TEMPO_EXPIRACAO_CACHE_MS = 6 * 60 * 60 * 1000; // 6 Horas em milissegundos

/**
 * Retorna as datas de Ontem, Hoje e Amanhã em formato ISO (YYYY-MM-DD)
 */
function obterDatasOperacionaisIso() {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  const formatISO = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return new Set([formatISO(ontem), formatISO(hoje), formatISO(amanha)]);
}

/**
 * Carrega e recupera os dados salvos em cache no LocalStorage do navegador
 */
function obterCacheLocal() {
  try {
    const rawVersoes = localStorage.getItem(CHAVE_LOCAL_VERSOES);
    const rawDados = localStorage.getItem(CHAVE_LOCAL_DADOS);
    
    const versoes = rawVersoes ? JSON.parse(rawVersoes) : {};
    const dados = rawDados ? JSON.parse(rawDados) : {};
    
    return { versoes, dados };
  } catch (e) {
    console.warn("[Cache Local] Falha ao ler do LocalStorage:", e.message);
    return { versoes: {}, dados: {} };
  }
}

/**
 * Persiste dados e versões no LocalStorage do navegador
 */
function salvarCacheLocal(versoesAtualizadas, dadosAtualizados) {
  try {
    localStorage.setItem(CHAVE_LOCAL_VERSOES, JSON.stringify({
      timestamp: Date.now(),
      versoes: versoesAtualizadas
    }));
    localStorage.setItem(CHAVE_LOCAL_DADOS, JSON.stringify(dadosAtualizados));
  } catch (e) {
    console.warn("[Cache Local] Falha ao salvar no LocalStorage:", e.message);
  }
}

/**
 * Carrega o documento de controle 'controle/versoes' com apenas 1 leitura no Firestore
 */
async function obterVersoesControleFirestore(db) {
  try {
    const docRef = await db.collection('controle').doc('versoes').get();
    if (docRef.exists) {
      return docRef.data() || {};
    }
  } catch (err) {
    console.warn("[Firestore] Documento controle/versoes não localizado ou sem acesso:", err.message);
  }
  return {};
}

/**
 * Função principal de carregamento inteligente com Ponteiro de Controle e Cache Local.
 */
export async function loadAllDataFromFirestore(forceRefresh = false) {
  if (isCarregandoDados) {
    console.warn("[Aviso DB] Carregamento de dados já em andamento. Ignorando requisição simultânea.");
    return;
  }

  isCarregandoDados = true;

  try {
    const db = firebase.firestore();
    const isAutenticado = !!(firebase.auth && firebase.auth().currentUser);

    const statusEl = document.getElementById('app-status');
    if (statusEl && !appState.currentUser) {
      statusEl.innerHTML = `<span class="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold animate-pulse">Sincronizando dados...</span>`;
    }

    const { versoes: cacheVersoesObj, dados: cacheDados } = obterCacheLocal();
    const versoesLocais = cacheVersoesObj.versoes || {};
    const timestampCache = cacheVersoesObj.timestamp || 0;
    const cacheExpirado = (Date.now() - timestampCache) > TEMPO_EXPIRACAO_CACHE_MS;

    // 1. LEITURA DO PONTEIRO DE CONTROLE (Consome apenas 1 leitura no Firestore)
    let versoesRemotas = {};
    if (!forceRefresh) {
      versoesRemotas = await obterVersoesControleFirestore(db);
    }

    const ano = appState.currentYear || new Date().getFullYear();
    const mesStr = String((appState.currentMonth || new Date().getMonth()) + 1).padStart(2, '0');
    const chaveMesEscalas = `escalas_${ano}_${mesStr}`;

    const precisaAtualizarDelegacias = forceRefresh || cacheExpirado || (versoesRemotas.delegacias !== versoesLocais.delegacias) || !cacheDados.delegacias;
    const precisaAtualizarFeriados = forceRefresh || cacheExpirado || (versoesRemotas.feriados !== versoesLocais.feriados) || !cacheDados.feriados;
    const precisaAtualizarSdps = forceRefresh || cacheExpirado || (versoesRemotas.sdps !== versoesLocais.sdps) || !cacheDados.sdps;
    const precisaAtualizarEscalasMes = forceRefresh || cacheExpirado || (versoesRemotas[chaveMesEscalas] !== versoesLocais[chaveMesEscalas]) || !cacheDados[chaveMesEscalas];
    
    const precisaAtualizarServidores = isAutenticado && (forceRefresh || cacheExpirado || (versoesRemotas.servidores !== versoesLocais.servidores) || !cacheDados.servidores);
    const precisaAtualizarFerias = isAutenticado && (forceRefresh || cacheExpirado || (versoesRemotas.ferias !== versoesLocais.ferias) || !cacheDados.ferias);
    const precisaAtualizarLogs = isAutenticado && (forceRefresh || cacheExpirado || (versoesRemotas.logs !== versoesLocais.logs) || !cacheDados.logs);

    // Função para buscar dados no Firestore apenas se a versão tiver mudado
    const buscarColecaoOuCache = async (nomeChave, fetchFn) => {
      const precisa = {
        delegacias: precisaAtualizarDelegacias,
        feriados: precisaAtualizarFeriados,
        sdps: precisaAtualizarSdps,
        servidores: precisaAtualizarServidores,
        ferias: precisaAtualizarFerias,
        logs: precisaAtualizarLogs
      }[nomeChave];

      if (precisa || !cacheDados[nomeChave]) {
        return await fetchFn();
      }
      return cacheDados[nomeChave];
    };

    // 2. BUSCAS SELETIVAS NO FIRESTORE (Apenas o que expirou ou mudou)
    const [delegaciasData, feriadosData, sdpsData, servidoresData, feriasData, logsData] = await Promise.all([
      buscarColecaoOuCache('delegacias', async () => {
        const snap = await db.collection('delegacias').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }),
      buscarColecaoOuCache('feriados', async () => {
        const snap = await db.collection('feriados').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }),
      buscarColecaoOuCache('sdps', async () => {
        const snap = await db.collection('sdps').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }),
      buscarColecaoOuCache('servidores', async () => {
        if (!isAutenticado) return cacheDados.servidores || [];
        const snap = await db.collection('servidores').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }),
      buscarColecaoOuCache('ferias', async () => {
        if (!isAutenticado) return cacheDados.ferias || [];
        const snap = await db.collection('ferias').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }),
      buscarColecaoOuCache('logs', async () => {
        if (!isAutenticado) return cacheDados.logs || [];
        const snap = await db.collection('logs').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      })
    ]);

    // Busca de Escalas Seletiva para o Mês Exibido
    let escalasMesData = cacheDados[chaveMesEscalas];
    if (precisaAtualizarEscalasMes || !escalasMesData) {
      const prefixoMesIso = `${ano}-${mesStr}`;
      const snapEscalas = await db.collection('escalas')
        .where('data', '>=', `${prefixoMesIso}-01`)
        .where('data', '<=', `${prefixoMesIso}-31`)
        .get();
      escalasMesData = snapEscalas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // 3. ATRIBUIÇÃO AO ESTADO GLOBAL (appState)
    appState.delegacias = delegaciasData || [];
    appState.feriados = feriadosData || [];
    appState.sdps = sdpsData || [];
    appState.escalas = escalasMesData || [];
    appState.ferias = feriasData || [];
    appState.logs = logsData || [];

    // Mapeia IDs dos policiais plantonistas das datas operacionais
    const datasOperacionais = obterDatasOperacionaisIso();
    const idsPlantonistasOperacionais = new Set();

    appState.escalas.forEach(e => {
      if (e.data && datasOperacionais.has(e.data) && e.servidorId) {
        idsPlantonistasOperacionais.add(String(e.servidorId));
      }
    });

    // Formatação segura de servidores
    appState.servidores = (servidoresData || []).map(srv => {
      const podeExibirTelefone = isAutenticado || idsPlantonistasOperacionais.has(String(srv.id));

      return {
        ...srv,
        nome: srv.nome || 'Servidor',
        cargo: srv.cargo || 'APJ',
        delegaciaId: srv.delegaciaId || '',
        delegaciaNome: srv.delegaciaNome || '',
        subdivisao: srv.subdivisao || '',
        telefone: podeExibirTelefone ? (srv.telefone || 'Não informado') : '🔒 [Acesso Restrito]'
      };
    });

    if (appState.delegacias.length > 0 && !appState.selectedDelegaciaId) {
      appState.selectedDelegaciaId = appState.delegacias[0].id;
    }

    // 4. ATUALIZAÇÃO DO CACHE LOCAL (LOCALSTORAGE)
    const novosDadosCache = {
      ...cacheDados,
      delegacias: delegaciasData,
      feriados: feriadosData,
      sdps: sdpsData,
      servidores: servidoresData,
      ferias: feriasData,
      logs: logsData,
      [chaveMesEscalas]: escalasMesData
    };

    salvarCacheLocal(versoesRemotas, novosDadosCache);

    if (statusEl && !appState.currentUser) {
      statusEl.innerHTML = '';
    }

    console.log(`[Firestore DB Otimizado] Dados carregados (Modo: ${isAutenticado ? 'Logado' : 'Público'}). Mês Exibido: ${chaveMesEscalas}.`);

  } catch (error) {
    console.error("Erro ao carregar dados otimizados do Firestore:", error);
  } finally {
    isCarregandoDados = false;
  }
}

/**
 * Sincroniza um documento com o Firestore (Criação, Atualização ou Exclusão)
 * E incrementa automaticamente a versão no documento de controle 'controle/versoes'.
 */
export async function syncDocToFirestore(collectionName, docId, dataObj, isDelete = false) {
  try {
    const db = firebase.firestore();
    const docRef = db.collection(collectionName).doc(docId);

    if (isDelete) {
      await docRef.delete();
      console.log(`Documento ${docId} removido da coleção ${collectionName}.`);
    } else {
      await docRef.set(dataObj, { merge: true });
      console.log(`Documento ${docId} salvo/atualizado na coleção ${collectionName}.`);
    }

    // INCREMENTO DA VERSÃO NO PONTEIRO DE CONTROLE
    try {
      const controleRef = db.collection('controle').doc('versoes');
      let campoIncremento = collectionName;

      if (collectionName === 'escalas' && dataObj?.data) {
        const partes = dataObj.data.split('-');
        if (partes.length === 3) {
          campoIncremento = `escalas_${partes[0]}_${partes[1]}`;
        }
      }

      await controleRef.set({
        [campoIncremento]: firebase.firestore.FieldValue.increment(1),
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (ctrlErr) {
      console.warn("Aviso ao atualizar ponteiro de versão de controle:", ctrlErr.message);
    }

  } catch (error) {
    console.error(`Erro ao sincronizar documento na coleção ${collectionName}:`, error);
    throw error;
  }
}
