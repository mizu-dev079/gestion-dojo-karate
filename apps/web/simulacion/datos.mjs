export const hoyLima = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
export const diaSemana = (fecha) =>
  ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
    new Date(`${fecha}T00:00:00Z`).getUTCDay()
  ];
export function desplazar(fecha, dias) {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
}
export const cuentasPrueba = [
  { usuario: 'profesor.prueba', perfil: 'profesor', profesorId: 10 },
  { usuario: 'alumno.prueba', perfil: 'alumno', alumnoIds: [101] },
  { usuario: 'alumno.recuperacion', perfil: 'alumno', alumnoIds: [102] },
  { usuario: 'alumno.congelado', perfil: 'alumno', alumnoIds: [103] },
  { usuario: 'alumno.solicitud', perfil: 'alumno', alumnoIds: [104] },
  { usuario: 'alumno.sinplan', perfil: 'alumno', alumnoIds: [106] },
];
const diasLMV = ['Lunes', 'Miércoles', 'Viernes'];
const diasMJ = ['Martes', 'Jueves'];
export function datosIniciales(hoy = hoyLima()) {
  const clases = [
    [11, 1, 'Mini Samuráis', 'Turno 1', diasLMV, '16:00', '17:00', 5, 6, 12, 10, 'Carlos Mendoza'],
    [12, 1, 'Mini Samuráis', 'Turno 2', diasMJ, '16:00', '17:00', 5, 7, 12, 10, 'Carlos Mendoza'],
    [
      21,
      2,
      'Jóvenes Guerreros',
      'Turno 1',
      diasLMV,
      '17:00',
      '18:00',
      7,
      11,
      15,
      20,
      'Rosa Torres',
    ],
    [22, 2, 'Jóvenes Guerreros', 'Turno 2', diasMJ, '17:00', '18:00', 8, 15, 15, 20, 'Rosa Torres'],
    [31, 3, 'Avanzados', 'Turno único', diasLMV, '18:00', '19:30', 12, null, 18, 20, 'Rosa Torres'],
  ].map(
    ([
      id,
      claseBaseId,
      nivel,
      turno,
      frecuencia,
      horaInicio,
      horaFin,
      edadMinima,
      edadMaxima,
      cupos,
      profesorId,
      profesor,
    ]) => ({
      id,
      turnoId: id,
      claseBaseId,
      claseNombre: nivel,
      nivel,
      turno: `${nivel} · ${turno}`,
      frecuencia,
      horaInicio,
      horaFin,
      edadMinima,
      edadMaxima,
      cupos,
      cuposDisponibles: cupos,
      profesorId,
      profesor,
      sede: 'Dojo de demostración',
      estado: 'Activa',
      configurado: true,
      tarifa: 0,
      fechaInicio: '',
      fechaFin: '',
      duracion: '',
    }),
  );
  const alumnos = [
    [101, 'Mateo Prueba', 11, 4],
    [102, 'Valentina Prueba', 11, 8],
    [103, 'Lucas Prueba', 12, 12],
    [104, 'Camila Prueba', 12, 8],
    [105, 'Diego Prueba', 31, 12],
    [106, 'Sofía Prueba', 12, null],
  ].map(([id, nombre, claseId, cantidad]) => {
    const clase = clases.find((c) => c.id === claseId);
    const seguimiento = {
      version: 0,
      plan: cantidad ? { cantidad, dias: [...clase.frecuencia], importe: 0 } : null,
      proximoPlan: null,
      pagos: cantidad
        ? [
            {
              id: `PAQUETE-${id}`,
              fecha: desplazar(hoy, -30),
              cantidad,
              restantes: cantidad,
              importe: 0,
              dias: [...clase.frecuencia],
              referencia: '',
              limiteRecuperaciones: cantidad === 4 ? 1 : 2,
            },
          ]
        : [],
      asistencias: [],
      congelamientos: [],
      recuperaciones: [],
      solicitudes: [],
      auditoria: [],
    };
    return {
      id,
      nombre,
      claseId,
      clase,
      telefono: '900111222',
      correo: `alumno${id}@example.com`,
      seguimiento,
    };
  });
  function ultimaClase(clase, desde) {
    let fecha = desplazar(desde, -1);
    while (!clase.frecuencia.includes(diaSemana(fecha))) fecha = desplazar(fecha, -1);
    return fecha;
  }
  for (const alumno of alumnos.filter((a) => [101, 102].includes(a.id))) {
    const s = alumno.seguimiento,
      fecha = ultimaClase(alumno.clase, hoy);
    s.asistencias.push({
      fecha,
      estado: alumno.id === 101 ? 'presente' : 'falta',
      pagoId: s.pagos[0].id,
      politica: 'vigente',
    });
    if (alumno.id === 102)
      s.recuperaciones.push({
        id: 'RECUPERACION-102',
        fecha,
        pagoId: s.pagos[0].id,
        motivo: 'Ausencia justificada de ejemplo',
        autorizadaPor: 'profesor.prueba',
        autorizadaEl: hoy,
        revocada: false,
      });
  }
  alumnos.find((a) => a.id === 101).seguimiento.proximoPlan = {
    cantidad: 8,
    dias: [...diasLMV],
    importe: 0,
  };
  alumnos
    .find((a) => a.id === 103)
    .seguimiento.congelamientos.push({
      id: 'CONGELAMIENTO-103',
      desde: desplazar(hoy, -2),
      hasta: null,
      reactivado: null,
      motivo: 'Viaje de ejemplo',
    });
  alumnos
    .find((a) => a.id === 104)
    .seguimiento.solicitudes.push({
      id: 'SOLICITUD-104',
      fecha: hoy,
      hasta: desplazar(hoy, 7),
      motivo: 'Motivo de ejemplo',
      estado: 'pendiente',
      resueltaPor: null,
      respuesta: null,
    });
  for (const clase of clases)
    clase.cuposDisponibles -= alumnos.filter((a) => a.claseId === clase.id).length;
  return { clases, alumnos, sesiones: new Map() };
}
