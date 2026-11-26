
// Inicializar Firebase para BodegaControl

const firebaseConfig = {
    apiKey: "AIzaSyBF_iVya9kI_SAPrTgkWz49e44TO6oGe98",
    authDomain: "bodega-de-control.firebaseapp.com",
    projectId: "bodega-de-control",
    storageBucket: "bodega-de-control.firebasestorage.app",
    messagingSenderId: "255226754881",
    appId: "1:255226754881:web:019e08606e143e1e7193c0",
    measurementId: "G-LCFHREH4LV"
};

// Inicializar la aplicación
firebase.initializeApp(firebaseConfig);

// Conectar Authentication y Firestore
const auth = firebase.auth();
const db = firebase.firestore();

// Compartir las conexiones con los demás archivos
window.auth = auth;
window.db = db;

console.log("Firebase conectado correctamente");
