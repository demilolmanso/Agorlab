// 1. IMPORTAMOS LAS FUNCIONES ESPECÍFICAS DE FIREBASE (Versión 12.15.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// 2. TUS CREDENCIALES REALES
const firebaseConfig = {
    apiKey: "AIzaSyBm8N4Rw03An_kOUJNXqw_XZFh2ovlFIE0",
    authDomain: "vos-album.firebaseapp.com",
    databaseURL: "https://vos-album-default-rtdb.firebaseio.com", 
    projectId: "vos-album",
    storageBucket: "vos-album.firebasestorage.app",
    messagingSenderId: "327624238972",
    appId: "1:327624238972:web:00603790e679efd07866f9"
};

// Inicializamos Firebase y la Base de Datos
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Variables globales de sesión
let MI_USER_ID = localStorage.getItem('vos_user_id') || null;
let datasetPersonas = {};
let miAlbum = {};
let fotoBase64 = null; 
let streamCamara = null;
let html5QrcodeScanner = null;

// CONTROL DE ARRANQUE CENTRAL
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

    // --- ARREGLO Y VINCULACIÓN DE BOTONES DE NAVEGACIÓN ---

    // Botón "📖 Álbum"
    document.getElementById('btn-ver-album').addEventListener('click', (e) => {
        detenerEscaneoCamara();
        document.getElementById('modal-mi-qr').classList.add('hidden');
        
        // Manejar luces activas en barra de navegación
        actualizarBotonActivo(e.currentTarget);
    });

    // Botón "✨ Sobre"
    document.getElementById('open-pack-trigger').addEventListener('click', abrirSobre);

    // Botón "🪪 Mi QR"
    document.getElementById('btn-mi-qr').addEventListener('click', (e) => {
        detenerEscaneoCamara();
        mostrarMiQR();
        actualizarBotonActivo(e.currentTarget);
    });
    
    document.getElementById('close-qr-btn').addEventListener('click', () => {
        document.getElementById('modal-mi-qr').classList.add('hidden');
        actualizarBotonActivo(document.getElementById('btn-ver-album'));
    });

    // Botón "📷 Escanear"
    document.getElementById('btn-scan-qr').addEventListener('click', (e) => {
        document.getElementById('modal-mi-qr').classList.add('hidden');
        iniciarEscaneoCamara();
        actualizarBotonActivo(e.currentTarget);
    });
    
    document.getElementById('close-scanner-btn').addEventListener('click', () => {
        detenerEscaneoCamara();
        actualizarBotonActivo(document.getElementById('btn-ver-album'));
    });
});

function actualizarBotonActivo(elementoBoton) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    elementoBoton.classList.add('active');
}

// --- SISTEMA DE FOTO SELFIE ---
function activarCamaraRegistro() {
    const video = document.getElementById('video-feed');
    const placeholder = document.getElementById('foto-placeholder');
    const btnActivar = document.getElementById('btn-activar-camara');
    const btnCapturar = document.getElementById('btn-capturar-foto');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
    .then(stream => {
        streamCamara = stream;
        video.srcObject = stream;
        video.classList.remove('hidden');
        placeholder.classList.add('hidden');
        btnActivar.classList.add('hidden');
        btnCapturar.classList.remove('hidden');
    })
    .catch(err => {
        alert("[ERROR]: Fallo de hardware en cámara frontal.");
    });
}

function capturarFotoRegistro() {
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('canvas-foto');
    const btnCapturar = document.getElementById('btn-capturar-foto');
    const btnActivar = document.getElementById('btn-activar-camara');

    const ctx = canvas.getContext('2d');
    canvas.width = 300;
    canvas.height = 300;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    ctx.drawImage(video, sx, sy, size, size, 0, 0, 300, 300);
    fotoBase64 = canvas.toDataURL('image/jpeg', 0.6);

    if (streamCamara) {
        streamCamara.getTracks().forEach(track => track.stop());
    }

    video.classList.add('hidden');
    canvas.classList.remove('hidden');
    btnCapturar.classList.add('hidden');
    btnActivar.classList.remove('hidden');
    btnActivar.innerText = "> REPETIR";
}

function registrarNuevoUsuario() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const rol = document.getElementById('reg-rol').value.trim();

    if (!nombre || !rol) { alert("[WARN]: Campos vacíos."); return; }
    if (!fotoBase64) { alert("[WARN]: Requiere captura de imagen."); return; }

    const nuevoId = 'user_' + Date.now();
    const datosCromo = { nombre, rol, avatar: fotoBase64, color: "#ca630e" };

    set(ref(db, `comunidad/${nuevoId}`), datosCromo).then(() => {
        localStorage.setItem('vos_user_id', nuevoId);
        MI_USER_ID = nuevoId;
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
        alert("[OK]: Cromo inyectado.");
    });
}

function conectarBaseDeDatos() {
    const dbRefComunidad = ref(db, 'comunidad');
    onValue(dbRefComunidad, (snapshot) => {
        if (snapshot.exists()) {
            datasetPersonas = snapshot.val();
            generarEstructuraVisualAlbum();
            cargarProgresoUsuario();
        } else {
            inicializarBaseDeDatosSemilla();
        }
    });
}

function generarEstructuraVisualAlbum() {
    const grid = document.querySelector('.album-grid');
    grid.innerHTML = ''; 

    Object.keys(datasetPersonas).forEach(id => {
        const cardHTML = `
            <div class="card locked" id="card-${id}">
                <div class="card-avatar">👤</div>
                <div class="card-info">
                    <h3>???</h3>
                    <p>Bloqueado</p>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function cargarProgresoUsuario() {
    const dbRefProgreso = ref(db, `albumes_usuarios/${MI_USER_ID}`);
    get(dbRefProgreso).then((snapshot) => {
        miAlbum = snapshot.exists() ? snapshot.val() : {};
        Object.keys(datasetPersonas).forEach(id => {
            if (miAlbum[id] === undefined) miAlbum[id] = false;
        });
        actualizarInterfazAlbum();
    });
}

function actualizarInterfazAlbum() {
    let cartasPegadas = 0;
    let totalCartas = Object.keys(datasetPersonas).length;

    for (let id in miAlbum) {
        const cardElement = document.getElementById(`card-${id}`);
        if (!cardElement) continue;

        if (miAlbum[id] === true) {
            cartasPegadas++;
            const datos = datasetPersonas[id];
            
            cardElement.classList.remove('locked');
            cardElement.style.borderColor = datos.color || "#ca630e";
            
            if (datos.avatar && datos.avatar.startsWith('data:image')) {
                cardElement.querySelector('.card-avatar').innerHTML = `<img src="${datos.avatar}">`;
            } else {
                cardElement.querySelector('.card-avatar').innerText = datos.avatar || "👤";
            }
            
            cardElement.querySelector('.card-info h3').innerText = datos.nombre;
            cardElement.querySelector('.card-info p').innerText = datos.rol;
        }
    }
    document.getElementById('counter').innerText = `${cartasPegadas}/${totalCartas}`;
}

function abrirSobre() {
    const bloqueadas = Object.keys(miAlbum).filter(id => miAlbum[id] === false);
    if (bloqueadas.length === 0) {
        alert("¡Álbum completo!");
        return;
    }
    const randomIndex = Math.floor(Math.random() * bloqueadas.length);
    const idGanado = bloqueadas[randomIndex];
    miAlbum[idGanado] = true;

    set(ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
        actualizarInterfazAlbum();
        alert(`🎉 ¡Te tocó: ${datasetPersonas[idGanado].nombre}!`);
    });
}

function inicializarBaseDeDatosSemilla() {
    const semilla = {
        "u1": { nombre: "Alan Agor", rol: "Fundador", avatar: "🚀", color: "#ca630e" },
        "u2": { nombre: "Sofía Dev", rol: "Programadora", avatar: "💻", color: "#ca630e" }
    };
    set(ref(db, 'comunidad'), semilla);
}

// --- ESCÁNER Y QR ---
function mostrarMiQR() {
    const container = document.getElementById('qrcode-container');
    container.innerHTML = ""; 
    new QRCode(container, {
        text: MI_USER_ID,
        width: 180,
        height: 180,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
    document.getElementById('modal-mi-qr').classList.remove('hidden');
}

function iniciarEscaneoCamara() {
    document.getElementById('modal-scanner').classList.remove('hidden');
    html5QrcodeScanner = new Html5Qrcode("reader");
    
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        detenerEscaneoCamara();
        procesarCromoEscaneado(decodedText);
        actualizarBotonActivo(document.getElementById('btn-ver-album'));
    };
    
    html5QrcodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, qrCodeSuccessCallback)
    .catch((err) => {
        alert("Error cámara trasera.");
        detenerEscaneoCamara();
    });
}

function detenerEscaneoCamara() {
    document.getElementById('modal-scanner').classList.add('hidden');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => { html5QrcodeScanner = null; }).catch(err => console.log(err));
    }
}

function procesarCromoEscaneado(idEscaneado) {
    if (idEscaneado === MI_USER_ID) { alert("No te puedes escanear a ti mismo."); return; }
    if (datasetPersonas[idEscaneado] === undefined) { alert("Código QR no registrado."); return; }
    if (miAlbum[idEscaneado] === true) { alert(`Ya tienes a ${datasetPersonas[idEscaneado].nombre}`); return; }

    miAlbum[idEscaneado] = true;
    import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js").then((FB) => {
        FB.set(FB.ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
            actualizarInterfazAlbum();
            alert(`🎉 ¡Desbloqueado!: ${datasetPersonas[idEscaneado].nombre}`);
        });
    });
}
