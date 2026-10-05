// src/db.js
import { appState } from './state.js';

const db = firebase.firestore();

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
 */
export async function loadAllDataFromFirestore() {
  try {
    const statusEl = document.getElementById('app-status');
    if (statusEl && !appState.currentUser) {
      statusEl.innerHTML = `<span class="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold animate-pulse">Carregando dados...</span>`;
    }

    const isAutenticado = !!(firebase.auth() && firebase.auth().currentUser);

    // Carregamento direto e seguro das coleções
    const [snapServidores, snapDelegacias, snapEscalas, snapFeriados, snapSdps] = await Promise.all([
      db.collection('servidores').get().catch(() => ({ docs: [] })),
      db.collection('delegacias').get().catch(() => ({ docs: [] })),
      db.collection('escalas').get().catch(() => ({ docs: [] })),
      db.collection('feriados').get().catch(() => ({ docs: [] })),
      db.collection('sdps').get().catch(() => ({ docs: [] }))
    ]);

    // 1. Delegacias
    appState.delegacias = snapDelegacias.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Escalas
    appState.escalas = snapEscalas.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Feriados e SDPs
    appState.feriados = snapFeriados.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    appState.sdps = snapSdps.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Mapeia IDs dos policiais que estão de plantão Ontem, Hoje ou Amanhã
    const datasOperacionais = obterDatasOperacionaisIso();
    const idsPlantoinstasOperacionais = new Set();

    appState.escalas.forEach(e => {
      if (e.data && datasOperacionais.has(e.data) && e.servidorId) {
        idsPlantoinstasOperacionais.add(e.servidorId);
      }
    });

    // 4. Servidores (Sanitização Apenas do Telefone, preservando Nome/Cargo/Unidade intactos)
    appState.servidores = snapServidores.docs.map(doc => {
      const data = doc.data();
      const srvId = doc.id;

      const podeExibirTelefone = isAutenticado || idsPlantoinstasOperacionais.has(srvId);

      return {
        id: srvId,
        ...data,
        nome: data.nome || 'Servidor',
        cargo: data.cargo || 'APJ',
        delegaciaId: data.delegaciaId || '',
        delegaciaNome: data.delegaciaNome || '',
        subdivisao: data.subdivisao || '',
        telefone: podeExibirTelefone ? (data.telefone || 'Não informado') : '🔒 [Acesso Restrito]'
      };
    });

    // Define uma delegacia padrão inicial se houver cadastradas
    if (appState.delegacias.length > 0 && !appState.selectedDelegaciaId) {
      appState.selectedDelegaciaId = appState.delegacias[0].id;
    }

    console.log(`Carregamento concluído: ${appState.servidores.length} servidores e ${appState.delegacias.length} delegacias ativas.`);

  } catch (error) {
    console.error("Erro ao carregar dados do Firestore:", error);
  }
}

/**
 * Sincroniza um documento com o Firestore (Criação, Atualização ou Exclusão)
 */
export async function syncDocToFirestore(collectionName, docId, dataObj, isDelete = false) {
  try {
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
