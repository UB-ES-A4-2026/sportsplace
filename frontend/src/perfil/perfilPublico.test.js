import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  TEXTOS,
  VISTAS,
  enlacesDeContacto,
  esMiCentro,
  etiquetaDeAnuncio,
  paginaDeLaUrl,
  paginacion,
  rutaDelCentro,
  textoAntiguedad,
  tituloDeAnuncios,
  totalDePaginas,
  vistaDelPerfil,
  zonaDelCentro,
} from './perfilPublico.js';

describe('cabecera (CA5, CA19)', () => {
  test('«En Sportsplace desde dd/mm/aaaa» en hora de Madrid', () => {
    assert.equal(textoAntiguedad('2026-10-09T10:00:00Z'), 'En Sportsplace desde 09/10/2026');
  });

  test('«Zona: <localidad> (<provincia>)» y, sin provincia, solo la localidad', () => {
    assert.equal(zonaDelCentro({ localidad: 'Barcelona', provincia: 'Barcelona' }), 'Zona: Barcelona (Barcelona)');
    assert.equal(zonaDelCentro({ localidad: 'Sant Cugat', provincia: null }), 'Zona: Sant Cugat');
  });

  test('sin localidad no hay zona', () => {
    assert.equal(zonaDelCentro({ localidad: null, provincia: null }), null);
  });
});

describe('enlacesDeContacto (CA8)', () => {
  test('teléfono como tel: (sin espacios), email como mailto: y web externa, en ese orden', () => {
    assert.deepEqual(enlacesDeContacto({
      telefono: '934 12 34 56', email_contacto: 'info@clubnatacio.cat', web: 'https://clubnatacio.cat',
    }), [
      { tipo: 'telefono', texto: '934 12 34 56', href: 'tel:934123456' },
      { tipo: 'email', texto: 'info@clubnatacio.cat', href: 'mailto:info@clubnatacio.cat' },
      { tipo: 'web', texto: 'https://clubnatacio.cat', href: 'https://clubnatacio.cat', externo: true },
    ]);
  });

  test('solo los que existen', () => {
    assert.deepEqual(enlacesDeContacto({ telefono: null, email_contacto: '', web: 'https://x.cat' }).map((e) => e.tipo), ['web']);
  });

  test('sin ninguno → lista vacía (la página muestra «Este centro no ha indicado datos de contacto.»)', () => {
    assert.deepEqual(enlacesDeContacto({ telefono: null, email_contacto: null, web: null }), []);
    assert.equal(TEXTOS.sinContacto, 'Este centro no ha indicado datos de contacto.');
  });
});

describe('paginación de sus anuncios (CA3, CA12, CA17)', () => {
  test('`?pagina` entera ≥ 1; cualquier otra cosa es la 1', () => {
    assert.equal(paginaDeLaUrl('2'), 2);
    for (const valor of [null, '', '0', '-1', 'abc', '1.5']) assert.equal(paginaDeLaUrl(valor), 1);
  });

  test('20 por página: 0 y 20 anuncios → 1 página; 21 → 2', () => {
    assert.equal(totalDePaginas(0), 1);
    assert.equal(totalDePaginas(20), 1);
    assert.equal(totalDePaginas(21), 2);
  });

  test('con 21: en la 1 no hay «Anterior»; en la 2 no hay «Siguiente»', () => {
    assert.deepEqual(paginacion(1, 21), { pagina: 1, paginas: 2, hayAnterior: false, haySiguiente: true });
    assert.deepEqual(paginacion(2, 21), { pagina: 2, paginas: 2, hayAnterior: true, haySiguiente: false });
  });

  test('«Anuncios activos (n)»', () => {
    assert.equal(tituloDeAnuncios(21), 'Anuncios activos (21)');
    assert.equal(tituloDeAnuncios(undefined), 'Anuncios activos (0)');
  });

  test('CA6: reservado como «No disponible»; activo sin etiqueta', () => {
    assert.equal(etiquetaDeAnuncio({ estado: 'reservado' }), 'No disponible');
    assert.equal(etiquetaDeAnuncio({ estado: 'activo' }), null);
  });
});

describe('vista de /centros/:id (CA9, CA10)', () => {
  test('200 → perfil; 404 → «Centro no encontrado»; red, 500 o 503 → error con «Reintentar»', () => {
    assert.equal(vistaDelPerfil({ centro: { id: 'c1' } }), VISTAS.perfil);
    assert.equal(vistaDelPerfil({ fallo: { status: 404 } }), VISTAS.noEncontrado);
    for (const fallo of [{ status: 0 }, { status: 500 }, { status: 503 }]) {
      assert.equal(vistaDelPerfil({ fallo }), VISTAS.error);
    }
  });

  test('textos de «Centro no encontrado»', () => {
    assert.equal(TEXTOS.noEncontradoTitulo, 'Centro no encontrado');
    assert.equal(TEXTOS.noEncontradoTexto, 'Este centro no existe o ya no está en Sportsplace.');
  });
});

describe('propio centro y enlaces (CA1, CA4)', () => {
  test('`es_mio: true` → banda «Así ven tu perfil los demás centros.»', () => {
    assert.equal(esMiCentro({ es_mio: true }), true);
    assert.equal(esMiCentro({ es_mio: false }), false);
    assert.equal(TEXTOS.bandaPropia, 'Así ven tu perfil los demás centros.');
  });

  test('ruta del perfil con el id codificado', () => {
    assert.equal(rutaDelCentro('c 1'), '/centros/c%201');
  });
});
