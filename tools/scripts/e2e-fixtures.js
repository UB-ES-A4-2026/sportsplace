export const fixturePassword = 'SportsplaceE2e2026!';
export const fixtureCentros = [
  { id: '12000000-0000-4000-8000-000000000001', email: 'centro-a@example.test', nombre: 'Club Natació Exemple', confirmed: true },
  { id: '12000000-0000-4000-8000-000000000002', email: 'centro-b@example.test', nombre: 'Centre Esportiu Exemple', confirmed: true },
  { id: '12000000-0000-4000-8000-000000000003', email: 'sin-confirmar@example.test', nombre: 'Centro pendiente de confirmar', confirmed: false },
];

// 21 visible advertisements owned by A: US-18 must paginate them as 20 + 1.
// A separate B advertisement exercises ownership; the withdrawn A item is hidden.
export function fixtureAnuncios() {
  const states = ['activo', 'pausado', 'reservado', 'entregado'];
  const rows = Array.from({ length: 21 }, (_, index) => ({
    id: `12000000-0000-4000-9000-${String(index + 1).padStart(12, '0')}`,
    centro_id: fixtureCentros[0].id,
    titulo: `Material de prueba ${String(index + 1).padStart(2, '0')}`,
    descripcion: 'Material deportivo de ejemplo para las pruebas automatizadas.',
    categoria: 'balones',
    deporte: 'futbol',
    unidades_disponibles: index + 1,
    estado_material: 'buen_estado',
    modalidad: 'donacion',
    precio_unitario_centimos: null,
    estado: states[index % states.length],
    publicado_en: new Date(Date.UTC(2026, 9, 1, 10, index)).toISOString(),
    creado_en: new Date(Date.UTC(2026, 9, 1, 10, index)).toISOString(),
    actualizado_en: new Date(Date.UTC(2026, 9, 1, 10, index)).toISOString(),
    retirado_en: null,
    entregado_en: index % states.length === 3 ? new Date(Date.UTC(2026, 9, 1, 11, index)).toISOString() : null,
  }));
  return [...rows,
    { ...rows[0], id: '12000000-0000-4000-9000-000000000022', centro_id: fixtureCentros[1].id, titulo: 'Balones del centro B' },
    { ...rows[0], id: '12000000-0000-4000-9000-000000000023', titulo: 'Material retirado', estado: 'retirado', retirado_en: '2026-10-02T10:00:00.000Z' },
  ];
}

export async function seedAnuncios(client, { requireAnuncios = false } = {}) {
  const { rows: [{ exists }] } = await client.query("SELECT to_regclass('public.anuncios') IS NOT NULL AS exists");
  if (!exists) {
    if (requireAnuncios) throw new Error('Falta la migración T12-1: no se pueden validar los 21 anuncios de US-18.');
    return { seeded: 0, pending: 'Falta T12-1: centros/Auth disponibles; los 21 anuncios de US-18 siguen pendientes.' };
  }
  const { rows: columns } = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anuncios'");
  const required = Object.keys(fixtureAnuncios()[0]);
  if (required.some((name) => !columns.some((column) => column.column_name === name))) {
    throw new Error('El esquema anuncios no coincide con la Base común E03. Revisar T12-1 antes de sembrar.');
  }
  for (const row of fixtureAnuncios()) {
    const updates = required.filter((name) => name !== 'id').map((name) => `${name}=EXCLUDED.${name}`).join(', ');
    await client.query(`INSERT INTO public.anuncios (${required.join(', ')}) VALUES (${required.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO UPDATE SET ${updates}`, required.map((name) => row[name]));
  }
  return { seeded: 23, pending: null };
}
