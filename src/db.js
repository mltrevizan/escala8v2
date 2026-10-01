// src/db.js
import { appState } from './state.js';

// Instanciação segura do Firestore obtendo a referência do app inicializado
function getDb() {
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
