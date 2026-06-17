import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBm8N4Rw03An_kOUJNXqw_XZFh2ovlFIE0",
    authDomain: "vos-album.firebaseapp.com",
    databaseURL: "https://vos-album-default-rtdb.firebaseio.com", 
    projectId: "vos-album",
    storageBucket: "vos-album.firebasestorage.app",
    messagingSenderId: "327624238972",
    appId: "1:327624238972:web:00603790e679efd07866f9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Variables de estado persistentes
let ROOM_ID = localStorage.getItem('vos_room_id') || null;
let MI_USER_ID = localStorage.getItem('vos_user_id') || null;

// --- AYUDANTE DE RUTAS (LA MAGIA) ---
// Todas las llamadas a DB usarán esta función. 
// Si no hay sala, pedimos el código antes.
const getRef = (path) => {
    if (!ROOM_ID) return null;
    return ref(db, `salas/${ROOM_ID}/${path}`);
};

// ... (resto de tus variables: datasetPersonas, miAlbum, etc)
let datasetPersonas = {};
let miAlbum = {};
// ...

document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificación de Sala
    if (!ROOM_ID) {
        document.getElementById('modal-sala').classList.remove('hidden');
        document.getElementById('btn-entrar-sala').addEventListener('click', () => {
            const code = document.getElementById('input-room-code').value.trim().toUpperCase();
            if (!code) return alert("Debes ingresar un código de sala.");
            localStorage.setItem('vos_room_id', code);
            ROOM_ID = code;
            document.getElementById('modal-sala').classList.add('hidden');
            iniciarFlujoApp();
        });
    } else {
        iniciarFlujoApp();
    }
});

function iniciarFlujoApp() {
    // Si ya existe usuario, cargamos, si no, abrimos registro
    if (!MI_USER_ID) {
        document.getElementById('modal-registro').classList.remove('hidden');
        // ... (tus listeners de registro igual que antes)
    } else {
        conectarBaseDeDatos();
    }
}

// --- TODAS TUS FUNCIONES SEGUIRÁN IGUAL, PERO CAMBIANDO EL ACCESO ---
// Ejemplo: Cambia todas tus llamadas de:
// ref(db, 'comunidad') -> getRef('comunidad')
// ref(db, 'albumes_usuarios/' + id) -> getRef('albumes_usuarios/' + id)

function conectarBaseDeDatos() {
    onValue(getRef('comunidad'), (snapshot) => {
        if (snapshot.exists()) {
            datasetPersonas = snapshot.val();
            generarEstructuraVisualAlbum();
            cargarProgresoUsuario();
        }
    });
}

// RECUERDA: En la función registrarNuevoUsuario, usa getRef también:
// set(getRef('comunidad/' + nuevoId), { ... })

// ... (Mantén el resto de tu lógica intacta, solo asegúrate de usar getRef)
