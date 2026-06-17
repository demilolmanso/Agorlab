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

// CONTROL DE ARRANQUE (Paso 5.3)
document.addEventListener("DOMContentLoaded", () => {
    // Si no tiene ID guardado, obligamos a que se registre
    if (!MI_USER_ID) {
        document.getElementById('modal-registro').classList.remove('hidden');
        document.getElementById('btn-guardar-perfil').addEventListener('click', registrarNuevoUsuario);
    } else {
        // Si ya está registrado, ocultamos el formulario de registro y conectamos la DB
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
    }

    // Inicializar el resto de eventos de la App (Sobres y QR)
    document.getElementById('open-pack-trigger').addEventListener('click', abrirSobre);
    document.getElementById('btn-mi-qr').addEventListener('click', mostrarMiQR);
    document.getElementById('close-qr-btn').addEventListener('click', () => {
        document.getElementById('modal-mi-qr').classList.add('hidden');
    });
    document.getElementById('btn-scan-qr').addEventListener('click', iniciarEscaneoCamara);
    document.getElementById('close-scanner-btn').addEventListener('click', detenerEscaneoCamara);
});

// FUNCIÓN PARA CREAR TU PERFIL / CROMO EN LA NUBE (Paso 5.3)
function registrarNuevoUsuario() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const rol = document.getElementById('reg-rol').value.trim();
    const avatar = document.getElementById('reg-avatar').value.trim();
    const color = document.getElementById('reg-color').value;

    if (!nombre || !rol || !avatar) {
        alert("Por favor, completa todos los campos para crear tu cromo de comunidad.");
        return;
    }

    // Generamos un ID único basado en el tiempo para evitar duplicados
    const nuevoId = 'user_' + Date.now();
    const datosCromo = { nombre, rol, avatar, color };

    // Guardamos la nueva figurita en el nodo global 'comunidad'
    set(ref(db, `comunidad/${nuevoId}`), datosCromo).then(() => {
        // Guardamos el ID localmente para no pedir registro de nuevo
        localStorage.setItem('vos_user_id', nuevoId);
        MI_USER_ID = nuevoId;

        // Ocultamos el registro, avisamos y arrancamos la aplicación
        document.getElementById('modal-registro').classList.add('hidden');
        conectarBaseDeDatos();
        alert("¡Tu cromo ha sido impreso y añadido al álbum global! 🎉");
    }).catch(err => {
        console.error("Error al registrar: ", err);
        alert("Hubo un problema con la base de datos al guardar tu perfil.");
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
            // Si eres el primero absoluto y la DB está vacía, mete las semillas
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
        
        // Ponemos en 'false' las que el usuario todavía no descubrió
        Object.keys(datasetPersonas).forEach(id => {
            if (miAlbum[id] === undefined) miAlbum[id] = false;
        });

        actualizarInterfazAlbum();
    });
}

// 5. PINTAR A COLOR LAS FIGUS DESBLOQUEADAS
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
            cardElement.style.borderColor = datos.color;
            cardElement.querySelector('.card-avatar').innerText = datos.avatar;
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

    // Guardamos el progreso de este usuario directamente en tu Firebase
    set(ref(db, `albumes_usuarios/${MI_USER_ID}`), miAlbum).then(() => {
        const cardElement = document.getElementById(`card-${idGanado}`);
        if (cardElement) {
            cardElement.style.transform = "scale(1.1)";
            setTimeout(() => {
                cardElement.style.transform = "scale(1)";
                actualizarInterfazAlbum();
                alert(`🎉 ¡Te tocó en tu base de datos: ${datasetPersonas[idGanado].nombre}!`);
            }, 200);
        }
    });
}

// Función auxiliar para meter datos de prueba la primera vez
function inicializarBaseDeDatosSemilla() {
    const semilla = {
        "u1": { nombre: "Alan Agor", rol: "Fundador", avatar: "🚀", color: "#FF5733" },
        "u2": { nombre: "Sofía Dev", rol: "Programadora", avatar: "💻", color: "#33FF57" },
        "u3": { nombre: "Carlos UX", rol: "Diseñador", avatar: "🎨", color: "#3357FF" }
    };
    set(ref(db, 'comunidad'), semilla);
}

// --- LÓGICA DEL PASO 4: QR e INTERCAMBIOS ---

let html5QrcodeScanner = null;

// B. Función para mostrar tu propio QR en pantalla
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

// C. Función para encender la cámara del celular
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
        console.error("Error al iniciar cámara: ", err);
        alert("No se pudo acceder a la cámara. Asegúrate de dar los permisos.");
        detenerEscaneoCamara();
    });
}

// D. Apagar la cámara de forma segura
function detenerEscaneoCamara() {
    document.getElementById('modal-scanner').classList.add('hidden');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner = null;
        }).catch(err => console.log("Error apagando cámara: ", err));
    }
}

// E. Procesar el ID obtenido por el escáner y guardarlo en Firebase
function procesarCromoEscaneado(idEscaneado) {
    if (idEscaneado === MI_USER_ID) {
        alert("¡No te puedes escanear a vos mismo ingenioso! 😉");
        return;
    }

    if (datasetPersonas[idEscaneado] === undefined) {
        alert("Este código QR no pertenece a ningún miembro registrado en este álbum.");
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
