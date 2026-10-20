// TODO US-02: leer `token_hash` y `type` de la URL y enviarlos a POST /api/auth/confirmar.
export default function ConfirmarEmailPage() {
  return (
    <section className="pagina" aria-labelledby="titulo">
      <h1 id="titulo">Confirmar email</h1>
      <p className="intro-text">Aquí se confirmará el email del centro a partir del enlace recibido (US-02).</p>
    </section>
  );
}
