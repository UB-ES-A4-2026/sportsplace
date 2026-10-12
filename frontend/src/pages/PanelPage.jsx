// Zona privada. TODO US-67: botón para cerrar sesión (POST /api/auth/logout).
export default function PanelPage() {
  return (
    <section className="pagina" aria-labelledby="titulo">
      <h1 id="titulo">Zona privada</h1>
      <p className="intro-text">Esta página solo se muestra con la sesión iniciada.</p>
    </section>
  );
}
