import { Link } from 'react-router';
import { TEXTO_NO_ENCONTRADO } from '../anuncios/ficha.js';

// Pantalla «Anuncio no encontrado» («Propiedad» de E03): para cualquier 404 de un anuncio, tanto si no existe
// como si es de otro centro, está retirado o el id no es un UUID. La reutilizan US-15, US-16, US-17 y US-70.
export default function AnuncioNoEncontrado() {
  return (
    <section className="pagina pagina-anuncio" aria-labelledby="titulo-pagina">
      <h1 id="titulo-pagina">{TEXTO_NO_ENCONTRADO.titulo}</h1>
      <p className="intro-text">{TEXTO_NO_ENCONTRADO.texto}</p>
      <Link to="/mis-anuncios" className="boton-enlace">{TEXTO_NO_ENCONTRADO.boton}</Link>
    </section>
  );
}
