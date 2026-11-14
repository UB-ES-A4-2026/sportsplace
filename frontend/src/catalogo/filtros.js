// Barra de filtros de /catalogo (T21-6: US-22 T22-2, US-73 T73-2 y US-74 T74-2).
// Los filtros viven en la URL con los mismos nombres y slugs que GET /api/catalogo (E04, «Base común»).
import { CATEGORIAS, DEPORTES, ESTADOS_MATERIAL, etiquetaDe } from '../anuncios/valores.js';

export const MODALIDADES = [
  { valor: 'venta', etiqueta: 'Venta' },
  { valor: 'donacion', etiqueta: 'Donación' },
];

export const PRECIO_MAXIMO = 99999;

export const TEXTOS = {
  todasCategorias: 'Todas las categorías',
  todosDeportes: 'Todos los deportes',
  categoria: 'Categoría',
  deporte: 'Deporte',
  estado: 'Estado del material',
  precio: 'Precio (€)',
  desde: 'Desde',
  hasta: 'Hasta',
  aplicar: 'Aplicar',
  noAplica: 'No aplica a donaciones',
  modalidad: 'Modalidad',
  todos: 'Todos',
  limpiar: 'Limpiar filtros',
  sinResultados: 'No hay anuncios con estos filtros.',
  errorPrecio: 'Indica un precio entero entre 0 y 99.999 €.',
  errorRango: 'El precio mínimo no puede ser mayor que el máximo.',
};

// Parámetros de la barra. «Limpiar filtros» los quita todos; `q`, `orden` y `vista` no son de la barra.
// `distancia_max` (US-75) todavía no tiene control, pero también es un filtro de la barra (US-22 CA7).
export const PARAMETROS_DE_FILTRO = [
  'categoria', 'deporte', 'estado_material', 'precio_min', 'precio_max', 'modalidad', 'distancia_max',
];

const SLUGS = {
  categoria: CATEGORIAS.map((opcion) => opcion.valor),
  deporte: DEPORTES.map((opcion) => opcion.valor),
  modalidad: MODALIDADES.map((opcion) => opcion.valor),
};
const ESTADOS = ESTADOS_MATERIAL.map((opcion) => opcion.valor);

// «99999» → «99.999» (como formatearEuros, a mano: Intl no separa los miles de 4 cifras).
function conMiles(numero) {
  return String(numero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// US-73 CA3: entero de 0 a 99999. Vacío = sin límite (null). Otro texto = no válido (undefined).
export function leerPrecio(texto) {
  const limpio = String(texto ?? '').trim();
  if (limpio === '') return null;
  if (!/^\d{1,5}$/.test(limpio)) return undefined;
  return Number(limpio);
}

// Un valor solo cuenta si aparece una vez y no está vacío (E04: `categoria=` equivale a no enviarlo;
// US-22 CA13: enviarlo dos veces no es válido).
function unico(parametros, nombre) {
  const valores = parametros.getAll(nombre);
  return valores.length === 1 && valores[0] !== '' ? valores[0] : null;
}

// US-73 CA11: slugs separados por comas, sin repetir. Devuelve los estados en el orden del diccionario
// o null si el valor está vacío o no es válido.
function leerEstados(parametros) {
  const valor = unico(parametros, 'estado_material');
  if (valor === null) return null;
  const elegidos = valor.split(',');
  if (new Set(elegidos).size !== elegidos.length || elegidos.some((estado) => !ESTADOS.includes(estado))) return null;
  return ESTADOS.filter((estado) => elegidos.includes(estado));
}

// Lee los filtros de la URL. Si alguno se ha escrito a mano con un valor no aceptado, `corregidos` trae
// los parámetros sin él para cambiar la URL con `replace` (E04, «Web»; US-22 CA14, US-74 E2E-3).
export function leerFiltros(parametros) {
  const limpios = new URLSearchParams(parametros);
  const filtros = { categoria: null, deporte: null, estados: [], precioMin: null, precioMax: null, modalidad: null };

  for (const nombre of ['categoria', 'deporte', 'modalidad']) {
    if (!parametros.has(nombre)) continue;
    const valor = unico(parametros, nombre);
    if (valor !== null && SLUGS[nombre].includes(valor)) filtros[nombre] = valor;
    else limpios.delete(nombre);
  }

  if (parametros.has('estado_material')) {
    const estados = leerEstados(parametros);
    // US-73 CA2: los 5 estados a la vez equivalen a no filtrar.
    if (estados === null || estados.length === ESTADOS.length) limpios.delete('estado_material');
    else filtros.estados = estados;
  }

  for (const [nombre, clave] of [['precio_min', 'precioMin'], ['precio_max', 'precioMax']]) {
    if (!parametros.has(nombre)) continue;
    const valor = unico(parametros, nombre);
    const precio = valor === null ? undefined : leerPrecio(valor);
    if (typeof precio === 'number') filtros[clave] = precio;
    else limpios.delete(nombre);
  }
  // US-73 CA12: mínimo > máximo no es válido; la API lo marca en `precio_min`.
  if (filtros.precioMin !== null && filtros.precioMax !== null && filtros.precioMin > filtros.precioMax) {
    filtros.precioMin = null;
    limpios.delete('precio_min');
  }
  // US-74 CA4: con donaciones no hay precio.
  if (filtros.modalidad === 'donacion') {
    filtros.precioMin = null;
    filtros.precioMax = null;
    limpios.delete('precio_min');
    limpios.delete('precio_max');
  }

  const corregidos = limpios.toString() === new URLSearchParams(parametros).toString() ? null : limpios;
  return { filtros, corregidos };
}

// Cualquier cambio de filtro vuelve a la página 1 (E04, «Base común»; US-22 CA3).
function sinPagina(parametros) {
  const nuevos = new URLSearchParams(parametros);
  nuevos.delete('pagina');
  return nuevos;
}

// US-22 CA3 y CA5, US-74 CA1: elegir una opción la pone en la URL; la opción por defecto la quita.
export function conFiltro(parametros, nombre, valor) {
  const nuevos = sinPagina(parametros);
  if (valor) nuevos.set(nombre, valor);
  else nuevos.delete(nombre);
  // US-74 CA4: al elegir «Donación» se quitan los precios.
  if (nombre === 'modalidad' && valor === 'donacion') {
    nuevos.delete('precio_min');
    nuevos.delete('precio_max');
  }
  return nuevos;
}

// US-73 CA1 y CA2: las casillas se aplican al marcarlas; los 5 a la vez quitan el filtro.
export function conEstados(parametros, estados) {
  const ordenados = ESTADOS.filter((estado) => estados.includes(estado));
  const todos = ordenados.length === ESTADOS.length;
  return conFiltro(parametros, 'estado_material', todos ? null : ordenados.join(','));
}

// US-73 CA3-CA5: valida «Desde» y «Hasta». Devuelve { error } o { parametros } listos para la URL.
export function conPrecio(parametros, { desde, hasta }) {
  const minimo = leerPrecio(desde);
  const maximo = leerPrecio(hasta);
  if (minimo === undefined || maximo === undefined) return { error: TEXTOS.errorPrecio };
  if (minimo !== null && maximo !== null && minimo > maximo) return { error: TEXTOS.errorRango };
  const nuevos = sinPagina(parametros);
  for (const [nombre, valor] of [['precio_min', minimo], ['precio_max', maximo]]) {
    if (valor === null) nuevos.delete(nombre);
    else nuevos.set(nombre, String(valor));
  }
  return { parametros: nuevos };
}

// US-22 CA7: quita los filtros de la barra y conserva la búsqueda `q` y el `orden`.
export function sinFiltros(parametros) {
  const nuevos = sinPagina(parametros);
  for (const nombre of PARAMETROS_DE_FILTRO) nuevos.delete(nombre);
  return nuevos;
}

// «Precio: 5 € – 20 €», «Precio: desde 5 €» o «Precio: hasta 20 €».
function textoPrecio(minimo, maximo) {
  if (minimo !== null && maximo !== null) return `Precio: ${conMiles(minimo)} € – ${conMiles(maximo)} €`;
  if (minimo !== null) return `Precio: desde ${conMiles(minimo)} €`;
  return `Precio: hasta ${conMiles(maximo)} €`;
}

// US-22 CA6, US-73 y US-74: una etiqueta por filtro activo, en el orden de la barra.
export function etiquetasActivas(filtros) {
  const etiquetas = [];
  if (filtros.categoria) etiquetas.push({ clave: 'categoria', texto: `Categoría: ${etiquetaDe(CATEGORIAS, filtros.categoria)}` });
  if (filtros.deporte) etiquetas.push({ clave: 'deporte', texto: `Deporte: ${etiquetaDe(DEPORTES, filtros.deporte)}` });
  if (filtros.estados.length > 0) {
    const nombres = filtros.estados.map((estado) => etiquetaDe(ESTADOS_MATERIAL, estado)).join(', ');
    etiquetas.push({ clave: 'estado_material', texto: `Estado: ${nombres}` });
  }
  if (filtros.precioMin !== null || filtros.precioMax !== null) {
    etiquetas.push({ clave: 'precio', texto: textoPrecio(filtros.precioMin, filtros.precioMax) });
  }
  if (filtros.modalidad) etiquetas.push({ clave: 'modalidad', texto: `Modalidad: ${etiquetaDe(MODALIDADES, filtros.modalidad)}` });
  return etiquetas;
}

// La «×» de una etiqueta quita solo ese filtro (la de precio quita «Desde» y «Hasta»).
export function sinEtiqueta(parametros, clave) {
  if (clave === 'precio') return conPrecio(parametros, { desde: '', hasta: '' }).parametros;
  return conFiltro(parametros, clave, null);
}

// N de «Filtros (N)» en móvil: filtros activos, contando el precio como uno.
export function numeroDeFiltros(filtros) {
  return etiquetasActivas(filtros).length;
}

// US-73: «Estado del material» sin selección, el nombre si hay uno o «Estado (2)» si hay varios.
export function textoBotonEstado(estados) {
  if (estados.length === 0) return TEXTOS.estado;
  if (estados.length === 1) return etiquetaDe(ESTADOS_MATERIAL, estados[0]);
  return `Estado (${estados.length})`;
}

export function textoBotonFiltros(filtros) {
  return `Filtros (${numeroDeFiltros(filtros)})`;
}

// Parámetros de filtro para GET /api/catalogo, con los mismos nombres que la URL.
export function parametrosDeApi(filtros) {
  const parametros = {};
  if (filtros.categoria) parametros.categoria = filtros.categoria;
  if (filtros.deporte) parametros.deporte = filtros.deporte;
  if (filtros.estados.length > 0) parametros.estado_material = filtros.estados.join(',');
  if (filtros.precioMin !== null) parametros.precio_min = String(filtros.precioMin);
  if (filtros.precioMax !== null) parametros.precio_max = String(filtros.precioMax);
  if (filtros.modalidad) parametros.modalidad = filtros.modalidad;
  return parametros;
}

// Texto de `search` para navegar: las comas de `estado_material` se dejan legibles
// (`?estado_material=nuevo,como_nuevo`, como en la especificación) en lugar de `%2C`.
export function busquedaDeUrl(parametros) {
  const texto = new URLSearchParams(parametros).toString().replaceAll('%2C', ',');
  return texto ? `?${texto}` : '';
}
