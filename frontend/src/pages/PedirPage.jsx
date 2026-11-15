import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { fotosDelDetalle } from '../anuncios/detalleOtroCentro.js';
import { obtenerAnuncioDelCatalogo } from '../api/anuncios.js';
import { useCentro } from '../centro/useCentro.js';
import Aviso from '../components/Aviso.jsx';
import DialogoConfirmacion from '../components/DialogoConfirmacion.jsx';
import { crearPedido } from '../pedidos/api.js';
import {
  CAMPOS_DIRECCION, MAX_MENSAJE, TEXTOS, avisoEfectivoConEnvio, direccionInicial, hayCambios, leerUnidades,
  resultadoDelFallo, sePuedePedir, textoDisponibles, textoModalidad, textoTotal, validarPedido,
} from '../pedidos/pedir.js';
import { PROVINCIAS } from '../validacion/entrega-pedido.js';
import '../pedidos/pedir.css';

const FORMULARIO_INICIAL = { unidades: '1', mensaje: '', metodoPago: null, metodoEntrega: null, direccion: null };

// Orden de los campos para llevar el foco al primer error tras «Enviar pedido».
const ORDEN_ERRORES = [
  'unidades', 'metodo_pago', 'metodo_entrega', ...CAMPOS_DIRECCION.map((campo) => `direccion_envio.${campo.nombre}`), 'mensaje',
];
const idDe = (clave) => `pedir-${clave.replace('direccion_envio.', 'direccion-')}`;

// Quita el error de un campo cuando se corrige (sin crear un objeto nuevo si no lo tenía).
function sinError(errores, clave) {
  if (!errores[clave]) return errores;
  const resto = { ...errores };
  delete resto[clave];
  return resto;
}

// US-32 T32-4 (+ US-35 T35-3 y US-40 T40-4): /anuncios/:id/pedir · «Hacer un pedido» sobre un anuncio de otro centro.
export default function PedirPage() {
  const { id } = useParams();
  const [intento, setIntento] = useState(0);
  const [carga, setCarga] = useState(null);

  // El anuncio sale de GET /api/catalogo/:id (US-24): resumen, modalidad, precio y unidades disponibles.
  const clave = `${id}#${intento}`;
  useEffect(() => {
    const control = new AbortController();
    obtenerAnuncioDelCatalogo(id, { signal: control.signal })
      .then((anuncio) => setCarga({ clave, anuncio }))
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setCarga({ clave, noDisponible: fallo?.status === 404, error: fallo?.status !== 404 });
      });
    return () => control.abort();
  }, [id, clave]);

  const actual = carga?.clave === clave ? carga : null;

  if (!actual) return <p className="pagina intro-text" role="status">{TEXTOS.cargando}</p>;
  if (actual.error) {
    return (
      <section className="pagina pagina-pedir">
        <p className="intro-text" role="alert">{TEXTOS.error}</p>
        <button type="button" className="pedir-boton" onClick={() => setIntento((n) => n + 1)}>{TEXTOS.reintentar}</button>
      </section>
    );
  }
  // CA5: anuncio propio, no activo o inexistente.
  if (actual.noDisponible || !sePuedePedir(actual.anuncio)) return <NoDisponible />;
  return <FormularioPedido key={actual.anuncio.id} anuncio={actual.anuncio} />;
}

function NoDisponible() {
  return (
    <section className="pagina pagina-pedir" aria-labelledby="titulo-pagina">
      <h1 id="titulo-pagina">{TEXTOS.titulo}</h1>
      <div className="pedir-no-disponible">
        <p>{TEXTOS.noDisponible}</p>
        <Link to="/catalogo">{TEXTOS.volverAlCatalogo}</Link>
      </div>
    </section>
  );
}

function FormularioPedido({ anuncio }) {
  const navigate = useNavigate();
  const { centro } = useCentro();
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [errores, setErrores] = useState({});
  const [maximo, setMaximo] = useState(anuncio.unidades_disponibles);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [noDisponible, setNoDisponible] = useState(false);
  const [preguntandoSalir, setPreguntandoSalir] = useState(false);
  const venta = anuncio.modalidad !== 'donacion';
  const foto = useMemo(() => fotosDelDetalle(anuncio.fotos)[0]?.url ?? null, [anuncio.fotos]);
  const unidades = leerUnidades(formulario.unidades, maximo);
  const volver = `/anuncios/${anuncio.id}`;

  // Claves de error de la API para cada campo del formulario.
  const CLAVE_ERROR = { unidades: 'unidades', mensaje: 'mensaje', metodoPago: 'metodo_pago' };

  function cambiar(nombre, valor) {
    setFormulario((anterior) => ({ ...anterior, [nombre]: valor }));
    setErrores((anteriores) => sinError(anteriores, CLAVE_ERROR[nombre]));
  }

  // US-40 CA3: la primera vez que se elige envío, la dirección se rellena con los datos del centro.
  function elegirEntrega(metodo) {
    setFormulario((anterior) => ({
      ...anterior,
      metodoEntrega: metodo,
      direccion: metodo === 'envio' && !anterior.direccion ? direccionInicial(centro) : anterior.direccion,
    }));
    setErrores((anteriores) => sinError(anteriores, 'metodo_entrega'));
  }

  // US-40 CA10: el error de coherencia va bajo «Código postal»; cambiar el CP o la provincia lo quita (E2E-3).
  function cambiarDireccion(nombre, valor) {
    setFormulario((anterior) => ({ ...anterior, direccion: { ...anterior.direccion, [nombre]: valor } }));
    const enlazados = ['codigo_postal', 'provincia'].includes(nombre) ? ['codigo_postal', 'provincia'] : [nombre];
    setErrores((anteriores) => enlazados.reduce((errores, campo) => sinError(errores, `direccion_envio.${campo}`), anteriores));
  }

  // CA7: − y + no salen de 1 ni del máximo.
  function sumarUnidades(paso) {
    const actualValida = unidades ?? 1;
    cambiar('unidades', String(Math.min(maximo, Math.max(1, actualValida + paso))));
  }

  function mostrarErrores(nuevos) {
    setErrores(nuevos);
    const primero = ORDEN_ERRORES.find((claveError) => nuevos[claveError]);
    if (primero) document.getElementById(idDe(primero))?.focus();
  }

  // CA10: «Enviar pedido» siempre habilitado; valida en la web y, si hay errores, no envía.
  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) return;
    const { errores: nuevos, cuerpo } = validarPedido(anuncio, formulario, maximo);
    if (nuevos) {
      mostrarErrores(nuevos);
      return;
    }
    setErrores({});
    setEnviando(true);
    try {
      const pedido = await crearPedido(cuerpo);
      // CA14: al detalle del pedido con el aviso verde.
      navigate(`/pedidos/${pedido.id}`, { state: { aviso: { tipo: 'exito', texto: TEXTOS.enviado } } });
    } catch (fallo) {
      setEnviando(false);
      const resultado = resultadoDelFallo(fallo, anuncio.id);
      if (resultado.maximo) setMaximo(resultado.maximo);
      if (resultado.errores) mostrarErrores(resultado.errores);
      if (resultado.noDisponible) setNoDisponible(true);
      if (resultado.irA) {
        navigate(resultado.irA, resultado.aviso ? { state: { aviso: { tipo: 'error', texto: resultado.aviso } } } : undefined);
      } else if (resultado.aviso) {
        setAviso({ tipo: 'error', texto: resultado.aviso });
      }
    }
  }

  // CA6: «Cancelar» pregunta antes de salir si se ha cambiado algo.
  function cancelar() {
    if (hayCambios(FORMULARIO_INICIAL, formulario)) setPreguntandoSalir(true);
    else navigate(volver);
  }

  if (noDisponible) return <NoDisponible />;

  const avisoEfectivo = avisoEfectivoConEnvio(formulario);
  const error = (clave) => errores[clave] && <p id={`${idDe(clave)}-error`} className="pedir-error">{errores[clave]}</p>;
  const describir = (clave, ayuda) => [ayuda, errores[clave] && `${idDe(clave)}-error`].filter(Boolean).join(' ') || undefined;

  return (
    <>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <section className="pagina pagina-pedir" aria-labelledby="titulo-pagina">
        <h1 id="titulo-pagina">{TEXTOS.titulo}</h1>

        {/* (1) Tarjeta resumen del anuncio. */}
        <div className="pedir-resumen">
          <div className="pedir-resumen-foto">
            {foto ? <img src={foto} alt="" /> : <span>Sin foto</span>}
          </div>
          <div className="pedir-resumen-datos">
            <p className="pedir-resumen-titulo">{anuncio.titulo}</p>
            <p className="pedir-resumen-centro">{anuncio.centro?.nombre} · {anuncio.centro?.localidad}</p>
            <p className="pedir-resumen-modalidad">{textoModalidad(anuncio)}</p>
            <p className="pedir-resumen-disponibles">{textoDisponibles(maximo)}</p>
          </div>
        </div>

        <form className="pedir-formulario" onSubmit={enviar} noValidate>
          {/* (2) «Unidades» con − y + (CA7). */}
          <div className="pedir-campo">
            <label htmlFor={idDe('unidades')}>{TEXTOS.unidades}</label>
            <div className="pedir-unidades">
              <button type="button" className="pedir-paso" aria-label={TEXTOS.menos} disabled={(unidades ?? 1) <= 1}
                onClick={() => sumarUnidades(-1)}>−</button>
              <input id={idDe('unidades')} type="number" inputMode="numeric" min={1} max={maximo} step={1}
                value={formulario.unidades} onChange={(evento) => cambiar('unidades', evento.target.value)}
                aria-invalid={errores.unidades ? 'true' : undefined} aria-describedby={describir('unidades')} />
              <button type="button" className="pedir-paso" aria-label={TEXTOS.mas} disabled={(unidades ?? 0) >= maximo}
                onClick={() => sumarUnidades(1)}>+</button>
            </div>
            {error('unidades')}
          </div>

          {/* (3) US-35: «Forma de pago», solo en venta y sin opción marcada al principio. */}
          {venta && (
            <fieldset className="pedir-grupo">
              <legend>{TEXTOS.formaPago}</legend>
              <Opcion id={idDe('metodo_pago')} nombre="metodo_pago" valor="transferencia" texto={TEXTOS.transferencia}
                ayuda={TEXTOS.ayudaTransferencia} elegido={formulario.metodoPago} onElegir={(valor) => cambiar('metodoPago', valor)}
                describir={describir('metodo_pago', 'ayuda-transferencia')} idAyuda="ayuda-transferencia" />
              <Opcion id="pedir-pago-efectivo" nombre="metodo_pago" valor="efectivo_recogida" texto={TEXTOS.efectivo}
                ayuda={TEXTOS.ayudaEfectivo} elegido={formulario.metodoPago} onElegir={(valor) => cambiar('metodoPago', valor)}
                describir={describir('metodo_pago', 'ayuda-efectivo')} idAyuda="ayuda-efectivo" />
              {error('metodo_pago')}
            </fieldset>
          )}

          {/* (4) US-40: «Entrega», sin opción marcada al principio. */}
          <fieldset className="pedir-grupo">
            <legend>{TEXTOS.entrega}</legend>
            <Opcion id={idDe('metodo_entrega')} nombre="metodo_entrega" valor="recogida" texto={TEXTOS.recogida}
              elegido={formulario.metodoEntrega} onElegir={elegirEntrega} describir={describir('metodo_entrega')} />
            <Opcion id="pedir-entrega-envio" nombre="metodo_entrega" valor="envio" texto={TEXTOS.envio}
              elegido={formulario.metodoEntrega} onElegir={elegirEntrega} describir={describir('metodo_entrega')} />
            <p className="pedir-ayuda">{TEXTOS.ayudaEntrega}</p>
            {error('metodo_entrega')}
            {avisoEfectivo && <p className="pedir-advertencia">{avisoEfectivo}</p>}

            {formulario.metodoEntrega === 'envio' && formulario.direccion && (
              <div className="pedir-direccion">
                {CAMPOS_DIRECCION.map(({ nombre, etiqueta }) => {
                  const claveError = `direccion_envio.${nombre}`;
                  const comunes = {
                    id: idDe(claveError),
                    value: formulario.direccion[nombre] ?? '',
                    onChange: (evento) => cambiarDireccion(nombre, evento.target.value),
                    'aria-invalid': errores[claveError] ? 'true' : undefined,
                    'aria-describedby': describir(claveError),
                  };
                  return (
                    <div key={nombre} className={`pedir-campo pedir-campo-${nombre}`}>
                      <label htmlFor={comunes.id}>{etiqueta}</label>
                      {nombre === 'provincia' && (
                        <select {...comunes}>
                          <option value="">Elige una provincia</option>
                          {PROVINCIAS.map((provincia) => <option key={provincia} value={provincia}>{provincia}</option>)}
                        </select>
                      )}
                      {nombre === 'indicaciones' && <textarea rows={3} {...comunes} />}
                      {!['provincia', 'indicaciones'].includes(nombre) && (
                        <input type={nombre === 'telefono_contacto' ? 'tel' : 'text'}
                          inputMode={nombre === 'codigo_postal' ? 'numeric' : undefined} {...comunes} />
                      )}
                      {error(claveError)}
                    </div>
                  );
                })}
              </div>
            )}
          </fieldset>

          {/* (5) «Mensaje para el vendedor (opcional)» con contador (CA8). */}
          <div className="pedir-campo">
            <label htmlFor={idDe('mensaje')}>{TEXTOS.mensaje}</label>
            <textarea id={idDe('mensaje')} rows={4} value={formulario.mensaje}
              onChange={(evento) => cambiar('mensaje', evento.target.value)}
              aria-invalid={errores.mensaje ? 'true' : undefined} aria-describedby={describir('mensaje', 'contador-mensaje')} />
            <p id="contador-mensaje" className="pedir-contador">{[...formulario.mensaje].length}/{MAX_MENSAJE}</p>
            {error('mensaje')}
          </div>

          {/* (6) y (7): total (CA9) y, en venta, que Sportsplace no gestiona el dinero. */}
          <div className="pedir-total">
            <p className="pedir-total-importe">{textoTotal(anuncio, formulario.unidades)}</p>
            {venta && <p className="pedir-ayuda">{TEXTOS.avisoDinero}</p>}
          </div>

          {/* (8) «Enviar pedido» y «Cancelar» (CA6, CA10). */}
          <div className="pedir-botones">
            <button type="submit" className="pedir-boton" disabled={enviando}>{enviando ? TEXTOS.enviando : TEXTOS.enviar}</button>
            <button type="button" className="pedir-boton pedir-boton-secundario" onClick={cancelar} disabled={enviando}>
              {TEXTOS.cancelar}
            </button>
          </div>
        </form>
      </section>

      <DialogoConfirmacion abierto={preguntandoSalir} titulo={TEXTOS.salirTitulo} texto={TEXTOS.salirTexto}
        textoConfirmar={TEXTOS.salir} textoCancelar={TEXTOS.seguir}
        onConfirmar={() => navigate(volver)} onCancelar={() => setPreguntandoSalir(false)} />
    </>
  );
}

// Una opción de radio con su ayuda debajo, fuera de la etiqueta: el nombre accesible es solo el texto del CA.
function Opcion({ id, nombre, valor, texto, ayuda, idAyuda, elegido, onElegir, describir }) {
  return (
    <div className={elegido === valor ? 'pedir-opcion elegida' : 'pedir-opcion'}>
      <input id={id} type="radio" name={nombre} value={valor} checked={elegido === valor}
        onChange={() => onElegir(valor)} aria-describedby={describir} />
      <label htmlFor={id}>{texto}</label>
      {ayuda && <p id={idAyuda} className="pedir-ayuda">{ayuda}</p>}
    </div>
  );
}
