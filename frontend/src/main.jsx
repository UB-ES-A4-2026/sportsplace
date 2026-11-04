import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.jsx';
import AuthProvider from './auth/AuthProvider.jsx';
import CentroProvider from './centro/CentroProvider.jsx';
import './styles.css';
import './anuncios/anuncios.css';
import './perfil/perfil.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CentroProvider>
          <App />
        </CentroProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
