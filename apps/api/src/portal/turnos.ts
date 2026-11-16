import { ConflictException } from '@nestjs/common';
import type { Libro } from './estructura.js';
import { numero, texto } from './libro.js';
import { leerClases, recalcularCupos } from './registros.js';

export const clasesOficiales = [
  [1, 'Mini Samuráis', 'Activa'],
  [2, 'Jóvenes Guerreros', 'Activa'],
  [3, 'Avanzados', 'Activa'],
];
export const horariosOficiales = [
  {
    clase: 1,
    nombre: 'Lunes, miércoles y viernes · 5 y 6 años',
    dias: 'Lunes, Miércoles, Viernes',
    inicio: '16:00',
    fin: '17:00',
    min: 5,
    max: 6,
    cupos: 12,
  },
  {
    clase: 1,
    nombre: 'Martes y jueves · 5 a 7 años',
    dias: 'Martes, Jueves',
    inicio: '16:00',
    fin: '17:00',
    min: 5,
    max: 7,
    cupos: 12,
  },
  {
    clase: 2,
    nombre: 'Lunes, miércoles y viernes · 7 a 11 años',
    dias: 'Lunes, Miércoles, Viernes',
    inicio: '17:00',
    fin: '18:00',
    min: 7,
    max: 11,
    cupos: 15,
  },
  {
    clase: 2,
    nombre: 'Martes y jueves · 8 a 15 años',
    dias: 'Martes, Jueves',
    inicio: '17:00',
    fin: '18:00',
    min: 8,
    max: 15,
    cupos: 15,
  },
  {
    clase: 3,
    nombre: 'Lunes, miércoles y viernes · 12 años a más',
    dias: 'Lunes, Miércoles, Viernes',
    inicio: '18:00',
    fin: '19:30',
    min: 12,
    max: null,
    cupos: 18,
  },
];
const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const dias = (s: string) =>
  s
    .split(',')
    .map((s) => normalizar(s))
    .sort()
    .join(',');
export function prepararTurnos(l: Libro) {
  if (l.clasesConTurnos) return { mensaje: 'La estructura de clases y turnos ya está preparada.' };
  const antiguas = leerClases(l),
    usados = new Set(antiguas.map((c) => c.id)),
    mapa = new Map<number, number>();
  const restantes = new Set(horariosOficiales.map((_, i) => i));
  l.Turnos = [];
  for (const c of antiguas) {
    const nombre = normalizar(c.nivel);
    const categoria = nombre.startsWith('mini samurai')
      ? 1
      : nombre.startsWith('jovenes guerreros')
        ? 2
        : nombre.startsWith('avanzados')
          ? 3
          : 0;
    const indice = horariosOficiales.findIndex(
      (t, i) =>
        restantes.has(i) &&
        t.clase === categoria &&
        dias(t.dias) === dias(c.frecuencia.join(',')) &&
        t.inicio === c.horaInicio &&
        t.fin === c.horaFin,
    );
    if (indice < 0)
      throw new ConflictException(
        `El grupo «${c.nivel}» no coincide con los horarios oficiales. Revisa los datos antes de preparar los turnos.`,
      );
    const t = horariosOficiales[indice];
    if (c.cupos - c.cuposDisponibles > t.cupos)
      throw new ConflictException(
        'Un grupo tiene más alumnos que el nuevo cupo oficial. No se ha modificado la hoja.',
      );
    mapa.set(c.id, t.clase);
    restantes.delete(indice);
    l.Turnos.push([
      c.id,
      t.clase,
      t.nombre,
      c.sede,
      t.dias,
      t.inicio,
      t.fin,
      t.min,
      t.max ?? '',
      c.profesorId ?? '',
      c.profesor,
      t.cupos,
      0,
      t.cupos,
      c.estado ?? 'Activa',
    ]);
  }
  let id = 1;
  for (const i of restantes) {
    while (usados.has(id)) id += 1;
    const t = horariosOficiales[i];
    l.Turnos.push([
      id,
      t.clase,
      t.nombre,
      '',
      t.dias,
      t.inicio,
      t.fin,
      t.min,
      t.max ?? '',
      '',
      '',
      t.cupos,
      0,
      t.cupos,
      'Activa',
    ]);
    mapa.set(id, t.clase);
    usados.add(id++);
  }
  const turno = (id: unknown) => {
    const t = l.Turnos.find((t) => texto(t[0]) === texto(id));
    if (!t)
      throw new ConflictException(
        'Hay registros asociados a un grupo que ya no existe. No se ha modificado la hoja.',
      );
    return t;
  };
  for (const f of l.Postulaciones) {
    const t = turno(f[9]);
    f[18] = f[9];
    f[19] = t[2];
    f[9] = t[1];
  }
  for (const f of l.Inscripciones) {
    const t = turno(f[3]);
    f[13] = f[3];
    f[14] = t[2];
    f[3] = t[1];
  }
  for (const f of l.Sesiones) {
    const t = turno(f[1]);
    f[14] = f[1];
    f[15] = t[2];
    f[1] = t[1];
  }
  l.Clases = clasesOficiales.map((c) => [...c]);
  l.clasesConTurnos = true;
  recalcularCupos(l);
  return {
    mensaje: 'Tres clases y cinco turnos preparados. Completa la sede y el profesor de cada turno.',
    clases: 3,
    turnos: l.Turnos.length,
  };
}
export function catalogo(l: Libro) {
  const turnos = leerClases(l);
  const clases = l.clasesConTurnos
    ? l.Clases.map((c) => ({ id: numero(c[0]), nombre: texto(c[1]), estado: texto(c[2]) }))
    : turnos.map((t) => ({ id: t.id, nombre: t.nivel, estado: t.estado ?? 'Activa' }));
  return {
    preparado: !!l.clasesConTurnos,
    clases: clases.map((c) => ({
      ...c,
      turnos: turnos.filter((t) => (t.claseBaseId ?? t.id) === c.id),
    })),
  };
}
