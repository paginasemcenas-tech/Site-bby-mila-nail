import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC0NmVSSTXO83CkWiqCnil5Uts1Rs6g5Dk",
  authDomain: "site-bby-mila-nails.firebaseapp.com",
  projectId: "site-bby-mila-nails",
  storageBucket: "site-bby-mila-nails.firebasestorage.app",
  messagingSenderId: "926442742887",
  appId: "1:926442742887:web:ca53d60f6ff723dfff20c2",
  measurementId: "G-DRWFEM30HK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);