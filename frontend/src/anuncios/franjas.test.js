import { test } from 'node:test';
import assert from 'node:assert/strict';
import { franjaDeReservaOEntrega } from './franjas.js';

test('un anuncio reservado lleva la franja naranja (US-17)', () => {
  assert.deepEqual(franjaDeReservaOEntrega({ estado: 'reservado' }), {
    tipo: 'reservado',
    texto: 'Este anuncio está reservado: los demás centros lo ven como no disponible.',
  });
});

test('un anuncio entregado lleva la franja azul con la fecha de entrega (US-17 E2E-1)', () => {
  assert.deepEqual(franjaDeReservaOEntrega({ estado: 'entregado', entregado_en: '2026-11-03T10:15:00.000Z' }), {
    tipo: 'entregado',
    texto: 'Material entregado el 03/11/2026. Este anuncio ya no se puede modificar.',
  });
});

test('la fecha de entrega se muestra en hora de Madrid, también al cambiar de día respecto a UTC', () => {
  // 23:30 UTC del 31/10 son las 00:30 del 01/11 en Madrid (horario de invierno, UTC+1).
  assert.match(franjaDeReservaOEntrega({ estado: 'entregado', entregado_en: '2026-10-31T23:30:00.000Z' }).texto, /el 01\/11\/2026\./);
  // 22:30 UTC del 30/06 son las 00:30 del 01/07 (horario de verano, UTC+2).
  assert.match(franjaDeReservaOEntrega({ estado: 'entregado', entregado_en: '2026-06-30T22:30:00.000Z' }).texto, /el 01\/07\/2026\./);
});

test('sin entregado_en se usa actualizado_en, que se renueva en la misma transición', () => {
  const franja = franjaDeReservaOEntrega({ estado: 'entregado', actualizado_en: '2026-11-05T09:00:00.000Z' });
  assert.equal(franja.texto, 'Material entregado el 05/11/2026. Este anuncio ya no se puede modificar.');
});

test('el resto de estados no lleva franja de reserva ni de entrega', () => {
  for (const estado of ['activo', 'pausado', 'borrador', 'retirado']) {
    assert.equal(franjaDeReservaOEntrega({ estado, entregado_en: '2026-11-03T10:15:00.000Z' }), null, estado);
  }
});
