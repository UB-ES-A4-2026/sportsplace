import { useEffect } from 'react';

// Aviso tras una acción (guía común, «Convenciones de interfaz»): mensaje breve en la esquina superior derecha
// que desaparece a los 4 s. Verde (`tipo: 'exito'`) si ha ido bien y rojo (`tipo: 'error'`) si ha fallado.
// Uso: <Aviso aviso={{ tipo: 'exito', texto: 'Anuncio publicado.' }} onCerrar={() => setAviso(null)} />
// Para repetir el mismo texto, pasa un objeto nuevo: cada objeto reinicia los 4 s.
const DURACION_AVISO_MS = 4000;

export default function Aviso({ aviso, onCerrar }) {
  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = window.setTimeout(onCerrar, DURACION_AVISO_MS);
    return () => window.clearTimeout(temporizador);
  }, [aviso, onCerrar]);

  if (!aviso) return null;

  const error = aviso.tipo === 'error';
  return (
    <div className={`aviso ${error ? 'aviso-error' : 'aviso-exito'}`} role={error ? 'alert' : 'status'}>
      {aviso.texto}
    </div>
  );
}
