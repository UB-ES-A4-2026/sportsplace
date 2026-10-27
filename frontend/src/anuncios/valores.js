// Valores fijos de los anuncios (E03, «Valores fijos»): texto en pantalla ↔ valor de la API.
// Los desplegables muestran las opciones en este orden.

export const CATEGORIAS = [
  { valor: 'balones', etiqueta: 'Balones' },
  { valor: 'ropa_equipacion', etiqueta: 'Ropa y equipación' },
  { valor: 'calzado', etiqueta: 'Calzado' },
  { valor: 'protecciones', etiqueta: 'Protecciones' },
  { valor: 'material_entrenamiento', etiqueta: 'Material de entrenamiento' },
  { valor: 'porterias_redes', etiqueta: 'Porterías y redes' },
  { valor: 'maquinas_fitness', etiqueta: 'Máquinas y fitness' },
  { valor: 'otros', etiqueta: 'Otros' },
];

export const DEPORTES = [
  { valor: 'futbol', etiqueta: 'Fútbol' },
  { valor: 'baloncesto', etiqueta: 'Baloncesto' },
  { valor: 'balonmano', etiqueta: 'Balonmano' },
  { valor: 'voleibol', etiqueta: 'Voleibol' },
  { valor: 'tenis', etiqueta: 'Tenis' },
  { valor: 'padel', etiqueta: 'Pádel' },
  { valor: 'natacion', etiqueta: 'Natación' },
  { valor: 'atletismo', etiqueta: 'Atletismo' },
  { valor: 'gimnasio_fitness', etiqueta: 'Gimnasio y fitness' },
  { valor: 'varios', etiqueta: 'Varios' },
];

export const ESTADOS_MATERIAL = [
  { valor: 'nuevo', etiqueta: 'Nuevo' },
  { valor: 'como_nuevo', etiqueta: 'Como nuevo' },
  { valor: 'buen_estado', etiqueta: 'Buen estado' },
  { valor: 'usado', etiqueta: 'Usado' },
  { valor: 'para_reparar', etiqueta: 'Para reparar' },
];

// «Estados del anuncio y transiciones»: etiqueta y color. `retirado` no se muestra nunca.
export const ESTADOS_ANUNCIO = {
  borrador: { etiqueta: 'Borrador', color: 'morado' },
  activo: { etiqueta: 'Activo', color: 'verde' },
  pausado: { etiqueta: 'Pausado', color: 'gris' },
  reservado: { etiqueta: 'Reservado', color: 'naranja' },
  entregado: { etiqueta: 'Entregado', color: 'azul' },
};

// Texto en pantalla de un valor de la API. Si el valor no está en la lista, se muestra tal cual.
export function etiquetaDe(lista, valor) {
  return lista.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;
}
