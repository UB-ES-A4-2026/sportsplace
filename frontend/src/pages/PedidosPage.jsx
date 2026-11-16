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
            {valor === 'recibidos' ? textoPestanaRecibidos(pendientes) : TEXTOS.realizados}
          </button>
        ))}
      </div>

      <div id="panel-pedidos" role="tabpanel" aria-labelledby={`pestana-${pestana}`}>
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
            <th scope="col">{unidades}</th>
            <th scope="col">{total}</th>
            <th scope="col">{estado}</th>
            <th scope="col">{fecha}</th>
          </tr>
        </thead>
        <tbody>
          {lista.pedidos.map(filaDePedido).map((fila) => (
            // CA6: toda la fila lleva al detalle; el enlace del título es el que se alcanza con el teclado.
            <tr key={fila.id} className="pedidos-fila" onClick={() => navigate(fila.ruta)}>
              <td className="pedidos-foto">
                {fila.foto
                  ? <img src={fila.foto} alt="" width="56" height="56" loading="lazy" />
                  : <span className="pedidos-sin-foto" aria-hidden="true" />}
              </td>
              <td className="pedidos-anuncio" data-columna={anuncio}>
                <Link to={fila.ruta} onClick={(evento) => evento.stopPropagation()}>{fila.anuncio}</Link>
              </td>
              <td data-columna={centro}>{fila.centro}</td>
              <td data-columna={unidades}>{fila.unidades}</td>
              <td data-columna={total}>{fila.total}</td>
              <td data-columna={estado}>
                <span className={`etiqueta-pedido etiqueta-pedido-${fila.estado.color}`}>{fila.estado.etiqueta}</span>
                {fila.pagado && <span className="etiqueta-pedido etiqueta-pedido-pagado">{TEXTOS.pagado}</span>}
              </td>
              <td data-columna={fecha}>{fila.fecha}</td>
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
