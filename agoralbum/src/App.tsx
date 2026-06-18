import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot
} from 'firebase/firestore';

const COMUNIDAD_PREDEFINIDA: any[] = [];

const COLORES_PIXEL = [
  '#000000', '#ffffff', '#f97316', '#ef4444', 
  '#facc15', '#22c55e', '#3b82f6', '#a855f7'
];

const crearMatrizVacia = () => Array(64).fill('#ffffff');

export default function App() {
  const [usuarioActual, setUsuarioActual] = useState<any>(null);
  const [registro, setRegistro] = useState({ nombre: '', bio: '' });
  const [usuariosGlobales, setUsuariosGlobales] = useState<any[]>([]);
  const [misFiguritas, setMisFiguritas] = useState<any>({});
  const [sobreAbierto, setSobreAbierto] = useState<any[] | null>(null);
  const [cargando, setCargando] = useState(true);
  
  const [escaneando, setEscaneando] = useState(false);
  const [amigoVinculadoId, setAmigoVinculadoId] = useState<string | null>(null);

  const [cuadricula, setCuadricula] = useState<string[]>(crearMatrizVacia());
  const [colorSeleccionado, setColorSeleccionado] = useState<string>('#f97316');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const usuariosFirebase = snapshot.docs.map(doc => doc.data());
      const todos = [...COMUNIDAD_PREDEFINIDA, ...usuariosFirebase];
      const mapeado = todos.filter((value, index, self) =>
        index === self.findIndex((t) => t.id === value.id)
      );
      setUsuariosGlobales(mapeado);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!usuarioActual) return;
    const unsubAlbum = onSnapshot(doc(db, "albumes", usuarioActual.id), (docSnap) => {
      if (docSnap.exists()) {
        setMisFiguritas(docSnap.data());
      }
    });
    return () => unsubAlbum();
  }, [usuarioActual]);

  useEffect(() => {
    const cargarDatosUsuario = async () => {
      const userLocal = localStorage.getItem('album_user');
      if (userLocal) {
        setUsuarioActual(JSON.parse(userLocal));
      }
      setCargando(false);
    };
    cargarDatosUsuario();
  }, []);

  useEffect(() => {
    if (!escaneando) return;

    // Se configura el scanner nativo de html5-qrcode que ya incluye la opción de subir archivo/imagen por defecto
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 220, height: 220 } },
      false
    );

    const alEscanearExito = async (textoDecodificado: string) => {
      scanner.clear();
      setEscaneando(false);
      const idAmigo = textoDecodificado;

      if (idAmigo === usuarioActual.id) {
        alert("📋 Este es tu propio QR. Escaneá o subí la imagen del QR de otra persona para vincularte.");
        return;
      }

      const existeUsuario = usuariosGlobales.some(u => u.id === idAmigo);
      if (!existeUsuario) {
        alert("❌ Código QR no válido o el usuario no existe.");
        return;
      }

      setAmigoVinculadoId(idAmigo);
    };

    const alEscanearError = () => {};
    scanner.render(alEscanearExito, alEscanearError);

    return () => {
      scanner.clear().catch(err => console.error("Error al apagar el escáner", err));
    };
  }, [escaneando, usuariosGlobales, usuarioActual]);

  const reclamarFiguritaPersonalAmigo = async () => {
    if (!amigoVinculadoId || !usuarioActual) return;

    const yaLaTengo = (misFiguritas[amigoVinculadoId] || 0) > 0;
    if (yaLaTengo) {
      alert("🔒 Ya tenés la figurita personal de este usuario en tu álbum.");
      return;
    }

    try {
      const miNuevoAlbum = { ...misFiguritas };
      miNuevoAlbum[amigoVinculadoId] = 1;

      await setDoc(doc(db, "albumes", usuarioActual.id), miNuevoAlbum);
      
      const datosAmigo = usuariosGlobales.find(u => u.id === amigoVinculadoId);
      alert(`✨ ¡Agregaste la figurita de ${datosAmigo?.nombre || 'tu amigo'} a tu colección!`);
    } catch (error) {
      console.error("Error al reclamar figurita:", error);
    }
  };

  const regalarFiguritaRepetida = async (idFigu: string) => {
    if (!amigoVinculadoId || !usuarioActual) return;
    const cantidadActual = misFiguritas[idFigu] || 0;
    if (cantidadActual <= 1) {
      alert("❌ No te quedan copias repetidas de esta figurita para regalar.");
      return;
    }

    try {
      const amigoAlbumRef = doc(db, "albumes", amigoVinculadoId);
      const amigoAlbumSnap = await getDoc(amigoAlbumRef);
      let albumAmigoData = amigoAlbumSnap.exists() ? amigoAlbumSnap.data() : {};

      const miNuevoAlbum = { ...misFiguritas };
      miNuevoAlbum[idFigu] = cantidadActual - 1;

      const nuevoAlbumAmigo = { ...albumAmigoData };
      nuevoAlbumAmigo[idFigu] = (Number(nuevoAlbumAmigo[idFigu]) || 0) + 1;

      await setDoc(doc(db, "albumes", usuarioActual.id), miNuevoAlbum);
      await setDoc(amigoAlbumRef, nuevoAlbumAmigo);

      const datosAmigo = usuariosGlobales.find(u => u.id === amigoVinculadoId);
      alert(`🍊 ¡Le regalaste la figurita a ${datosAmigo?.nombre || 'tu amigo'} con éxito!`);
    } catch (error) {
      console.error(error);
    }
  };

  const manejarRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registro.nombre) return;

    const yaTieneFigu = localStorage.getItem('ya_creo_figurita');
    if (yaTieneFigu) {
      alert("❌ Ya tenés un usuario creado en este dispositivo.");
      return;
    }

    const nuevoId = 'usr_' + Math.random().toString(36).substr(2, 9);
    const nuevoUsuario = {
      id: nuevoId,
      nombre: registro.nombre,
      bio: registro.bio || 'Coleccionista oficial.',
      pixelArt: cuadricula,
    };

    try {
      await setDoc(doc(db, "usuarios", nuevoId), nuevoUsuario);
      await setDoc(doc(db, "albumes", nuevoId), { [nuevoId]: 1 });

      localStorage.setItem('ya_creo_figurita', 'true');
      localStorage.setItem('album_user', JSON.stringify(nuevoUsuario));
      setUsuarioActual(nuevoUsuario);
      setMisFiguritas({ [nuevoId]: 1 });
    } catch (error) {
      console.error(error);
    }
  };

  const pintarPixel = (index: number) => {
    const nuevaCuadricula = [...cuadricula];
    nuevaCuadricula[index] = colorSeleccionado;
    setCuadricula(nuevaCuadricula);
  };

  const RenderPixelArt = ({ matriz }: { matriz: string[] }) => {
    const pixeles = matriz || Array(64).fill('#ffffff');
    return (
      <div className="w-full bg-zinc-950 rounded border border-zinc-800 grid grid-cols-8 p-1 gap-[1.5px] items-center justify-center overflow-hidden">
        {pixeles.map((color, i) => (
          <div 
            key={i} 
            style={{ backgroundColor: color }} 
            className="w-full aspect-square rounded-[1px]" 
          />
        ))}
      </div>
    );
  };

  const abrirSobre = async () => {
    if (usuariosGlobales.length === 0 || !usuarioActual) return;

    const ULTIMA_APERTURA_MS = 8 * 60 * 60 * 1000;
    const ultimaApertura = localStorage.getItem(`ultimo_sobre_${usuarioActual.id}`);
    const ahora = Date.now();

    if (ultimaApertura) {
      const tiempoTranscurrido = ahora - Number(ultimaApertura);
      if (tiempoTranscurrido < ULTIMA_APERTURA_MS) {
        const tiempoRestanteMs = ULTIMA_APERTURA_MS - tiempoTranscurrido;
        const horasRestantes = Math.floor(tiempoRestanteMs / (1000 * 60 * 60));
        const minutosRestantes = Math.floor((tiempoRestanteMs % (1000 * 60 * 60)) / (1000 * 60));
        alert(`⏳ Tenés que esperar ${horasRestantes}h y ${minutosRestantes}m para tu próximo sobre.`);
        return;
      }
    }

    let sobre: any[] = [];
    for (let i = 0; i < 3; i++) {
      const randomUser = usuariosGlobales[Math.floor(Math.random() * usuariosGlobales.length)];
      sobre.push(randomUser);
    }

    const nuevoAlbum = { ...misFiguritas };
    sobre.forEach((figu) => {
      nuevoAlbum[figu.id] = (Number(nuevoAlbum[figu.id]) || 0) + 1;
    });

    try {
      await setDoc(doc(db, "albumes", usuarioActual.id), nuevoAlbum);
      localStorage.setItem(`ultimo_sobre_${usuarioActual.id}`, ahora.toString());
      setMisFiguritas(nuevoAlbum);
      setSobreAbierto(sobre);
    } catch (error) {
      console.error(error);
    }
  };

  const reiniciarTodo = () => {
    if (confirm("⚠️ ¿Estás seguro de que querés reiniciar la demo? Se borrarán tus datos locales.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-zinc-950 text-orange-500 flex items-center justify-center font-mono">
        <p className="text-xl font-bold animate-pulse tracking-widest">CARGANDO AGORALBUM...</p>
      </div>
    );
  }

  const misRepetidas = usuariosGlobales.filter(figu => (misFiguritas[figu.id] || 0) > 1);
  const amigoDatos = usuariosGlobales.find(u => u.id === amigoVinculadoId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-4 pb-16 selection:bg-orange-500/20">
      {/* ENCABEZADO */}
      <header className="max-w-5xl mx-auto flex justify-between items-center py-6 border-b border-zinc-800 mb-10">
        <h1 className="text-3xl font-black tracking-tighter text-orange-500">
          AGORALBUM_
        </h1>
        {usuarioActual && (
          <button onClick={reiniciarTodo} className="text-xs font-bold border border-zinc-700 text-zinc-400 hover:border-orange-500 hover:text-orange-500 px-4 py-1.5 rounded transition">
            [ REINICIAR_DEMO ]
          </button>
        )}
      </header>

      <main className="max-w-5xl mx-auto">
        {!usuarioActual ? (
          /* REGISTRO */
          <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 p-8 rounded shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-xl font-bold mb-1 text-orange-500">NUEVA_FIGURITA</h2>
              <p className="text-[11px] text-zinc-400 mb-6">Completá tus datos para diseñar tu figurita oficial.</p>
              
              <form onSubmit={manejarRegistro} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">TU NOMBRE o ALIAS</label>
                  <input type="text" required placeholder="Ej: Juan_Pixel" className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:border-orange-500 rounded text-sm outline-none font-mono transition" value={registro.nombre} onChange={(e) => setRegistro({ ...registro, nombre: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">BIO / FRASE CORTA</label>
                  <input type="text" placeholder="Ej: Al infinito y más allá" className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:border-orange-500 rounded text-sm outline-none font-mono transition" value={registro.bio} onChange={(e) => setRegistro({ ...registro, bio: e.target.value })} />
                </div>
                <button type="submit" className="w-full py-3 bg-orange-500 text-black font-black hover:bg-orange-400 transition duration-150 text-sm tracking-wide rounded">
                  CREAR FIGURITA Y ENTRAR
                </button>
              </form>
            </div>

            {/* LIENZO PIXEL ART */}
            <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-zinc-800 pt-6 md:pt-0 md:pl-8">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 text-center">🎨 DIBUJÁ TU AVATAR (8x8)</label>
              
              <div className="w-48 h-48 bg-zinc-950 border border-zinc-800 p-1.5 grid grid-cols-8 gap-[1px] rounded cursor-crosshair">
                {cuadricula.map((color, idx) => (
                  <div
                    key={idx}
                    style={{ backgroundColor: color }}
                    onClick={() => pintarPixel(idx)}
                    className="w-full aspect-square border border-black/5"
                  />
                ))}
              </div>

              <div className="flex gap-1.5 mt-4 flex-wrap justify-center">
                {COLORES_PIXEL.map((color) => (
                  <button
                    key={color}
                    type="button"
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded border ${colorSeleccionado === color ? 'border-orange-500 scale-110 ring-1 ring-orange-500' : 'border-zinc-800'}`}
                    onClick={() => setColorSeleccionado(color)}
                  />
                ))}
              </div>
              <button type="button" onClick={() => setCuadricula(crearMatrizVacia())} className="text-[11px] text-zinc-500 hover:text-orange-400 mt-4 underline transition">
                Limpiar lienzo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* PANEL CENTRAL DE CONTROL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-zinc-900 border border-zinc-800 p-8 rounded">
              
              {/* TARJETA PROPIA */}
              <div className="flex flex-col items-center">
                <p className="text-[11px] font-bold tracking-widest text-zinc-400 mb-3.5 uppercase">[ MI FIGURITA ]</p>
                <div className="w-40 bg-zinc-950 border border-orange-500/50 rounded p-4 flex flex-col gap-3 text-zinc-100 shadow-xl relative">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-1.5">
                    <span className="text-[9px] font-extrabold text-orange-500 border border-orange-500/30 px-1 rounded">MÍA</span>
                    <div className="font-black text-xs uppercase tracking-wide truncate max-w-[90px] text-zinc-100">
                      {usuarioActual.nombre}
                    </div>
                  </div>
                  
                  <RenderPixelArt matriz={usuarioActual.pixelArt} />
                  
                  <div className="text-[10px] leading-relaxed text-zinc-400 italic text-center min-h-[16px] line-clamp-1">
                    "{usuarioActual.bio}"
                  </div>
                </div>
              </div>

              {/* CONTROLES */}
              <div className="flex flex-col items-center justify-center text-center p-2 space-y-4">
                <button onClick={abrirSobre} className="w-full py-3.5 bg-orange-500 text-black font-black text-xs tracking-wider rounded hover:bg-orange-400 transition">
                  [ 🎁 ABRIR SOBRE DIARIO ]
                </button>

                <button onClick={() => { setEscaneando(!escaneando); setAmigoVinculadoId(null); }} className={`w-full py-3.5 font-bold text-xs tracking-wider rounded transition border ${escaneando ? 'bg-zinc-950 border-red-500 text-red-500' : 'bg-zinc-950 border-zinc-800 text-orange-500 hover:bg-zinc-900'}`}>
                  {escaneando ? 'CANCELAR ESCÁNER X' : '📷 ESCANEAR O SUBIR QR'}
                </button>
              </div>

              {/* CÓDIGO QR */}
              <div className="flex flex-col items-center">
                <p className="text-[11px] font-bold tracking-widest text-zinc-400 mb-3.5 uppercase">[ MI CÓDIGO QR ]</p>
                <div className="bg-white p-3 rounded">
                  <QRCodeSVG value={usuarioActual.id} size={110} />
                </div>
              </div>
            </div>

            {/* SECTOR DE INTERACCIÓN / VÍNCULO ACTIVO */}
            {amigoVinculadoId && amigoDatos && (
              <div className="bg-zinc-900 border-2 border-orange-500 p-6 rounded shadow-2xl">
                <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                  <div>
                    <h3 className="text-md font-bold text-orange-500 uppercase tracking-wide">🔗 INTERCAMBIO CONECTADO</h3>
                    <p className="text-xs text-zinc-400">Vinculado con: <span className="text-zinc-100 font-bold uppercase">{amigoDatos.nombre}</span></p>
                  </div>
                  <button onClick={() => setAmigoVinculadoId(null)} className="text-xs border border-zinc-700 text-zinc-300 hover:text-orange-500 px-3 py-1.5 rounded font-bold transition">CERRAR VÍNCULO X</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                  {/* Tarjeta del usuario escaneado */}
                  <div className="bg-zinc-950 p-4 border border-zinc-800 rounded flex flex-col items-center gap-4 text-center">
                    <p className="text-[10px] tracking-wider text-orange-400 font-bold uppercase">// PERFIL DE TU AMIGO</p>
                    <div className="w-36 bg-zinc-900 border border-zinc-800 rounded p-3 flex flex-col gap-2">
                      <div className="font-bold text-[10px] text-zinc-100 truncate uppercase">{amigoDatos.nombre}</div>
                      <RenderPixelArt matriz={amigoDatos.pixelArt} />
                      <div className="text-[9px] text-zinc-400 italic line-clamp-1">"{amigoDatos.bio}"</div>
                    </div>

                    <button 
                      onClick={reclamarFiguritaPersonalAmigo} 
                      className={`w-full py-2.5 px-4 text-xs font-bold rounded transition ${
                        (misFiguritas[amigoDatos.id] || 0) > 0 
                          ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                          : 'bg-orange-500 text-black hover:bg-orange-400'
                      }`}
                    >
                      {(misFiguritas[amigoDatos.id] || 0) > 0 ? '🔒 YA ESTÁ EN TU ÁLBUM' : '✨ RECLAMAR SU FIGU PERSONAL'}
                    </button>
                  </div>

                  {/* Regalar repetidas */}
                  <div className="md:col-span-2 space-y-3">
                    <p className="text-[10px] tracking-wider text-zinc-400 font-bold uppercase">// REGALARLE UNA DE TUS REPETIDAS GLOBALES</p>
                    {misRepetidas.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic bg-zinc-950 p-4 rounded border border-zinc-800">No tenés duplicados disponibles en este momento para obsequiar.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 bg-zinc-950 p-4 rounded border border-zinc-800 max-h-60 overflow-y-auto">
                        {misRepetidas.map((figu) => (
                          <button key={figu.id} onClick={() => regalarFiguritaRepetida(figu.id)} className="bg-zinc-900 border border-zinc-800 hover:border-orange-500 rounded p-2 flex flex-col gap-2 transition text-left group">
                            <div className="truncate font-bold text-[9px] text-zinc-400 group-hover:text-zinc-100 uppercase">{figu.nombre}</div>
                            <RenderPixelArt matriz={figu.pixelArt} />
                            <div className="text-[8px] font-bold text-center w-full bg-orange-500/10 text-orange-400 rounded py-0.5 border border-orange-500/20">
                              REPETIDAS: {misFiguritas[figu.id] - 1}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ÁREA DEL ESCÁNER */}
            {escaneando && (
              <div className="max-w-md mx-auto bg-zinc-900 p-4 rounded border border-zinc-800 shadow-2xl">
                <p className="text-center text-xs text-orange-500 mb-2 animate-pulse font-medium">📷 ENFOCÁ EL QR O SUBÍ UNA IMAGEN/CAPTURA</p>
                <p className="text-center text-[10px] text-zinc-500 mb-4">(Podés usar la cámara en vivo o tocar el botón de abajo en el lector para cargar un archivo)</p>
                <div id="reader" className="w-full rounded overflow-hidden bg-zinc-950 border border-zinc-800"></div>
              </div>
            )}

            {/* CONTENIDO DEL SOBRE */}
            {sobreAbierto && (
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded text-center">
                <h3 className="text-xs font-bold text-orange-400 tracking-widest uppercase mb-5">// RECOMPENSAS DEL SOBRE ADQUIRIDO</h3>
                <div className="flex flex-wrap justify-center gap-5">
                  {sobreAbierto.map((figu, idx) => (
                    <div key={idx} className="w-36 bg-zinc-950 border border-zinc-800 rounded p-3 flex flex-col gap-2.5 text-left">
                      <div className="font-bold text-[10px] text-zinc-100 truncate uppercase">{figu.nombre}</div>
                      <RenderPixelArt matriz={figu.pixelArt} />
                      <div className="text-[9px] text-zinc-400 text-center truncate italic">"{figu.bio}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MI ÁLBUM */}
            <div>
              <div className="flex justify-between items-baseline mb-6 border-b border-zinc-800 pb-3">
                <h2 className="text-xl font-bold text-orange-500 tracking-tight">
                  COLECCIÓN OFICIAL_
                </h2>
                <span className="text-xs font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded">
                  {Object.keys(misFiguritas).length} / {usuariosGlobales.length} FIGURITAS
                </span>
              </div>

              {/* GRILLA DEL ÁLBUM */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                {usuariosGlobales.map((figu) => {
                  const cantidad = misFiguritas[figu.id] || 0;
                  const laTengo = cantidad > 0;

                  return (
                    <div
                      key={figu.id}
                      className={`relative rounded p-4 flex flex-col gap-3 transition-all border ${
                        laTengo 
                          ? 'bg-zinc-950 border-orange-500/40 text-zinc-100' 
                          : 'bg-zinc-950/40 border-dashed border-zinc-900 text-zinc-700 select-none'
                      }`}
                    >
                      {/* Cantidad acumulada */}
                      {cantidad > 1 && (
                        <div className="absolute -top-1.5 -right-1.5 bg-orange-500 text-black font-black text-[10px] px-1.5 py-0.5 rounded shadow border border-orange-400">
                          x{cantidad}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <div className={`font-bold text-xs truncate uppercase ${laTengo ? 'text-zinc-100' : 'text-zinc-700'}`}>
                          {figu.nombre}
                        </div>
                      </div>
                      
                      {laTengo ? (
                        <RenderPixelArt matriz={figu.pixelArt} />
                      ) : (
                        <div className="w-full aspect-square bg-zinc-900/40 rounded flex items-center justify-center border border-zinc-800 text-xl font-bold text-zinc-800">
                          ?
                        </div>
                      )}
                      
                      <div className="text-[10px] leading-relaxed text-zinc-400 italic text-center min-h-[16px] line-clamp-1">
                        {laTengo ? `"${figu.bio}"` : 'BLOQUEADA'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}