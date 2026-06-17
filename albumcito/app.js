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

let MI_USER_ID = localStorage.getItem('vos_user_id') || null;
let datasetPersonas = {};
let miAlbum = {};
let fotoBase64 = null; 
let streamCamara = null;
let html5QrcodeScanner = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!MI_USER_ID) {
        document.getElementById('modal-registro').classList.remove('hidden');
        document.getElementById('btn-guardar-perfil').addEventListener('click', registrarNuevoUsuario);
        document.getElementById('btn-activar-camara').addEventListener('click', activarCamaraRegistro);
        document.getElementById('btn-capturar-foto').addEventListener('click', capturarFotoRegistro);
    } else {
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
    }

    // BOTONERA DE NAVEGACIÓN
    document.getElementById('btn-ver-album').addEventListener('click', () => {
        document.getElementById('modal-mi-qr').classList.add('hidden');
        document.getElementById('modal-scanner').classList.add('hidden');
        detenerEscaneoCamara();
    });

    document.getElementById('open-pack-trigger').addEventListener('click', abrirSobre);
    
    document.getElementById('btn-mi-qr').addEventListener('click', mostrarMiQR);
    document.getElementById('close-qr-btn').addEventListener('click', () => {
        document.getElementById('modal-mi-qr').classList.add('hidden');
    });

    document.getElementById('btn-scan-qr').addEventListener('click', iniciarEscaneoCamara);
    document.getElementById('close-scanner-btn').addEventListener('click', detenerEscaneoCamara);
});

// --- CÁMARA FRONTAL Y REGISTRO ---
function activarCamaraRegistro() {
    const video = document.getElementById('video-feed');
    const placeholder = document.getElementById('foto-placeholder');
    const btnActivar = document.getElementById('btn-activar-camara');
    const btnCapturar = document.getElementById('btn-capturar-foto');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
    .then(stream => {
        streamCamara = stream; video.srcObject = stream;
        video.classList.remove('hidden'); placeholder.classList.add('hidden');
        btnActivar.classList.add('hidden'); btnCapturar.classList.remove('hidden');
    }).catch(err => alert("Fallo de cámara frontal."));
}

function capturarFotoRegistro() {
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('canvas-foto');
    const ctx = canvas.getContext('2d');
    canvas.width = 300; canvas.height = 300;
    
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2; const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 300, 300);
    fotoBase64 = canvas.toDataURL('image/jpeg', 0.6);

    if (streamCamara) streamCamara.getTracks().forEach(t => t.stop());
    video.classList.add('hidden'); canvas.classList.remove('hidden');
    document.getElementById('btn-capturar-foto').classList.add('hidden');
}

function registrarNuevoUsuario() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const rol = document.getElementById('reg-rol').value.trim();
    if (!nombre || !rol || !fotoBase64) return alert("Faltan datos o foto.");

    const nuevoId = 'user_' + Date.now();
    set(ref(db, `comunidad/${nuevoId}`), { nombre, rol, avatar: fotoBase64, color: "#ffffff" }).then(() => {
        localStorage.setItem('vos_user_id', nuevoId);
        MI_USER_ID = nuevoId;
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
    });
}

function conectarBaseDeDatos() {
    onValue(ref(db, 'comunidad'), (snapshot) => {
        if (snapshot.exists()) {
            datasetPersonas = snapshot.val();
            generarEstructuraVisualAlbum();
            cargarProgresoUsuario();
        }
    });
}

function generarEstructuraVisualAlbum() {
    const grid = document.querySelector('.album-grid');
    grid.innerHTML = ''; 
    Object.keys(datasetPersonas).forEach(id => {
        grid.insertAdjacentHTML('beforeend', `
            <div class="card locked" id="card-${id}">
                <div class="card-avatar">👤</div>
                <div class="card-info"><h3>???</h3><p>Bloqueado</p></div>
            </div>`);
    });
}

function cargarProgresoUsuario() {
    get(ref(db, `albumes_usuarios/${MI_USER_ID}`)).then((snapshot) => {
        miAlbum = snapshot.exists() ? snapshot.val() : {};
        Object.keys(datasetPersonas).forEach(id => { if (miAlbum[id] === undefined) miAlbum[id] = false; });
        actualizarInterfazAlbum();
    });
}

function actualizarInterfazAlbum() {
    let cartasPegadas = 0; let totalCartas = Object.keys(datasetPersonas).length;
    for (let id in miAlbum) {
        const cardElement = document.getElementById(`card-${id}`);
        if (!cardElement) continue;
        if (miAlbum[id] === true) {
            cartasPegadas++; const datos = datasetPersonas[id];
            cardElement.classList.remove('locked');
            if (datos.avatar && datos.avatar.startsWith('data:image')) {
                cardElement.querySelector('.card-avatar').innerHTML = `<img src="${datos.avatar}">`;
            }
            cardElement.querySelector('.card-info h3').innerText = datos.nombre;
            cardElement.querySelector('.card-info p').innerText = datos.rol;
        }
    }
    document.getElementById('counter').innerText = `${cartasPegadas}/${totalCartas}`;
}

// --- LÍMITE DE SOBRES (MAX 3 POR DÍA) ---
function abrirSobre() {
    const hoy = new Date().toDateString();
    let limite = JSON.parse(localStorage.getItem('vos_limite_sobres')) || { fecha: hoy, abiertos: 0 };
    
    if (limite.fecha !== hoy) limite = { fecha: hoy, abiertos: 0 }; // Resetea si es un nuevo día
    
    if (limite.abiertos >= 3) {
        alert("⏳ ¡Límite alcanzado! Abriste tus 3 sobres diarios. Escanea códigos QR para conseguir más figus hoy.");
        return;
    }

    const bloqueadas = Object.keys(miAlbum).filter(id => miAlbum[id] === false);
    if (bloqueadas.length === 0) return alert("¡Álbum completo!");

    const idGanado = bloqueadas[Math.floor(Math.random() * bloqueadas.length)];
    miAlbum[idGanado] = true;

    set(ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
        limite.abiertos++;
        localStorage.setItem('vos_limite_sobres', JSON.stringify(limite));
        actualizarInterfazAlbum();
        alert(`🎉 ¡Te tocó: ${datasetPersonas[idGanado].nombre}! (Sobres abiertos hoy: ${limite.abiertos}/3)`);
    });
}

// --- ESCÁNER Y QR ---
function mostrarMiQR() {
    const container = document.getElementById('qrcode-container');
    container.innerHTML = ""; 
    new QRCode(container, { text: MI_USER_ID, width: 180, height: 180 });
    document.getElementById('modal-mi-qr').classList.remove('hidden');
}

function iniciarEscaneoCamara() {
    document.getElementById('modal-scanner').classList.remove('hidden');
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, (decodedText) => {
        detenerEscaneoCamara(); procesarCromoEscaneado(decodedText);
    }).catch(() => { alert("Error al iniciar cámara."); detenerEscaneoCamara(); });
}

function detenerEscaneoCamara() {
    document.getElementById('modal-scanner').classList.add('hidden');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => html5QrcodeScanner = null).catch(e => console.log(e));
    }
}

function procesarCromoEscaneado(idEscaneado) {
    if (idEscaneado === MI_USER_ID) return alert("No te puedes escanear a vos mismo.");
    if (!datasetPersonas[idEscaneado]) return alert("QR no válido.");
    if (miAlbum[idEscaneado]) return alert("Ya tienes esta figu.");

    miAlbum[idEscaneado] = true;
    set(ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
        actualizarInterfazAlbum();
        alert(`🎉 ¡Desbloqueaste a: ${datasetPersonas[idEscaneado].nombre} cara a cara!`);
    });
}
