# Mapa de pantallas de Mi Dojo

Las rutas están en `apps/web/src/pages/`. El contenido interactivo de cada pantalla está en `apps/web/src/components/pantallas/`.

| Pantalla | Ruta | Archivo en `pages/` | Archivo en `components/pantallas/` |
| --- | --- | --- | --- |
| Entrada al login | `/` | `index.astro` | Redirige a `/login` |
| Clases | `/clases` | `clases.astro` | `Clases.jsx` |
| Ruta antigua de alta | `/nueva-clase` → `/clases` | `nueva-clase.astro` | Redirección, sin formulario |
| Postulaciones | `/postulaciones` | `postulaciones.astro` | `Postulaciones.jsx` |
| Calendario de asistencia | `/calendario` | `calendario.astro` | `Calendario.jsx` |
| Profesores y alumnos | `/cuentas` | `cuentas.astro` | `Cuentas.jsx` |
| Alumnos | `/alumnos` | `alumnos.astro` | `Alumnos.jsx` |
| Ruta anterior de profesores | `/profesores` → `/cuentas` | `profesores.astro` | Redirección |
| Usuario | `/usuario` | `usuario.astro` | `Usuario.jsx` |
| Ayuda e información | `/ajustes` | `ajustes.astro` | `Ajustes.jsx` |
| Enlace anterior de convocatoria | `/configurar-convocatoria` | `configurar-convocatoria.astro` | Reutiliza CompartirConvocatoria |
| Compartir convocatoria | `/compartir-convocatoria` | `compartir-convocatoria.astro` | `CompartirConvocatoria.jsx` |
| Formulario de postulación público | `/formulario?clase=ID` | `formulario.astro` | `FormularioPostulacion.jsx` |
| Iniciar sesión | `/login` | `login.astro` | `Login.jsx` |

El calendario se dedica a la asistencia. Profesores y administración seleccionan una fecha, consultan las sesiones y registran la presencia del profesor y de los alumnos. El alumno consulta su propia asistencia y puede avisar o retirar una ausencia futura. La gestión de clases y las convocatorias se realizan en sus apartados respectivos.

La ruta anterior `/asistencia` redirige a `/calendario`. Alumnos concentra los planes, recuperaciones y congelamientos; la toma de asistencia no se duplica en esa pantalla. Los accesos de ayuda se reúnen en Usuario → Ayuda e información.

## Componentes compartidos

En `apps/web/src/components/` quedan las piezas que pueden usarse en varias pantallas:

- `NavegacionInferior.astro`: barra inferior.
- `ProtegerPagina.astro`: comprobación de sesión de las páginas privadas.
- `CerrarSesion.astro`: botón para cerrar sesión.
- `styles/tema.css`: define el único tema claro con los colores del dojo.
- `TarjetaClase.jsx` e `IndicadorCupos.jsx`: resumen de una clase y disponibilidad.
- `QrFormulario.jsx` y `CopiarEnlace.jsx`: QR y copia de enlaces.
- `Mensaje.jsx`: avisos de éxito y error.

`apps/web/src/layouts/LayoutAdministracion.astro` reúne el encabezado, la navegación y la protección de las pantallas privadas. Los hooks permanecen en `hooks/`, las utilidades en `lib/` y los estilos en `styles/`.

## Enlaces anteriores

`pages/formulario-generado.astro` es un alias de compatibilidad: renderiza `compartir-convocatoria.astro`, sin duplicar su contenido ni perder parámetros como `?clase=ID`.

La ruta principal `/` lleva siempre al login. Al iniciar sesión se abre `/clases`, salvo que haya una pantalla privada pendiente en `?volver=...`. Las páginas privadas solo se muestran después de comprobar la sesión; si la comprobación falla, llevan al login. Las clases oficiales se cargan en Google Sheets. La ruta antigua `/nueva-clase` redirige a `/clases` y no permite altas.

La dirección pública `/formulario?clase=ID` se conserva para que sigan funcionando los QR compartidos.

## Backend y código compartido

La API conserva la convención de NestJS por módulo: `apps/api/src/clases/`, `profesores/` y `auth/`. Dentro de cada módulo, los sufijos `.controller.ts`, `.service.ts`, `.module.ts`, `.dto.ts` y `.repository.ts` indican la función del archivo. Los tipos y estados comunes están en `packages/shared/src/`.

La navegación inferior incluye **Alumnos**. El registro y la gestión de ambos perfiles se unifican en **Usuario → Profesores y alumnos**. Consulta [planes y asistencia](06-alumnos-asistencia.md) para conocer los planes, recuperaciones y permisos.
