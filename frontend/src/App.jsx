import { Route, Routes } from 'react-router';
import Layout from './components/Layout.jsx';
import AnuncioPage from './pages/AnuncioPage.jsx';
import RutaPrivada from './components/RutaPrivada.jsx';
import ConfirmarEmailPage from './pages/ConfirmarEmailPage.jsx';
import EditarPerfilPage from './pages/EditarPerfilPage.jsx';
import EntrarPage from './pages/EntrarPage.jsx';
import InicioPage from './pages/InicioPage.jsx';
import NoEncontradaPage from './pages/NoEncontradaPage.jsx';
import PanelPage from './pages/PanelPage.jsx';
import PerfilPage from './pages/PerfilPage.jsx';
import PublicarAnuncioPage from './pages/PublicarAnuncioPage.jsx';
import RegistroPage from './pages/RegistroPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<InicioPage />} />
        <Route path="registro" element={<RegistroPage />} />
        <Route path="confirmar-email" element={<ConfirmarEmailPage />} />
        <Route path="entrar" element={<EntrarPage />} />
        <Route element={<RutaPrivada />}>
          <Route path="panel" element={<PanelPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="perfil/editar" element={<EditarPerfilPage />} />
          <Route path="anuncios/nuevo" element={<PublicarAnuncioPage />} />
          <Route path="anuncios/:id" element={<AnuncioPage />} />
        </Route>
        <Route path="*" element={<NoEncontradaPage />} />
      </Route>
    </Routes>
  );
}
