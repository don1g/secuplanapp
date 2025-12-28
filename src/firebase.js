import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


// HIER DEINE ECHTEN DATEN EINFÜGEN!
const firebaseConfig = {
  apiKey: "AIzaSyDKx63fW_Ngy7N_wYmCcr2NRaoIn63uCJg",
  authDomain: "secuplangemini2.firebaseapp.com",
  projectId: "secuplangemini2",
  storageBucket: "secuplangemini2.firebasestorage.app",
  messagingSenderId: "804459964892",
  appId: "1:804459964892:web:0679f0e019da07569e8719"
};

// App starten (nur EINMAL!)
const app = initializeApp(firebaseConfig);

// Werkzeuge exportieren
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);