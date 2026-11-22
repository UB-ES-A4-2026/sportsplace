import { ArrowDownToLine, ArrowUpToLine, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { listarPedidos } from '../api/pedidos.js';
import {
  PESTANAS,
  TEXTOS,
  filaDePedido,
  paginaDeUrl,
  parametrosDeBandeja,
  pestanaDeUrl,
  textoPestanaRecibidos,
  totalDePaginas,
  vacioDe,
} from '../pedidos/bandeja.js';
import useContadorPedidos from '../pedidos/useContadorPedidos.js';
import '../pedidos/pedidos.css';

// Clase .s2-estado--… de tokens.css para cada color de estado de bandeja.js (el texto sigue siendo el del CA).
const CLASE_ESTADO = { amarillo: 'pendiente', verde: 'aceptado', rojo: 'rechazado', gris: 'cancelado', azul: 'recibido' };

// Diseño con vida (#361): la pestaña «Recibidos (2 pendientes)» se ve como «Recibidos» y una pastilla naranja
// «2 pendientes». Es solo presentación del mismo texto: los paréntesis siguen dentro, ocultos a la vista, para que el
// nombre accesible no cambie (lo usan los E2E de US-109).
function TextoPestana({ valor, pendientes }) {
  if (valor !== 'recibidos') return TEXTOS.realizados;
  const contador = textoPestanaRecibidos(pendientes).slice(TEXTOS.recibidos.length).trim(); // «(2 pendientes)» o «»
  if (!contador) return TEXTOS.recibidos;
  return (
    <>
      {TEXTOS.recibidos}{' '}
      <span className="pedidos-pastilla">
        <span className="pedidos-parentesis">(</span>{contador.slice(1, -1)}<span className="pedidos-parentesis">)</span>
      </span>
    </>
  );
}

// US-109 (T33-4): /pedidos con las pestañas «Recibidos» y «Realizados», 20 por página.
export default function PedidosPage() {
  const [parametros, setParametros] = useSearchParams();
  const pestana = pestanaDeUrl(parametros.get('pestana'));
  const pagina = paginaDeUrl(parametros.get('pagina'));
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);
  // Contador de la pestaña (CA9): se recarga con cada carga de la lista.
  const clave = `${pestana}#${pagina}#${intento}`;
  const pendientes = useContadorPedidos(true, clave);

  useEffect(() => {
    const control = new AbortController();
    listarPedidos({ rol: pestana, pagina }, { signal: control.signal })
      .then((lista) => setResultado({ clave, lista }))
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setResultado({ clave, error: true });
      });
    return () => control.abort();
  }, [pestana, pagina, clave]);

  const actual = resultado?.clave === clave ? resultado : null;

  // CA2: cambiar de pestaña actualiza la URL sin recargar y vuelve a la página 1.
  function cambiarPestana(nueva) {
    if (nueva !== pestana) setParametros(parametrosDeBandeja(nueva));
  }

  // Flechas izquierda/derecha entre pestañas (patrón de pestañas accesibles).
  function teclaEnPestanas(evento) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const otra = PESTANAS[(PESTANAS.indexOf(pestana) + 1) % PESTANAS.length];
    cambiarPestana(otra);
    document.getElementById(`pestana-${otra}`)?.focus();
  }

  return (
    <section className="pedidos-pagina">
      {/* Diseño con vida (#361): el título y, debajo, las pestañas grandes con su flecha (↓ Recibidos, ↑ Realizados). */}
      <div className="pedidos-cabecera">
        <h1>{TEXTOS.titulo}</h1>

        <div className="pedidos-pestanas" role="tablist" aria-label={TEXTOS.titulo} onKeyDown={teclaEnPestanas}>
          {PESTANAS.map((valor) => (
            <button
              key={valor}
              id={`pestana-${valor}`}
              type="button"
              role="tab"
              aria-selected={valor === pestana}
              aria-controls="panel-pedidos"
              tabIndex={valor === pestana ? 0 : -1}
              className="pedidos-pestana"
              onClick={() => cambiarPestana(valor)}
            >
              {valor === 'recibidos'
                ? <ArrowDownToLine size={22} strokeWidth={2.8} aria-hidden="true" />
                : <ArrowUpToLine size={22} strokeWidth={2.8} aria-hidden="true" />}
              <TextoPestana valor={valor} pendientes={pendientes} />
            </button>
          ))}
        </div>
      </div>

      <div id="panel-pedidos" className="pedidos-panel" role="tabpanel" aria-labelledby={`pestana-${pestana}`}>
        {!actual && <p className="intro-text" role="status">{TEXTOS.cargando}</p>}
        {actual?.error && (
          <p className="intro-text" role="alert">
            {TEXTOS.error}
            <button type="button" className="boton-enlace" onClick={() => setIntento((n) => n + 1)}>
              {TEXTOS.reintentar}
            </button>
          </p>
        )}
        {actual?.lista && (
          <Bandeja
            lista={actual.lista}
            pestana={pestana}
            pagina={pagina}
            irAPagina={(n) => setParametros(parametrosDeBandeja(pestana, n))}
          />
        )}
      </div>
    </section>
  );
}

function Bandeja({ lista, pestana, pagina, irAPagina }) {
  const navigate = useNavigate();

  if (lista.pedidos.length === 0 && pagina === 1) {
    const vacio = vacioDe(pestana);
    return (
      <div className="pedidos-vacio">
        <span className="pedidos-vacio-icono" aria-hidden="true"><Package size={44} strokeWidth={2} /></span>
        <p className="intro-text">{vacio.texto}</p>
        {vacio.enlace && <Link to={vacio.enlace.ruta} className="boton-enlace">{vacio.enlace.texto}</Link>}
      </div>
    );
  }

  const paginas = totalDePaginas(lista.total, lista.por_pagina);
  const [anuncio, centro, unidades, total, estado, fecha] = TEXTOS.columnas;

  return (
    <>
      <table className="pedidos-tabla">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Foto</span></th>
            <th scope="col">{anuncio}</th>
            <th scope="col">{centro}</th>
            <th scope="col" className="pedidos-num">{unidades}</th>
            <th scope="col" className="pedidos-num">{total}</th>
            <th scope="col">{estado}</th>
            <th scope="col">{fecha}</th>
          </tr>
        </thead>
        <tbody>
          {lista.pedidos.map(filaDePedido).map((fila) => (
            // CA6: toda la fila lleva al detalle; el enlace del título es el que se alcanza con el teclado.
            // Diseño con vida (#361): los pendientes, con fondo amarillo suave (el estado sigue escrito en su columna).
            <tr key={fila.id} className={fila.estado.color === 'amarillo' ? 'pedidos-fila pedidos-fila-pendiente' : 'pedidos-fila'}
              onClick={() => navigate(fila.ruta)}>
              <td className="pedidos-foto">
                {fila.foto
                  ? <img src={fila.foto} alt="" width="48" height="48" loading="lazy" />
                  : <span className="pedidos-sin-foto" aria-hidden="true"><Package size={22} strokeWidth={1.8} /></span>}
              </td>
              <td className="pedidos-anuncio" data-columna={anuncio}>
                <Link to={fila.ruta} onClick={(evento) => evento.stopPropagation()}>{fila.anuncio}</Link>
                {fila.entrega && <span className="pedidos-entrega">{fila.entrega}</span>}
              </td>
              <td className="pedidos-centro" data-columna={centro}>{fila.centro}</td>
              <td className="pedidos-num pedidos-unidades" data-columna={unidades}>{fila.unidades}</td>
              <td className={fila.total === TEXTOS.donacion ? 'pedidos-num pedidos-total pedidos-donacion' : 'pedidos-num pedidos-total'}
                data-columna={total}>{fila.total}</td>
              <td className="pedidos-estado" data-columna={estado}>
                <span className={`s2-estado s2-estado--${CLASE_ESTADO[fila.estado.color] ?? 'cancelado'}`}>{fila.estado.etiqueta}</span>
                {fila.pagado && <span className="s2-pagado">{TEXTOS.pagado}</span>}
              </td>
              <td className="pedidos-fecha" data-columna={fecha}>{fila.fecha}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* CA5: «Anterior» deshabilitado en la página 1 y «Siguiente» en la última. */}
      {paginas > 1 && (
        <nav className="paginacion" aria-label="Paginación">
          <button type="button" className="boton-secundario" disabled={pagina <= 1}
            onClick={() => irAPagina(pagina - 1)}>{TEXTOS.anterior}</button>
          <span>Página {Math.min(pagina, paginas)} de {paginas}</span>
          <button type="button" className="boton-secundario" disabled={pagina >= paginas}
            onClick={() => irAPagina(pagina + 1)}>{TEXTOS.siguiente}</button>
        </nav>
      )}
    </>
  );
}
