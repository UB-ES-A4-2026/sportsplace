import { useNavigate } from 'react-router';
import { crearAnuncio } from '../api/anuncios.js';
import { AVISO_PUBLICADO, DIALOGO_SALIR } from '../anuncios/publicar.js';
import FormularioAnuncio from '../components/FormularioAnuncio.jsx';

// US-12: /anuncios/nuevo · «Publicar anuncio» (POST /api/anuncios).
export default function PublicarAnuncioPage() {
  const navigate = useNavigate();

  // CA4: con `replace`, «Atrás» no vuelve al formulario relleno. La ficha muestra el aviso verde de `state.aviso`.
  async function publicar(cuerpo) {
    const anuncio = await crearAnuncio(cuerpo);
    navigate(`/anuncios/${encodeURIComponent(anuncio.id)}`, {
      replace: true,
      state: { aviso: { tipo: 'exito', texto: AVISO_PUBLICADO } },
    });
  }

  return (
    <section className="pagina pagina-anuncio" aria-labelledby="titulo-pagina">
      <h1 id="titulo-pagina">Publicar anuncio</h1>
      <p className="intro-text">Los campos marcados con * son obligatorios.</p>
      <FormularioAnuncio
        textoEnviar="Publicar"
        textoEnviando="Publicando…"
        dialogoSalir={DIALOGO_SALIR}
        onEnviar={publicar}
      />
    </section>
  );
}
