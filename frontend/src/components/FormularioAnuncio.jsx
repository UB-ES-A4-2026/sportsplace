import { cloneElement, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorApi } from '../api/cliente.js';
import { resultadoDelEnvio } from '../anuncios/publicar.js';
import { CATEGORIAS, DEPORTES, ESTADOS_MATERIAL } from '../anuncios/valores.js';
import { validarModalidadPrecio } from '../validacion/modalidadPrecio.js';
import {
  CAMPOS_CON_ERROR,
  CAMPOS_MODALIDAD_PRECIO,
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
import SeccionModalidadPrecio from './SeccionModalidadPrecio.jsx';

// Formulario de anuncio reutilizable (US-12 T12-3; lo reutilizarán US-15, US-19 y US-90).
// Campos, reglas y mensajes de la «Tabla de campos» de E03. Valida todo al enviar, revalida cada campo
// al cambiarlo tras el primer intento, muestra los `details` de un 400 bajo su campo y conserva los datos si falla.
//
// - `onEnviar(cuerpo)`: hace la petición y, si va bien, navega. Si lanza un ErrorApi, el formulario muestra el error.
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
  const [errores, setErrores] = useState({});
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // Se busca por id (no por name): en «Modalidad» varios radios comparten name y el primero lleva el id del campo.
  function enfocarPrimerError(lista) {
    const campo = CAMPOS_CON_ERROR.find((nombre) => lista[nombre]);
    if (campo) formulario.current?.querySelector(`#${campo}`)?.focus();
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

  // US-14: «Modalidad y precio» se valida junta, porque el precio depende de la modalidad (CA2, CA5).
  // Cambiar a «Donación» quita el error del precio; el texto escrito se conserva por si vuelve a «Venta».
  function cambiarModalidadPrecio(campo, valor) {
    const siguientes = { ...valores, [campo]: valor };
    setValores(siguientes);
    if (!intentado) return;
    const nuevos = validarModalidadPrecio(siguientes);
    // Al marcar «Venta» el campo aparece vacío: el aviso de precio llega al enviar o al escribir, no antes.
    if (campo === 'modalidad' && siguientes.precio.trim() === '') delete nuevos.precio_unitario_centimos;
    setErrores((anteriores) => {
      const resto = { ...anteriores };
      for (const clave of CAMPOS_MODALIDAD_PRECIO) delete resto[clave];
      return { ...resto, ...nuevos };
    });
  }

  function cambiarUnidades(evento) {
    // Con texto que no es un número («abc»), el navegador deja `value` vacío y marca `badInput`.
    const ilegible = evento.target.validity?.badInput ?? false;
    setUnidadesIlegibles(ilegible);
    actualizar('unidades_disponibles', evento.target.value, ilegible);
  }

  async function enviar(evento) {
    evento.preventDefault();
    // CA10: un segundo clic mientras se envía no hace otra petición.
    if (enviandoAhora.current) return;

    // CA7: se validan todos los campos a la vez; con errores, foco en el primero y ninguna petición.
    setIntentado(true);
    const erroresLocales = validarAnuncio(valores, { unidadesIlegibles });
    setErrores(erroresLocales);
    if (Object.keys(erroresLocales).length > 0) {
      enfocarPrimerError(erroresLocales);
      return;
    }

    enviandoAhora.current = true;
    setEnviando(true);
    setAviso(null);
    try {
      await onEnviar(cuerpoDelAnuncio(valores));
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
    if (haCambiado(valores, valoresIniciales, { unidadesIlegibles })) setDialogoAbierto(true);
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

        {/* [Depende de US-13] sección «Fotos» va aquí, antes de «Modalidad y precio». */}

        <SeccionModalidadPrecio valores={valores} errores={errores} onCambio={cambiarModalidadPrecio} />

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
