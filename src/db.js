// src/db.js
import { appState } from './state.js';

let isCarregandoDados = false;
let dadosJáCarregados = false;

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
 * Carrega todos os documentos do Firestore para o estado global appState.
 * Otimizado com trava de segurança para evitar consumo excessivo de leituras.
 */
export async function loadAllDataFromFirestore(forceRefresh = false) {
  // 🔑 TRAVA DE CACHE: Se os dados já foram carregados e não foi solicitado refresh forçado, reaproveita a memória
  if (dadosJáCarregados && !forceRefresh) {
    console.log("[Cache DB] Dados mantidos em memória (0 leituras no Firestore).");
    return;
  }

  // 🔑 TRAVA DE CONCORRÊNCIA: Evita execuções paralelas simultâneas
  if (isCarregandoDados) {
    console.warn("[Aviso DB] Carregamento de dados já em andamento. Ignorando requisição duplicada.");
    return;
  }

  isCarregandoDados = true;

  try {
    const db = firebase.firestore();

    const statusEl = document.getElementById('app-status');
    if (statusEl && !appState.currentUser && !dadosJáCarregados) {
      statusEl.innerHTML = `<span class="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold animate-pulse">Carregando dados...</span>`;
    }

    const isAutenticado = !!(firebase.auth && firebase.auth().currentUser);

    // Função auxiliar para buscar coleção de forma segura sem estourar exceção global
    const buscarColecaoSegura = async (nomeColecao) => {
      try {
        const snap = await db.collection(nomeColecao).get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn(`[Aviso Firestore] Acesso restrito ou sem permissão para ler '${nomeColecao}':`, err.message);
        return [];
      }
    };

    // Buscas paralelas seguras
    const [delegaciasData, escalasData, feriadosData, sdpsData, servidoresData, feriasData, logsData] = await Promise.all([
      buscarColecaoSegura('delegacias'),
      buscarColecaoSegura('escalas'),
      buscarColecaoSegura('feriados'),
      buscarColecaoSegura('sdps'),
      buscarColecaoSegura('servidores'),
      buscarColecaoSegura('ferias'),
      buscarColecaoSegura('logs')
    ]);

    // Atribuição ao estado global da aplicação
    appState.delegacias = delegaciasData;
    appState.escalas = escalasData;
    appState.feriados = feriadosData;
    appState.sdps = sdpsData;
    appState.ferias = feriasData;
    appState.logs = logsData;

    // Mapeia IDs dos policiais que estão de plantão Ontem, Hoje ou Amanhã
    const datasOperacionais = obterDatasOperacionaisIso();
    const idsPlantonistasOperacionais = new Set();

    appState.escalas.forEach(e => {
      if (e.data && datasOperacionais.has(e.data) && e.servidorId) {
        idsPlantonistasOperacionais.add(String(e.servidorId));
      }
    });

    // Sanitização e formatação dos dados dos servidores
    appState.servidores = servidoresData.map(srv => {
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

    if (statusEl && !appState.currentUser) {
      statusEl.innerHTML = '';
    }

    dadosJáCarregados = true;
    console.log(`[Firestore DB] Carregamento concluído: ${appState.servidores.length} servidores, ${appState.delegacias.length} delegacias, ${appState.ferias.length} férias e ${appState.logs.length} logs.`);

  } catch (error) {
    console.error("Erro ao carregar dados do Firestore:", error);
  } finally {
    isCarregandoDados = false;
  }
}

/**
 * Sincroniza um documento com o Firestore (Criação, Atualização ou Exclusão)
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
  } catch (error) {
    console.error(`Erro ao sincronizar documento na coleção ${collectionName}:`, error);
    throw error;
  }
}
