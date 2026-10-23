import { Route, Routes } from 'react-router';
import Layout from './components/Layout.jsx';
import RutaPrivada from './components/RutaPrivada.jsx';
import ConfirmarEmailPage from './pages/ConfirmarEmailPage.jsx';
import EntrarPage from './pages/EntrarPage.jsx';
import InicioPage from './pages/InicioPage.jsx';
import NoEncontradaPage from './pages/NoEncontradaPage.jsx';
import PanelPage from './pages/PanelPage.jsx';
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
          <Route path="anuncios/nuevo" element={<PublicarAnuncioPage />} />
        </Route>
        <Route path="*" element={<NoEncontradaPage />} />
      </Route>
    </Routes>
  );
}
