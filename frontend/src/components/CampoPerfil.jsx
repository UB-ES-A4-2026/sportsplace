import { cloneElement } from 'react';

// Formularios del perfil (US-07 «Editar perfil», US-68 «Ubicación del centro»).
// Etiqueta (con «*» si es obligatorio, por CSS), el control, el error debajo y, si lo hay, el contador «n/máx» (CA7).
// Los opcionales no llevan «(opcional)»: las etiquetas son las de la especificación.
export default function CampoPerfil({ id, etiqueta, obligatorio = false, error, contador, children }) {
  const idError = `${id}-error`;
  const idContador = `${id}-contador`;
  const excedido = contador && contador.actual > contador.maximo;
  const describe = [error && idError, contador && idContador].filter(Boolean).join(' ') || undefined;

  return (
    <div className={obligatorio ? 'campo campo-obligatorio' : 'campo'}>
      {/* El «*» de obligatorio va por CSS: así la etiqueta es exactamente la de la especificación. */}
      <label htmlFor={id}>{etiqueta}</label>
      {cloneElement(children, {
        id,
        name: id,
        required: obligatorio || undefined,
        'aria-required': obligatorio ? 'true' : undefined,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': describe,
      })}
      {(error || contador) && (
        <div className="campo-pie">
          {error ? <p id={idError} className="campo-error">{error}</p> : <span />}
          {contador && (
            <span id={idContador} className={excedido ? 'contador contador-excedido' : 'contador'}>
              {contador.actual}/{contador.maximo}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
