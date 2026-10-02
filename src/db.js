// src/db.js
import { appState } from './state.js';

const db = firebase.firestore();

/**
 * Carrega todos os documentos do Firestore para o estado global appState
 */
export async function loadAllDataFromFirestore() {
  try {
    const statusEl = document.getElementById('app-status');
    if (statusEl && !appState.currentUser) {
      statusEl.innerHTML = `<span class="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold animate-pulse">Carregando dados...</span>`;
    }

    // Carregamento paralelo das coleções
    const [snapServidores, snapDelegacias, snapEscalas, snapFeriados, snapSdps] = await Promise.all([
      db.collection('servidores').get().catch(() => ({ docs: [] })),
      db.collection('delegacias').get().catch(() => ({ docs: [] })),
      db.collection('escalas').get().catch(() => ({ docs: [] })),
      db.collection('feriados').get().catch(() => ({ docs: [] })),
      db.collection('sdps').get().catch(() => ({ docs: [] }))
    ]);

    appState.servidores = snapServidores.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    appState.delegacias = snapDelegacias.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    appState.escalas = snapEscalas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    appState.feriados = snapFeriados.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    appState.sdps = snapSdps.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Define uma delegacia padrão inicial se houver cadastradas
    if (appState.delegacias.length > 0 && !appState.selectedDelegaciaId) {
      appState.selectedDelegaciaId = appState.delegacias[0].id;
    }

    console.log("Dados do Firestore carregados com sucesso!");

  } catch (error) {
    console.error("Erro ao carregar dados do Firestore:", error);
  }
}

/**
 * Sincroniza um documento específico com o Firestore (Criação, Atualização ou Exclusão)
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
