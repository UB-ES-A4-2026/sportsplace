import { useState } from 'react';
import { fotoInicial, fotosOrdenadas, textoAlternativo, TEXTO_SIN_FOTOS } from '../anuncios/galeria.js';

// Galería de la ficha del anuncio (US-13, CA9 y CA10): la foto principal en grande y, debajo, miniaturas de todas
// en su orden. Al pulsar una miniatura se ve grande en lugar de la principal.
// Uso: <GaleriaAnuncio titulo={anuncio.titulo} fotos={anuncio.fotos} />
export default function GaleriaAnuncio({ titulo, fotos }) {
  const lista = fotosOrdenadas(fotos);
  const [elegida, setElegida] = useState(null);

  if (lista.length === 0) return <p className="galeria-vacia">{TEXTO_SIN_FOTOS}</p>;

  const idGrande = lista.some((foto) => foto.id === elegida) ? elegida : fotoInicial(lista);
  const grande = lista.find((foto) => foto.id === idGrande);

  return (
    <div className="galeria">
      <img className="galeria-grande" src={grande.url} alt={textoAlternativo(titulo, grande, lista)} />
      {lista.length > 1 && (
        <ul className="galeria-miniaturas">
          {lista.map((foto, posicion) => (
            <li key={foto.id}>
              <button
                type="button"
                className={foto.id === idGrande ? 'galeria-miniatura galeria-miniatura-activa' : 'galeria-miniatura'}
                aria-label={`Ver foto ${posicion + 1}`}
                aria-pressed={foto.id === idGrande}
                onClick={() => setElegida(foto.id)}
              >
                <img src={foto.url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
