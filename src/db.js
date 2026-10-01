// src/db.js
import { appState } from './state.js';

// Retorna a referência do Firestore iniciada pelas credenciais do index.html
function getDb() {
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyAupeszDjCFIhxdz0AlGNgTOws1L4oC8ZE",
      authDomain: "escala8v2.firebaseapp.com",
      projectId: "escala8v2",
      storageBucket: "escala8v2.firebasestorage.app",
      messagingSenderId: "974252050712",
      appId: "1:974252050712:web:debb093dc6eea1f4c6766d"
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
