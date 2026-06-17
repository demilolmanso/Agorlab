// 1. IMPORTAMOS LAS FUNCIONES ESPECÍFICAS DE FIREBASE (Versión 12.15.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// 2. TUS CREDENCIALES REALES
const firebaseConfig = {
    apiKey: "AIzaSyBm8N4Rw03An_kOUJNXqw_XZFh2ovlFIE0",
    authDomain: "vos-album.firebaseapp.com",
    databaseURL: "https://vos-album-default-rtdb.firebaseio.com", // Agregamos la URL estándar de tu DB
    projectId: "vos-album",
    storageBucket: "vos-album.firebasestorage.app",
    messagingSenderId: "327624238972",
    appId: "1:327624238972:web:00603790e679efd07866f9"
};

// Inicializamos Firebase y la Base de Datos
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Creamos un ID de usuario simulado para rastrear quién está abriendo la app en este celular
if (!localStorage.getItem('vos_user_id')) {
    localStorage.setItem('vos_user_id', 'user_' + Math.floor(Math.random() * 10000));
}
const MI_USER_ID = localStorage.getItem('vos_user_id');

let datasetPersonas = {};
let miAlbum = {};

// 3. ESCUCHAR LA BASE DE DATOS EN TIEMPO REAL
const dbRefComunidad = ref(db, 'comunidad');
onValue(dbRefComunidad, (snapshot) => {
    if (snapshot.exists()) {
        datasetPersonas = snapshot.val();
        generarEstructuraVisualAlbum();
        cargarProgresoUsuario();
    } else {
        // Si entras y tu Firebase está totalmente vacío, creamos 3 figus iniciales para testear
        inicializarBaseDeDatosSemilla();
    }
});

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

// Escuchar el botón del HTML
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('open-pack-trigger').addEventListener('click', abrirSobre);
});
