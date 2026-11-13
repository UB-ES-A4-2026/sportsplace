import { Route, Routes } from 'react-router';
import Layout from './components/Layout.jsx';
import RutaPrivada from './components/RutaPrivada.jsx';
import CentroPage from './pages/CentroPage.jsx';
import ConfirmarEmailPage from './pages/ConfirmarEmailPage.jsx';
import DetalleAnuncioPage from './pages/DetalleAnuncioPage.jsx';
import EditarAnuncioPage from './pages/EditarAnuncioPage.jsx';
import EditarPerfilPage from './pages/EditarPerfilPage.jsx';
import EntrarPage from './pages/EntrarPage.jsx';
import MisAnunciosPage from './pages/MisAnunciosPage.jsx';
import InicioPage from './pages/InicioPage.jsx';
import NoEncontradaPage from './pages/NoEncontradaPage.jsx';
import PanelPage from './pages/PanelPage.jsx';
import PerfilPage from './pages/PerfilPage.jsx';
import PublicarAnuncioPage from './pages/PublicarAnuncioPage.jsx';
import RecuperarContrasenaPage from './pages/RecuperarContrasenaPage.jsx';
import RegistroPage from './pages/RegistroPage.jsx';
import RestablecerContrasenaPage from './pages/RestablecerContrasenaPage.jsx';
import UbicacionPage from './pages/UbicacionPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<InicioPage />} />
        <Route path="registro" element={<RegistroPage />} />
        <Route path="confirmar-email" element={<ConfirmarEmailPage />} />
        <Route path="entrar" element={<EntrarPage />} />
        <Route path="recuperar-contrasena" element={<RecuperarContrasenaPage />} />
        <Route path="restablecer-contrasena" element={<RestablecerContrasenaPage />} />
        <Route element={<RutaPrivada />}>
          <Route path="panel" element={<PanelPage />} />
          <Route path="mis-anuncios" element={<MisAnunciosPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="perfil/editar" element={<EditarPerfilPage />} />
          <Route path="perfil/ubicacion" element={<UbicacionPage />} />
          <Route path="anuncios/nuevo" element={<PublicarAnuncioPage />} />
          <Route path="anuncios/:id" element={<DetalleAnuncioPage />} />
          <Route path="anuncios/:id/editar" element={<EditarAnuncioPage />} />
          <Route path="centros/:id" element={<CentroPage />} />
        </Route>
        <Route path="*" element={<NoEncontradaPage />} />
      </Route>
    </Routes>
  );
}
