// src/db.js
import { appState } from './state.js';

const db = firebase.firestore();

/**
 * Carrega todos os documentos do Firestore para o estado global appState.
 * Sanitiza telefones de visitantes, MAS MANTÉM VISÍVEIS os contatos de quem 
 * está escalado no dia anterior, dia atual ou dia seguinte.
 */
export async function loadAllDataFromFirestore() {
  try {
    const statusEl = document.getElementById('app-status');
    if (statusEl && !appState.currentUser) {
      statusEl.innerHTML = `<span class="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold animate-pulse">Carregando dados...</span>`;
    }

    // 1. Verifica autenticação do usuário
    const isAutenticado = !!(firebase.auth() && firebase.auth().currentUser);

    // 2. Carregamento paralelo das coleções
    const [snapServidores, snapDelegacias, snapEscalas, snapFeriados, snapSdps] = await Promise.all([
      db.collection('servidores').get().catch(() => ({ docs: [] })),
      db.collection('delegacias').get().catch(() => ({ docs: [] })),
      db.collection('escalas').get().catch(() => ({ docs: [] })),
      db.collection('feriados').get().catch(() => ({ docs: [] })),
      db.collection('sdps').get().catch(() => ({ docs: [] }))
    ]);

    const escalasDocs = snapEscalas.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Mapeia as datas operacionais: Ontem, Hoje e Amanhã (formato YYYY-MM-DD)
    const hojeObj = new Date();
    const ontemObj = new Date(hojeObj);
    ontemObj.setDate(hojeObj.getDate() - 1);
    const amanhaObj = new Date(hojeObj);
    amanhaObj.setDate(hojeObj.getDate() + 1);

    const formatISO = (d) => d.toISOString().split('T')[0];
    const datasVisiveisSet = new Set([formatISO(ontemObj), formatISO(hojeObj), formatISO(amanhaObj)]);

    // 4. Identifica o ID de todos os policiais escalados nessas datas operacionais
    const idsServidoresComAcessoAberto = new Set();
    escalasDocs.forEach(esc => {
      if (esc.data && datasVisiveisSet.has(esc.data) && esc.servidorId) {
        idsServidoresComAcessoAberto.add(esc.servidorId);
      }
    });

    // 5. SANITIZAÇÃO INTELIGENTE DE SERVIDORES
    appState.servidores = snapServidores.docs.map(doc => {
      const data = doc.data();
      const srvId = doc.id;

      // Permite o telefone se:
      // a) O usuário estiver logado no sistema (isAutenticado), OU
      // b) O policial estiver escalado ontem, hoje ou amanhã (idsServidoresComAcessoAberto)
      const podeExibirTelefone = isAutenticado || idsServidoresComAcessoAberto.has(srvId);

      return {
        id: srvId,
        ...data,
        nome: data.nome || '',
        cargo: data.cargo || 'APJ',
        delegaciaId: data.delegaciaId || null,
        delegaciaNome: data.delegaciaNome || '',
        subdivisao: data.subdivisao || '',
        telefone: podeExibirTelefone ? (data.telefone || 'Não informado') : '🔒 [Acesso Restrito]'
      };
    });

    appState.delegacias = snapDelegacias.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    appState.escalas = escalasDocs;
    appState.feriados = snapFeriados.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    appState.sdps = snapSdps.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (appState.delegacias.length > 0 && !appState.selectedDelegaciaId) {
      appState.selectedDelegaciaId = appState.delegacias[0].id;
    }

    console.log(`Dados carregados com sucesso! (Telefones liberto para plantonistas de Ontem/Hoje/Amanhã)`);

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
    console.error(`Erro ao
