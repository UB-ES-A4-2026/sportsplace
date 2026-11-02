import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { formatearFecha } from '../anuncios/ficha.js';
import { useCentro } from '../centro/useCentro.js';
import Aviso from '../components/Aviso.jsx';
import { TEXTOS_PERFIL } from '../perfil/perfil.js';
import { faltaCodigoPostal, textoDireccion, textoZona, TEXTOS_UBICACION } from '../perfil/ubicacion.js';

// US-07: /perfil · «Mi perfil», vista previa propia de los datos del centro (GET /api/centros/mio).
export default function PerfilPage() {
  const { centro, cargando, error, recargar } = useCentro();
  const location = useLocation();
  const navigate = useNavigate();
  // CA5: «Perfil actualizado.» llega en `state.aviso` desde /perfil/editar.
  const [aviso, setAviso] = useState(() => location.state?.aviso ?? null);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // El aviso se muestra una vez: se quita del historial para que no vuelva a salir al recargar.
  useEffect(() => {
    if (location.state?.aviso) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <section className="pagina pagina-anuncio pagina-perfil" aria-labelledby="titulo-pagina" aria-busy={cargando || undefined}>
        <h1 id="titulo-pagina">Mi perfil</h1>

        {cargando && <p className="intro-text" role="status">{TEXTOS_PERFIL.cargando}</p>}

        {error && (
          <div className="ficha-error">
            <p className="intro-text" role="alert">{TEXTOS_PERFIL.errorCarga}</p>
            <button type="button" onClick={recargar}>{TEXTOS_PERFIL.reintentar}</button>
          </div>
        )}

        {centro && <DatosDelCentro centro={centro} />}
      </section>
    </>
  );
}

function DatosDelCentro({ centro }) {
  return (
    <>
      <h2 className="perfil-nombre">{centro.nombre}</h2>
      <p className="perfil-localidad">{centro.localidad}</p>

      {/* US-68 CA10: los centros sin código postal (Sprint 0) ven la banda amarilla hasta indicarlo. */}
      {faltaCodigoPostal(centro) && (
        <div className="perfil-banda" role="status">
          <p>{TEXTOS_UBICACION.banda}</p>
          <Link to="/perfil/ubicacion" className="boton-enlace">{TEXTOS_UBICACION.indicar}</Link>
        </div>
      )}

      <section className="perfil-bloque" aria-labelledby="titulo-sobre-nosotros">
        <h3 id="titulo-sobre-nosotros">Sobre nosotros</h3>
        {/* CA15: React escapa el texto (<b>hola</b> se ve literal); los saltos de línea se respetan con CSS. */}
        {centro.descripcion
          ? <p className="perfil-descripcion">{centro.descripcion}</p>
          : <p className="perfil-vacio">{TEXTOS_PERFIL.sinDescripcion}</p>}
      </section>

      <section className="perfil-bloque" aria-labelledby="titulo-contacto">
        <h3 id="titulo-contacto">Contacto</h3>
        <dl className="perfil-contacto">
          <dt>Teléfono</dt>
          <dd>{centro.telefono ?? TEXTOS_PERFIL.sinDato}</dd>
          <dt>Email de contacto</dt>
          <dd>{centro.email_contacto ?? TEXTOS_PERFIL.sinDato}</dd>
          <dt>Web</dt>
          <dd>
            {centro.web
              ? <a href={centro.web} target="_blank" rel="noopener noreferrer">{centro.web}</a>
              : TEXTOS_PERFIL.sinDato}
          </dd>
        </dl>
      </section>

      {/* US-68: zona (localidad y provincia) y dirección completa, que solo ve el propio centro (CA14). */}
      {!faltaCodigoPostal(centro) && (
        <section className="perfil-bloque" aria-labelledby="titulo-ubicacion">
          <h3 id="titulo-ubicacion">Ubicación</h3>
          <p className="perfil-ubicacion">{textoZona(centro)}</p>
          <p className="perfil-ubicacion">{textoDireccion(centro)}</p>
          <Link to="/perfil/ubicacion" className="boton-enlace boton-enlace-secundario">{TEXTOS_UBICACION.editar}</Link>
        </section>
      )}

      <p className="perfil-desde">En Sportsplace desde {formatearFecha(centro.creado_en)}</p>
      <Link to="/perfil/editar" className="boton-enlace">Editar perfil</Link>
    </>
  );
}
