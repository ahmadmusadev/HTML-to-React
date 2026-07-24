import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-ZActwqd7CADV0BHQQFdBFVFXgsWMB90",
  authDomain: "madrsa-hifz-system.firebaseapp.com",
  projectId: "madrsa-hifz-system",
  storageBucket: "madrsa-hifz-system.firebasestorage.app",
  messagingSenderId: "440285961279",
  appId: "1:440285961279:web:646216aef21c1f0196ec8a",
};

let db = null;

if (!firebase.apps.length) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
  } catch (error) {
    console.warn('[System] Firebase SDK not initialized:', error);
  }
} else {
  db = firebase.firestore();
}

export { db };
