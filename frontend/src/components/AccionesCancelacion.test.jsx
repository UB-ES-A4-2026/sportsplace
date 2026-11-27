// T39-2 (US-39): botón «Cancelar pedido» y su diálogo, con Testing Library sobre jsdom.
import '../../pruebas/dom.js';
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ErrorApi } from '../api/cliente.js';
import AccionesCancelacion from './AccionesCancelacion.jsx';

afterEach(cleanup);

// Pedido de E2E-1 de US-39: Gràcia (comprador) pide los petos a Les Corts.
const PEDIDO = {
  id: 'p1',
  anuncio: { id: 'a1', titulo: 'Petos de entrenamiento reversibles', estado: 'activo', unidades_disponibles: 30 },
  comprador: { id: 'c1', nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona' },
  vendedor: { id: 'c2', nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona' },
  mi_papel: 'comprador',
  unidades: 10,
  estado: 'pendiente',
  acciones: ['cancelar'],
};

// El <dialog> de jsdom no tiene showModal: se busca por su clase y se consulta con `hidden`.
const dialogo = () => document.querySelector('dialog.dialogo-cancelacion');
const enDialogo = () => within(dialogo());
const opciones = () => [...dialogo().querySelectorAll('option')].map((opcion) => opcion.textContent);

function pintar(pedido = PEDIDO, cancelar = async () => ({ ...pedido, estado: 'cancelado' })) {
  const llamadas = { actualizado: [], aviso: [], fallo: [], peticiones: [] };
  render(
    <AccionesCancelacion
      pedido={pedido}
      cancelar={async (...args) => { llamadas.peticiones.push(args); return cancelar(...args); }}
      onActualizado={(valor) => llamadas.actualizado.push(valor)}
      onAviso={(valor) => llamadas.aviso.push(valor)}
      onFallo={(valor) => llamadas.fallo.push(valor)}
    />,
  );
  return llamadas;
}

function elegir(motivo, explicacion) {
  fireEvent.change(enDialogo().getByLabelText('Motivo', { hidden: true }), { target: { value: motivo } });
  if (explicacion !== undefined) {
    fireEvent.change(dialogo().querySelector('textarea'), { target: { value: explicacion } });
  }
}

const confirmar = () => fireEvent.click(enDialogo().getByRole('button', { name: 'Cancelar pedido', hidden: true }));

describe('US-39 CA1: el botón', () => {
  test('sale con `cancelar` en acciones y no sale sin ella', () => {
    pintar();
    assert.ok(screen.getByRole('button', { name: 'Cancelar pedido' }));
    cleanup();
    pintar({ ...PEDIDO, acciones: [] });
    assert.equal(screen.queryByRole('button', { name: 'Cancelar pedido' }), null);
  });
});

describe('US-39: el diálogo', () => {
  test('título, texto y botones; el comprador ve solo sus motivos (CA2)', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    assert.ok(enDialogo().getByText('Cancelar el pedido'));
    assert.ok(enDialogo().getByText('Club Esportiu Les Corts verá el motivo. No se puede deshacer.'));
    assert.ok(enDialogo().getByRole('button', { name: 'Volver', hidden: true }));
    assert.deepEqual(opciones(), [
      'Elige un motivo', 'Ya no necesitamos el material', 'Hemos encontrado otra opción',
      'No hemos podido acordar la entrega', 'La otra parte no responde', 'El pedido tenía un error', 'Otro motivo',
    ]);
    assert.ok(enDialogo().getByText('0/300'));
  });

  test('el vendedor de un aceptado ve sus motivos y el aviso de las unidades (CA9)', () => {
    pintar({ ...PEDIDO, mi_papel: 'vendedor', estado: 'aceptado' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    assert.ok(enDialogo().getByText(
      'Escola de Bàsquet Gràcia verá el motivo. No se puede deshacer. Las unidades volverán a estar disponibles en el anuncio.',
    ));
    assert.ok(opciones().includes('El material ya no está disponible'));
    assert.ok(!opciones().includes('Ya no necesitamos el material'));
  });

  test('sin motivo, «Elige un motivo.»; con «Otro motivo» y menos de 10 caracteres, el error de la explicación (CA2)', () => {
    const llamadas = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    confirmar();
    assert.ok(enDialogo().getByText('Elige un motivo.'));
    elegir('otro', 'No vamos');
    assert.ok(enDialogo().getByText('Explicación (obligatoria)'));
    confirmar();
    assert.ok(enDialogo().getByText('Explica el motivo (entre 10 y 300 caracteres).'));
    assert.equal(llamadas.peticiones.length, 0);
  });

  test('«Volver» cierra sin enviar nada', () => {
    const llamadas = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    fireEvent.click(enDialogo().getByRole('button', { name: 'Volver', hidden: true }));
    assert.equal(llamadas.peticiones.length, 0);
    assert.equal(llamadas.aviso.length, 0);
  });
});

describe('US-39 CA3: enviar', () => {
  test('«Cancelando…» mientras envía y, al ir bien, el pedido nuevo y el aviso «Pedido cancelado.»', async () => {
    let terminar;
    const llamadas = pintar(PEDIDO, () => new Promise((resolver) => { terminar = resolver; }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    elegir('otra_opcion', '  Lo hemos conseguido en otro sitio.  ');
    confirmar();
    await waitFor(() => assert.ok(enDialogo().getByRole('button', { name: 'Cancelando…', hidden: true })));
    assert.deepEqual(llamadas.peticiones, [['p1', { motivoCodigo: 'otra_opcion', motivoTexto: 'Lo hemos conseguido en otro sitio.' }]]);
    terminar({ ...PEDIDO, estado: 'cancelado', acciones: [] });
    await waitFor(() => assert.deepEqual(llamadas.aviso, [{ tipo: 'exito', texto: 'Pedido cancelado.' }]));
    assert.equal(llamadas.actualizado[0].estado, 'cancelado');
  });

  test('ante un 409, el mensaje de la API y recargar el pedido', async () => {
    const conflicto = new ErrorApi(409, { code: 'PEDIDO_PAGADO', message: 'No se puede cancelar un pedido ya cobrado. Si hay un problema, abre una incidencia.' });
    const llamadas = pintar(PEDIDO, async () => { throw conflicto; });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    elegir('sin_respuesta');
    confirmar();
    await waitFor(() => assert.equal(llamadas.fallo.length, 1));
    assert.deepEqual(llamadas.fallo[0], {
      mensaje: 'No se puede cancelar un pedido ya cobrado. Si hay un problema, abre una incidencia.', recargar: true, noEncontrado: undefined,
    });
    assert.equal(llamadas.aviso.length, 0);
  });

  test('un 400 con el motivo deja el error bajo su campo (CA6)', async () => {
    const invalido = new ErrorApi(400, { code: 'DATOS_INVALIDOS', message: 'Revisa los campos marcados.', details: { motivo_codigo: 'Elige un motivo.' } });
    const llamadas = pintar(PEDIDO, async () => { throw invalido; });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    elegir('sin_respuesta');
    confirmar();
    await waitFor(() => assert.ok(enDialogo().getByText('Elige un motivo.')));
    assert.equal(llamadas.fallo.length, 0);
  });
});
