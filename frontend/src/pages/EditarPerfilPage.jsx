import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorApi } from '../api/cliente.js';
import { actualizarMiCentro } from '../api/centros.js';
import { useCentro } from '../centro/useCentro.js';
import Aviso from '../components/Aviso.jsx';
import DialogoConfirmacion from '../components/DialogoConfirmacion.jsx';
import { DIALOGO_DESCARTAR, resultadoDelGuardado, TEXTOS_PERFIL } from '../perfil/perfil.js';
import {
  cuerpoDelPerfil,
  DESCRIPCION_MAX,
  hayCambios,
  longitud,
  validarPerfil,
  valoresDelCentro,
} from '../validacion/perfil.js';

// US-07: /perfil/editar · formulario «Editar perfil» (PATCH /api/centros/mio).
export default function EditarPerfilPage() {
  const { centro, cargando, error, recargar } = useCentro();

  return (
    <section className="pagina pagina-anuncio pagina-perfil" aria-labelledby="titulo-pagina" aria-busy={cargando || undefined}>
      <h1 id="titulo-pagina">Editar perfil</h1>

      {cargando && <p className="intro-text" role="status">{TEXTOS_PERFIL.cargando}</p>}

      {error && (
        <div className="ficha-error">
          <p className="intro-text" role="alert">{TEXTOS_PERFIL.errorCarga}</p>
          <button type="button" onClick={recargar}>{TEXTOS_PERFIL.reintentar}</button>
        </div>
      )}

      {/* CA3: el formulario empieza con los valores actuales del centro. */}
      {centro && <FormularioPerfil centro={centro} />}
    </section>
  );
}

function FormularioPerfil({ centro }) {
  const { actualizarCentro } = useCentro();
  const navigate = useNavigate();
  const [valores, setValores] = useState(() => valoresDelCentro(centro));
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [descartando, setDescartando] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const formulario = useRef(null);
  const cerrarAviso = useCallback(() => setAviso(null), []);
  const cambiado = hayCambios(valores, centro);

  // Tras un envío con errores en los campos, el foco va al primero.
  useEffect(() => {
    if (intentosFallidos > 0) {
      formulario.current?.querySelector('[aria-invalid="true"]')?.focus();
    }
  }, [intentosFallidos]);

  // Los errores se vuelven a validar al corregir el campo (guía común, «Formularios»).
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
    if (enviando || !cambiado) return;

    setAviso(null);
    const erroresLocales = validarPerfil(valores);
    if (Object.keys(erroresLocales).length > 0) {
      setErrores(erroresLocales);
      setIntentosFallidos((n) => n + 1);
      return;
    }

    setErrores({});
    setEnviando(true);
    try {
      const actualizado = await actualizarMiCentro(cuerpoDelPerfil(valores));
      // CA14: el nombre nuevo aparece en el menú del centro sin recargar.
      actualizarCentro(actualizado);
      navigate('/perfil', { state: { aviso: { tipo: 'exito', texto: TEXTOS_PERFIL.actualizado } } });
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      const resultado = resultadoDelGuardado(fallo);
      if (resultado.errores) {
        setErrores(resultado.errores);
        setIntentosFallidos((n) => n + 1);
      } else {
        setAviso({ tipo: 'error', texto: resultado.mensaje });
      }
      setEnviando(false);
    }
  }

  // CA4: «Cancelar» vuelve a /perfil sin llamar a la API; con cambios, primero pide confirmación.
  function cancelar() {
    if (cambiado) setDescartando(true);
    else navigate('/perfil');
  }

  const caracteresDescripcion = longitud(valores.descripcion);

  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <form ref={formulario} className="formulario formulario-anuncio" onSubmit={guardar} noValidate>
        <CampoPerfil id="nombre" etiqueta="Nombre del centro" obligatorio error={errores.nombre}>
          <input type="text" autoComplete="organization" value={valores.nombre} onChange={cambiar} />
        </CampoPerfil>
        <CampoPerfil id="descripcion" etiqueta="Descripción" error={errores.descripcion}
          contador={{ actual: caracteresDescripcion, maximo: DESCRIPCION_MAX }}>
          <textarea rows={6} value={valores.descripcion} onChange={cambiar} />
        </CampoPerfil>
        <CampoPerfil id="telefono" etiqueta="Teléfono de contacto" error={errores.telefono}>
          <input type="tel" autoComplete="tel" value={valores.telefono} onChange={cambiar} />
        </CampoPerfil>
        <CampoPerfil id="email_contacto" etiqueta="Email de contacto" error={errores.email_contacto}>
          <input type="email" autoComplete="email" value={valores.email_contacto} onChange={cambiar} />
        </CampoPerfil>
        <CampoPerfil id="web" etiqueta="Web" error={errores.web}>
          <input type="url" autoComplete="url" value={valores.web} onChange={cambiar} />
        </CampoPerfil>

        <div className="formulario-botones">
          <button type="button" className="boton-secundario" onClick={cancelar} disabled={enviando}>Cancelar</button>
          {/* CA12 y CA13: deshabilitado sin cambios o mientras se envía. */}
          <button type="submit" disabled={enviando || !cambiado}>
            {enviando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <DialogoConfirmacion abierto={descartando} titulo={DIALOGO_DESCARTAR.titulo} texto={DIALOGO_DESCARTAR.texto}
        textoConfirmar={DIALOGO_DESCARTAR.confirmar} textoCancelar={DIALOGO_DESCARTAR.cancelar}
        onConfirmar={() => navigate('/perfil')} onCancelar={() => setDescartando(false)} />
    </>
  );
}

// Etiqueta (con «*» si es obligatorio, por CSS), el control, el error debajo y, si lo hay, el contador «n/máx» (CA7).
// Los opcionales no llevan «(opcional)»: las etiquetas son las de la especificación.
function CampoPerfil({ id, etiqueta, obligatorio = false, error, contador, children }) {
  const idError = `${id}-error`;
  const idContador = `${id}-contador`;
  const excedido = contador && contador.actual > contador.maximo;
  const describe = [error && idError, contador && idContador].filter(Boolean).join(' ') || undefined;

  return (
    <div className={obligatorio ? 'campo campo-obligatorio' : 'campo'}>
      {/* El «*» de obligatorio va por CSS: así la etiqueta es exactamente la de la especificación. */}
      <label htmlFor={id}>{etiqueta}</label>
      {cloneElement(children, {
        id,
        name: id,
        required: obligatorio || undefined,
        'aria-required': obligatorio ? 'true' : undefined,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': describe,
      })}
      {(error || contador) && (
        <div className="campo-pie">
          {error ? <p id={idError} className="campo-error">{error}</p> : <span />}
          {contador && (
            <span id={idContador} className={excedido ? 'contador contador-excedido' : 'contador'}>
              {contador.actual}/{contador.maximo}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
