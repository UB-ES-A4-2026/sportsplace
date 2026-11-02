import { useContext } from 'react';
import { CentroContexto } from './contexto.js';

// Devuelve { centro, cargando, error, recargar, actualizarCentro }.
export function useCentro() {
  const valor = useContext(CentroContexto);
  if (!valor) throw new Error('useCentro debe usarse dentro de <CentroProvider>.');
  return valor;
}
