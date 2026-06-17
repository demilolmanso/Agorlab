// 1. Base de datos de prueba (Los miembros de la comunidad)
const datasetPersonas = {
    1: { nombre: "Alan Agor", rol: "Fundador", avatar: "🚀", color: "#FF5733" },
    2: { nombre: "Sofía Dev", rol: "Programadora", avatar: "💻", color: "#33FF57" },
    3: { nombre: "Carlos UX", rol: "Diseñador", avatar: "🎨", color: "#3357FF" },
    4: { nombre: "Matias Clip", rol: "Streamer", avatar: "🎙️", color: "#F3FF33" }
};

// 2. Estado del Álbum del usuario (Cargar guardado o empezar vacío)
let miAlbum = JSON.parse(localStorage.getItem('vos_album_progreso')) || {
    1: false,
    2: false,
    3: false,
    4: false
};

// 3. Función para renderizar el álbum según lo que el usuario ya desbloqueó
function actualizarInterfazAlbum() {
    let cartasPegadas = 0;

    for (let id in miAlbum) {
        const cardElement = document.getElementById(`card-${id}`);
        if (miAlbum[id] === true) {
            cartasPegadas++;
            // Traemos los datos reales
            const datos = datasetPersonas[id];
            
            // Le quitamos la clase "locked" (vuelve el color)
            cardElement.classList.remove('locked');
            cardElement.style.borderColor = datos.color;
            
            // Inyectamos la info real del cromo
            cardElement.querySelector('.card-avatar').innerText = datos.avatar;
            cardElement.querySelector('.card-info h3').innerText = datos.nombre;
            cardElement.querySelector('.card-info p').innerText = datos.rol;
        }
    }
    // Actualizar el contador del header
    document.getElementById('counter').innerText = `${cartasPegadas}/4`;
}

// 4. Lógica para "Abrir Sobre" (Selección aleatoria)
function abrirSobre() {
    // Buscamos qué IDs todavía no se han desbloqueado
    const bloqueadas = Object.keys(miAlbum).filter(id => miAlbum[id] === false);

    if (bloqueadas.length === 0) {
        alert("¡Ya completaste este álbum! Sos un coleccionista experto.");
        return;
    }

    // Elegimos una al azar de las que faltan
    const randomIndex = Math.floor(Math.random() * bloqueadas.length);
    const idGanado = bloqueadas[randomIndex];

    // La marcamos como desbloqueada
    miAlbum[idGanado] = true;

    // Guardamos el progreso en el teléfono/navegador
    localStorage.setItem('vos_album_progreso', JSON.stringify(miAlbum));

    // Animación simple antes de pintar (puedes mejorarla después)
    const cardElement = document.getElementById(`card-${idGanado}`);
    cardElement.style.transform = "scale(1.1)";
    setTimeout(() => {
        cardElement.style.transform = "scale(1)";
        actualizarInterfazAlbum();
        alert(`🎉 ¡Te tocó la figu de: ${datasetPersonas[idGanado].nombre}!`);
    }, 200);
}

// 5. Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    actualizarInterfazAlbum();

    // Conectar el botón de abrir sobre
    document.getElementById('open-pack-trigger').addEventListener('click', abrirSobre);
});
