// Icono de deporte o categoría del diseño S2 «con vida». Decorativo por defecto (aria-hidden): el texto que lo
// acompaña ya dice qué es. Si va solo, pasa `etiqueta` y se anuncia como imagen.
// Uso: <IconoDeporte nombre="futbol" tamano={20} color="#fff" />
//      <CirculoDeporte deporte="baloncesto" tamano={40} />  (círculo de color con el icono blanco)
import { createElement } from 'react';
import { trazosDe, coloresDeporte } from './iconosDeporte.js';

export function IconoDeporte({ nombre, tamano = 24, color = 'currentColor', grosor = 2, etiqueta }) {
  const accesible = etiqueta ? { role: 'img', 'aria-label': etiqueta } : { 'aria-hidden': true };
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...accesible}
    >
      {trazosDe(nombre).map(([etiquetaSvg, atributos], i) => createElement(etiquetaSvg, { key: i, ...atributos }))}
    </svg>
  );
}

export function CirculoDeporte({ deporte, icono, tamano = 40 }) {
  const { color } = coloresDeporte(deporte);
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        width: tamano, height: tamano, borderRadius: '50%', background: color,
      }}
    >
      <IconoDeporte nombre={icono ?? deporte} tamano={Math.round(tamano * 0.58)} color="#fff" />
    </span>
  );
}
