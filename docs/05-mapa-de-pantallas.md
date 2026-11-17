# Mapa de pantallas de Shinken Dojo - Hiroshi

Las rutas están en `apps/web/src/pages/`. Los componentes indicados en la tabla son relativos a `apps/web/src/components/`.

| Pantalla | Ruta | Página Astro | Componente o comportamiento |
| --- | --- | --- | --- |
| Entrada | `/` | `index.astro` | Redirige a `/login` |
| Login | `/login` | `login.astro` | `pantallas/Login.jsx` |
| Clases | `/clases` | `clases.astro` | `pantallas/Clases.jsx` |
| Postulaciones | `/postulaciones` | `postulaciones.astro` | `pantallas/Postulaciones.jsx` |
| Calendario de asistencia | `/calendario` | `calendario.astro` | `pantallas/Calendario.jsx` |
| Alumnos y planes por perfil | `/alumnos` | `alumnos.astro` | `perfiles/InicioPerfil.jsx` |
| Profesores y alumnos | `/cuentas` | `cuentas.astro` | `pantallas/Cuentas.jsx`, menú |
| Profesores | `/profesores` | `profesores.astro` | `pantallas/Cuentas.jsx`, vista profesores |
| Cuentas de alumnos | `/cuentas/alumnos` | `cuentas/alumnos.astro` | `pantallas/Cuentas.jsx`, vista alumnos |
| Usuario | `/usuario` | `usuario.astro` | `pantallas/Usuario.jsx` |
| Ayuda e información | `/ajustes` | `ajustes.astro` | `pantallas/Ajustes.jsx` |
| Compartir inscripción | `/compartir-convocatoria` | `compartir-convocatoria.astro` | `pantallas/CompartirConvocatoria.jsx` |
| Formulario público | `/formulario?clase=ID&turno=ID` | `formulario.astro` | `pantallas/FormularioPostulacion.jsx` |
| Entrada antigua de clases | `/nueva-clase` | `nueva-clase.astro` | Redirige a `/clases` |
| Entrada antigua de asistencia | `/asistencia` | `asistencia.astro` | Redirige a `/calendario` |
| Enlace anterior de convocatoria | `/configurar-convocatoria` | `configurar-convocatoria.astro` | Reutiliza la página de compartir y conserva la consulta |
| Enlace anterior del formulario generado | `/formulario-generado` | `formulario-generado.astro` | Reutiliza la página de compartir y conserva la consulta |

## Función de cada sección

**Clases** muestra los tres grupos oficiales y sus turnos. Permite editar sede, frecuencia, horario, profesor y cupos. No incluye altas, eliminación de clases, vigencia, duración ni tarifa. Cada turno ofrece Ver postulaciones y Compartir.

**Postulaciones** permite seleccionar clase, elegir turno cuando hay más de uno y filtrar por estado. No incluye un filtro de búsqueda por nombre, correo o código. La aceptación genera inscripción y reserva de cupo; los enlaces y QR se comparten desde la clase, sin una pantalla de vista previa adicional.

**Calendario** concentra la asistencia. Profesor y administración registran las sesiones y la participación de alumnos. El alumno consulta su asistencia propia y puede avisar o retirar una ausencia actual o futura. El calendario no administra clases ni genera convocatorias.

**Alumnos** concentra planes, saldo, renovaciones, cambio de plan programado, recuperaciones y congelamientos. El listado administrativo de cuentas y contactos se encuentra en Usuario → Profesores y alumnos, no en esta gestión del plan.

**Usuario** muestra la cuenta, el cambio de contraseña propio cuando corresponde, el cierre de sesión y los accesos de administración y ayuda. La guía y la versión se reúnen en Ayuda e información.

## Inicio y permisos

Administración inicia en `/clases` o en una ruta interna válida pendiente en `volver`. Profesor y alumno inician en `/alumnos`. `InicioPerfil.jsx` selecciona el componente correspondiente:

- Profesor: `perfiles/profesor/PanelProfesor.jsx`.
- Alumno: `perfiles/alumno/PanelAlumno.jsx`.
- Administrador: `pantallas/Alumnos.jsx`.

Los paneles de profesor y alumno reutilizan actualmente `Alumnos.jsx` como punto de partida y tienen carpetas separadas para desarrollar sus interfaces. No son cuentas nuevas ni pantallas con permisos distintos. Ver [colaboración simulada](09-colaboracion-simulada.md).

`ProtegerPagina.astro` comprueba la sesión antes de mostrar una página privada y adapta la navegación. La autorización real y las asignaciones se validan en la API. Para profesor y alumno, la navegación incluye Calendario, Alumnos/Mi plan y Usuario; Clases y Postulaciones quedan para administración.

## Piezas compartidas

- `LayoutAdministracion.astro`, en `layouts/`: encabezado, navegación y protección de páginas privadas.
- `NavegacionInferior.astro`, `ProtegerPagina.astro` y `CerrarSesion.astro`: navegación y sesión.
- `TarjetaClase.jsx`, `SelectorClaseTurno.jsx` e `IndicadorCupos.jsx`: clases y selección de turno.
- `SelectorFechaAsistencia.jsx`: calendario de fechas.
- `CampoContrasena.jsx`: visualización de contraseñas al escribir.
- `ConfirmarAccion.jsx` y `Mensaje.jsx`: confirmaciones y resultado de operaciones.
- `QrFormulario.jsx` y `CopiarEnlace.jsx`: descarga del QR y copia del enlace.

Los hooks se mantienen en `hooks/`, el acceso a la API y las utilidades en `lib/`, y la paleta y estilos en `styles/`. Se utiliza un solo tema claro, con blanco, negro y rojo. Las pantallas priorizan títulos, datos y acciones; la ayuda extensa se concentra en su apartado y los mensajes operativos aparecen cuando son necesarios.

## Backend y contratos

La API se organiza en módulos de autenticación, clases, profesores, alumnos y actualizaciones; `portal/` concentra la persistencia de la estructura vigente de Sheets. Los contratos se importan directamente desde `@dojo/shared`. La edición de turnos utiliza `EditarClaseDto`.

La API ficticia se activa únicamente en el [modo de colaboración](09-colaboracion-simulada.md). El modo real conserva la configuración de `PUBLIC_API_URL` y la autenticación del backend.
