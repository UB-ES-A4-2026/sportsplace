import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorApi } from '../api/cliente.js';
import { guardarUbicacion } from '../api/centros.js';
import { useCentro } from '../centro/useCentro.js';
import Aviso from '../components/Aviso.jsx';
import CampoPerfil from '../components/CampoPerfil.jsx';
import { TEXTOS_PERFIL } from '../perfil/perfil.js';
import { resultadoDeLaUbicacion, TEXTOS_UBICACION } from '../perfil/ubicacion.js';
import { cuerpoDeUbicacion, validarUbicacion, valoresDeUbicacion } from '../validacion/ubicacion.js';

// US-68: /perfil/ubicacion · «Ubicación del centro» (PUT /api/centros/mio/ubicacion). Privada (CA1).
export default function UbicacionPage() {
  const { centro, cargando, error, recargar } = useCentro();

  return (
    <section className="pagina pagina-anuncio pagina-perfil" aria-labelledby="titulo-pagina" aria-busy={cargando || undefined}>
      <h1 id="titulo-pagina">Ubicación del centro</h1>
      <p className="intro-text">{TEXTOS_UBICACION.explicacion}</p>

      {cargando && <p className="intro-text" role="status">{TEXTOS_PERFIL.cargando}</p>}

      {error && (
        <div className="ficha-error">
          <p className="intro-text" role="alert">{TEXTOS_PERFIL.errorCarga}</p>
          <button type="button" onClick={recargar}>{TEXTOS_PERFIL.reintentar}</button>
        </div>
      )}

      {/* CA1: el formulario empieza con los valores actuales del centro. */}
      {centro && <FormularioUbicacion centro={centro} />}
    </section>
  );
}

function FormularioUbicacion({ centro }) {
  const { actualizarCentro } = useCentro();
  const navigate = useNavigate();
  const [valores, setValores] = useState(() => valoresDeUbicacion(centro));
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const formulario = useRef(null);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // Tras un envío con errores en los campos, el foco va al primero.
  useEffect(() => {
    if (intentosFallidos > 0) {
      formulario.current?.querySelector('[aria-invalid="true"]')?.focus();
    }
  }, [intentosFallidos]);

  function cambiar(evento) {
    const { name, value } = evento.target;
    setValores((anteriores) => ({ ...anteriores, [name]: value }));
    setErrores((anteriores) => {
      if (!anteriores[name]) return anteriores;
      const resto = { ...anteriores };
      delete resto[name];
      return resto;
    });
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (enviando) return;

    setAviso(null);
    const erroresLocales = validarUbicacion(valores);
    if (Object.keys(erroresLocales).length > 0) {
      setErrores(erroresLocales);
      setIntentosFallidos((n) => n + 1);
      return;
    }

    setErrores({});
    setEnviando(true);
    try {
      const actualizado = await guardarUbicacion(cuerpoDeUbicacion(valores));
      // CA7: el centro devuelto ya trae provincia y coordenadas; /perfil lo muestra sin volver a cargar.
      actualizarCentro(actualizado);
      navigate('/perfil', { state: { aviso: { tipo: 'exito', texto: TEXTOS_UBICACION.guardada } } });
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      const resultado = resultadoDeLaUbicacion(fallo);
      if (resultado.errores) {
        setErrores(resultado.errores);
        setIntentosFallidos((n) => n + 1);
      } else {
        setAviso({ tipo: 'error', texto: resultado.mensaje });
      }
      setEnviando(false);
    }
  }

  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <form ref={formulario} className="formulario formulario-anuncio" onSubmit={guardar} noValidate>
        <CampoPerfil id="direccion" etiqueta="Dirección" error={errores.direccion}>
          <input type="text" autoComplete="street-address" value={valores.direccion} onChange={cambiar} />
        </CampoPerfil>
        <CampoPerfil id="codigo_postal" etiqueta="Código postal" obligatorio error={errores.codigo_postal}>
          <input type="text" inputMode="numeric" autoComplete="postal-code" maxLength={10}
            value={valores.codigo_postal} onChange={cambiar} />
        </CampoPerfil>
        <CampoPerfil id="localidad" etiqueta="Localidad" obligatorio error={errores.localidad}>
          <input type="text" autoComplete="address-level2" value={valores.localidad} onChange={cambiar} />
        </CampoPerfil>

        <div className="formulario-botones">
          {/* CA2: «Cancelar» vuelve a /perfil sin guardar. */}
          <button type="button" className="boton-secundario" onClick={() => navigate('/perfil')} disabled={enviando}>
            Cancelar
          </button>
          {/* CA9: «Guardando…» durante el envío. */}
          <button type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar ubicación'}</button>
        </div>
      </form>
    </>
  );
}
