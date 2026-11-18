import { randomUUID } from 'node:crypto';
import { cuentasPrueba, datosIniciales, desplazar, diaSemana, hoyLima } from './datos.mjs';

export const PREFIJO_SIMULADO = '/api-simulada';
const COOKIE = 'dojo_simulacion';
const pausaEn = (s, fecha) =>
  s.congelamientos.some(
    (c) =>
      c.desde <= fecha && (!c.hasta || fecha < c.hasta) && (!c.reactivado || fecha < c.reactivado),
  );
const validarFecha = (fecha) =>
  typeof fecha === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
  Number.isFinite(Date.parse(`${fecha}T00:00:00Z`)) &&
  new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) === fecha;
function exigir(condicion, mensaje, status = 400) {
  if (!condicion) throw Object.assign(new Error(mensaje), { status });
}
function recalcular(s) {
  for (const p of s.pagos) p.restantes = p.cantidad;
  for (const a of [...s.asistencias].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const recuperada = s.recuperaciones.find((r) => r.fecha === a.fecha && !r.revocada);
    if (recuperada) {
      a.pagoId = recuperada.pagoId;
      continue;
    }
    const p = s.pagos.find(
      (p) => p.restantes > 0 && p.fecha <= a.fecha && p.dias.includes(diaSemana(a.fecha)),
    );
    exigir(p, 'No hay clases disponibles para esa fecha.', 409);
    p.restantes--;
    a.pagoId = p.id;
  }
}
function resumen(s, hoy) {
  return {
    ...structuredClone(s),
    congelado: pausaEn(s, hoy),
    pendientes: s.pagos.reduce((n, p) => n + p.restantes, 0),
    faltasPendientes: s.asistencias.filter(
      (a) =>
        a.estado !== 'presente' &&
        !s.recuperaciones.some((r) => r.fecha === a.fecha && !r.revocada),
    ).length,
  };
}

/** Datos ficticios en memoria. No importa ni inicia la API real ni clientes de Google. */
export function crearApiSimulada({ hoy: hoyFijo, crearDatos = datosIniciales } = {}) {
  const datos = crearDatos(hoyFijo ?? hoyLima()),
    accesos = new Map();
  const claves = new Map(cuentasPrueba.map((c) => [c.usuario, c.usuario]));
  for (const a of datos.alumnos) recalcular(a.seguimiento);
  const visibles = (cuenta) =>
    datos.alumnos.filter((a) =>
      cuenta.perfil === 'profesor'
        ? a.clase.profesorId === cuenta.profesorId
        : cuenta.alumnoIds.includes(a.id),
    );
  const publico = (cuenta) => ({ id: cuenta.usuario, ...cuenta, revision: 0 });
  const cookie = (valor, borrar = false) =>
    `${COOKIE}=${valor}; Path=${PREFIJO_SIMULADO}; HttpOnly; SameSite=Lax${borrar ? '; Max-Age=0' : ''}`;
  function responder({ method = 'GET', path = '/', body = {}, cookies = '' }) {
    const hoy = hoyFijo ?? hoyLima();
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    };
    const salida = (body, status = 200) => ({ status, headers, body: structuredClone(body) });
    try {
      const url = new URL(path, 'http://simulado.local');
      const ruta = url.pathname.replace(/\/$/, '') || '/';
      if (method === 'POST' && ruta === '/auth/login') {
        const cuenta = cuentasPrueba.find((c) => c.usuario === body.usuario);
        exigir(
          cuenta && claves.get(cuenta.usuario) === body.password,
          'Usuario o contraseña incorrectos.',
          401,
        );
        const token = randomUUID();
        accesos.set(token, cuenta);
        headers['Set-Cookie'] = cookie(token);
        return salida(publico(cuenta));
      }
      if (method === 'GET' && ruta === '/clases/catalogo')
        return salida({
          preparado: true,
          clases: [1, 2, 3].map((id) => ({
            id,
            nombre: datos.clases.find((c) => c.claseBaseId === id).nivel,
            estado: 'Activa',
            turnos: datos.clases.filter((c) => c.claseBaseId === id),
          })),
        });
      if (method === 'GET' && /^\/clases\/\d+$/.test(ruta)) {
        const clase = datos.clases.find((c) => c.id === Number(ruta.split('/').at(-1)));
        exigir(clase, 'Turno no encontrado.', 404);
        return salida(clase);
      }
      const token = cookies
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${COOKIE}=`))
        ?.slice(COOKIE.length + 1);
      const cuenta = accesos.get(token);
      exigir(cuenta, 'Inicia sesión.', 401);
      if (method === 'GET' && ruta === '/auth/me') return salida(publico(cuenta));
      if (method === 'POST' && ruta === '/auth/logout') {
        accesos.delete(token);
        headers['Set-Cookie'] = cookie('', true);
        return salida({ ok: true });
      }
      if (method === 'POST' && ruta === '/auth/password') {
        exigir(
          body.actual === claves.get(cuenta.usuario) &&
            typeof body.nueva === 'string' &&
            body.nueva.length >= 8,
          'Revisa la contraseña actual y utiliza al menos 8 caracteres.',
        );
        claves.set(cuenta.usuario, body.nueva);
        for (const [t, c] of accesos) if (c.usuario === cuenta.usuario) accesos.delete(t);
        headers['Set-Cookie'] = cookie('', true);
        return salida({ ok: true });
      }
      if (method === 'GET' && ruta === '/planes')
        return salida(
          [4, 8, 12].map((cantidad, i) => ({
            id: `PLAN-${cantidad}`,
            nombre: `${cantidad} clases`,
            cantidad,
            importe: [130, 150, 180][i],
            recuperaciones: cantidad === 4 ? 1 : 2,
          })),
        );
      if (method === 'GET' && ruta === '/alumnos')
        return salida(
          visibles(cuenta).map((a) => ({ ...a, seguimiento: resumen(a.seguimiento, hoy) })),
        );
      if (ruta === '/sesiones' && method === 'GET' && cuenta.perfil === 'alumno') {
        const desde = url.searchParams.get('desde') ?? url.searchParams.get('fecha');
        const hasta = url.searchParams.get('hasta') ?? desde;
        exigir(
          validarFecha(desde) &&
            validarFecha(hasta) &&
            hasta >= desde &&
            hasta <= desplazar(desde, 120),
          'Selecciona un intervalo de hasta 121 días.',
        );
        const propias = visibles(cuenta);
        const sesiones = [];
        for (let fecha = desde; fecha <= hasta; fecha = desplazar(fecha, 1)) {
          for (const alumno of propias) {
            const clase = alumno.clase;
            if (!clase?.frecuencia.includes(diaSemana(fecha))) continue;
            const sesion = datos.sesiones.get(`${clase.id}:${fecha}`);
            sesiones.push({
              alumnoId: alumno.id,
              claseId: clase.id,
              fecha,
              estado: sesion?.estado ?? 'programada',
            });
          }
        }
        return salida({ sesiones });
      }
      if (ruta === '/sesiones' && method === 'GET') {
        exigir(cuenta.perfil === 'profesor', 'Acceso reservado al profesor.', 403);
        const fecha = url.searchParams.get('fecha');
        exigir(validarFecha(fecha), 'Selecciona una fecha válida.');
        return salida({
          profesores: [],
          sesiones: datos.clases
            .filter(
              (c) => c.profesorId === cuenta.profesorId && c.frecuencia.includes(diaSemana(fecha)),
            )
            .map((c) => {
              const s = datos.sesiones.get(`${c.id}:${fecha}`) ?? {
                claseId: c.id,
                fecha,
                horaInicio: c.horaInicio,
                horaFin: c.horaFin,
                profesorId: c.profesorId,
                profesor: c.profesor,
                estado: 'programada',
                asistenciaProfesor: 'pendiente',
                version: 0,
                auditoria: [],
              };
              return {
                ...s,
                nivel: c.nivel,
                sede: c.sede,
                turno: c.turno,
                alumnos: visibles(cuenta)
                  .filter((a) => a.claseId === c.id)
                  .map((a) => {
                    const t = a.seguimiento,
                      registro = t.asistencias.find((r) => r.fecha === fecha),
                      pausa = pausaEn(t, fecha),
                      programado =
                        !!t.plan &&
                        t.plan.dias.includes(diaSemana(fecha)) &&
                        t.pagos.some((p) => p.fecha <= fecha) &&
                        !pausa;
                    return {
                      id: a.id,
                      nombre: a.nombre,
                      version: t.version,
                      pendientes: resumen(t, hoy).pendientes,
                      programado,
                      estado:
                        s.estado === 'cancelada'
                          ? 'cancelada'
                          : pausa
                            ? 'congelado'
                            : (registro?.estado ?? (programado ? 'pendiente' : 'sin sesión')),
                      tienePlan: !!t.plan,
                    };
                  }),
              };
            }),
        });
      }
      if (method === 'POST' && /^\/sesiones\/\d+\/[^/]+$/.test(ruta)) {
        const [, , id, fecha] = ruta.split('/'),
          clase = datos.clases.find((c) => c.id === Number(id));
        exigir(
          cuenta.perfil === 'profesor' && clase?.profesorId === cuenta.profesorId,
          'Esta sesión pertenece a otro profesor.',
          403,
        );
        exigir(
          validarFecha(fecha) && clase.frecuencia.includes(diaSemana(fecha)) && fecha <= hoy,
          'Selecciona una fecha válida del turno que no sea futura.',
        );
        exigir(
          body.accion === 'profesor' && body.asistencia === 'presente',
          'Solo puedes marcar tu propia presencia.',
          403,
        );
        const clave = `${id}:${fecha}`,
          anterior = datos.sesiones.get(clave);
        exigir(
          body.version === (anterior?.version ?? 0),
          'La sesión cambió. Actualiza la lista.',
          409,
        );
        exigir(anterior?.estado !== 'cancelada', 'La sesión fue cancelada por el dojo.', 409);
        const s = {
          claseId: clase.id,
          fecha,
          horaInicio: clase.horaInicio,
          horaFin: clase.horaFin,
          profesorId: clase.profesorId,
          profesor: clase.profesor,
          estado: 'realizada',
          asistenciaProfesor: 'presente',
          version: body.version + 1,
          auditoria: [
            ...(anterior?.auditoria ?? []),
            { usuario: cuenta.usuario, fecha: hoy, accion: 'profesor', motivo: body.motivo ?? '' },
          ],
        };
        datos.sesiones.set(clave, s);
        return salida({ sesion: s });
      }
      if (method === 'POST' && /^\/alumnos\/\d+$/.test(ruta)) {
        const a = visibles(cuenta).find((a) => a.id === Number(ruta.split('/').at(-1)));
        exigir(a, 'Alumno no disponible para esta cuenta.', 403);
        const anterior = a.seguimiento,
          s = structuredClone(anterior),
          c = body;
        exigir(c.version === s.version, 'El registro cambió. Actualiza los datos.', 409);
        const alumno = cuenta.perfil === 'alumno';
        exigir(
          (alumno
            ? ['asistencia', 'retirarAviso', 'solicitarCongelamiento']
            : [
                'asistencia',
                'retirarAviso',
                'congelar',
                'reactivar',
                'recuperar',
                'revocarRecuperacion',
                'limiteRecuperaciones',
                'resolverSolicitud',
              ]
          ).includes(c.accion),
          'Acción no permitida para este perfil.',
          403,
        );
        exigir(s.plan, 'El alumno todavía no tiene un plan.');
        if (c.accion === 'asistencia') {
          exigir(
            Object.keys(c).every((k) => ['accion', 'version', 'fecha', 'estado'].includes(k)),
            'La asistencia solo admite acción, versión, fecha y estado.',
          );
          exigir(
            datos.sesiones.get(`${a.claseId}:${c.fecha}`)?.estado !== 'cancelada',
            'La sesión fue cancelada por el dojo.',
            409,
          );
          const previa = s.asistencias.find((r) => r.fecha === c.fecha);
          if (alumno)
            exigir(
              c.estado === 'avisada' && c.fecha >= hoy && (!previa || previa.estado === 'avisada'),
              'Solo puedes avisar una ausencia actual o futura sin modificar la asistencia del profesor.',
              403,
            );
          exigir(
            validarFecha(c.fecha) &&
              s.plan.dias.includes(diaSemana(c.fecha)) &&
              !pausaEn(s, c.fecha),
            'La fecha no corresponde a una clase activa del plan.',
          );
          exigir(['presente', 'falta', 'avisada'].includes(c.estado), 'Asistencia inválida.');
          exigir(
            c.fecha <= hoy || c.estado === 'avisada',
            'Solo se pueden avisar ausencias futuras.',
          );
          s.asistencias = s.asistencias.filter((r) => r.fecha !== c.fecha);
          s.asistencias.push({
            fecha: c.fecha,
            estado: c.estado,
            pagoId: null,
            politica: 'vigente',
          });
        } else if (c.accion === 'retirarAviso') {
          exigir(
            validarFecha(c.fecha) &&
              c.fecha >= hoy &&
              s.asistencias.some((r) => r.fecha === c.fecha && r.estado === 'avisada') &&
              !s.recuperaciones.some((r) => r.fecha === c.fecha && !r.revocada),
            'No hay un aviso vigente para retirar.',
          );
          s.asistencias = s.asistencias.filter((r) => r.fecha !== c.fecha);
        } else if (['congelar', 'solicitarCongelamiento'].includes(c.accion)) {
          exigir(typeof c.motivo === 'string' && c.motivo.trim(), 'Indica un motivo.');
          exigir(
            !c.hasta || (validarFecha(c.hasta) && c.hasta > hoy),
            'La fecha de regreso debe ser posterior a hoy.',
          );
          exigir(!pausaEn(s, hoy), 'El plan ya está congelado.', 409);
          if (c.accion === 'congelar')
            s.congelamientos.push({
              id: randomUUID(),
              desde: hoy,
              hasta: c.hasta || null,
              reactivado: null,
              motivo: c.motivo,
            });
          else {
            exigir(
              !s.solicitudes.some((r) => r.estado === 'pendiente'),
              'Ya existe una solicitud pendiente.',
              409,
            );
            s.solicitudes.push({
              id: randomUUID(),
              fecha: hoy,
              hasta: c.hasta || null,
              motivo: c.motivo,
              estado: 'pendiente',
              resueltaPor: null,
              respuesta: null,
            });
          }
        } else if (c.accion === 'reactivar') {
          exigir(pausaEn(s, hoy), 'El plan no está congelado.');
          s.congelamientos.findLast((r) => !r.reactivado).reactivado = hoy;
        } else if (c.accion === 'resolverSolicitud') {
          const r = s.solicitudes.find((r) => r.id === c.id && r.estado === 'pendiente');
          exigir(r, 'La solicitud ya fue resuelta.', 409);
          exigir(
            typeof c.aprobar === 'boolean' && c.motivo?.trim(),
            'Indica la decisión y el motivo.',
          );
          if (c.aprobar) {
            exigir(!pausaEn(s, hoy), 'El plan ya está congelado.');
            s.congelamientos.push({
              id: randomUUID(),
              desde: hoy,
              hasta: r.hasta,
              reactivado: null,
              motivo: r.motivo,
            });
          }
          Object.assign(r, {
            estado: c.aprobar ? 'aprobada' : 'rechazada',
            respuesta: c.motivo,
            resueltaPor: cuenta.usuario,
          });
        } else if (c.accion === 'recuperar') {
          const falta = s.asistencias.find(
            (r) => r.fecha === c.fecha && r.estado !== 'presente' && r.fecha <= hoy,
          );
          exigir(
            falta && !s.recuperaciones.some((r) => r.fecha === c.fecha && !r.revocada),
            'Selecciona una falta sin recuperación.',
          );
          const p = s.pagos.find((p) => p.id === falta.pagoId);
          exigir(p, 'Paquete no encontrado.');
          exigir(
            s.recuperaciones.filter((r) => r.pagoId === p.id && !r.revocada).length <
              p.limiteRecuperaciones,
            'Se alcanzó el límite de recuperaciones.',
            409,
          );
          exigir(c.motivo?.trim(), 'Indica el motivo.');
          s.recuperaciones.push({
            id: randomUUID(),
            fecha: c.fecha,
            pagoId: p.id,
            motivo: c.motivo,
            autorizadaPor: cuenta.usuario,
            autorizadaEl: hoy,
            revocada: false,
          });
        } else if (c.accion === 'revocarRecuperacion') {
          const r = s.recuperaciones.find((r) => r.id === c.id && !r.revocada);
          exigir(r && c.motivo?.trim(), 'Selecciona una recuperación y un motivo.');
          r.revocada = true;
        } else if (c.accion === 'limiteRecuperaciones') {
          const p = s.pagos.find((p) => p.id === c.pagoId);
          exigir(
            p && Number.isInteger(c.limite) && c.limite >= 0 && c.limite <= 12 && c.motivo?.trim(),
            'Revisa el paquete, límite y motivo.',
          );
          exigir(
            c.limite >= s.recuperaciones.filter((r) => r.pagoId === p.id && !r.revocada).length,
            'El límite es menor a las recuperaciones autorizadas.',
          );
          p.limiteRecuperaciones = c.limite;
        }
        recalcular(s);
        s.version++;
        s.auditoria.push({
          id: randomUUID(),
          fecha: hoy,
          usuario: cuenta.usuario,
          accion: c.accion,
          motivo: c.motivo ?? '',
        });
        a.seguimiento = s;
        return salida(resumen(s, hoy));
      }
      if (['/clases', '/profesores'].includes(ruta) || ruta.startsWith('/cuentas'))
        return salida(
          { message: 'Este entorno está reservado a los perfiles profesor y alumno.' },
          403,
        );
      return salida({ message: 'Esta operación no está disponible en la API simulada.' }, 404);
    } catch (error) {
      return salida(
        { message: error.status ? error.message : 'No se pudo completar la operación simulada.' },
        error.status ?? 500,
      );
    }
  }
  const middleware = async (req, res, next) => {
    const url = new URL(req.url, 'http://simulado.local');
    if (url.pathname !== PREFIJO_SIMULADO && !url.pathname.startsWith(`${PREFIJO_SIMULADO}/`))
      return next();
    try {
      let contenido = '';
      for await (const trozo of req) {
        contenido += trozo;
        exigir(Buffer.byteLength(contenido) <= 16000, 'Solicitud demasiado grande.', 413);
      }
      let body = {};
      if (contenido) {
        try {
          body = JSON.parse(contenido);
        } catch {
          exigir(false, 'JSON inválido.');
        }
      }
      const r = responder({
        method: req.method,
        path: `${url.pathname.slice(PREFIJO_SIMULADO.length)}${url.search}`,
        body,
        cookies: req.headers.cookie,
      });
      res.writeHead(r.status, r.headers);
      res.end(JSON.stringify(r.body));
    } catch (error) {
      res.writeHead(error.status ?? 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: error.message }));
    }
  };
  return { responder, middleware };
}
