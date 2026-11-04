// Sección «Modalidad y precio» del formulario de anuncios (US-14).
// Componente controlado: el formulario guarda `valores.modalidad` ('' | 'venta' | 'donacion') y `valores.precio`
// (texto tal como se escribe) y recibe los cambios por `onCambio(campo, valor)`.
// Los ids coinciden con las claves de error (`modalidad`, `precio_unitario_centimos`) para poder llevar el foco
// al primer campo con error y mostrar debajo los `details` de la API.
// Uso: <SeccionModalidadPrecio valores={valores} errores={errores} onCambio={cambiar} />
export default function SeccionModalidadPrecio({ valores, errores, onCambio }) {
  const errorModalidad = errores.modalidad;
  // Con «Donación» el precio no se muestra ni se valida, así que tampoco su error (CA5).
  const errorPrecio = valores.modalidad === 'venta' ? errores.precio_unitario_centimos : undefined;

  return (
    <section className="seccion-formulario">
      <h2>Modalidad y precio</h2>

      <fieldset className="campo-opciones" aria-describedby={errorModalidad ? 'modalidad-error' : undefined}>
        <legend>
          Modalidad<span aria-hidden="true"> *</span>
        </legend>
        <div className="opciones-en-fila">
          <label>
            <input
              id="modalidad"
              type="radio"
              name="modalidad"
              value="venta"
              checked={valores.modalidad === 'venta'}
              onChange={() => onCambio('modalidad', 'venta')}
            />
            Venta
          </label>
          <label>
            <input
              id="modalidad-donacion"
              type="radio"
              name="modalidad"
              value="donacion"
              checked={valores.modalidad === 'donacion'}
              onChange={() => onCambio('modalidad', 'donacion')}
            />
            Donación
          </label>
        </div>
        {errorModalidad && <p id="modalidad-error" className="campo-error">{errorModalidad}</p>}
      </fieldset>

      {valores.modalidad === 'venta' && (
        <div className="campo">
          <label htmlFor="precio_unitario_centimos">
            Precio por unidad (€)<span aria-hidden="true"> *</span>
          </label>
          <div className="campo-con-sufijo">
            <input
              id="precio_unitario_centimos"
              name="precio_unitario_centimos"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              aria-required="true"
              aria-invalid={errorPrecio ? 'true' : undefined}
              aria-describedby={errorPrecio ? 'precio-ayuda precio-error' : 'precio-ayuda'}
              value={valores.precio}
              onChange={(evento) => onCambio('precio', evento.target.value)}
            />
            <span aria-hidden="true">€</span>
          </div>
          <p id="precio-ayuda" className="campo-ayuda">Precio de cada unidad, IVA incluido si lo aplicas.</p>
          {errorPrecio && <p id="precio-error" className="campo-error">{errorPrecio}</p>}
        </div>
      )}

      {valores.modalidad === 'donacion' && <p className="campo-ayuda">El material se cederá gratis.</p>}
    </section>
  );
}
