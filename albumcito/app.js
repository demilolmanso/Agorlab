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

// Revisamos si el usuario ya se registró alguna vez en este dispositivo
let MI_USER_ID = localStorage.getItem('vos_user_id') || null;

let datasetPersonas = {};
let miAlbum = {};
let fotoBase64 = null; // Almacenará el stream de la imagen optimizada
let streamCamara = null;

// CONTROL DE ARRANQUE (Paso 5.3 + Cámara Selfie)
document.addEventListener("DOMContentLoaded", () => {
    if (!MI_USER_ID) {
        // Obligar registro si no existe sesión
        document.getElementById('modal-registro').classList.remove('hidden');
        document.getElementById('btn-guardar-perfil').addEventListener('click', registrarNuevoUsuario);
        
        // Listeners para el hardware de la cámara
        document.getElementById('btn-activar-camara').addEventListener('click', activarCamaraRegistro);
        document.getElementById('btn-capturar-foto').addEventListener('click', capturarFotoRegistro);
    } else {
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
    }

    // Inicializar listeners globales
    document.getElementById('open-pack-trigger').addEventListener('click', abrirSobre);
    document.getElementById('btn-mi-qr').addEventListener('click', mostrarMiQR);
    document.getElementById('close-qr-btn').addEventListener('click', () => {
        document.getElementById('modal-mi-qr').classList.add('hidden');
    });
    document.getElementById('btn-scan-qr').addEventListener('click', iniciarEscaneoCamara);
    document.getElementById('close-scanner-btn').addEventListener('click', detenerEscaneoCamara);
});

// --- SISTEMA DE CAPTURA MULTIMEDIA (CÁMARA SELFIE) ---

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
        console.error("Fallo de hardware en cámara frontal: ", err);
        alert("[ERROR]: No se pudo acceder a la cámara frontal de la consola.");
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

    // Procesar encuadre simétrico (1:1 Aspect Ratio)
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    ctx.drawImage(video, sx, sy, size, size, 0, 0, 300, 300);

    // Compresión del buffer de imagen para optimizar almacenamiento en Realtime Database
    fotoBase64 = canvas.toDataURL('image/jpeg', 0.6);

    // Liberar recursos de la cámara
    if (streamCamara) {
        streamCamara.getTracks().forEach(track => track.stop());
    }

    video.classList.add('hidden');
    canvas.classList.remove('hidden');
    btnCapturar.classList.add('hidden');
    btnActivar.classList.remove('hidden');
    btnActivar.innerText = "> REPETIR_CAPTURA";
}

// CREACIÓN DE PERFIL E INYECCIÓN EN FIREBASE
function registrarNuevoUsuario() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const rol = document.getElementById('reg-rol').value.trim();

    if (!nombre || !rol) {
        alert("[WARN]: Datos incompletos detectados.");
        return;
    }
    if (!fotoBase64) {
        alert("[WARN]: Se requiere captura biométrica para emitir el cromo.");
        return;
    }

    const nuevoId = 'user_' + Date.now();
    const datosCromo = { nombre, rol, avatar: fotoBase64, color: "#ca630e" };

    set(ref(db, `comunidad/${nuevoId}`), datosCromo).then(() => {
        localStorage.setItem('vos_user_id', nuevoId);
        MI_USER_ID = nuevoId;

        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
        alert("[OK]: Cromo impreso en la base de datos de Agorlab. 🎉");
    }).catch(err => {
        console.error("Fallo de enlace con Firebase: ", err);
        alert("[ERROR]: Fallo crítico en la inyección de datos.");
    });
}

// CONECTAR Y ESCUCHAR LOS CAMBIOS DE LA COMUNIDAD EN TIEMPO REAL
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

// Generar los espacios en el álbum dinámicamente según la gente que haya en la nube
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

// 4. CARGAR LAS FIGURITAS QUE ESTE USUARIO YA TIENE GUARDADAS EN LA NUBE
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

// 5. RENDERIZADO AVANZADO (FOTO EN BASE64 O TEXTO SEMILLA)
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
            
            // Discriminador de tipo de renderizado para el Avatar
            if (datos.avatar && datos.avatar.startsWith('data:image')) {
                cardElement.querySelector('.card-avatar').innerHTML = `<img src="${datos.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            } else {
                cardElement.querySelector('.card-avatar').innerText = datos.avatar || "👤";
            }
            
            cardElement.querySelector('.card-info h3').innerText = datos.nombre;
            cardElement.querySelector('.card-info p').innerText = datos.rol;
        }
    }
    document.getElementById('counter').innerText = `${cartasPegadas}/${totalCartas}`;
}

// 6. LÓGICA DE APERTURA DE SOBRES RANDOM CONECTADA A TU FIREBASE
function abrirSobre() {
    const bloqueadas = Object.keys(miAlbum).filter(id => miAlbum[id] === false);

    if (bloqueadas.length === 0) {
        alert("¡Álbum completo o no hay nuevos usuarios registrados en la base de datos!");
        return;
    }

    const randomIndex = Math.floor(Math.random() * bloqueadas.length);
    const idGanado = bloqueadas[randomIndex];

    miAlbum[idGanado] = true;

    set(ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
        const cardElement = document.getElementById(`card-${idGanado}`);
        if (cardElement) {
            cardElement.style.transform = "scale(1.1)";
            setTimeout(() => {
                cardElement.style.transform = "scale(1)";
                actualizarInterfazAlbum();
                alert(`🎉 ¡Te tocó: ${datasetPersonas[idGanado].nombre}!`);
            }, 200);
        }
    });
}

function inicializarBaseDeDatosSemilla() {
    const semilla = {
        "u1": { nombre: "Alan Agor", rol: "Fundador", avatar: "🚀", color: "#ca630e" },
        "u2": { nombre: "Sofía Dev", rol: "Programadora", avatar: "💻", color: "#ca630e" },
        "u3": { nombre: "Carlos UX", rol: "Diseñador", avatar: "🎨", color: "#ca630e" }
    };
    set(ref(db, 'comunidad'), semilla);
}

// --- LÓGICA DEL PASO 4: QR e INTERCAMBIOS ---

let html5QrcodeScanner = null;

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
    };
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrcodeScanner.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
    .catch((err) => {
        console.error("Error al iniciar cámara trasera: ", err);
        alert("No se pudo acceder a la cámara de escaneo.");
        detenerEscaneoCamara();
    });
}

function detenerEscaneoCamara() {
    document.getElementById('modal-scanner').classList.add('hidden');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner = null;
        }).catch(err => console.log("Error apagando cámara: ", err));
    }
}

function procesarCromoEscaneado(idEscaneado) {
    if (idEscaneado === MI_USER_ID) {
        alert("¡No te puedes escanear a vos mismo ingenioso! 😉");
        return;
    }

    if (datasetPersonas[idEscaneado] === undefined) {
        alert("Este código QR no pertenece a ningún miembro registrado.");
        return;
    }

    if (miAlbum[idEscaneado] === true) {
        alert(`Ya tienes la figurita de ${datasetPersonas[idEscaneado].nombre} en tu álbum.`);
        return;
    }

    miAlbum[idEscaneado] = true;
    
    import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js").then((FB) => {
        FB.set(FB.ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
            actualizarInterfazAlbum();
            alert(`🎉 ¡ÉXITO! Escaneaste y desbloqueaste a: ${datasetPersonas[idEscaneado].nombre}`);
        });
    });
}
