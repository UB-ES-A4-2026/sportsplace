// Navegador simulado (jsdom) para los tests de componentes. Se importa antes que React y Testing Library para que
// encuentren `window` y `document` al cargarse.
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });

globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
for (const nombre of ['HTMLElement', 'Element', 'Node', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  globalThis[nombre] ??= window[nombre];
}
// React 19: avisa si una actualización no va dentro de act(); Testing Library la envuelve.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
