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

// Variables de Estado para el Escáner
let modoEscaneo = 'agregar_amigo'; // Puede ser 'agregar_amigo' o 'transferir'
let cartaATransferir = null;

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

    // NAVEGACIÓN
    document.getElementById('btn-ver-album').addEventListener('click', (e) => {
        document.getElementById('modal-mi-qr').classList.add('hidden');
        document.getElementById('modal-scanner').classList.add('hidden');
        detenerEscaneoCamara();
        actualizarBotonActivo(e.currentTarget);
    });

    document.getElementById('open-pack-trigger').addEventListener('click', abrirSobre);
    
    document.getElementById('btn-mi-qr').addEventListener('click', (e) => {
        mostrarMiQR();
        actualizarBotonActivo(e.currentTarget);
    });
    
    document.getElementById('close-qr-btn').addEventListener('click', () => {
        document.getElementById('modal-mi-qr').classList.add('hidden');
        actualizarBotonActivo(document.getElementById('btn-ver-album'));
    });

    document.getElementById('btn-scan-qr').addEventListener('click', (e) => {
        modoEscaneo = 'agregar_amigo';
        document.querySelector('#modal-scanner h2').innerText = "Escanea a un compañero";
        iniciarEscaneoCamara();
        actualizarBotonActivo(e.currentTarget);
    });
    
    document.getElementById('close-scanner-btn').addEventListener('click', () => {
        detenerEscaneoCamara();
        actualizarBotonActivo(document.getElementById('btn-ver-album'));
    });

    // Delegación de eventos para los botones de Transferir dinámicos
    document.querySelector('.album-grid').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-transferir')) {
            iniciarTransferencia(e.target.getAttribute('data-id'));
        }
    });
});

function actualizarBotonActivo(elementoBoton) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (elementoBoton) elementoBoton.classList.add('active');
}

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

// --- LÓGICA DE BASE DE DATOS Y RENDERIZADO ---
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
        let datosAlbum = snapshot.exists() ? snapshot.val() : {};
        
        // Conversión a sistema de números (Repetidas)
        Object.keys(datasetPersonas).forEach(id => { 
            if (datosAlbum[id] === true) miAlbum[id] = 1;
            else if (datosAlbum[id] === false || datosAlbum[id] === undefined) miAlbum[id] = 0;
            else miAlbum[id] = datosAlbum[id];
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
        
        // Limpiar elementos dinámicos previos para no duplicarlos
        const badgeViejo = cardElement.querySelector('.badge-cantidad');
        if (badgeViejo) badgeViejo.remove();
        const btnViejo = cardElement.querySelector('.btn-transferir');
        if (btnViejo) btnViejo.remove();

        if (miAlbum[id] > 0) {
            cartasPegadas++; 
            const datos = datasetPersonas[id];
            cardElement.classList.remove('locked');
            
            if (datos.avatar && datos.avatar.startsWith('data:image')) {
                cardElement.querySelector('.card-avatar').innerHTML = `<img src="${datos.avatar}">`;
            }
            cardElement.querySelector('.card-info h3').innerText = datos.nombre;
            cardElement.querySelector('.card-info p').innerText = datos.rol;

            // Si hay repetidas, inyectar el indicador y el botón de transferencia
            if (miAlbum[id] > 1) {
                cardElement.insertAdjacentHTML('afterbegin', `<div class="badge-cantidad">x${miAlbum[id]}</div>`);
                cardElement.querySelector('.card-info').insertAdjacentHTML('beforeend', `<button class="btn-transferir" data-id="${id}">🔄 Transferir</button>`);
            }
        }
    }
    document.getElementById('counter').innerText = `${cartasPegadas}/${totalCartas}`;
}

// --- LÍMITE DE SOBRES Y PROBABILIDAD DE REPETIDAS ---
function abrirSobre() {
    const hoy = new Date().toDateString();
    let limite = JSON.parse(localStorage.getItem('vos_limite_sobres')) || { fecha: hoy, abiertos: 0 };
    if (limite.fecha !== hoy) limite = { fecha: hoy, abiertos: 0 }; 
    
    if (limite.abiertos >= 3) {
        alert("⏳ ¡Límite alcanzado! Abriste tus 3 sobres diarios.");
        return;
    }

    const todosLosIds = Object.keys(datasetPersonas);
    if (todosLosIds.length === 0) return;

    // Ahora puede tocar CUALQUIER carta (Incluso repetidas)
    const idGanado = todosLosIds[Math.floor(Math.random() * todosLosIds.length)];
    miAlbum[idGanado]++; // Sumamos 1 a la cantidad

    set(ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
        limite.abiertos++;
        localStorage.setItem('vos_limite_sobres', JSON.stringify(limite));
        actualizarInterfazAlbum();
        alert(`🎉 ¡Te tocó: ${datasetPersonas[idGanado].nombre}! (Sobres: ${limite.abiertos}/3)`);
    });
}

// --- ESCÁNER Y TRANSFERENCIAS ---
function mostrarMiQR() {
    const container = document.getElementById('qrcode-container');
    container.innerHTML = ""; 
    new QRCode(container, {
    text: MI_USER_ID,
    width: 300,
    height: 300
});
    document.getElementById('modal-mi-qr').classList.remove('hidden');
}

function iniciarTransferencia(idCromo) {
    modoEscaneo = 'transferir';
    cartaATransferir = idCromo;
    document.querySelector('#modal-scanner h2').innerText = `Escanea el QR para enviar a: ${datasetPersonas[idCromo].nombre}`;
    iniciarEscaneoCamara();
}

function iniciarEscaneoCamara() {
    document.getElementById('modal-mi-qr').classList.add('hidden');
    document.getElementById('modal-scanner').classList.remove('hidden');
    
    // Aseguramos que la instancia anterior se destruya si quedó basura en memoria
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
    }

    html5QrcodeScanner = new Html5Qrcode("reader");
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        }, 
        (decodedText) => {
            // Éxito: detén el escaneo ANTES de procesar para evitar lecturas múltiples
            detenerEscaneoCamara(); 
            procesarCromoEscaneado(decodedText);
        },
        (errorMessage) => {
            // IMPORTANTE: Esto ocurre miles de veces mientras la cámara busca.
            // No alertes aquí, o bloquearás el navegador. 
            // Solo logs para depuración.
            console.log("Buscando QR...");
        }
    ).catch(err => {
        alert("Error al acceder a la cámara. Asegúrate de dar permisos y usar HTTPS.");
        console.error(err);
        detenerEscaneoCamara();
    });
function detenerEscaneoCamara() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear(); // Limpia visualmente el div #reader
            html5QrcodeScanner = null;
            document.getElementById('modal-scanner').classList.add('hidden');
        }).catch(err => console.error("Error al detener:", err));
    } else {
        document.getElementById('modal-scanner').classList.add('hidden');
    }
}

function procesarCromoEscaneado(idEscaneado) {
    if (idEscaneado === MI_USER_ID) return alert("[ERROR]: No puedes escanear tu propio código.");
    if (!datasetPersonas[idEscaneado]) return alert("[ERROR]: QR de usuario no válido o inexistente.");

    // MODO 1: Agregar a alguien que conociste
    if (modoEscaneo === 'agregar_amigo') {
        if (miAlbum[idEscaneado] > 0) return alert("Ya tienes esta figu en tu álbum.");
        
        miAlbum[idEscaneado] = 1;
        set(ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
            actualizarInterfazAlbum();
            alert(`🎉 ¡Desbloqueaste a: ${datasetPersonas[idEscaneado].nombre} cara a cara!`);
        });
    } 
    // MODO 2: Transferir una carta repetida
    else if (modoEscaneo === 'transferir') {
        if (miAlbum[cartaATransferir] <= 1) return alert("No tienes suficientes copias para transferir.");

        // 1. Te restamos la carta a vos
        miAlbum[cartaATransferir]--;

        // 2. Leemos el álbum del receptor para sumarle la carta
        const refReceptor = ref(db, `albumes_usuarios/${idEscaneado}/${cartaATransferir}`);
        get(refReceptor).then(snap => {
            let cantidadReceptor = snap.exists() ? snap.val() : 0;
            // Parche de compatibilidad por si su carta estaba en true/false
            if (cantidadReceptor === true) cantidadReceptor = 1;
            if (cantidadReceptor === false) cantidadReceptor = 0;

            // 3. Escribimos la actualización en ambas cuentas
            set(refReceptor, cantidadReceptor + 1).then(() => {
                set(ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
                    actualizarInterfazAlbum();
                    actualizarBotonActivo(document.getElementById('btn-ver-album'));
                    alert(`🔄 ¡Transferencia exitosa! Le enviaste la figu de ${datasetPersonas[cartaATransferir].nombre} a ${datasetPersonas[idEscaneado].nombre}.`);
                });
            });
        });
    }
}
