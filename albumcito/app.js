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

// Estado Global
let ROOM_ID = localStorage.getItem('vos_room_id') || null;
let MI_USER_ID = localStorage.getItem('vos_user_id') || null;
let datasetPersonas = {};
let miAlbum = {};
let fotoBase64 = null; 
let streamCamara = null;

// Función de rutas
const getRef = (path) => ref(db, `salas/${ROOM_ID}/${path}`);

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Manejo de URL (Deep link)
    const urlParams = new URLSearchParams(window.location.search);
    const salaEnUrl = urlParams.get('sala');
    if (salaEnUrl) {
        localStorage.setItem('vos_room_id', salaEnUrl.toUpperCase());
        ROOM_ID = salaEnUrl.toUpperCase();
        window.history.replaceState({}, document.title, "/");
    }

    // 2. Conectar listeners de interfaz (Cámara, Registro, Botones)
    conectarListeners();

    // 3. Flujo principal
    if (!ROOM_ID) {
        document.getElementById('modal-sala').classList.remove('hidden');
    } else if (!MI_USER_ID) {
        document.getElementById('modal-registro').classList.remove('hidden');
    } else {
        conectarBaseDeDatos();
    }
});

// --- LISTENERS (Donde vive la lógica de tus botones) ---
function conectarListeners() {
    // Botones de Sala
    document.getElementById('btn-entrar-sala').addEventListener('click', entrarASala);
    document.getElementById('btn-cambiar-sala')?.addEventListener('click', () => {
        localStorage.removeItem('vos_room_id');
        localStorage.removeItem('vos_user_id');
        location.reload();
    });

    // Botones de Registro/Cámara
    document.getElementById('btn-registrar').addEventListener('click', registrarNuevoUsuario);
    document.getElementById('btn-activar-camara').addEventListener('click', iniciarCamara);
    document.getElementById('btn-capturar-foto').addEventListener('click', capturarFoto);
}

// --- FUNCIONES DE CÁMARA ---
async function iniciarCamara() {
    try {
        streamCamara = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        const video = document.getElementById('video-feed');
        video.srcObject = streamCamara;
        video.classList.remove('hidden');
        document.getElementById('foto-placeholder').classList.add('hidden');
    } catch (e) { alert("Error al activar cámara"); }
}

function capturarFoto() {
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('canvas-foto');
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    fotoBase64 = canvas.toDataURL('image/png');
    canvas.classList.remove('hidden');
    video.classList.add('hidden');
    if (streamCamara) streamCamara.getTracks().forEach(t => t.stop());
}

// --- FUNCIONES DE LOGICA ---
function entrarASala() {
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    if (!code) return alert("Ingresa un código");
    localStorage.setItem('vos_room_id', code);
    ROOM_ID = code;
    document.getElementById('modal-sala').classList.add('hidden');
    document.getElementById('modal-registro').classList.remove('hidden');
}

function registrarNuevoUsuario() {
    const nombre = document.getElementById('reg-nombre').value;
    const rol = document.getElementById('reg-rol').value;
    if (!nombre || !fotoBase64) return alert("Faltan datos");
    
    MI_USER_ID = 'user_' + Date.now();
    localStorage.setItem('vos_user_id', MI_USER_ID);
    
    set(getRef('comunidad/' + MI_USER_ID), { nombre, rol, foto: fotoBase64 })
    .then(() => {
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
    });
}

function conectarBaseDeDatos() {
    onValue(getRef('comunidad'), (snap) => { datasetPersonas = snap.val() || {}; });
    onValue(getRef('albumes_usuarios/' + MI_USER_ID), (snap) => { 
        miAlbum = snap.val() || {};
        // Aquí llamarías a tu función que pinta las cartas
    });
}
