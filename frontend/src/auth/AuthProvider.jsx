import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ErrorApi } from '../api/cliente.js';
import { borrarSesion, guardarSesion, leerSesion } from '../api/sesion.js';
import { AuthContexto } from './contexto.js';

// El access_token dura una hora. Se renueva con /api/auth/refresh este margen (segundos) antes de que caduque.
const MARGEN_RENOVACION = 60;

const ahora = () => Math.floor(Date.now() / 1000);
const esSesionInvalida = (error) => error instanceof ErrorApi && error.status === 401;

async function renovar(sesion) {
  const datos = await api('/auth/refresh', { method: 'POST', body: { refresh_token: sesion.refresh_token } });
  guardarSesion(datos.sesion);
  return datos;
}

// US-03: guarda al usuario de la sesión, la recupera al cargar la web y la mantiene renovada.
export default function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Si hay una sesión guardada, hasta comprobarla no sabemos si el usuario sigue dentro.
  const [cargando, setCargando] = useState(() => leerSesion() !== null);
  const [caducidad, setCaducidad] = useState(null);
  // La renovación con refresh_token no debe ejecutarse dos veces (StrictMode repite los efectos en desarrollo).
  const restaurada = useRef(false);

  // Al cargar la web: comprueba la sesión guardada con GET /api/auth/me (o la renueva si está a punto de caducar).
  useEffect(() => {
    const sesion = leerSesion();
    if (!sesion || restaurada.current) return;
    restaurada.current = true;

    async function restaurar() {
      try {
        const datos = ahora() >= sesion.expires_at - MARGEN_RENOVACION
          ? await renovar(sesion)
          : { usuario: (await api('/auth/me')).usuario, sesion };
        setUsuario(datos.usuario);
        setCaducidad(datos.sesion.expires_at);
      } catch (error) {
        // Sesión caducada o cerrada: se descarta. Con otros errores (sin conexión) se conserva para reintentar.
        if (esSesionInvalida(error)) borrarSesion();
      } finally {
        setCargando(false);
      }
    }
    restaurar();
  }, []);

  // Renueva la sesión antes de que caduque el access_token.
  useEffect(() => {
    if (caducidad === null) return undefined;

    const espera = Math.max((caducidad - MARGEN_RENOVACION - ahora()) * 1000, 0);
    const temporizador = window.setTimeout(async () => {
      const sesion = leerSesion();
      if (!sesion) return;
      try {
        const datos = await renovar(sesion);
        setUsuario(datos.usuario);
        setCaducidad(datos.sesion.expires_at);
      } catch (error) {
        if (esSesionInvalida(error)) {
          borrarSesion();
          setUsuario(null);
          setCaducidad(null);
        }
      }
    }, espera);

    return () => window.clearTimeout(temporizador);
  }, [caducidad]);

  // POST /api/auth/login. Si falla lanza ErrorApi para que el formulario muestre el mensaje.
  const iniciarSesion = useCallback(async (email, password) => {
    const datos = await api('/auth/login', { method: 'POST', body: { email, password } });
    guardarSesion(datos.sesion);
    setUsuario(datos.usuario);
    setCaducidad(datos.sesion.expires_at);
  }, []);

  // Borra la sesión solo en este navegador (el cierre de sesión en el servidor es US-67).
  const olvidarSesion = useCallback(() => {
    borrarSesion();
    setUsuario(null);
    setCaducidad(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, olvidarSesion }),
    [usuario, cargando, iniciarSesion, olvidarSesion],
  );

  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>;
}
