// js/firebase-config.js

// Mengimpor fungsi-fungsi yang diperlukan dari Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Konfigurasi Firebase proyek Anda
const firebaseConfig = {
    apiKey: "AIzaSyBsHAP2jzbg5L3uYQVkVkfdWtD3wQssteI",
    authDomain: "sistem-akademik-pusdik-polair.firebaseapp.com",
    projectId: "sistem-akademik-pusdik-polair",
    storageBucket: "sistem-akademik-pusdik-polair.appspot.com",
    messagingSenderId: "1035004359743",
    appId: "1:1035004359743:web:d2419fe293d579802cf48a",
     
     
      // --> PASTIKAN BARIS INI ADA DAN LENGKAP <--
    databaseURL: "https://sistem-akademik-pusdik-polair-default-rtdb.asia-southeast1.firebasedatabase.app"
};
  

// Inisialisasi aplikasi Firebase dengan konfigurasi di atas
const app = initializeApp(firebaseConfig);

// Mendapatkan instance dari layanan Firebase yang akan digunakan
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

// Mengekspor instance agar bisa digunakan di file lain
export { auth, db, storage, rtdb };