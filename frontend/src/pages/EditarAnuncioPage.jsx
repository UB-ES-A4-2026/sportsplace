import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ErrorApi } from '../api/cliente.js';
import { editarAnuncio, obtenerAnuncio } from '../api/anuncios.js';
import {
  AVISO_GUARDADO,
  cuerpoDeLaEdicion,
  DIALOGO_DESCARTAR,
  fotosDelAnuncio,
  MENSAJE_NO_EDITABLE,
  puedeEditar,
  valoresDelAnuncio,
} from '../anuncios/editar.js';
import { resultadoDeLaCarga } from '../anuncios/ficha.js';
import AnuncioNoEncontrado from '../components/AnuncioNoEncontrado.jsx';
import FormularioAnuncio from '../components/FormularioAnuncio.jsx';

// US-15 T15-2: /anuncios/:id/editar · «Editar anuncio», el formulario de US-12 con los datos actuales
// y fotos actuales (PATCH /api/anuncios/:id, contrato de T15-1).
export default function EditarAnuncioPage() {
  const { id } = useParams();
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);

  // Cada carga se identifica por id + intento: mientras no llega su resultado, se muestra «Cargando…».
  const clave = `${id}#${intento}`;

  useEffect(() => {
    const control = new AbortController();
    obtenerAnuncio(id, { signal: control.signal })
      .then((anuncio) => setResultado({ clave, anuncio }))
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setResultado({ clave, ...resultadoDeLaCarga(fallo) });
      });
    return () => control.abort();
  }, [id, clave]);

  const actual = resultado?.clave === clave ? resultado : null;

  if (actual?.noEncontrado) return <AnuncioNoEncontrado />;

  // CA2: un anuncio que ya no se puede editar (entregado) lleva a su ficha con el aviso rojo.
  if (actual?.anuncio && !puedeEditar(actual.anuncio.estado)) {
    return (
      <Navigate to={`/anuncios/${encodeURIComponent(id)}`} replace
        state={{ aviso: { tipo: 'error', texto: MENSAJE_NO_EDITABLE } }} />
    );
  }

  return (
    <section className="pagina pagina-anuncio" aria-labelledby="titulo-pagina" aria-busy={!actual || undefined}>
      <h1 id="titulo-pagina">Editar anuncio</h1>

      {!actual && <p className="intro-text" role="status">Cargando…</p>}

      {actual?.error && (
        <div className="ficha-error">
          <p className="intro-text" role="alert">No se ha podido cargar. </p>
          <button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        </div>
      )}

      {actual?.anuncio && (
        <>
          <p className="intro-text">Los campos marcados con * son obligatorios.</p>
          <FormularioEdicion anuncio={actual.anuncio} />
        </>
      )}
    </section>
  );
}

function FormularioEdicion({ anuncio }) {
  const navigate = useNavigate();
  // Se calculan una vez: son la referencia para saber si «Cancelar» tiene que preguntar (CA3).
  const [iniciales] = useState(() => ({ valores: valoresDelAnuncio(anuncio), fotos: fotosDelAnuncio(anuncio) }));
  const ficha = `/anuncios/${encodeURIComponent(anuncio.id)}`;

  // CA4: tras guardar, a la ficha con `replace` y «Cambios guardados.». CA20: si mientras tanto se ha entregado (409),
  // a la ficha con «Este anuncio ya no se puede editar.». El resto de fallos los muestra el formulario (CA5, CA10).
  async function guardar(cuerpo, fotos) {
    try {
      await editarAnuncio(anuncio.id, cuerpoDeLaEdicion(cuerpo, fotos));
    } catch (fallo) {
      if (fallo instanceof ErrorApi && fallo.status === 409 && fallo.code === 'ANUNCIO_NO_EDITABLE') {
        navigate(ficha, { replace: true, state: { aviso: { tipo: 'error', texto: MENSAJE_NO_EDITABLE } } });
        return;
      }
      throw fallo;
    }
    navigate(ficha, { replace: true, state: { aviso: { tipo: 'exito', texto: AVISO_GUARDADO } } });
  }

  return (
    <FormularioAnuncio
      valoresIniciales={iniciales.valores}
      fotosIniciales={iniciales.fotos}
      textoEnviar="Guardar cambios"
      textoEnviando="Guardando…"
      dialogoSalir={DIALOGO_DESCARTAR}
      destinoCancelar={ficha}
      onEnviar={guardar}
    />
  );
}
