import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Reemplazá esto con el bloque exacto que te dio la consola de Firebase:
const firebaseConfig = {
  apiKey: 'AIzaSyDDYJeGy05ff6nfuHZfga8rcxT3qOGuCsw',
  authDomain: 'agoralbum.firebaseapp.com',
  projectId: 'agoralbum',
  storageBucket: 'agoralbum.firebasestorage.app',
  messagingSenderId: '657157318457',
  appId: '1:657157318457:web:faa4496b8740f61a6deae8',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
