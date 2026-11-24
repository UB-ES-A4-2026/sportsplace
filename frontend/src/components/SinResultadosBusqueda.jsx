import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { RUTA_CATALOGO, TEXTOS, textoSinResultados } from '../catalogo/busqueda.js';

// US-21 CA18 (T21-5): bloque de /catalogo cuando una búsqueda no da resultados (E2E-2 y E2E-5).
// «Quitar búsqueda y filtros» lleva a /catalogo sin parámetros. Diseño con vida (#361): el icono es decorativo y el
// aspecto (recuadro discontinuo, círculo amarillo) está en catalogo.css, como los demás vacíos del catálogo.
export default function SinResultadosBusqueda({ q }) {
  return (
    <div className="busqueda-sin-resultados" role="status">
      <span className="catalogo-estado-icono" aria-hidden="true"><SearchX size={52} strokeWidth={2} /></span>
      <p className="busqueda-sin-resultados-titulo">{textoSinResultados(q)}</p>
      <p>{TEXTOS.consejo}</p>
      <Link to={RUTA_CATALOGO} className="boton-enlace">{TEXTOS.quitarTodo}</Link>
    </div>
  );
}
