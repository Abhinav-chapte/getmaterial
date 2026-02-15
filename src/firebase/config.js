import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBLXv8_OWPhF2ihYaJ69KOwwPnnWdh2qPg",
  authDomain: "getmaterial-gndec.firebaseapp.com",
  projectId: "getmaterial-gndec",
  storageBucket: "getmaterial-gndec.firebasestorage.app",
  messagingSenderId: "579504072407",
  appId: "1:579504072407:web:84b44bb2a184a1d49e7292"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;