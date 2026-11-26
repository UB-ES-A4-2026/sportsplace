// Inicio (#386): sección «Quiénes somos», con el equipo en tres filas (1-3-3). Cada persona en un círculo con su cara
// recortada de la foto del equipo o, si no hay foto, con sus iniciales. Las fotos están en public/equipo.
import { Sparkles } from 'lucide-react';
import { FILAS_EQUIPO, iniciales } from './equipo.js';

function Esfera({ persona }) {
  if (persona.foto) {
    return <img className="equipo-esfera" src={persona.foto} alt={`Foto de ${persona.nombre}`} width="112" height="112" loading="lazy" />;
  }
  return (
    <span className={`equipo-esfera equipo-esfera-${persona.icono ? 'icono' : 'iniciales'}`} aria-hidden="true">
      {persona.icono ? <Sparkles size={44} strokeWidth={2.2} /> : iniciales(persona.nombre)}
    </span>
  );
}

export default function QuienesSomos() {
  return (
    <section className="equipo" aria-labelledby="equipo-titulo">
      <h2 id="equipo-titulo">Quiénes somos</h2>
      {FILAS_EQUIPO.map((fila, indice) => (
        <ul key={indice} className="equipo-fila">
          {fila.map((persona) => (
            <li key={persona.nombre} className="equipo-persona">
              <Esfera persona={persona} />
              <p className="equipo-nombre">{persona.nombre}</p>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}
