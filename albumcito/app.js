// --- IMPORTACIONES ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// --- CONFIGURACIÓN ---
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

// --- ESTADO GLOBAL ---
let ROOM_ID = localStorage.getItem('vos_room_id') || null;
let MI_USER_ID = localStorage.getItem('vos_user_id') || null;
let datasetPersonas = {};
let miAlbum = {};
let fotoBase64 = null; 
let streamCamara = null;
let html5QrcodeScanner = null;
let modoEscaneo = 'agregar_amigo';
let cartaATransferir = null;

// --- FUNCIÓN CLAVE: TODAS LAS CONSULTAS PASAN POR AQUÍ (SALA) ---
const getRef = (path) => ref(db, `salas/${ROOM_ID}/${path}`);

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificación de Sala
    if (!ROOM_ID) {
        document.getElementById('modal-sala')?.classList.remove('hidden');
        document.getElementById('btn-entrar-sala')?.addEventListener('click', entrarASala);
    } else {
        iniciarApp();
    }

    // 2. Eventos Globales de Navegación
    document.getElementById('btn-ver-album')?.addEventListener('click', (e) => {
        document.getElementById('modal-mi-qr')?.classList.add('hidden');
        document.getElementById('modal-scanner')?.classList.add('hidden');
        detenerEscaneoCamara();
        actualizarBotonActivo(e.currentTarget);
    });

    document.getElementById('open-pack-trigger')?.addEventListener('click', abrirSobre);
    
    document.getElementById('btn-mi-qr')?.addEventListener('click', (e) => {
        mostrarMiQR();
        actualizarBotonActivo(e.currentTarget);
    });
    
    document.getElementById('close-qr-btn')?.addEventListener('click', () => {
        document.getElementById('modal-mi-qr')?.classList.add('hidden');
        actualizarBotonActivo(document.getElementById('btn-ver-album'));
    });

    document.getElementById('btn-scan-qr')?.addEventListener('click', (e) => {
        modoEscaneo = 'agregar_amigo';
        const titulo = document.querySelector('#modal-scanner h2');
        if(titulo) titulo.innerText = "Escanea a un compañero";
        iniciarEscaneoCamara();
        actualizarBotonActivo(e.currentTarget);
    });
    
    document.getElementById('close-scanner-btn')?.addEventListener('click', () => {
        detenerEscaneoCamara();
        actualizarBotonActivo(document.getElementById('btn-ver-album'));
    });

    // Delegación para botones de transferencia
    document.querySelector('.album-grid')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-transferir')) {
            iniciarTransferencia(e.target.getAttribute('data-id'));
        }
    });

    // Botón registro
    document.getElementById('btn-guardar-perfil')?.addEventListener('click', registrarNuevoUsuario);
    document.getElementById('btn-activar-camara')?.addEventListener('click', activarCamaraRegistro);
    document.getElementById('btn-capturar-foto')?.addEventListener('click', capturarFotoRegistro);
});

// --- LÓGICA DE SALA Y APP ---
function entrarASala() {
    const input = document.getElementById('input-room-code');
    if(!input || !input.value.trim()) return alert("Ingresa un código de sala");
    ROOM_ID = input.value.trim().toUpperCase();
    localStorage.setItem('vos_room_id', ROOM_ID);
    document.getElementById('modal-sala').classList.add('hidden');
    iniciarApp();
}

function iniciarApp() {
    if (!MI_USER_ID) {
        document.getElementById('modal-registro')?.classList.remove('hidden');
    } else {
        conectarBaseDeDatos();
    }
}

function conectarBaseDeDatos() {
    onValue(getRef('comunidad'), (snapshot) => {
        if (snapshot.exists()) {
            datasetPersonas = snapshot.val();
            generarEstructuraVisualAlbum();
            cargarProgresoUsuario();
        }
    });
}

// --- REGISTRO Y CÁMARA ---
function registrarNuevoUsuario() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const rol = document.getElementById('reg-rol').value.trim();
    if (!nombre || !rol || !fotoBase64) return alert("Faltan datos o foto.");

    MI_USER_ID = 'user_' + Date.now();
    localStorage.setItem('vos_user_id', MI_USER_ID);

    set(getRef('comunidad/' + MI_USER_ID), { nombre, rol, avatar: fotoBase64 }).then(() => {
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
    });
}

function activarCamaraRegistro() {
    const video = document.getElementById('video-feed');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
    .then(stream => {
        streamCamara = stream;
        video.srcObject = stream;
        video.classList.remove('hidden');
        document.getElementById('foto-placeholder').classList.add('hidden');
        document.getElementById('btn-capturar-foto').classList.remove('hidden');
    }).catch(err => alert("Fallo de cámara."));
}

function capturarFotoRegistro() {
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('canvas-foto');
    const ctx = canvas.getContext('2d');
    canvas.width = 300; canvas.height = 300;
    ctx.drawImage(video, 0, 0, 300, 300);
    fotoBase64 = canvas.toDataURL('image/jpeg', 0.6);
    if (streamCamara) streamCamara.getTracks().forEach(t => t.stop());
    video.classList.add('hidden');
    canvas.classList.remove('hidden');
    document.getElementById('btn-capturar-foto').classList.add('hidden');
}

// --- ÁLBUM Y LÓGICA ---
function cargarProgresoUsuario() {
    get(getRef('albumes_usuarios/' + MI_USER_ID)).then((snapshot) => {
        let datosAlbum = snapshot.exists() ? snapshot.val() : {};
        Object.keys(datasetPersonas).forEach(id => {
            miAlbum[id] = datosAlbum[id] || 0;
        });
        actualizarInterfazAlbum();
    });
}

function actualizarInterfazAlbum() {
    let cartasPegadas = 0;
    const grid = document.querySelector('.album-grid');
    if(!grid) return;
    
    // Renderizado básico
    grid.innerHTML = '';
    Object.keys(datasetPersonas).forEach(id => {
        const tiene = miAlbum[id] || 0;
        const datos = datasetPersonas[id];
        
        const html = `
            <div class="card ${tiene > 0 ? '' : 'locked'}" id="card-${id}">
                ${tiene > 1 ? `<div class="badge-cantidad">x${tiene}</div>` : ''}
                <div class="card-avatar">${tiene > 0 ? `<img src="${datos.avatar}">` : '👤'}</div>
                <div class="card-info">
                    <h3>${tiene > 0 ? datos.nombre : '???'}</h3>
                    <p>${tiene > 0 ? datos.rol : 'Bloqueado'}</p>
                    ${tiene > 1 ? `<button class="btn-transferir" data-id="${id}">🔄 Transferir</button>` : ''}
                </div>
            </div>`;
        grid.insertAdjacentHTML('beforeend', html);
        if(tiene > 0) cartasPegadas++;
    });
    const counter = document.getElementById('counter');
    if(counter) counter.innerText = `${cartasPegadas}/${Object.keys(datasetPersonas).length}`;
}

function abrirSobre() {
    const todosLosIds = Object.keys(datasetPersonas);
    const idGanado = todosLosIds[Math.floor(Math.random() * todosLosIds.length)];
    miAlbum[idGanado] = (miAlbum[idGanado] || 0) + 1;

    set(getRef('albumes_usuarios/' + MI_USER_ID), miAlbum).then(() => {
        actualizarInterfazAlbum();
        alert(`🎉 ¡Te tocó: ${datasetPersonas[idGanado].nombre}!`);
    });
}

// --- ESCÁNER Y TRANSFERENCIAS ---
function iniciarTransferencia(idCromo) {
    modoEscaneo = 'transferir';
    cartaATransferir = idCromo;
    const titulo = document.querySelector('#modal-scanner h2');
    if(titulo) titulo.innerText = `Escanea el QR para enviar a: ${datasetPersonas[idCromo].nombre}`;
    iniciarEscaneoCamara();
}

function iniciarEscaneoCamara() {
    document.getElementById('modal-scanner').classList.remove('hidden');
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (txt) => {
        detenerEscaneoCamara();
        procesarCromoEscaneado(txt);
    });
}

function detenerEscaneoCamara() {
    document.getElementById('modal-scanner').classList.add('hidden');
    if (html5QrcodeScanner) html5QrcodeScanner.stop().catch(()=>{});
}

function procesarCromoEscaneado(idEscaneado) {
    if (idEscaneado === MI_USER_ID) return alert("No puedes escanearte a ti mismo.");
    if (!datasetPersonas[idEscaneado]) return alert("QR no válido en esta sala.");

    if (modoEscaneo === 'agregar_amigo') {
        if (miAlbum[idEscaneado] > 0) return alert("Ya tienes esta carta.");
        miAlbum[idEscaneado] = 1;
        set(getRef('albumes_usuarios/' + MI_USER_ID), miAlbum).then(actualizarInterfazAlbum);
    } 
    else if (modoEscaneo === 'transferir') {
        if (miAlbum[cartaATransferir] <= 1) return alert("No tienes suficientes copias.");
        miAlbum[cartaATransferir]--;

        const refReceptor = getRef('albumes_usuarios/' + idEscaneado + '/' + cartaATransferir);
        get(refReceptor).then(snap => {
            const cant = snap.exists() ? snap.val() : 0;
            set(refReceptor, cant + 1).then(() => {
                set(getRef('albumes_usuarios/' + MI_USER_ID), miAlbum).then(actualizarInterfazAlbum);
            });
        });
    }
}

function mostrarMiQR() {
    const container = document.getElementById('qrcode-container');
    if (!container) return;
    container.innerHTML = "";
    new QRCode(container, { text: MI_USER_ID, width: 180, height: 180 });
    document.getElementById('modal-mi-qr').classList.remove('hidden');
}

function actualizarBotonActivo(btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
}
