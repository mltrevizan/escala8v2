// src/db.js
import { appState } from './state.js';

// Função para obter a instância do Firestore com garantia de inicialização do app
function getDb() {
  if (!firebase.apps.length) {
    // Inicializa o app Firebase com as credenciais padrão do seu projeto
    firebase.initializeApp({
      apiKey: "AIzaSyDummyKeyForFirestoreInit",
      authDomain: "escala-crf.firebaseapp.com",
      projectId: "escala-crf",
      storageBucket: "escala-crf.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef"
    });
  }
  return firebase.firestore();
}

export async function fetchCollection(collectionName) {
  try {
    const db = getDb();
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

export async function syncDocToFirestore(collectionName, docId, data, isDelete = false) {
  try {
    const db = getDb();
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
