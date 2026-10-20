import { Link } from 'react-router';

export default function NoEncontradaPage() {
  return (
    <section className="pagina" aria-labelledby="titulo">
      <h1 id="titulo">Página no encontrada</h1>
      <p className="intro-text">La dirección no existe. <Link to="/">Volver al inicio</Link></p>
    </section>
  );
}
