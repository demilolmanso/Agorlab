// 1. IMPORTACIONES
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

// 2. ESTADO GLOBAL
let ROOM_ID = localStorage.getItem('vos_room_id') || null;
let MI_USER_ID = localStorage.getItem('vos_user_id') || null;
let datasetPersonas = {};
let miAlbum = {};
let fotoBase64 = null; 
let streamCamara = null;
let html5QrcodeScanner = null;
let modoEscaneo = 'agregar_amigo'; 
let cartaATransferir = null;

// --- FUNCIÓN CLAVE: getRef ---
// Esta función le pone el prefijo de la sala a cualquier ruta de la DB
const getRef = (path) => {
    return ref(db, `salas/${ROOM_ID}/${path}`);
};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificar si hay Sala configurada
    if (!ROOM_ID) {
        document.getElementById('modal-sala').classList.remove('hidden');
        document.getElementById('btn-entrar-sala').addEventListener('click', entrarASala);
    } else {
        iniciarApp();
    }
});

function entrarASala() {
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    if (!code) return alert("Ingresa un código válido.");
    
    localStorage.setItem('vos_room_id', code);
    ROOM_ID = code;
    document.getElementById('modal-sala').classList.add('hidden');
    iniciarApp();
}

function iniciarApp() {
    // 1. Mostrar el registro si no hay usuario
    if (!MI_USER_ID) {
        document.getElementById('modal-registro').classList.remove('hidden');
        
        // --- CONECTAR BOTONES DE REGISTRO ---
        document.getElementById('btn-registrar').addEventListener('click', registrarNuevoUsuario);
        
        // --- CONECTAR BOTONES DE CÁMARA (Faltaba esto) ---
        document.getElementById('btn-activar-camara').addEventListener('click', iniciarCamara);
        document.getElementById('btn-capturar-foto').addEventListener('click', capturarFoto);
        
    } else {
        conectarBaseDeDatos();
    }
}

function conectarBaseDeDatos() {
    // Usamos getRef para aislar los datos a la SALA actual
    onValue(getRef('comunidad'), (snapshot) => {
        if (snapshot.exists()) {
            datasetPersonas = snapshot.val();
            actualizarInterfazAlbum();
        }
    });

    if (MI_USER_ID) {
        onValue(getRef('albumes_usuarios/' + MI_USER_ID), (snapshot) => {
            miAlbum = snapshot.exists() ? snapshot.val() : {};
            actualizarInterfazAlbum();
        });
    }
}

// 3. REGISTRO (Adaptado)
function registrarNuevoUsuario() {
    const nombre = document.getElementById('reg-nombre').value;
    const rol = document.getElementById('reg-rol').value;
    if (!nombre || !rol || !fotoBase64) return alert("Faltan datos o foto.");

    const nuevoId = 'user_' + Date.now();
    MI_USER_ID = nuevoId;
    localStorage.setItem('vos_user_id', nuevoId);

    // Guardar en la ruta de la sala actual
    set(getRef('comunidad/' + nuevoId), {
        nombre, rol, foto: fotoBase64
    }).then(() => {
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
    });
}

// 4. LÓGICA DE ESCANEO (Adaptada)
function procesarCromoEscaneado(idEscaneado) {
    if (idEscaneado === MI_USER_ID) return alert("¡No puedes escanearte a ti mismo!");
    if (!datasetPersonas[idEscaneado]) return alert("Código no reconocido en esta sala.");

    if (modoEscaneo === 'agregar_amigo') {
        if (miAlbum[idEscaneado]) return alert("Ya tienes esta carta.");
        
        miAlbum[idEscaneado] = true;
        set(getRef('albumes_usuarios/' + MI_USER_ID), miAlbum).then(() => {
            actualizarInterfazAlbum();
        });
    } 
    else if (modoEscaneo === 'transferir') {
        // Lógica de transferencia usando getRef para el receptor
        const refReceptor = getRef('albumes_usuarios/' + idEscaneado);
        get(refReceptor).then(snap => {
            // ... (tu lógica de transferencia original)
            // Asegúrate de usar getRef para el set del álbum de MI_USER_ID también
            set(getRef('albumes_usuarios/' + MI_USER_ID), miAlbum);
        });
    }
}

// 5. FUNCIONES DE INTERFAZ (Sin cambios, solo llamar a actualizarInterfaz)
function actualizarInterfazAlbum() {
    // Tu código para renderizar el grid .album-grid
    // ...
}

// (Manten el resto de tus funciones de cámara, Qr, etc. tal cual)

document.addEventListener("DOMContentLoaded", () => {
    // 1. ¿Viene un código por la URL?
    const urlParams = new URLSearchParams(window.location.search);
    const salaEnUrl = urlParams.get('sala');
    
    if (salaEnUrl) {
        localStorage.setItem('vos_room_id', salaEnUrl.toUpperCase());
        ROOM_ID = salaEnUrl.toUpperCase();
        window.history.replaceState({}, document.title, "/"); // Limpiamos la URL
    }

    // 2. Lógica normal de chequeo
    if (!ROOM_ID) {
        document.getElementById('modal-sala').classList.remove('hidden');
        // ... resto de tu código
    } else {
        iniciarApp();
    }
});

document.getElementById('btn-cambiar-sala').addEventListener('click', () => {
    if (confirm("¿Quieres salir de esta sala? Se cerrará tu sesión actual.")) {
        // Limpiamos los rastros
        localStorage.removeItem('vos_room_id');
        localStorage.removeItem('vos_user_id');
        
        // Recargamos la app para que vuelva a pedir la sala
        location.reload(); 
    }
});

async function iniciarCamara() {
    try {
        const video = document.getElementById('video-feed');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        streamCamara = stream;
        video.srcObject = stream;
        video.classList.remove('hidden');
        document.getElementById('foto-placeholder').classList.add('hidden');
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        alert("No se pudo acceder a la cámara. Revisa los permisos.");
    }
}

function capturarFoto() {
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('canvas-foto');
    const context = canvas.getContext('2d');

    // Ajustar tamaño del canvas al video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Guardar en base64
    fotoBase64 = canvas.toDataURL('image/png');
    
    // Mostrar resultado
    canvas.classList.remove('hidden');
    video.classList.add('hidden');
    
    // Detener cámara
    if (streamCamara) {
        streamCamara.getTracks().forEach(track => track.stop());
    }
}
