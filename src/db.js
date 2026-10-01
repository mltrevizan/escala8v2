// src/db.js
import { appState } from './state.js';

// Função para garantir a inicialização segura do Firebase SDK v8
function getFirestoreInstance() {
  if (!firebase.apps.length) {
    // Configuração de Fallback caso o Firebase ainda não tenha sido iniciado no index/app
    const firebaseConfig = {
      apiKey: "AIzaSyDummyKeyForFirestoreInit",
      authDomain: "escala-crf.firebaseapp.com",
      projectId: "escala-crf",
      storageBucket: "escala-crf.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef"
    };
    firebase.initializeApp(firebaseConfig);
  }
  return firebase.firestore();
}

/**
 * Busca todos os documentos de uma coleção no Firestore
 * e insere no appState caso exista o array.
 */
export async function fetchCollection(collectionName) {
  try {
    const db = getFirestoreInstance();
    const snapshot = await db.collection(collectionName).get();
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (appState && appState[collectionName] !== undefined) {
      appState[collectionName] = docs;
    }

    return docs;
  } catch (error) {
    console.error(`Erro ao buscar a coleção ${collectionName}:`, error);
    return [];
  }
}

/**
 * Sincroniza (Salva/Edita/Exclui) um documento no Firestore
 */
export async function syncDocToFirestore(collectionName, docId, data, isDelete = false) {
  try {
    const db = getFirestoreInstance();
    const ref = db.collection(collectionName).doc(docId);
    if (isDelete) {
      await ref.delete();
    } else {
      await ref.set(data, { merge: true });
    }
  } catch (error) {
    console.error(`Erro ao sincronizar documento ${docId} em ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Configura escutadores em tempo real para sincronização instantânea
 */
export function listenToCollection(collectionName, callback) {
  try {
    const db = getFirestoreInstance();
    return db.collection(collectionName).onSnapshot(snapshot => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (appState && appState[collectionName] !== undefined) {
        appState[collectionName] = docs;
      }

      if (callback) callback(docs);
    }, err => {
      console.error(`Erro no listener da coleção ${collectionName}:`, err);
    });
  } catch (e) {
    console.error(`Falha ao iniciar listener para ${collectionName}:`, e);
  }
}
