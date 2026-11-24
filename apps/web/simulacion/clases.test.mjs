import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clasesDelProfesor,
  etiquetaTurno,
  imagenClase,
  sesionesDelTurno,
} from '../src/lib/clases.js';
import { agruparClases } from '../src/lib/turnos.js';

test('un turno se busca por su ID exacto aunque otro coincida con el ID del grupo', () => {
  const sesiones = [
    { claseId: 2, nivel: 'Mini Samuráis' },
    { claseId: 4, nivel: 'Jóvenes Guerreros' },
  ];
  assert.deepEqual(sesionesDelTurno(sesiones, 4), [sesiones[1]]);
  assert.deepEqual(sesionesDelTurno(sesiones, '4'), [sesiones[1]]);
  assert.deepEqual(sesionesDelTurno(sesiones, 99), []);
});

test('los turnos sin alumnos se asignan por ID docente, nunca por un nombre compartido', () => {
  const catalogo = [
    { id: 11, profesorId: 10, profesor: 'Carlos Mendoza' },
    { id: 12, profesorId: 20, profesor: 'Carlos Mendoza' },
    { id: 13, profesor: 'Carlos Mendoza' },
  ];
  const clases = clasesDelProfesor([], catalogo, { profesorId: 10, usuario: 'Carlos Mendoza' });
  assert.deepEqual(
    clases.map((c) => c.id),
    [11],
  );
  assert.equal(clases[0].alumnosIds.size, 0);
  assert.deepEqual(
    clasesDelProfesor([], catalogo, { profesorId: 30, usuario: 'Carlos Mendoza' }),
    [],
  );
});

test('la agrupación conserva tres clases y los dos turnos visibles sin usar sus IDs como número', () => {
  const turnos = [
    { id: 47, claseBaseId: 1, nivel: 'Mini Samuráis', turno: 'Turno 2', frecuencia: ['Martes'] },
    { id: 9, claseBaseId: 1, nivel: 'Mini Samuráis', turno: 'Turno 1', frecuencia: ['Lunes'] },
    { id: 81, claseBaseId: 2, nivel: 'Jóvenes Guerreros', turno: 'Turno 1', frecuencia: ['Lunes'] },
    {
      id: 82,
      claseBaseId: 2,
      nivel: 'Jóvenes Guerreros',
      turno: 'Turno 2',
      frecuencia: ['Martes'],
    },
    { id: 90, claseBaseId: 3, nivel: 'Avanzados', turno: 'Turno único', frecuencia: ['Lunes'] },
  ];
  const grupos = agruparClases(turnos);
  assert.deepEqual(
    grupos.map((g) => g.turnos.length),
    [2, 2, 1],
  );
  assert.deepEqual(grupos[0].turnos.map(etiquetaTurno), ['Turno 1', 'Turno 2']);
  assert.equal(etiquetaTurno(turnos[0]), 'Turno 2');
  assert.equal(etiquetaTurno(turnos[4]), 'Horario');
});

test('se conserva la clase autorizada por la API anterior sin duplicar alumnos ni turnos', () => {
  const clase = { id: 7, nivel: 'Avanzados' };
  const resultado = clasesDelProfesor(
    [
      { id: 101, clase },
      { id: 102, clase },
    ],
    [],
    { profesorId: 10 },
  );
  assert.equal(resultado.length, 1);
  assert.deepEqual([...resultado[0].alumnosIds], [101, 102]);
  assert.equal(imagenClase('Mini Samuráis'), '/imagenes/clases/mini-samurais.png');
  assert.equal(imagenClase('Jóvenes Guerreros'), '/imagenes/clases/jovenes-guerreros.png');
  assert.equal(imagenClase('Avanzados'), '/imagenes/clases/avanzados.png');
  assert.equal(imagenClase('Desconocida'), null);
});
