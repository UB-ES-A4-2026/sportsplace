import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  busquedaDeUrl,
  conEstados,
  conFiltro,
  conPrecio,
  etiquetasActivas,
  leerFiltros,
  leerPrecio,
  numeroDeFiltros,
  parametrosDeApi,
  sinEtiqueta,
  sinFiltros,
  TEXTOS,
  textoBotonEstado,
  textoBotonFiltros,
} from './filtros.js';

const url = (texto) => new URLSearchParams(texto);
const SIN_FILTROS = { categoria: null, deporte: null, estados: [], precioMin: null, precioMax: null, modalidad: null };

describe('leerFiltros: la URL rellena la barra (US-22 CA8, US-73 CA10)', () => {
  test('sin parámetros → sin filtros y sin corregir', () => {
    assert.deepEqual(leerFiltros(url('')), { filtros: SIN_FILTROS, corregidos: null });
  });

  test('todos los filtros válidos se leen tal cual', () => {
    const { filtros, corregidos } = leerFiltros(url(
      'q=balon&categoria=calzado&deporte=baloncesto&estado_material=como_nuevo,nuevo&precio_min=5&precio_max=20&modalidad=venta',
    ));
    assert.equal(corregidos, null);
    assert.deepEqual(filtros, {
      categoria: 'calzado', deporte: 'baloncesto', estados: ['nuevo', 'como_nuevo'],
      precioMin: 5, precioMax: 20, modalidad: 'venta',
    });
  });

  test('US-22 CA14 y E2E-5: un slug no válido se quita y la URL queda sin él', () => {
    for (const texto of ['categoria=pelotas', 'categoria=Balones', 'deporte=golf', 'categoria=balones&categoria=calzado', 'categoria=']) {
      const { filtros, corregidos } = leerFiltros(url(texto));
      assert.deepEqual(filtros, SIN_FILTROS, texto);
      assert.equal(corregidos.toString(), '', texto);
    }
  });

  test('US-74 E2E-3: `modalidad=gratis` se quita', () => {
    assert.equal(leerFiltros(url('modalidad=gratis')).corregidos.toString(), '');
  });

  test('la corrección conserva la búsqueda y el resto de parámetros', () => {
    const { corregidos } = leerFiltros(url('q=balon&deporte=golf&orden=recientes&pagina=2'));
    assert.equal(corregidos.toString(), 'q=balon&orden=recientes&pagina=2');
  });

  test('US-73 CA11: estados desconocidos o repetidos se quitan', () => {
    for (const texto of ['estado_material=nuevo,roto', 'estado_material=nuevo,nuevo', 'estado_material=', 'estado_material=nuevo&estado_material=usado']) {
      const { filtros, corregidos } = leerFiltros(url(texto));
      assert.deepEqual(filtros.estados, [], texto);
      assert.equal(corregidos.toString(), '', texto);
    }
  });

  test('US-73 CA2: los 5 estados equivalen a no filtrar', () => {
    const { filtros, corregidos } = leerFiltros(url('estado_material=nuevo,como_nuevo,buen_estado,usado,para_reparar'));
    assert.deepEqual(filtros.estados, []);
    assert.equal(corregidos.toString(), '');
  });

  test('US-73 CA3: precios fuera de 0-99999 o no enteros se quitan; 0 y 99999 valen', () => {
    assert.deepEqual(leerFiltros(url('precio_min=0&precio_max=99999')).filtros.precioMin, 0);
    assert.equal(leerFiltros(url('precio_min=0&precio_max=99999')).corregidos, null);
    for (const valor of ['-1', '100000', '12,5', '12.5', 'abc', '', ' 20 ', '+20']) {
      const { filtros, corregidos } = leerFiltros(url(`precio_max=${encodeURIComponent(valor)}`));
      assert.equal(filtros.precioMax, null, valor);
      assert.equal(corregidos.toString(), '', valor);
    }
  });

  test('US-73 CA4: mínimo > máximo → se quita el mínimo; mínimo = máximo vale', () => {
    const { filtros, corregidos } = leerFiltros(url('precio_min=30&precio_max=20'));
    assert.equal(filtros.precioMin, null);
    assert.equal(filtros.precioMax, 20);
    assert.equal(corregidos.toString(), 'precio_max=20');
    assert.equal(leerFiltros(url('precio_min=10&precio_max=10')).corregidos, null);
  });

  test('US-74 CA4: con `modalidad=donacion` los precios se quitan de la URL', () => {
    const { filtros, corregidos } = leerFiltros(url('precio_max=20&modalidad=donacion'));
    assert.equal(filtros.precioMax, null);
    assert.equal(filtros.modalidad, 'donacion');
    assert.equal(corregidos.toString(), 'modalidad=donacion');
  });
});

describe('cambiar un filtro (US-22 CA3 y CA5, US-74 CA1)', () => {
  test('elegir una opción la añade y vuelve a la página 1', () => {
    assert.equal(conFiltro(url('q=balon&pagina=3'), 'categoria', 'balones').toString(), 'q=balon&categoria=balones');
  });

  test('«Todas las categorías» / «Todos» quitan el parámetro', () => {
    assert.equal(conFiltro(url('categoria=balones&deporte=futbol'), 'categoria', '').toString(), 'deporte=futbol');
    assert.equal(conFiltro(url('modalidad=venta'), 'modalidad', null).toString(), '');
  });

  test('US-74 E2E-2: «Donación» quita los precios', () => {
    assert.equal(conFiltro(url('precio_min=5&precio_max=20'), 'modalidad', 'donacion').toString(), 'modalidad=donacion');
    assert.equal(conFiltro(url('precio_max=20'), 'modalidad', 'venta').toString(), 'precio_max=20&modalidad=venta');
  });
});

describe('estado del material (US-73 CA1, CA2)', () => {
  test('las casillas se escriben en el orden del diccionario', () => {
    assert.equal(conEstados(url(''), ['como_nuevo', 'nuevo']).get('estado_material'), 'nuevo,como_nuevo');
  });

  test('ninguna o las 5 casillas quitan el filtro', () => {
    assert.equal(conEstados(url('estado_material=nuevo'), []).toString(), '');
    assert.equal(conEstados(url('estado_material=nuevo'), ['nuevo', 'como_nuevo', 'buen_estado', 'usado', 'para_reparar']).toString(), '');
  });

  test('texto del botón: sin selección, uno o varios', () => {
    assert.equal(textoBotonEstado([]), 'Estado del material');
    assert.equal(textoBotonEstado(['nuevo']), 'Nuevo');
    assert.equal(textoBotonEstado(['nuevo', 'como_nuevo']), 'Estado (2)');
  });
});

describe('precio (US-73 CA3-CA5)', () => {
  test('leerPrecio: vacío → sin límite; entero 0-99999 → número; lo demás → no válido', () => {
    assert.equal(leerPrecio(''), null);
    assert.equal(leerPrecio('  '), null);
    assert.equal(leerPrecio('0'), 0);
    assert.equal(leerPrecio(' 99999 '), 99999);
    for (const valor of ['-1', '100000', '12,5', 'abc', '1e3']) assert.equal(leerPrecio(valor), undefined, valor);
  });

  test('E2E-1: «Hasta» 20 → `precio_max=20` y página 1', () => {
    assert.equal(conPrecio(url('pagina=2'), { desde: '', hasta: '20' }).parametros.toString(), 'precio_max=20');
  });

  test('E2E-3: valores no válidos → mensaje y no se aplica', () => {
    assert.deepEqual(conPrecio(url(''), { desde: '', hasta: '12,5' }), { error: TEXTOS.errorPrecio });
    assert.deepEqual(conPrecio(url(''), { desde: '100000', hasta: '' }), { error: TEXTOS.errorPrecio });
    assert.deepEqual(conPrecio(url(''), { desde: '30', hasta: '20' }), { error: TEXTOS.errorRango });
  });

  test('«Desde» = «Hasta» vale; los dos vacíos quitan el filtro', () => {
    assert.equal(conPrecio(url(''), { desde: '15', hasta: '15' }).parametros.toString(), 'precio_min=15&precio_max=15');
    assert.equal(conPrecio(url('precio_min=5&precio_max=20&q=red'), { desde: '', hasta: '' }).parametros.toString(), 'q=red');
  });
});

describe('etiquetas y «Limpiar filtros» (US-22 CA6, CA7; US-73; US-74)', () => {
  const filtros = {
    categoria: 'balones', deporte: 'baloncesto', estados: ['nuevo', 'como_nuevo'],
    precioMin: 5, precioMax: 20, modalidad: 'venta',
  };

  test('una etiqueta por filtro, con los textos de la especificación', () => {
    assert.deepEqual(etiquetasActivas(filtros).map((etiqueta) => etiqueta.texto), [
      'Categoría: Balones', 'Deporte: Baloncesto', 'Estado: Nuevo, Como nuevo', 'Precio: 5 € – 20 €', 'Modalidad: Venta',
    ]);
  });

  test('textos del precio: rango, solo desde, solo hasta y miles', () => {
    const precio = (min, max) => etiquetasActivas({ ...SIN_FILTROS, precioMin: min, precioMax: max })[0].texto;
    assert.equal(precio(5, null), 'Precio: desde 5 €');
    assert.equal(precio(null, 20), 'Precio: hasta 20 €');
    assert.equal(precio(0, 99999), 'Precio: 0 € – 99.999 €');
  });

  test('la «×» quita solo su filtro (la de precio, los dos campos)', () => {
    const parametros = url('q=balon&categoria=balones&deporte=baloncesto&precio_min=5&precio_max=20&pagina=2');
    assert.equal(sinEtiqueta(parametros, 'deporte').toString(), 'q=balon&categoria=balones&precio_min=5&precio_max=20');
    assert.equal(sinEtiqueta(parametros, 'precio').toString(), 'q=balon&categoria=balones&deporte=baloncesto');
  });

  test('E2E-3: «Limpiar filtros» conserva `q` y `orden`', () => {
    const parametros = url('q=molten&categoria=balones&estado_material=nuevo&precio_max=20&modalidad=venta&distancia_max=10&orden=recientes&pagina=2');
    assert.equal(sinFiltros(parametros).toString(), 'q=molten&orden=recientes');
  });

  test('«Filtros (N)» cuenta el precio como un filtro', () => {
    assert.equal(numeroDeFiltros(SIN_FILTROS), 0);
    assert.equal(numeroDeFiltros(filtros), 5);
    assert.equal(textoBotonFiltros({ ...SIN_FILTROS, categoria: 'calzado' }), 'Filtros (1)');
  });
});

describe('parametrosDeApi', () => {
  test('solo los filtros activos, con los nombres de GET /api/catalogo', () => {
    assert.deepEqual(parametrosDeApi(SIN_FILTROS), {});
    assert.deepEqual(parametrosDeApi({
      categoria: 'balones', deporte: null, estados: ['nuevo', 'usado'], precioMin: 0, precioMax: null, modalidad: 'venta',
    }), { categoria: 'balones', estado_material: 'nuevo,usado', precio_min: '0', modalidad: 'venta' });
  });
});

describe('busquedaDeUrl', () => {
  test('comas legibles y espacios como «+»; sin parámetros, cadena vacía', () => {
    assert.equal(busquedaDeUrl(url('q=balon futbol&estado_material=nuevo,como_nuevo')), '?q=balon+futbol&estado_material=nuevo,como_nuevo');
    assert.equal(busquedaDeUrl(url('')), '');
  });
});
