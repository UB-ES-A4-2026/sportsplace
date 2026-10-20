// Campo de formulario con etiqueta y mensaje de error accesibles.
// Uso: <Campo id="email" etiqueta="Email" error={errores.email} type="email" value={...} onChange={...} />
export default function Campo({ id, etiqueta, error, obligatorio = false, ...inputProps }) {
  const idError = `${id}-error`;

  return (
    <div className="campo">
      <label htmlFor={id}>
        {etiqueta}
        {obligatorio ? <span aria-hidden="true"> *</span> : <span className="opcional"> (opcional)</span>}
      </label>
      <input
        id={id}
        name={id}
        required={obligatorio}
        aria-required={obligatorio || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? idError : undefined}
        {...inputProps}
      />
      {error && <p id={idError} className="campo-error">{error}</p>}
    </div>
  );
}
