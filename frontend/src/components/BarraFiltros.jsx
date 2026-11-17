import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, CircleAlert, FilterX, Info, SlidersHorizontal, X } from 'lucide-react';
import { CATEGORIAS, DEPORTES, ESTADOS_MATERIAL } from '../anuncios/valores.js';
import {
  busquedaDeUrl,
  conEstados,
  conFiltro,
  conPrecio,
  etiquetasActivas,
  MODALIDADES,
  sinEtiqueta,
  sinFiltros,
  TEXTOS,
  textoBotonEstado,
  textoBotonFiltros,
} from '../catalogo/filtros.js';
import '../catalogo/filtros.css';

// T21-6: barra de filtros de /catalogo (US-22, US-73 y US-74). Recibe lo que devuelve useFiltrosCatalogo()
// y llama a `onCambiar(parametros)` con la URL nueva; la pantalla navega y vuelve a pedir el catálogo.
export default function BarraFiltros({ parametros, filtros, onCambiar }) {
  // US-22: por debajo de 600 px la barra se pliega tras «Filtros (N)».
  const [abierta, setAbierta] = useState(false);
  const idBarra = useId();
  const etiquetas = etiquetasActivas(filtros);
  const donacion = filtros.modalidad === 'donacion';
  // US-73 CA2: con las 5 casillas marcadas la URL no lleva `estado_material`, pero las casillas siguen marcadas
  // mientras la URL sea la que dejó esa acción (si cambia por «Atrás», «Limpiar filtros» u otro filtro, se desmarcan).
  const [todosEn, setTodosEn] = useState(null);
  const todos = todosEn !== null && todosEn === busquedaDeUrl(parametros) && filtros.estados.length === 0;

  function cambiarEstados(estados) {
    const nuevos = conEstados(parametros, estados);
    setTodosEn(estados.length === ESTADOS_MATERIAL.length ? busquedaDeUrl(nuevos) : null);
    onCambiar(nuevos);
  }

  function aplicarPrecio(valores) {
    const resultado = conPrecio(parametros, valores);
    if (resultado.error) return resultado.error;
    onCambiar(resultado.parametros);
    return null;
  }

  return (
    <section className="filtros" aria-label="Filtros">
      <button type="button" className="filtros-movil s2-boton s2-boton-secundario" aria-expanded={abierta}
        aria-controls={idBarra} onClick={() => setAbierta((valor) => !valor)}>
        <SlidersHorizontal size={17} aria-hidden="true" />
        {textoBotonFiltros(filtros)}
      </button>

      <div id={idBarra} className={abierta ? 'filtros-barra abierta' : 'filtros-barra'}>
        <Desplegable etiqueta={TEXTOS.categoria} todas={TEXTOS.todasCategorias} opciones={CATEGORIAS}
          valor={filtros.categoria} onCambiar={(valor) => onCambiar(conFiltro(parametros, 'categoria', valor))} />
        <Desplegable etiqueta={TEXTOS.deporte} todas={TEXTOS.todosDeportes} opciones={DEPORTES}
          valor={filtros.deporte} onCambiar={(valor) => onCambiar(conFiltro(parametros, 'deporte', valor))} />
        <FiltroEstado estados={todos ? ESTADOS_MATERIAL.map((opcion) => opcion.valor) : filtros.estados}
          onCambiar={cambiarEstados} />
        <FiltroPrecio minimo={filtros.precioMin} maximo={filtros.precioMax} desactivado={donacion}
          onAplicar={aplicarPrecio} />
        <FiltroModalidad modalidad={filtros.modalidad}
          onCambiar={(valor) => onCambiar(conFiltro(parametros, 'modalidad', valor))} />
        {/* US-22 CA7: solo se ve con algún filtro activo. */}
        {etiquetas.length > 0 && (
          <button type="button" className="filtros-limpiar" onClick={() => onCambiar(sinFiltros(parametros))}>
            <FilterX size={16} aria-hidden="true" />
            {TEXTOS.limpiar}
          </button>
        )}
      </div>

      {etiquetas.length > 0 && (
        <ul className="filtros-etiquetas" aria-label="Filtros activos">
          {etiquetas.map(({ clave, texto }) => (
            <li key={clave} className="filtro-etiqueta">
              <span>{texto}</span>
              <button type="button" aria-label={`Quitar ${texto}`}
                onClick={() => onCambiar(sinEtiqueta(parametros, clave))}>
                <X size={14} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// US-22 CA1-CA5: selección única; la primera opción («Todas…/Todos…») quita el filtro.
function Desplegable({ etiqueta, todas, opciones, valor, onCambiar }) {
  return (
    <select className={valor ? 'filtro-desplegable activo' : 'filtro-desplegable'} aria-label={etiqueta} value={valor ?? ''}
      onChange={(evento) => onCambiar(evento.target.value)}>
      <option value="">{todas}</option>
      {opciones.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
    </select>
  );
}

// US-73 CA1-CA2: desplegable con 5 casillas que se aplican al marcarlas.
function FiltroEstado({ estados, onCambiar }) {
  const [abierto, setAbierto] = useState(false);
  // Las casillas cambian en el acto, sin esperar a que la navegación actualice la URL; si los estados cambian
  // desde fuera (URL, etiqueta o «Limpiar filtros»), se vuelven a tomar de ahí.
  const [marcados, setMarcados] = useState(estados);
  const [estadosVistos, setEstadosVistos] = useState(estados);
  if (estadosVistos.join(',') !== estados.join(',')) {
    setEstadosVistos(estados);
    setMarcados(estados);
  }
  const contenedor = useRef(null);
  const boton = useRef(null);
  const idPanel = useId();

  // Se cierra al pulsar fuera o con Escape. Con Escape desde dentro del panel, el foco vuelve al botón.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (evento) => { if (!contenedor.current?.contains(evento.target)) setAbierto(false); };
    const escape = (evento) => {
      if (evento.key !== 'Escape') return;
      if (contenedor.current?.contains(document.activeElement)) boton.current?.focus();
      setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  function alternar(valor, marcado) {
    const nuevos = marcado ? [...marcados, valor] : marcados.filter((estado) => estado !== valor);
    setMarcados(nuevos);
    onCambiar(nuevos);
  }

  return (
    <div className="filtro-estado" ref={contenedor}>
      <button ref={boton} type="button" className={marcados.length > 0 ? 'filtro-boton activo' : 'filtro-boton'}
        aria-expanded={abierto} aria-controls={idPanel} onClick={() => setAbierto((valor) => !valor)}>
        {textoBotonEstado(marcados)}
        <ChevronDown className="icono-girar" size={16} aria-hidden="true" />
      </button>
      {abierto && (
        <fieldset id={idPanel} className="filtro-panel">
          <legend>{TEXTOS.estado}</legend>
          {ESTADOS_MATERIAL.map((opcion) => (
            <label key={opcion.valor}>
              <input type="checkbox" checked={marcados.includes(opcion.valor)}
                onChange={(evento) => alternar(opcion.valor, evento.target.checked)} />
              {opcion.etiqueta}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

// US-73 CA3-CA5 y US-74 CA4: «Desde», «Hasta» y «Aplicar» (o Intro). Con donaciones, deshabilitado.
function FiltroPrecio({ minimo, maximo, desactivado, onAplicar }) {
  const [desde, setDesde] = useState(minimo === null ? '' : String(minimo));
  const [hasta, setHasta] = useState(maximo === null ? '' : String(maximo));
  const [error, setError] = useState(null);
  const idError = useId();

  // Si el precio cambia desde fuera (URL, etiqueta, «Limpiar filtros» o «Donación»), los campos se rellenan de nuevo
  // sin desmontar el formulario, para que el foco siga en el campo donde se pulsó Intro.
  const origen = `${minimo}|${maximo}|${desactivado}`;
  const [origenVisto, setOrigenVisto] = useState(origen);
  if (origenVisto !== origen) {
    setOrigenVisto(origen);
    setDesde(minimo === null ? '' : String(minimo));
    setHasta(maximo === null ? '' : String(maximo));
    setError(null);
  }

  function enviar(evento) {
    evento.preventDefault();
    setError(onAplicar({ desde, hasta }));
  }

  const invalido = error ? true : undefined;
  return (
    <form className="filtro-precio" onSubmit={enviar} noValidate>
      <fieldset disabled={desactivado}>
        <legend>{TEXTOS.precio}</legend>
        <div className="filtro-precio-campos">
          <span className="filtro-precio-titulo" aria-hidden="true">{TEXTOS.precio}</span>
          <input type="text" inputMode="numeric" aria-label={TEXTOS.desde} placeholder={TEXTOS.desde}
            value={desactivado ? '' : desde} onChange={(evento) => setDesde(evento.target.value)}
            aria-invalid={invalido} aria-describedby={error ? idError : undefined} />
          <input type="text" inputMode="numeric" aria-label={TEXTOS.hasta} placeholder={TEXTOS.hasta}
            value={desactivado ? '' : hasta} onChange={(evento) => setHasta(evento.target.value)}
            aria-invalid={invalido} aria-describedby={error ? idError : undefined} />
          <button type="submit" className="filtro-boton">{TEXTOS.aplicar}</button>
        </div>
        {desactivado && <p className="filtro-nota"><Info size={14} aria-hidden="true" />{TEXTOS.noAplica}</p>}
        {error && !desactivado && (
          <p id={idError} className="campo-error" role="alert"><CircleAlert size={14} aria-hidden="true" />{error}</p>
        )}
      </fieldset>
    </form>
  );
}

// US-74 CA1: tres botones unidos; «Todos» quita el parámetro.
function FiltroModalidad({ modalidad, onCambiar }) {
  const opciones = [{ valor: null, etiqueta: TEXTOS.todos }, ...MODALIDADES];
  return (
    <div className="filtro-modalidad" role="group" aria-label={TEXTOS.modalidad}>
      {opciones.map((opcion) => (
        <button key={opcion.etiqueta} type="button" aria-pressed={modalidad === opcion.valor}
          onClick={() => onCambiar(opcion.valor)}>
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  );
}
