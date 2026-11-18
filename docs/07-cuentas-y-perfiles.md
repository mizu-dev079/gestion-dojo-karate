# Cuentas y perfiles

La aplicación tiene tres perfiles: **administrador, profesor y alumno**. El perfil se obtiene de la cuenta autenticada y no se elige en el login. Esta guía describe las cuentas del sistema real; las cuentas ficticias de colaboración se detallan [por separado](09-colaboracion-simulada.md).

## Registro y acceso

El administrador inicial utiliza `ADMIN_USUARIO` y `ADMIN_PASSWORD`. Las cuentas de profesor y alumno se administran en **Usuario → Profesores y alumnos**:

| Apartado | Ruta | Operaciones |
| --- | --- | --- |
| Profesores | `/profesores` | Listado por nombre, creación de profesor y cuenta, estado del registro, acceso y contraseña |
| Alumnos | `/cuentas/alumnos` | Listado por nombre, registro manual, creación de acceso para aceptados y administración de sus cuentas |

El menú `/cuentas` ofrece esos dos apartados. Cada ficha despliega sus datos al pulsar el nombre. El nombre es obligatorio; celular y correo son opcionales. Cuando se ingresa celular, debe contener exactamente nueve dígitos.

### Profesor

**Crear cuenta de profesor** crea el registro y su cuenta en una misma operación. No selecciona profesores anteriores para vincularlos ni reasigna la cuenta a otra persona. La recuperación de una cuenta existente se realiza mediante restablecimiento de contraseña.

La asignación a sus grupos se realiza en **Clases → Editar turno**, seleccionando al profesor activo. La hoja vigente relaciona `Turnos!J` (ID profesor) con `Profesores!A`; el nombre habitual se muestra en `Turnos!K`. Los permisos utilizan el ID del profesor.

### Alumno

El registro manual crea alumno, inscripción y cuenta y reserva el cupo. El formulario solicita los datos personales, la clase, el turno y las credenciales. Si hay solicitudes pendientes coincidentes, se revisan antes de confirmar otra persona.

Cuando ya existe una postulación aceptada, se utiliza **Crear acceso y activar plan** desde los aceptados sin acceso. El formulario utiliza esa inscripción y no vuelve a pedir los datos personales ni ocupa otro cupo.

En ambos casos, **Activar plan al crear el acceso** está marcado por defecto. Permite elegir paquete de 4, 8 o 12 clases, días del turno y fecha. Cuenta y plan se guardan en un único lote; un error no deja altas parciales. Se puede crear solo el acceso. Si el plan ya existe, se conserva y no se activa otro por error.

El ID alumno de Sheets identifica a la persona. Los `alumnoIds` internos de la cuenta o sesión representan sus inscripciones y se obtienen de la relación con esa persona; no se asignan por coincidencia de correo. La API no acepta seleccionar arbitrariamente `alumnoIds` en un alta manual.

## Credenciales y estado

El usuario admite de 3 a 60 caracteres: letras minúsculas, números, punto, guion y guion bajo. Las contraseñas requieren de 8 a 200 caracteres. El contacto no se utiliza obligatoriamente como usuario; no se necesita un correo de Google para ingresar.

El login y los formularios de registro permiten mostrar u ocultar la contraseña mientras se escribe. Profesor y alumno abren **Mi cuenta** con el icono de la esquina superior derecha; desde allí pueden cambiar su contraseña. Administración puede restablecerla o desactivar el acceso desde su ficha. El cambio, restablecimiento o desactivación invalida las sesiones previas.

El administrador del entorno no se cambia ni desactiva desde estas pantallas, y el sistema no crea administradores adicionales. El entorno real no incluye cuentas de prueba predeterminadas.

## Permisos e inicio por perfil

| Perfil | Inicio | Alcance |
| --- | --- | --- |
| Administrador | `/clases` | Gestión de clases y turnos, postulaciones, cuentas, planes, asistencia y autorizaciones |
| Profesor | `/alumnos` | Sus alumnos y turnos, asistencia propia y de alumnos, recuperaciones y congelamientos |
| Alumno | `/alumnos` | Su plan e historial, avisos o retiro de ausencia en Calendario y solicitudes de congelamiento |

En `/alumnos`, `InicioPerfil.jsx` selecciona `PanelProfesor.jsx`, `PanelAlumno.jsx` o la gestión administrativa. Los componentes propios de cada perfil están en `apps/web/src/components/perfiles/` con un panel propio de alumno y un calendario específico de profesor.

Las rutas privadas son administrativas por defecto. Las de identidad y sesión, cambio de contraseña propio, planes y seguimiento declaran los perfiles admitidos; el alumno puede consultar exclusivamente las fechas y cancelaciones de sus propias inscripciones; el detalle de sesiones y sus modificaciones se reservan a profesor y administración. El catálogo, la consulta del turno del formulario y el envío de postulaciones son públicos.

El profesor no administra cuentas, no consulta postulaciones generales, no cambia el plan ni renueva paquetes y no cancela sesiones por el dojo. Solo marca su propia presencia en una sesión asignada. Un reemplazante puede tomar asistencia en la sesión concreta que le asignó administración, sin adquirir permisos generales sobre los planes del grupo.

El alumno no cambia saldos, asistencias registradas por el profesor ni datos de otra persona. El backend comprueba permisos y asignaciones en cada petición; los botones ocultos y las redirecciones no sustituyen esos controles.

## Almacenamiento y sesión

La [estructura vigente de CuentasDojo](03-google-sheets.md) muestra sus datos legibles en A:G, IDs en H:J y `cuentaJson` en K. La contraseña se conserva mediante scrypt con una sal aleatoria por cuenta. Las respuestas de consulta y creación omiten hashes y sales. Los permisos y contraseñas se modifican desde la app, no editando celdas o JSON.

El JWT se guarda en una cookie HttpOnly, SameSite=Lax y Secure en producción. La API comprueba la cuenta activa, su revisión y perfil en cada petición. Se limita el número de intentos de inicio de sesión por IP. Desactivar o eliminar un profesor impide su acceso.

La compatibilidad con hojas antiguas puede resolver asignaciones por nombre cuando no existe ID de profesor, exigiendo una coincidencia única. Esa ruta de compatibilidad no cambia el vínculo por ID de la hoja actual.

## Sincronización de los listados

Los listados de cuentas se actualizan sin botón de recarga. El canal SSE autenticado `GET /cuentas/cambios`, exclusivo de administración, anuncia revisiones después de escrituras exitosas, sin incluir nombres, contactos o credenciales.

También se comprueban cambios cada 30 segundos mientras la página está visible, al volver a ella y al recuperar la conexión. Se conservan filtros, fichas desplegadas y formularios; el canal se cierra al salir. El menú `/cuentas` no abre el canal ni consulta los listados hasta entrar a un apartado.

Las notificaciones y la serialización se aplican dentro de una instancia de la API; no coordinan varias réplicas o ediciones manuales simultáneas de Sheets.

## Operaciones HTTP principales

- `GET /cuentas` y `GET /cuentas/opciones`: consulta administrativa sin contraseñas ni hashes.
- `POST /cuentas`: alta manual de profesor o alumno con su cuenta.
- `POST /cuentas/inscripciones/:id`: acceso para una inscripción ya aceptada.
- `POST /cuentas/:id`: estado del acceso o restablecimiento de contraseña.
- `POST /auth/password`: cambio de contraseña del titular, profesor o alumno.

Las dos altas de alumno aceptan `planInicial` opcional: `{ cantidad: 4 | 8 | 12, dias: [...], fecha: "AAAA-MM-DD" }`. No recibe importes ni referencias. La respuesta indica `planActivado` y, si corresponde, `clasesPendientes`. Las opciones incluyen `permiteActivacionInicial` y `tienePlan` para adaptar el formulario.
