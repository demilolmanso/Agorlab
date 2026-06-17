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

// --- ESTADO ---
let ROOM_ID = localStorage.getItem('vos_room_id') || null;
let MI_USER_ID = localStorage.getItem('vos_user_id') || null;
let datasetPersonas = {};
let miAlbum = {};
let fotoBase64 = null; 
let html5QrcodeScanner = null;

// --- RUTA ÚNICA ---
const getRef = (path) => ref(db, `salas/${ROOM_ID}/${path}`);

document.addEventListener("DOMContentLoaded", () => {
    // 1. Check Sala
    if (!ROOM_ID) {
        document.getElementById('modal-sala').classList.remove('hidden');
        document.getElementById('btn-entrar-sala').addEventListener('click', () => {
            const code = document.getElementById('input-room-code').value.trim().toUpperCase();
            if(!code) return alert("Pon un código");
            localStorage.setItem('vos_room_id', code);
            location.reload();
        });
    } else {
        iniciarApp();
    }
});

function iniciarApp() {
    // Si ya tiene usuario, arranca, si no, registro
    if (!MI_USER_ID) {
        document.getElementById('modal-registro').classList.remove('hidden');
        document.getElementById('btn-guardar-perfil').addEventListener('click', registrarNuevoUsuario);
        document.getElementById('btn-activar-camara').addEventListener('click', activarCamara);
        document.getElementById('btn-capturar-foto').addEventListener('click', capturarFoto);
    } else {
        conectarBaseDeDatos();
    }
}

function registrarNuevoUsuario() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const rol = document.getElementById('reg-rol').value.trim();
    if (!nombre || !fotoBase64) return alert("Faltan datos o foto");

    MI_USER_ID = 'user_' + Date.now();
    localStorage.setItem('vos_user_id', MI_USER_ID);

    // GUARDAR EN LA SALA
    set(getRef('comunidad/' + MI_USER_ID), { 
        nombre: nombre, 
        rol: rol, 
        avatar: fotoBase64 
    }).then(() => {
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
    }).catch(e => console.error("Error al registrar:", e));
}

function conectarBaseDeDatos() {
    console.log("Conectando a sala:", ROOM_ID);
    // LEER DE LA MISMA SALA
    onValue(getRef('comunidad'), (snapshot) => {
        if (snapshot.exists()) {
            datasetPersonas = snapshot.val();
            console.log("Datos recibidos:", datasetPersonas);
            renderizarAlbum();
            cargarProgreso();
        } else {
            console.log("No hay usuarios en esta sala aún.");
        }
    });
}

function renderizarAlbum() {
    const grid = document.querySelector('.album-grid');
    grid.innerHTML = '';
    
    Object.keys(datasetPersonas).forEach(id => {
        const persona = datasetPersonas[id];
        grid.insertAdjacentHTML('beforeend', `
            <div class="card locked" id="card-${id}">
                <div class="card-avatar">👤</div>
                <div class="card-info">
                    <h3>${persona.nombre}</h3>
                    <p>${persona.rol}</p>
                </div>
            </div>
        `);
    });
}

function cargarProgreso() {
    get(getRef('albumes_usuarios/' + MI_USER_ID)).then(snap => {
        const data = snap.exists() ? snap.val() : {};
        // Actualizar visual de cartas desbloqueadas
        Object.keys(data).forEach(id => {
            const card = document.getElementById(`card-${id}`);
            if(card) {
                card.classList.remove('locked');
                card.querySelector('.card-avatar').innerHTML = `<img src="${datasetPersonas[id].avatar}">`;
            }
        });
    });
}

// --- CÁMARA (Simplificada) ---
function activarCamara() {
    navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
        const video = document.getElementById('video-feed');
        video.srcObject = s;
        video.classList.remove('hidden');
        document.getElementById('btn-capturar-foto').classList.remove('hidden');
    });
}

function capturarFoto() {
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('canvas-foto');
    canvas.getContext('2d').drawImage(video, 0, 0, 300, 300);
    fotoBase64 = canvas.toDataURL('image/jpeg', 0.5);
    canvas.classList.remove('hidden');
    video.classList.add('hidden');
}
