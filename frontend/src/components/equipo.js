// Inicio (#386): el equipo de «Quiénes somos» en tres filas (1-3-3). Las fotos están en public/equipo.
export const FILAS_EQUIPO = [
  [{ nombre: 'Claude', icono: true }],
  [
    { nombre: 'Alex Yang Ji', foto: '/equipo/alex.webp' },
    { nombre: 'Lucía Nuez Hernández', foto: '/equipo/lucia.webp' },
    { nombre: 'Anass Baki Achkoukar', foto: '/equipo/anass.webp' },
  ],
  [
    { nombre: 'Carlos Moya Paniza' },
    { nombre: 'Asier Sánchez', foto: '/equipo/asier.webp' },
    { nombre: 'Marta Herranz Lozano' },
  ],
];

export function iniciales(nombre) {
  return nombre.split(' ').slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();
}
