# Cuentas y perfiles

Hay tres perfiles: **administrador, profesor y alumno**. El rol no se elige en el login: se obtiene de la cuenta autenticada.

## Activación

1. El administrador continúa ingresando con `ADMIN_USUARIO` y `ADMIN_PASSWORD` configurados en el entorno. Las sesiones de ese administrador mantienen compatibilidad.
2. Entrar a **Usuario → Cuentas y perfiles**. Registrar antes los profesores y aceptar las postulaciones de los alumnos.
3. Crear la cuenta de profesor, vinculada a su registro activo; o la cuenta de alumno, vinculada a sus inscripciones aceptadas/aprobadas. Si un alumno tiene varios grupos, seleccionar solo sus propias inscripciones.
4. Entregar usuario y contraseña inicial por un medio privado. El titular puede cambiar su contraseña desde **Usuario**. Las contraseñas requieren al menos 12 caracteres. No hay registro público ni contraseñas compartidas predeterminadas.
5. Desactivar acceso o restablecer contraseña desde la cuenta. Ambas acciones invalidan sesiones existentes inmediatamente; el usuario debe volver a ingresar.

El administrador configurado en el entorno no se desactiva ni cambia de contraseña mediante esta pantalla. La gestión permite crear cuentas de profesor y alumno; no crea administradores adicionales.

Las asignaciones de una cuenta se fijan al crearla. Para sustituir una asignación, desactivar la cuenta anterior y crear una nueva con otro usuario. No reutilizar una cuenta de otra persona. Una futura gestión de reasignaciones debe preservar auditoría y revocar sesiones.

## Permisos

Todas las rutas privadas son **solo de administración por defecto**. Solo `/auth/me`, cierre de sesión, cambio de contraseña propio y las rutas de alumnos declaran acceso a los otros perfiles. Las rutas públicas existentes del formulario QR continúan públicas.

El profesor no puede consultar postulaciones generales, gestionar cuentas/profesores, modificar clases ni registrar pagos. Sus alumnos se filtran según el registro de profesor y el nombre de profesor de cada clase. Se exige que ese nombre sea único: la estructura actual de clases almacena nombres, no IDs de profesor. Desactivar/eliminar un profesor o una ambigüedad de nombre bloquea su acceso. Para eliminar esa dependencia se requiere migrar el vínculo de clases a un identificador.

El alumno solo consulta las inscripciones explícitamente asignadas. Cambiar el ID en la URL no permite ver ni modificar otro alumno. Los permisos se validan en la API; ocultar botones o redirigir páginas solo adapta la navegación.

Inicio por perfil:

- Administrador: clases y navegación de administración.
- Profesor: **Mis alumnos y clases**, con filtros de clase/fecha y asistencia.
- Alumno: **Mi plan y asistencia**, con sus solicitudes e historial.

## Almacenamiento y seguridad

La nueva pestaña `CuentasDojo` contiene `id` y `cuentaJson`. Se crea solo al guardar la primera cuenta, sin cambiar las pestañas anteriores. Conserva usuario, perfil, asignaciones, estado, revisión y contraseña derivada con **scrypt y una sal aleatoria por cuenta**. No almacena contraseñas en texto claro. Los hashes y sales no se devuelven en los endpoints de consulta o creación.

Quien tenga acceso directo a la hoja puede ver/modificar esta información: restringir ese acceso como ya se hace con los datos personales del dojo. No publicar ni compartir la hoja.

El JWT guarda el identificador de cuenta y su revisión. En cada petición se comprueban de nuevo el estado, la revisión y el perfil guardados; no se confía en un rol proporcionado por el cliente. El cambio de contraseña, restablecimiento o desactivación aumenta la revisión. Las cookies mantienen `HttpOnly`, `SameSite=Lax` y `Secure` en producción. Se conserva el límite de intentos de login por IP.

Las escrituras de cuentas, como el seguimiento, requieren una sola instancia de la API y no edición manual simultánea de las pestañas. Consultar no crea hojas, y las cabeceras o datos inválidos provocan un error sin sobrescribir el contenido.

No se han creado cuentas reales ni modificado datos privados durante las pruebas. Se verifican login por perfil, acceso a objetos ajenos, contraseñas, revocación de sesiones y denegación de rutas administrativas usando repositorios simulados.
