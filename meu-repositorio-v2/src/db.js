// src/db.js
import { firebaseConfig } from './config.js';
import { appState } from './state.js';

let db = null;

export function initFirebase() {
  if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("🔥 Firebase Inicializado com sucesso na v2!");
  } else if (typeof firebase !== 'undefined') {
    db = firebase.firestore();
  }
}

export async function syncDocToFirestore(collectionName, docId, dataObject, isDelete = false) {
  if (!db) return;
  try {
    const docRef = db.collection(collectionName).doc(String(docId));
    if (isDelete) {
      await docRef.delete();
      console.log(`[Firestore DB] Documento ${docId} removido de '${collectionName}'`);
    } else {
      const cleanObj = JSON.parse(JSON.stringify(dataObject));
      await docRef.set(cleanObj, { merge: true });
      console.log(`[Firestore DB] Documento ${docId} gravado em '${collectionName}'`);
    }
  } catch (err) {
    console.error(`[Firestore Error] Erro ao gravar em '${collectionName}':`, err);
  }
}

export async function fetchCollection(collectionName) {
  if (!db) return [];
  try {
    const snapshot = await db.collection(collectionName).get();
    const items = [];
    snapshot.forEach(doc => items.push({ ...doc.data(), id: doc.id }));
    return items;
  } catch (err) {
    console.error(`[Firestore Error] Erro ao buscar '${collectionName}':`, err);
    return [];
  }
}
