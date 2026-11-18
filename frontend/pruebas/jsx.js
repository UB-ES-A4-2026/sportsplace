// Tests de componentes con `node --test`: registra el cargador que compila los .jsx (ver cargador-jsx.js).
// Se carga con `--import` desde el script `test` de package.json.
import { register } from 'node:module';

register('./cargador-jsx.js', import.meta.url);
