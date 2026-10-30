import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  anadirFotos,
  cuerpoMultipart,
  errorDeArchivo,
  FOTOS_VACIAS,
  indicePrincipal,
  marcarPrincipal,
  MAX_BYTES_FOTO,
  MAX_FOTOS,
  MENSAJES_FOTOS,
  pesoTotal,
  quitarFoto,
  subidaLenta,
  validarFotos,
} from './fotos.js';

// Archivos de prueba en memoria; `bytes` no reserva memoria de verdad: se simula el tamaño.
function foto(nombre, { tipo = 'image/jpeg', bytes = 1000 } = {}) {
  return { name: nombre, type: tipo, size: bytes };
}

function generador() {
  let n = 0;
  return () => `f${++n}`;
}

function con(nombres, estado = FOTOS_VACIAS, nuevoId = generador()) {
  return anadirFotos(estado, nombres.map((nombre) => foto(nombre)), { nuevoId });
}

describe('errorDeArchivo (CA2, CA5)', () => {
  test('JPG, PNG y WebP se aceptan', () => {
    for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) {
      assert.equal(errorDeArchivo(foto('a', { tipo })), undefined);
    }
  });

  test('otros tipos se rechazan, aunque lleven extensión de foto', () => {
    assert.equal(errorDeArchivo(foto('logo.gif', { tipo: 'image/gif' })), MENSAJES_FOTOS.tipo);
    assert.equal(errorDeArchivo(foto('trampa.jpg', { tipo: 'text/plain' })), MENSAJES_FOTOS.tipo);
    assert.equal(errorDeArchivo(foto('sin-tipo.jpg', { tipo: '' })), MENSAJES_FOTOS.tipo);
  });

  test('CA5: 5.242.880 bytes se acepta y 5.242.881 se rechaza', () => {
    assert.equal(MAX_BYTES_FOTO, 5242880);
    assert.equal(errorDeArchivo(foto('justo.jpg', { bytes: 5242880 })), undefined);
    assert.equal(errorDeArchivo(foto('pasado.jpg', { bytes: 5242881 })), MENSAJES_FOTOS.peso);
  });

  test('un GIF de 6 MB se rechaza por el tipo', () => {
    assert.equal(errorDeArchivo(foto('x.gif', { tipo: 'image/gif', bytes: 6 * 1024 * 1024 })), MENSAJES_FOTOS.tipo);
  });
});

describe('anadirFotos', () => {
  test('CA6: la primera foto añadida queda como principal y el orden es el de entrada (CA8)', () => {
    const { estado, mensajes } = con(['balones1.jpg', 'balones2.jpg']);
    assert.deepEqual(estado.fotos.map((f) => f.archivo.name), ['balones1.jpg', 'balones2.jpg']);
    assert.equal(estado.principalId, 'f1');
    assert.deepEqual(mensajes, []);
  });

  test('añadir más fotos después no cambia la principal', () => {
    const generar = generador();
    const primero = con(['a.jpg'], FOTOS_VACIAS, generar);
    const segundo = con(['b.jpg'], primero.estado, generar);
    assert.equal(segundo.estado.principalId, 'f1');
    assert.equal(segundo.estado.fotos.length, 2);
  });

  test('CA2 y E2E-3: los inválidos no entran y el mensaje lleva el nombre', () => {
    const { estado, mensajes } = anadirFotos(FOTOS_VACIAS, [
      foto('logo.gif', { tipo: 'image/gif' }),
      foto('grande.jpg', { bytes: 6 * 1024 * 1024 }),
      foto('ok.webp', { tipo: 'image/webp', bytes: 100 * 1024 }),
    ]);
    assert.deepEqual(estado.fotos.map((f) => f.archivo.name), ['ok.webp']);
    assert.deepEqual(mensajes, [
      'logo.gif: Solo se admiten fotos JPG, PNG o WebP.',
      'grande.jpg: Cada foto debe pesar 5 MB como máximo.',
    ]);
  });

  test('CA3 y E2E-4: con 7 y 3 más, entran 8 y sale el mensaje del máximo', () => {
    const generar = generador();
    const siete = con(Array.from({ length: 7 }, (_, i) => `f${i}.jpg`), FOTOS_VACIAS, generar);
    const { estado, mensajes } = con(['x.jpg', 'y.jpg', 'z.jpg'], siete.estado, generar);
    assert.equal(estado.fotos.length, MAX_FOTOS);
    assert.deepEqual(estado.fotos.at(-1).archivo.name, 'x.jpg');
    assert.deepEqual(mensajes, [MENSAJES_FOTOS.maximo]);
  });

  test('con 8 ya puestas, no entra ninguna y sale el mensaje', () => {
    const llenas = con(Array.from({ length: 8 }, (_, i) => `f${i}.jpg`));
    const { estado, mensajes } = con(['otra.jpg'], llenas.estado);
    assert.equal(estado.fotos.length, 8);
    assert.deepEqual(mensajes, [MENSAJES_FOTOS.maximo]);
  });

  test('los inválidos no cuentan para el máximo', () => {
    const { estado, mensajes } = anadirFotos(
      FOTOS_VACIAS,
      [...Array.from({ length: 8 }, (_, i) => foto(`f${i}.jpg`)), foto('mal.gif', { tipo: 'image/gif' })],
    );
    assert.equal(estado.fotos.length, 8);
    assert.deepEqual(mensajes, ['mal.gif: Solo se admiten fotos JPG, PNG o WebP.']);
  });

  test('CA23: el mismo archivo dos veces añade dos fotos', () => {
    const mismo = foto('igual.jpg');
    const { estado } = anadirFotos(FOTOS_VACIAS, [mismo, mismo], { nuevoId: generador() });
    assert.equal(estado.fotos.length, 2);
    assert.notEqual(estado.fotos[0].id, estado.fotos[1].id);
  });

  test('no modifica el estado de partida', () => {
    const inicial = con(['a.jpg']).estado;
    const copia = structuredClone({ ids: inicial.fotos.map((f) => f.id), principalId: inicial.principalId });
    con(['b.jpg'], inicial);
    assert.deepEqual({ ids: inicial.fotos.map((f) => f.id), principalId: inicial.principalId }, copia);
  });

  test('crea la miniatura de cada foto aceptada y solo de esas', () => {
    const creadas = [];
    anadirFotos(FOTOS_VACIAS, [foto('a.jpg'), foto('b.gif', { tipo: 'image/gif' })], {
      crearVista: (archivo) => { creadas.push(archivo.name); return `blob:${archivo.name}`; },
    });
    assert.deepEqual(creadas, ['a.jpg']);
  });
});

describe('marcarPrincipal (CA6)', () => {
  test('la estrella de otra foto la convierte en principal', () => {
    const { estado } = con(['a.jpg', 'b.jpg']);
    assert.equal(marcarPrincipal(estado, 'f2').principalId, 'f2');
  });

  test('con un id que no existe no cambia nada', () => {
    const { estado } = con(['a.jpg']);
    assert.equal(marcarPrincipal(estado, 'zzz'), estado);
  });
});

describe('quitarFoto (CA7)', () => {
  test('quitar una foto que no es la principal mantiene la principal', () => {
    const { estado } = con(['a.jpg', 'b.jpg', 'c.jpg']);
    const resultado = quitarFoto(estado, 'f2');
    assert.deepEqual(resultado.estado.fotos.map((f) => f.id), ['f1', 'f3']);
    assert.equal(resultado.estado.principalId, 'f1');
    assert.equal(resultado.quitada.id, 'f2');
  });

  test('E2E-5: quitar la principal (la 1) hace principal a la antigua 2', () => {
    const { estado } = con(['a.jpg', 'b.jpg', 'c.jpg']);
    assert.equal(quitarFoto(estado, 'f1').estado.principalId, 'f2');
  });

  test('si la principal era la última, pasa a serlo la primera de las restantes', () => {
    const { estado } = con(['a.jpg', 'b.jpg', 'c.jpg']);
    const resultado = quitarFoto(marcarPrincipal(estado, 'f3'), 'f3');
    assert.equal(resultado.estado.principalId, 'f1');
  });

  test('al quitar la última foto no queda principal', () => {
    const { estado } = con(['a.jpg']);
    const resultado = quitarFoto(estado, 'f1');
    assert.deepEqual(resultado.estado, { fotos: [], principalId: null });
  });

  test('con un id que no existe no cambia nada', () => {
    const { estado } = con(['a.jpg']);
    const resultado = quitarFoto(estado, 'zzz');
    assert.equal(resultado.estado, estado);
    assert.equal(resultado.quitada, undefined);
  });

  test('tras quitar de las 8 vuelve a haber hueco', () => {
    const llenas = con(Array.from({ length: 8 }, (_, i) => `f${i}.jpg`)).estado;
    const { estado } = quitarFoto(llenas, llenas.fotos[0].id);
    assert.equal(anadirFotos(estado, [foto('nueva.jpg')]).estado.fotos.length, 8);
  });
});

describe('validarFotos (CA4)', () => {
  test('sin fotos → «Añade al menos una foto.»', () => {
    assert.deepEqual(validarFotos(FOTOS_VACIAS), { fotos: 'Añade al menos una foto.' });
  });

  test('con 1 o con 8 fotos no hay error (CA5)', () => {
    assert.deepEqual(validarFotos(con(['a.jpg']).estado), {});
    assert.deepEqual(validarFotos(con(Array.from({ length: 8 }, (_, i) => `f${i}.jpg`)).estado), {});
  });
});

describe('indicePrincipal (CA8, CA12)', () => {
  test('es la posición (1..n) de la principal; no se mueve al primer lugar', () => {
    const { estado } = con(['a.jpg', 'b.jpg', 'c.jpg']);
    assert.equal(indicePrincipal(estado), 1);
    assert.equal(indicePrincipal(marcarPrincipal(estado, 'f3')), 3);
  });
});

describe('subidaLenta (CA11)', () => {
  test('hasta 10 MB en total no se avisa; con más, sí', () => {
    const cinco = { name: 'a.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 };
    const dos = anadirFotos(FOTOS_VACIAS, [cinco, cinco]).estado;
    assert.equal(pesoTotal(dos), 10 * 1024 * 1024);
    assert.equal(subidaLenta(dos), false);
    const tres = anadirFotos(dos, [cinco]).estado;
    assert.equal(subidaLenta(tres), true);
  });
});

describe('cuerpoMultipart (CA12)', () => {
  function archivo(nombre, contenido, tipo) {
    return new File([contenido], nombre, { type: tipo });
  }

  test('parte `datos` en JSON, partes `fotos` en orden y `foto_principal` como texto', async () => {
    const { estado } = anadirFotos(FOTOS_VACIAS, [
      archivo('balones1.jpg', 'uno', 'image/jpeg'),
      archivo('balones2.png', 'dos', 'image/png'),
    ], { nuevoId: generador() });
    const datos = { titulo: 'Balones de fútbol talla 5', unidades_disponibles: 12 };

    const formulario = cuerpoMultipart(datos, marcarPrincipal(estado, 'f2'));

    assert.deepEqual(JSON.parse(formulario.get('datos')), datos);
    const fotos = formulario.getAll('fotos');
    assert.deepEqual(fotos.map((f) => f.name), ['balones1.jpg', 'balones2.png']);
    assert.equal(await fotos[1].text(), 'dos');
    assert.equal(formulario.get('foto_principal'), '2');
  });

  test('sin tocar la estrella, la principal es la 1', () => {
    const { estado } = anadirFotos(FOTOS_VACIAS, [archivo('a.jpg', 'x', 'image/jpeg')], { nuevoId: generador() });
    assert.equal(cuerpoMultipart({}, estado).get('foto_principal'), '1');
  });
});
