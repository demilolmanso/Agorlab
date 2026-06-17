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

let modoEscaneo = 'agregar_amigo'; 
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

    document.getElementById('btn-ver-album').addEventListener('click', (e) => {
        document.getElementById('modal-mi-qr').classList.add('hidden');
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

// --- CÁMARA Y ESCÁNER ---
function iniciarEscaneoCamara() {
    document.getElementById('modal-mi-qr').classList.add('hidden');
    document.getElementById('modal-scanner').classList.remove('hidden');
    
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } }, 
        (decodedText) => {
            detenerEscaneoCamara();
            procesarCromoEscaneado(decodedText.trim());
        }
    ).catch(err => {
        console.error(err);
        alert("Error al iniciar cámara: " + err);
        detenerEscaneoCamara();
    });
}

function detenerEscaneoCamara() {
    document.getElementById('modal-scanner').classList.add('hidden');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner = null;
        }).catch(e => console.log("Error al detener:", e));
    }
}

// ... (El resto de tus funciones: registrarNuevoUsuario, abrirSobre, procesarCromoEscaneado, etc.)
// Asegúrate de incluir aquí las funciones que ya tenías de base de datos intactas.

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
