import { useContext } from 'react';
import { AuthContexto } from './contexto.js';

// Devuelve { usuario, cargando, iniciarSesion, cerrarSesion, olvidarSesion }.
export function useAuth() {
  const valor = useContext(AuthContexto);
  if (!valor) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return valor;
}
