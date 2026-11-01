import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorApi } from '../api/cliente.js';
import {
  anadirFotos,
  FOTOS_VACIAS,
  marcarPrincipal,
  quitarFoto,
  subidaLenta,
  validarFotos,
} from '../anuncios/fotos.js';
import { resultadoDelEnvio } from '../anuncios/publicar.js';
import { CATEGORIAS, DEPORTES, ESTADOS_MATERIAL } from '../anuncios/valores.js';
import {
  CAMPOS_ANUNCIO,
  cuerpoDelAnuncio,
  DESCRIPCION_MAX,
  haCambiado,
  longitud,
  TITULO_MAX,
  validarAnuncio,
  validarCampo,
  VALORES_VACIOS,
} from '../validacion/anuncio.js';
import Aviso from './Aviso.jsx';
import DialogoConfirmacion from './DialogoConfirmacion.jsx';
import SeccionFotos from './SeccionFotos.jsx';

// Formulario de anuncio reutilizable (US-12 T12-3; lo reutilizarán US-15, US-19 y US-90).
// Campos, reglas y mensajes de la «Tabla de campos» de E03. Valida todo al enviar, revalida cada campo
// al cambiarlo tras el primer intento, muestra los `details` de un 400 bajo su campo y conserva los datos si falla.
//
// - `onEnviar(cuerpo, fotos)`: hace la petición y, si va bien, navega. Si lanza un ErrorApi, el formulario muestra el error.
// - `dialogoSalir`: { titulo, texto, confirmar, cancelar } del diálogo que abre «Cancelar» con datos (CA9).
// - `destinoCancelar`: adónde lleva «Cancelar» (o «Salir» en el diálogo).
export default function FormularioAnuncio({
  valoresIniciales = VALORES_VACIOS,
  textoEnviar,
  textoEnviando,
  dialogoSalir,
  destinoCancelar = '/mis-anuncios',
  onEnviar,
}) {
  const navigate = useNavigate();
  const formulario = useRef(null);
  const enviandoAhora = useRef(false);
  const [valores, setValores] = useState(valoresIniciales);
  const [unidadesIlegibles, setUnidadesIlegibles] = useState(false);
  const [fotos, setFotos] = useState(FOTOS_VACIAS);
  const [mensajesFotos, setMensajesFotos] = useState([]);
  const [errores, setErrores] = useState({});
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // Las miniaturas son URLs de objeto: se liberan al quitar la foto y al salir del formulario.
  const vistas = useRef(new Set());
  useEffect(() => {
    const abiertas = vistas.current;
    return () => abiertas.forEach((vista) => URL.revokeObjectURL(vista));
  }, []);

  function enfocarPrimerError(lista) {
    const campo = [...CAMPOS_ANUNCIO, 'fotos'].find((nombre) => lista[nombre]);
    if (campo) formulario.current?.elements.namedItem(campo)?.focus();
  }

  // CA8: tras el primer intento, cada campo se vuelve a validar al cambiarlo.
  function actualizar(campo, valor, ilegible = unidadesIlegibles) {
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }));
    if (!intentado) return;
    const error = validarCampo(campo, valor, { ilegible });
    setErrores((anteriores) => {
      const siguientes = { ...anteriores };
      if (error) siguientes[campo] = error;
      else delete siguientes[campo];
      return siguientes;
    });
  }

  function cambiar(evento) {
    actualizar(evento.target.name, evento.target.value);
  }

  function cambiarUnidades(evento) {
    // Con texto que no es un número («abc»), el navegador deja `value` vacío y marca `badInput`.
    const ilegible = evento.target.validity?.badInput ?? false;
    setUnidadesIlegibles(ilegible);
    actualizar('unidades_disponibles', evento.target.value, ilegible);
  }

  // CA4: tras el primer intento, el error de la sección se actualiza al añadir o quitar fotos.
  function revalidarFotos(siguientes) {
    if (!intentado) return;
    const error = validarFotos(siguientes).fotos;
    setErrores((anteriores) => {
      const resto = { ...anteriores };
      if (error) resto.fotos = error;
      else delete resto.fotos;
      return resto;
    });
  }

  function anadirLasFotos(archivos) {
    const crearVista = (archivo) => {
      const vista = URL.createObjectURL(archivo);
      vistas.current.add(vista);
      return vista;
    };
    const resultado = anadirFotos(fotos, archivos, { crearVista });
    setFotos(resultado.estado);
    setMensajesFotos(resultado.mensajes);
    revalidarFotos(resultado.estado);
  }

  function quitarLaFoto(id) {
    const { estado, quitada } = quitarFoto(fotos, id);
    if (quitada?.vista) {
      URL.revokeObjectURL(quitada.vista);
      vistas.current.delete(quitada.vista);
    }
    setFotos(estado);
    setMensajesFotos([]);
    revalidarFotos(estado);
  }

  async function enviar(evento) {
    evento.preventDefault();
    // CA10: un segundo clic mientras se envía no hace otra petición.
    if (enviandoAhora.current) return;

    // CA7: se validan todos los campos a la vez; con errores, foco en el primero y ninguna petición.
    setIntentado(true);
    const erroresLocales = { ...validarAnuncio(valores, { unidadesIlegibles }), ...validarFotos(fotos) };
    setErrores(erroresLocales);
    if (Object.keys(erroresLocales).length > 0) {
      enfocarPrimerError(erroresLocales);
      return;
    }

    enviandoAhora.current = true;
    setEnviando(true);
    setAviso(null);
    try {
      await onEnviar(cuerpoDelAnuncio(valores), fotos);
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      const resultado = resultadoDelEnvio(fallo);
      if (resultado.errores) {
        setErrores(resultado.errores);
        enfocarPrimerError(resultado.errores);
      } else {
        setAviso({ tipo: 'error', texto: resultado.mensaje });
      }
    } finally {
      enviandoAhora.current = false;
      setEnviando(false);
    }
  }

  // CA9: sin tocar, «Cancelar» sale directamente; con datos, pregunta antes.
  function cancelar() {
    if (haCambiado(valores, valoresIniciales, { unidadesIlegibles, hayFotos: fotos.fotos.length > 0 })) {
      setDialogoAbierto(true);
    }
    else navigate(destinoCancelar);
  }

  const longitudTitulo = longitud(valores.titulo);
  const longitudDescripcion = longitud(valores.descripcion);

  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />

      <form ref={formulario} className="formulario formulario-anuncio" onSubmit={enviar} noValidate>
        <CampoAnuncio id="titulo" etiqueta="Título" error={errores.titulo}
          contador={{ actual: longitudTitulo, maximo: TITULO_MAX }}>
          <input type="text" value={valores.titulo} onChange={cambiar} autoComplete="off" />
        </CampoAnuncio>

        <CampoAnuncio id="descripcion" etiqueta="Descripción" error={errores.descripcion}
          contador={{ actual: longitudDescripcion, maximo: DESCRIPCION_MAX }}>
          <textarea rows={6} value={valores.descripcion} onChange={cambiar} />
        </CampoAnuncio>

        <CampoAnuncio id="categoria" etiqueta="Categoría" error={errores.categoria}>
          <Desplegable valor={valores.categoria} onChange={cambiar} vacio="Elige una categoría" opciones={CATEGORIAS} />
        </CampoAnuncio>

        <CampoAnuncio id="deporte" etiqueta="Deporte" error={errores.deporte}>
          <Desplegable valor={valores.deporte} onChange={cambiar} vacio="Elige un deporte" opciones={DEPORTES} />
        </CampoAnuncio>

        <CampoAnuncio id="unidades_disponibles" etiqueta="Unidades disponibles" error={errores.unidades_disponibles}>
          <input type="number" inputMode="numeric" min={1} max={9999} step={1}
            value={valores.unidades_disponibles} onChange={cambiarUnidades} />
        </CampoAnuncio>

        <CampoAnuncio id="estado_material" etiqueta="Estado del material" error={errores.estado_material}>
          <Desplegable valor={valores.estado_material} onChange={cambiar} vacio="Elige el estado"
            opciones={ESTADOS_MATERIAL} />
        </CampoAnuncio>

        <SeccionFotos
          estado={fotos}
          mensajes={mensajesFotos}
          error={errores.fotos}
          subiendo={enviando && subidaLenta(fotos)}
          deshabilitado={enviando}
          onAnadir={anadirLasFotos}
          onQuitar={quitarLaFoto}
          onPrincipal={(id) => setFotos((anteriores) => marcarPrincipal(anteriores, id))}
        />

        {/* [Depende de US-14] sección «Modalidad y precio» */}

        <div className="formulario-botones">
          <button type="button" className="boton-secundario" onClick={cancelar}>Cancelar</button>
          <button type="submit" disabled={enviando}>{enviando ? textoEnviando : textoEnviar}</button>
        </div>
      </form>

      <DialogoConfirmacion
        abierto={dialogoAbierto}
        titulo={dialogoSalir.titulo}
        texto={dialogoSalir.texto}
        textoConfirmar={dialogoSalir.confirmar}
        textoCancelar={dialogoSalir.cancelar}
        onConfirmar={() => { setDialogoAbierto(false); navigate(destinoCancelar); }}
        onCancelar={() => setDialogoAbierto(false)}
      />
    </>
  );
}

// Etiqueta «Campo *», el control, el error debajo y, si lo hay, el contador «n/máx» a la derecha (CA6).
function CampoAnuncio({ id, etiqueta, error, contador, children }) {
  const idError = `${id}-error`;
  const idContador = `${id}-contador`;
  const excedido = contador && contador.actual > contador.maximo;
  const describe = [error && idError, contador && idContador].filter(Boolean).join(' ') || undefined;

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}<span aria-hidden="true"> *</span></label>
      {/* El control llega como hijo; aquí se le añaden id, name y los atributos de accesibilidad. */}
      {cloneElement(children, {
        id,
        name: id,
        required: true,
        'aria-required': 'true',
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

function Desplegable({ valor, onChange, vacio, opciones, ...props }) {
  return (
    <select value={valor} onChange={onChange} {...props}>
      <option value="">{vacio}</option>
      {opciones.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
    </select>
  );
}
