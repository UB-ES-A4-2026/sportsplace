// Iconos y colores de deportes y categorías del diseño S2 «con vida» (mockups del 19/11).
// Lucide no tiene un balón por deporte, así que estos trazos son propios (viewBox 0 0 24 24, trazo 2, sin relleno).
// Los slugs son los del diccionario de E04 (frontend/src/anuncios/valores.js): no se crean slugs nuevos.

// Cada icono es una lista de elementos SVG: [etiqueta, atributos].
export const TRAZOS = Object.freeze({
  futbol: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 8l3 2.2-1.1 3.6h-3.8L9 10.2z' }], ['path', { d: 'M12 3v5M15 10.2l4.6-1.6M13.9 13.8l2.8 4M10.1 13.8l-2.8 4M9 10.2L4.4 8.6' }]],
  baloncesto: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8' }]],
  balonmano: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M3.6 9c5.2 1.4 11.6 1.4 16.8 0M3.6 15c5.2-1.4 11.6-1.4 16.8 0M12 3c-2 3-2 15 0 18' }]],
  voleibol: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 3c-1.8 4-1.2 8 1.6 9.6M21 12.5c-4.2-1.2-7.8.4-9.4 3.4M6.8 19.4c.6-4.2 3-7 5.4-7.6' }]],
  tenis: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8' }]],
  padel: [['ellipse', { cx: 10.5, cy: 9, rx: 6.5, ry: 6.5 }], ['path', { d: 'M15 13.8l5 5.2' }], ['path', { d: 'M8 7h.01M11 7h.01M14 7h.01M9.5 10h.01M12.5 10h.01' }]],
  natacion: [['path', { d: 'M3 16c2 0 2-1.5 4.5-1.5S10 16 12 16s2-1.5 4.5-1.5S19 16 21 16M3 20.5c2 0 2-1.5 4.5-1.5S10 20.5 12 20.5s2-1.5 4.5-1.5S19 20.5 21 20.5' }], ['circle', { cx: 16, cy: 6, r: 2 }], ['path', { d: 'M5 12l4.5-4.5 3.5 3.5' }]],
  atletismo: [['circle', { cx: 12, cy: 13.5, r: 7.5 }], ['path', { d: 'M12 9.5v4l2.6 2.2M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5' }]],
  gimnasio_fitness: [['path', { d: 'M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11' }]],
  varios: [['circle', { cx: 7.5, cy: 7.5, r: 3 }], ['circle', { cx: 16.5, cy: 7.5, r: 3 }], ['circle', { cx: 7.5, cy: 16.5, r: 3 }], ['circle', { cx: 16.5, cy: 16.5, r: 3 }]],
  // Categorías (las que no comparten icono con un deporte).
  balon: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M8 5.5c2.5 2 3.5 4.5 3 8M18.5 9c-3 0-5.5 1-7.5 4.5M7 18.5c1.5-2.5 3.5-4 5.5-5' }]],
  ropa: [['path', { d: 'M8.5 3.5L3.5 6.5l2 4 2-1v11h9v-11l2 1 2-4-5-3c-.8 1.6-2 2.5-3.5 2.5S9.3 5.1 8.5 3.5z' }]],
  calzado: [['path', { d: 'M3 17.5V8l4.5 1.5L10 7l3.5 4.5 5.5 1.8c1.4.5 2 1.4 2 2.7v1.5z' }], ['path', { d: 'M3 14.5h18M9.5 10.5l1.5 1.5' }]],
  protecciones: [['path', { d: 'M12 3l7.5 3v6c0 4.8-3.2 7.8-7.5 9-4.3-1.2-7.5-4.2-7.5-9V6z' }], ['path', { d: 'M9 12l2 2 4-4' }]],
  entrenamiento: [['path', { d: 'M9.5 4h5l4 15h-13z' }], ['path', { d: 'M7.4 12h9.2M3.5 19.5h17' }]],
  porterias: [['path', { d: 'M3 19V6h18v13' }], ['path', { d: 'M3 10h18M3 14.5h18M7.5 6v13M12 6v13M16.5 6v13' }]],
});

// Color fuerte (círculo con icono blanco, ≥ 4,5:1 con blanco) y tinte (fondo de la foto o miniatura) por deporte.
export const COLORES_DEPORTE = Object.freeze({
  futbol: { color: '#15803D', tinte: '#E3F4E8' },
  baloncesto: { color: '#C2410C', tinte: '#FDEBDD' },
  balonmano: { color: '#7C3AED', tinte: '#EEE7FD' },
  voleibol: { color: '#A16207', tinte: '#FBF1D3' },
  tenis: { color: '#4D7C0F', tinte: '#EDF5D9' },
  padel: { color: '#0E7490', tinte: '#DDF2F6' },
  natacion: { color: '#1D4ED8', tinte: '#E1EAFD' },
  atletismo: { color: '#BE123C', tinte: '#FCE4EA' },
  gimnasio_fitness: { color: '#334155', tinte: '#E6EAF0' },
  varios: { color: '#7E22CE', tinte: '#F2E5FC' },
});

// Icono de cada categoría de E04.
export const ICONO_CATEGORIA = Object.freeze({
  balones: 'balon',
  ropa_equipacion: 'ropa',
  calzado: 'calzado',
  protecciones: 'protecciones',
  material_entrenamiento: 'entrenamiento',
  porterias_redes: 'porterias',
  maquinas_fitness: 'gimnasio_fitness',
  otros: 'varios',
});

// Estado del material → número de barritas (5 = nuevo … 1 = para reparar). Acompaña siempre al texto, no lo sustituye.
export const BARRAS_ESTADO = Object.freeze({ nuevo: 5, como_nuevo: 4, buen_estado: 3, usado: 2, para_reparar: 1 });

export function trazosDe(nombre) {
  return TRAZOS[nombre] ?? TRAZOS.varios;
}

export function coloresDeporte(slug) {
  return COLORES_DEPORTE[slug] ?? COLORES_DEPORTE.varios;
}

export function iconoCategoria(slug) {
  return ICONO_CATEGORIA[slug] ?? 'varios';
}

// Lista de 5 booleanos para pintar las barritas: [true, true, true, false, false] para «buen_estado».
export function barrasEstado(estadoMaterial) {
  const n = BARRAS_ESTADO[estadoMaterial] ?? 0;
  return [1, 2, 3, 4, 5].map((i) => i <= n);
}
