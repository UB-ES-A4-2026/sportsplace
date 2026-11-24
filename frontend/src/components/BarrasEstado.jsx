import { barrasEstado } from '../diseno/iconosDeporte.js';
import '../diseno/barras.css';

// Diseño con vida (#361): cinco barritas del estado del material (5 = nuevo … 1 = para reparar). Decorativas: el texto
// del estado va siempre al lado, así que no se anuncian (el estado nunca se indica solo con el dibujo).
export default function BarrasEstado({ estado }) {
  return (
    <span className="barras-estado" aria-hidden="true">
      {barrasEstado(estado).map((llena, i) => (
        // Las cinco barritas son fijas y no cambian de orden: la posición sirve de clave.
        <span key={i} className={llena ? 'barra-estado barra-estado-llena' : 'barra-estado'} />
      ))}
    </span>
  );
}
