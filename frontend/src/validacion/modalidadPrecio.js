// Validación de la sección «Modalidad y precio» del formulario de anuncios (US-14).
// Mismas reglas y mensajes que la «Tabla de campos» de E03, para avisar antes de enviar.
// El servidor vuelve a validar siempre: esta comprobación solo mejora la experiencia.
const MODALIDADES = ['venta', 'donacion'];
// Solo cifras y hasta 2 decimales con coma o punto. Cuántas cifras enteras se permiten lo decide
// el rango, para que «100000» dé el mensaje de rango (CA4) y no el de formato.
const FORMATO_PRECIO = /^(\d+)(?:[,.](\d{1,2}))?$/;
const PRECIO_MIN_CENTIMOS = 1;
const PRECIO_MAX_CENTIMOS = 9999999;

const MENSAJES = {
  modalidadObligatoria: 'Elige si es venta o donación.',
  modalidadInvalida: 'La modalidad no es válida.',
  precioObligatorio: 'Indica el precio por unidad.',
  precioFormato: 'Escribe el precio con hasta 2 decimales, por ejemplo 12,50.',
  precioRango: 'El precio debe estar entre 0,01 € y 99.999,99 €.',
};

// Convierte el texto del precio a céntimos sin coma flotante (CA3).
// Devuelve null si no tiene el formato aceptado o si se sale del rango.
export function precioACentimos(texto) {
  const coincidencia = FORMATO_PRECIO.exec((texto ?? '').trim());
  if (!coincidencia) return null;

  const [, enteros, decimales = ''] = coincidencia;
  const sinCeros = enteros.replace(/^0+(?=\d)/, '');
  if (sinCeros.length > 5) return null;

  const centimos = Number(sinCeros) * 100 + Number(decimales.padEnd(2, '0'));
  return centimos >= PRECIO_MIN_CENTIMOS && centimos <= PRECIO_MAX_CENTIMOS ? centimos : null;
}

// Devuelve un objeto campo → mensaje. Vacío si todo es correcto.
// El precio solo se valida con «Venta» marcada (CA2 y CA5).
export function validarModalidadPrecio(valores) {
  const errores = {};
  const modalidad = valores.modalidad ?? '';

  if (modalidad === '') {
    errores.modalidad = MENSAJES.modalidadObligatoria;
  } else if (!MODALIDADES.includes(modalidad)) {
    errores.modalidad = MENSAJES.modalidadInvalida;
  }

  if (modalidad === 'venta') {
    const precio = (valores.precio ?? '').trim();
    if (precio === '') {
      errores.precio_unitario_centimos = MENSAJES.precioObligatorio;
    } else if (!FORMATO_PRECIO.test(precio)) {
      errores.precio_unitario_centimos = MENSAJES.precioFormato;
    } else if (precioACentimos(precio) === null) {
      errores.precio_unitario_centimos = MENSAJES.precioRango;
    }
  }

  return errores;
}

// Claves de la sección para el cuerpo de la petición (CA8). Con «Donación» no se envía el precio (CA5).
export function datosModalidadPrecio(valores) {
  if (valores.modalidad === 'venta') {
    return { modalidad: 'venta', precio_unitario_centimos: precioACentimos(valores.precio) };
  }
  return { modalidad: valores.modalidad };
}
