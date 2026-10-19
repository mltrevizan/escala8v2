// src/db.js
import { appState } from './state.js';

let isCarregandoDados = false;
let unsubscribeControle = null;

const CHAVE_LOCAL_VERSOES = 'escala8_versoes_cache';
const CHAVE_LOCAL_DADOS = 'escala8_dados_cache';
const TEMPO_EXPIRACAO_CACHE_MS = 6 * 60 * 60 * 1000;

// 📊 RASTREADOR DE LEITURAS EM MEMÓRIA
let totalLeiturasSessao = 0;
let historicoLeiturasSessao = [];

export function registrarLeituraFirestore(colecao, quantidadeDocs) {
  const qtd = Number(quantidadeDocs) || 0;
  totalLeiturasSessao += qtd;
  
  const registro = {
    hora: new Date().toLocaleTimeString(),
    colecao,
    quantidadeDocs: qtd,
    acumulado: totalLeiturasSessao
  };
  
  historicoLeiturasSessao.unshift(registro);
  if (historicoLeiturasSessao.length > 50) historicoLeiturasSessao.pop();

  console.log(`[Firestore Tracker] 📥 +${qtd} docs lidos de '${colecao}' | Total Sessão: ${totalLeiturasSessao}`);
  
  if (typeof window.atualizarBadgeLeiturasAdmin === 'function') {
    window.atualizarBadgeLeiturasAdmin();
  }
}

export function obterMetricasLeitura() {
  return {
    total: totalLeiturasSessao,
    historico: historicoLeiturasSessao
  };
}

window.obterMetricasLeitura = obterMetricasLeitura;

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

function obterCacheLocal() {
  try {
    const rawVersoes = localStorage.getItem(CHAVE_LOCAL_VERSOES);
    const rawDados = localStorage.getItem(CHAVE_LOCAL_DADOS);
    return {
      versoes: rawVersoes ? JSON.parse(rawVersoes) : {},
      dados: rawDados ? JSON.parse(rawDados) : {}
    };
  } catch (e) {
    return { versoes: {}, dados: {} };
  }
}

function salvarCacheLocal(versoesAtualizadas, dadosAtualizados) {
  try {
    localStorage.setItem(CHAVE_LOCAL_VERSOES, JSON.stringify({
      timestamp: Date.now(),
      versoes: versoesAtualizadas
    }));
    localStorage.setItem(CHAVE_LOCAL_DADOS, JSON.stringify(dadosAtualizados));
  } catch (e) {
    console.warn("[Cache Local] Erro ao salvar cache:", e.message);
  }
}

export async function garantirColecaoControle() {
  try {
    const db = firebase.firestore();
    const docRef = db.collection('controle').doc('versoes');
    const snap = await docRef.get();
    
    registrarLeituraFirestore('controle/versoes', snap.exists ? 1 : 0);

    if (!snap.exists) {
      await docRef.set({
        servidores: 1,
        delegacias: 1,
        feriados: 1,
        sdps: 1,
        ferias: 1,
        logs: 1,
        escalas: 1,
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (err) {
    console.warn("[Firestore] Não foi possível verificar/criar coleção controle:", err.message);
  }
}

async function obterVersoesControleFirestore(db) {
  try {
    const docRef = await db.collection('controle').doc('versoes').get();
    registrarLeituraFirestore('controle/versoes (checagem)', docRef.exists ? 1 : 0);
    if (docRef.exists) return docRef.data() || {};
  } catch (err) {
    console.warn("[Firestore] Erro leitura controle/versoes:", err.message);
  }
  return {};
}

function processarEFormatarServidores(servidoresData) {
  const datasOperacionais = obterDatasOperacionaisIso();
  const idsPlantonistasOperacionais = new Set();

  (appState.escalas || []).forEach(e => {
    if (e.data && datasOperacionais.has(e.data) && e.servidorId) {
      idsPlantonistasOperacionais.add(String(e.servidorId));
    }
  });

  return (servidoresData || []).map(srv => {
    const telReal = srv.telefone || srv._telefoneOriginal || 'Não informado';
    return {
      ...srv,
      _telefoneOriginal: telReal,
      nome: srv.nome || 'Servidor',
      cargo: srv.cargo || 'APJ',
      delegaciaId: srv.delegaciaId || '',
      delegaciaNome: srv.delegaciaNome || '',
      subdivisao: srv.subdivisao || '',
      telefone: telReal,
      isPlantonistaOperacional: idsPlantonistasOperacionais.has(String(srv.id))
    };
  });
}

// 📦 BUSCA CONSOLIDADA
async function buscarColecaoConsolidada(db, nomeColecao) {
  try {
    const docRef = await db.collection('consolidados').doc(nomeColecao).get();
    registrarLeituraFirestore(`${nomeColecao} (consolidado)`, docRef.exists ? 1 : 0);

    let listaConsolidada = [];
    if (docRef.exists && docRef.data() && Array.isArray(docRef.data().lista)) {
      listaConsolidada = docRef.data().lista;
    }

    if (listaConsolidada.length === 0) {
      const snap = await db.collection(nomeColecao).get();
      registrarLeituraFirestore(`${nomeColecao} (migracao lote)`, snap.docs.length);

      listaConsolidada = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (listaConsolidada.length > 0) {
        db.collection('consolidados').doc(nomeColecao).set({
          lista: listaConsolidada,
          ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    }

    return listaConsolidada;
  } catch (err) {
    console.warn(`[Firestore] Erro leitura consolidada de ${nomeColecao}:`, err.message);
    return [];
  }
}

export async function buscarServidoresSobDemanda() {
  try {
    console.log("[Firestore] Atualizando lista de servidores diretamente do banco...");
    const db = firebase.firestore();
    const servidoresData = await buscarColecaoConsolidada(db, 'servidores');

    appState.servidores = processarEFormatarServidores(servidoresData);

    const { versoes, dados } = obterCacheLocal();
    salvarCacheLocal(versoes.versoes || {}, { ...dados, servidores: servidoresData });

    return appState.servidores;
  } catch (err) {
    console.error("Erro ao buscar servidores sob demanda:", err);
    return [];
  }
}

// ⚡ INICIA O ESCUTADOR EM TEMPO REAL LEVE NO PONTEIRO DE VERSÃO
function iniciarEscutadorTempoRealPonteiro() {
  if (unsubscribeControle) return;

  try {
    const db = firebase.firestore();
    unsubscribeControle = db.collection('controle').doc('versoes').onSnapshot(snap => {
      registrarLeituraFirestore('controle/versoes (tempo-real)', snap.exists ? 1 : 0);
      
      if (snap.exists && !isCarregandoDados) {
        loadAllDataFromFirestore(false).then(() => {
          if (window.switchTab && appState.activeTab) {
            window.switchTab(appState.activeTab);
          }
        });
      }
    }, err => console.warn("[Tempo Real] Aviso no escutador do ponteiro:", err.message));
  } catch (e) {
    console.warn("[Tempo Real] Não foi possível registrar escutador:", e.message);
  }
}

// 🔑 CARREGAMENTO DE DADOS OTIMIZADO E EM TEMPO REAL
export async function loadAllDataFromFirestore(forceRefresh = false) {
  if (isCarregandoDados) return;
  isCarregandoDados = true;

  try {
    const db = firebase.firestore();
    const userLogado = appState.currentUser || (firebase.auth && firebase.auth().currentUser);
    const isAutenticado = !!userLogado;

    let { versoes: cacheVersoesObj, dados: cacheDados } = obterCacheLocal();

    const cacheInvalido = !cacheDados || !cacheDados.escalas || cacheDados.escalas.length === 0;
    if (cacheInvalido) {
      console.warn("[Auto-Recuperação] Cache local zerado/inválido detectado. Limpando memória para recarregar...");
      localStorage.removeItem(CHAVE_LOCAL_DADOS);
      localStorage.removeItem(CHAVE_LOCAL_VERSOES);
      cacheDados = {};
      cacheVersoesObj = {};
    }

    const versoesLocais = cacheVersoesObj.versoes || {};
    const timestampCache = cacheVersoesObj.timestamp || 0;
    const cacheExpirado = (Date.now() - timestampCache) > TEMPO_EXPIRACAO_CACHE_MS;

    if (!forceRefresh && !cacheExpirado && !cacheInvalido && appState.escalas && appState.escalas.length > 0) {
      const versoesRemotas = await obterVersoesControleFirestore(db);
      
      const mudouDelegacias = versoesRemotas.delegacias !== versoesLocais.delegacias;
      const mudouFeriados = versoesRemotas.feriados !== versoesLocais.feriados;
      const mudouSdps = versoesRemotas.sdps !== versoesLocais.sdps;
      const mudouServidores = versoesRemotas.servidores !== versoesLocais.servidores;
      const mudouEscalas = versoesRemotas.escalas !== versoesLocais.escalas;
      const mudouFerias = isAutenticado && (versoesRemotas.ferias !== versoesLocais.ferias);
      const mudouLogs = isAutenticado && (versoesRemotas.logs !== versoesLocais.logs);

      if (!mudouDelegacias && !mudouFeriados && !mudouSdps && !mudouServidores && !mudouEscalas && !mudouFerias && !mudouLogs) {
        appState.delegacias = cacheDados.delegacias || appState.delegacias || [];
        appState.feriados = cacheDados.feriados || appState.feriados || [];
        appState.sdps = cacheDados.sdps || appState.sdps || [];
        appState.escalas = cacheDados.escalas || appState.escalas || [];
        appState.ferias = cacheDados.ferias || appState.ferias || [];
        appState.logs = cacheDados.logs || appState.logs || [];
        appState.servidores = processarEFormatarServidores(cacheDados.servidores || appState.servidores || []);
        
        isCarregandoDados = false;
        iniciarEscutadorTempoRealPonteiro();
        return;
      }
    }

    let versoesRemotas = {};
    if (!forceRefresh) {
      versoesRemotas = await obterVersoesControleFirestore(db);
    }

    const precisaAtualizarDelegacias = forceRefresh || cacheExpirado || cacheInvalido || (versoesRemotas.delegacias !== versoesLocais.delegacias) || !cacheDados.delegacias;
    const precisaAtualizarFeriados = forceRefresh || cacheExpirado || cacheInvalido || (versoesRemotas.feriados !== versoesLocais.feriados) || !cacheDados.feriados;
    const precisaAtualizarSdps = forceRefresh || cacheExpirado || cacheInvalido || (versoesRemotas.sdps !== versoesLocais.sdps) || !cacheDados.sdps;
    const precisaAtualizarServidores = forceRefresh || cacheExpirado || cacheInvalido || (versoesRemotas.servidores !== versoesLocais.servidores) || !cacheDados.servidores;
    const precisaAtualizarEscalas = forceRefresh || cacheExpirado || cacheInvalido || (versoesRemotas.escalas !== versoesLocais.escalas) || !cacheDados.escalas;
    const precisaAtualizarFerias = isAutenticado && (forceRefresh || cacheExpirado || cacheInvalido || (versoesRemotas.ferias !== versoesLocais.ferias) || !cacheDados.ferias);
    const precisaAtualizarLogs = isAutenticado && (forceRefresh || cacheExpirado || cacheInvalido || (versoesRemotas.logs !== versoesLocais.logs) || !cacheDados.logs);

    const buscarColecaoOuCache = async (nomeChave) => {
      const precisa = {
        delegacias: precisaAtualizarDelegacias,
        feriados: precisaAtualizarFeriados,
        sdps: precisaAtualizarSdps,
        servidores: precisaAtualizarServidores,
        escalas: precisaAtualizarEscalas,
        ferias: precisaAtualizarFerias,
        logs: precisaAtualizarLogs
      }[nomeChave];

      if (precisa || !cacheDados[nomeChave]) {
        return await buscarColecaoConsolidada(db, nomeChave);
      }
      return cacheDados[nomeChave];
    };

    const [delegaciasData, feriadosData, sdpsData, servidoresData, escalasData, feriasData, logsData] = await Promise.all([
      buscarColecaoOuCache('delegacias'),
      buscarColecaoOuCache('feriados'),
      buscarColecaoOuCache('sdps'),
      buscarColecaoOuCache('servidores'),
      buscarColecaoOuCache('escalas'),
      buscarColecaoOuCache('ferias'),
      buscarColecaoOuCache('logs')
    ]);

    appState.delegacias = delegaciasData || [];
    appState.feriados = feriadosData || [];
    appState.sdps = sdpsData || [];
    appState.escalas = escalasData || [];
    appState.ferias = feriasData || [];
    appState.logs = logsData || [];

    appState.servidores = processarEFormatarServidores(servidoresData);

    if (appState.delegacias.length > 0 && !appState.selectedDelegaciaId) {
      appState.selectedDelegaciaId = appState.delegacias[0].id;
    }

    const novosDadosCache = {
      ...cacheDados,
      delegacias: delegaciasData,
      feriados: feriadosData,
      sdps: sdpsData,
      servidores: servidoresData,
      escalas: escalasData,
      ferias: feriasData,
      logs: logsData
    };

    salvarCacheLocal(versoesRemotas, novosDadosCache);
    iniciarEscutadorTempoRealPonteiro();

  } catch (error) {
    console.error("Erro ao carregar dados do Firestore:", error);
  } finally {
    isCarregandoDados = false;
  }
}

// 🛡️ SINCRONIZAÇÃO ATÔMICA (TRANSAÇÃO NO BANCO PARA EVITAR SOBREPOSIÇÃO SIMULTÂNEA)
export async function syncDocToFirestore(collectionName, docId, dataObj, isDelete = false) {
  try {
    const db = firebase.firestore();
    const docRef = db.collection(collectionName).doc(docId);
    const consolidadoRef = db.collection('consolidados').doc(collectionName);
    const controleRef = db.collection('controle').doc('versoes');

    // Executa uma transação no Firestore: lê a versão oficial da nuvem e grava com consistência garantida
    await db.runTransaction(async (transaction) => {
      // 1. Gravação do documento individual
      if (isDelete) {
        transaction.delete(docRef);
      } else {
        transaction.set(docRef, dataObj, { merge: true });
      }

      // 2. Leitura atômica da lista consolidada na nuvem
      const consolidadoDoc = await transaction.get(consolidadoRef);
      let listaNuvem = [];
      if (consolidadoDoc.exists && Array.isArray(consolidadoDoc.data().lista)) {
        listaNuvem = consolidadoDoc.data().lista;
      }

      // 3. Atualização atômica do lote
      const idx = listaNuvem.findIndex(item => String(item.id) === String(docId));
      if (isDelete) {
        if (idx >= 0) listaNuvem.splice(idx, 1);
      } else {
        if (idx >= 0) {
          listaNuvem[idx] = { ...listaNuvem[idx], ...dataObj };
        } else {
          listaNuvem.push({ id: docId, ...dataObj });
        }
      }

      // 4. Salva a lista consolidada atualizada na nuvem
      transaction.set(consolidadoRef, {
        lista: listaNuvem,
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 5. Incrementa o ponteiro de versão global no controle
      transaction.set(controleRef, {
        [collectionName]: firebase.firestore.FieldValue.increment(1),
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    // 6. Atualiza a memória local após confirmação da transação na nuvem
    if (!appState[collectionName]) appState[collectionName] = [];
    const idxLocal = appState[collectionName].findIndex(item => String(item.id) === String(docId));
    if (isDelete) {
      if (idxLocal >= 0) appState[collectionName].splice(idxLocal, 1);
    } else {
      if (idxLocal >= 0) {
        appState[collectionName][idxLocal] = { ...appState[collectionName][idxLocal], ...dataObj };
      } else {
        appState[collectionName].push({ id: docId, ...dataObj });
      }
    }

  } catch (error) {
    console.error(`Erro na transação de sincronização de ${collectionName}:`, error);
    throw error;
  }
}
