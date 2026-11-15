import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENLACE_CABECERA,
  ESTADOS_PEDIDO,
  TEXTOS,
  filaDePedido,
  paginaDeUrl,
  parametrosDeBandeja,
  pestanaDeUrl,
  textoContador,
  textoPestanaRecibidos,
  textoTotal,
  totalDePaginas,
  vacioDe,
} from './bandeja.js';

const RESUMEN = {
  id: '11111111-1111-4111-8111-111111111111',
  anuncio: { id: 'a1', titulo: 'Balones de baloncesto talla 7', foto_principal_url: 'https://x/f.jpg' },
  otro_centro: { id: 'c2', nombre: 'Escola de Bàsquet Gràcia' },
  unidades: 4,
  modalidad: 'venta',
  total_centimos: 3400,
  estado: 'pendiente',
  pagado_en: null,
  creado_en: '2026-10-21T08:30:00Z',
};

test('US-109 · CA1 · la cabecera lleva a /pedidos?pestana=recibidos', () => {
  assert.equal(ENLACE_CABECERA, '/pedidos?pestana=recibidos');
  assert.equal(TEXTOS.enlaceCabecera, 'Pedidos');
});

test('US-109 · CA1 · sin pestaña o con otro valor se abre «Recibidos»', () => {
  assert.equal(pestanaDeUrl(null), 'recibidos');
  assert.equal(pestanaDeUrl('cualquiera'), 'recibidos');
  assert.equal(pestanaDeUrl('RECIBIDOS'), 'recibidos');
  assert.equal(pestanaDeUrl('realizados'), 'realizados');
});

test('US-109 · CA2 y CA5 · URL de la bandeja: pestaña siempre, página desde la 2', () => {
  assert.equal(parametrosDeBandeja('realizados').toString(), 'pestana=realizados');
  assert.equal(parametrosDeBandeja('realizados', 1).toString(), 'pestana=realizados');
  assert.equal(parametrosDeBandeja('recibidos', 2).toString(), 'pestana=recibidos&pagina=2');
  assert.equal(parametrosDeBandeja('otra', 3).toString(), 'pestana=recibidos&pagina=3');
});

test('US-109 · CA5 · página de la URL', () => {
  for (const malo of [null, '', '0', '-1', '1.5', 'abc', '01']) assert.equal(paginaDeUrl(malo), 1, malo);
  assert.equal(paginaDeUrl('2'), 2);
  assert.equal(totalDePaginas(0), 1);
  assert.equal(totalDePaginas(20), 1);
  assert.equal(totalDePaginas(21), 2); // E2E-4
});

test('US-109 · CA9 · contador: oculto con 0, «99+» con más de 99', () => {
  assert.equal(textoContador(0), null);
  assert.equal(textoContador(undefined), null);
  assert.equal(textoContador(1), '1');
  assert.equal(textoContador(99), '99');
  assert.equal(textoContador(100), '99+');
});

test('US-109 · pestaña «Recibidos (n pendientes)» (E2E-1) y sin contador con 0', () => {
  assert.equal(textoPestanaRecibidos(1), 'Recibidos (1 pendientes)');
  assert.equal(textoPestanaRecibidos(3), 'Recibidos (3 pendientes)');
  assert.equal(textoPestanaRecibidos(150), 'Recibidos (99+ pendientes)');
  assert.equal(textoPestanaRecibidos(0), 'Recibidos');
});

test('US-109 · columna Total: «34,00 €» o «Donación» (E2E-1 y E2E-2)', () => {
  assert.equal(textoTotal(RESUMEN), '34,00 €');
  assert.equal(textoTotal({ ...RESUMEN, modalidad: 'donacion', total_centimos: 0 }), 'Donación');
});

test('US-109 · CA6 y E2E-1 · fila del pedido', () => {
  assert.deepEqual(filaDePedido(RESUMEN), {
    id: RESUMEN.id,
    ruta: `/pedidos/${RESUMEN.id}`,
    foto: 'https://x/f.jpg',
    anuncio: 'Balones de baloncesto talla 7',
    centro: 'Escola de Bàsquet Gràcia',
    unidades: 4,
    total: '34,00 €',
    estado: { etiqueta: 'Pendiente', color: 'amarillo' },
    pagado: false,
    fecha: '21/10/2026',
  });
  assert.equal(filaDePedido({ ...RESUMEN, pagado_en: '2026-10-22T10:00:00Z' }).pagado, true);
  assert.equal(filaDePedido({ ...RESUMEN, anuncio: { ...RESUMEN.anuncio, foto_principal_url: null } }).foto, null);
});

test('US-109 · etiquetas de estado de la base común', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(ESTADOS_PEDIDO).map(([estado, { etiqueta, color }]) => [estado, `${etiqueta}/${color}`])),
    {
      pendiente: 'Pendiente/amarillo', aceptado: 'Aceptado/verde', rechazado: 'Rechazado/rojo',
      cancelado: 'Cancelado/gris', recibido: 'Recibido/azul',
    },
  );
  assert.equal(TEXTOS.pagado, 'Pagado');
});

test('US-109 · CA7 · textos de la bandeja vacía', () => {
  assert.deepEqual(vacioDe('recibidos'), {
    texto: 'Todavía no has recibido pedidos. Cuando otro centro pida tu material, aparecerá aquí.', enlace: null,
  });
  assert.deepEqual(vacioDe('realizados'), {
    texto: 'Todavía no has hecho pedidos.', enlace: { texto: 'Ir al catálogo', ruta: '/catalogo' },
  });
});

test('US-109 · CA8 · textos de carga y error de la convención de listas', () => {
  assert.equal(TEXTOS.cargando, 'Cargando…');
  assert.equal(TEXTOS.error, 'No se ha podido cargar. ');
  assert.equal(TEXTOS.reintentar, 'Reintentar');
});
