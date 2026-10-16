// src/db.js
import { appState } from './state.js';

let isCarregandoDados = false;
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

// 📦 FUNÇÃO AUXILIAR DE BUSCA CONSOLIDADA (Lê coleção em lote agregando para apenas 1 leitura)
async function buscarColecaoConsolidada(db, nomeColecao) {
  try {
    const docRef = await db.collection('consolidados').doc(nomeColecao).get();
    registrarLeituraFirestore(`${nomeColecao} (consolidado)`, docRef.exists ? 1 : 0);

    if (docRef.exists && docRef.data() && Array.isArray(docRef.data().lista)) {
      return docRef.data().lista;
    }

    // Fallback: Se o lote acumulado não existir, lê individual e faz a migração automática silenciosa
    const snap = await db.collection(nomeColecao).get();
    registrarLeituraFirestore(`${nomeColecao} (migracao lote)`, snap.docs.length);

    const listaIndividual = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Grava o documento consolidado para que as próximas consultas gastem apenas 1 leitura
    if (listaIndividual.length > 0) {
      db.collection('consolidados').doc(nomeColecao).set({
        lista: listaIndividual,
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(() => {});
    }

    return listaIndividual;
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

// 🔑 CARREGAMENTO DE DADOS OTIMIZADO (Apenas 3 a 5 leituras no total da aplicação!)
export async function loadAllDataFromFirestore(forceRefresh = false) {
  if (isCarregandoDados) return;
  isCarregandoDados = true;

  try {
    const db = firebase.firestore();
    const userLogado = appState.currentUser || (firebase.auth && firebase.auth().currentUser);
    const isAutenticado = !!userLogado;

    const { versoes: cacheVersoesObj, dados: cacheDados } = obterCacheLocal();
    const versoesLocais = cacheVersoesObj.versoes || {};
    const timestampCache = cacheVersoesObj.timestamp || 0;
    const cacheExpirado = (Date.now() - timestampCache) > TEMPO_EXPIRACAO_CACHE_MS;

    // Se temos dados em cache local, faz apenas 1 leitura de checagem do ponteiro de versão
    if (!forceRefresh && !cacheExpirado && cacheDados.escalas && appState.escalas && appState.escalas.length > 0) {
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
        return;
      }
    }

    let versoesRemotas = {};
    if (!forceRefresh) {
      versoesRemotas = await obterVersoesControleFirestore(db);
    }

    const precisaAtualizarDelegacias = forceRefresh || cacheExpirado || (versoesRemotas.delegacias !== versoesLocais.delegacias) || !cacheDados.delegacias;
    const precisaAtualizarFeriados = forceRefresh || cacheExpirado || (versoesRemotas.feriados !== versoesLocais.feriados) || !cacheDados.feriados;
    const precisaAtualizarSdps = forceRefresh || cacheExpirado || (versoesRemotas.sdps !== versoesLocais.sdps) || !cacheDados.sdps;
    const precisaAtualizarServidores = forceRefresh || cacheExpirado || (versoesRemotas.servidores !== versoesLocais.servidores) || !cacheDados.servidores;
    const precisaAtualizarEscalas = forceRefresh || cacheExpirado || (versoesRemotas.escalas !== versoesLocais.escalas) || !cacheDados.escalas;
    const precisaAtualizarFerias = isAutenticado && (forceRefresh || cacheExpirado || (versoesRemotas.ferias !== versoesLocais.ferias) || !cacheDados.ferias);
    const precisaAtualizarLogs = isAutenticado && (forceRefresh || cacheExpirado || (versoesRemotas.logs !== versoesLocais.logs) || !cacheDados.logs);

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

  } catch (error) {
    console.error("Erro ao carregar dados do Firestore:", error);
  } finally {
    isCarregandoDados = false;
  }
}

export async function syncDocToFirestore(collectionName, docId, dataObj, isDelete = false) {
  try {
    const db = firebase.firestore();
    const docRef = db.collection(collectionName).doc(docId);

    // 1. Atualiza/Exclui o documento individual na coleção
    if (isDelete) {
      await docRef.delete();
    } else {
      await docRef.set(dataObj, { merge: true });
    }

    // 2. Sincroniza o lote consolidado em paralelo para garantir 1 leitura no próximo carregamento
    try {
      let listaAtual = appState[collectionName] || [];
      const idx = listaAtual.findIndex(item => String(item.id) === String(docId));

      if (isDelete) {
        if (idx >= 0) listaAtual.splice(idx, 1);
      } else {
        if (idx >= 0) listaAtual[idx] = { ...listaAtual[idx], ...dataObj };
        else listaAtual.push({ id: docId, ...dataObj });
      }

      db.collection('consolidados').doc(collectionName).set({
        lista: listaAtual,
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(() => {});

    } catch (conErr) {
      console.warn(`[Firestore] Aviso ao sincronizar lote consolidado de ${collectionName}:`, conErr.message);
    }

    // 3. Incrementa o ponteiro de versão de controle
    await garantirColecaoControle();

    try {
      const controleRef = db.collection('controle').doc('versoes');
      await controleRef.set({
        [collectionName]: firebase.firestore.FieldValue.increment(1),
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (ctrlErr) {
      console.warn("Aviso ao atualizar ponteiro de controle:", ctrlErr.message);
    }

  } catch (error) {
    console.error(`Erro ao sincronizar ${collectionName}:`, error);
    throw error;
  }
}
