> En la estructura profesional, los datos legibles de CuentasDojo ocupan A:G, los identificadores H:J y cuentaJson K. La compatibilidad con A/B descrita más abajo corresponde a la hoja anterior. Consultar [estructura actual](03-google-sheets.md).

# Cuentas y perfiles

Hay tres perfiles: **administrador, profesor y alumno**. El rol no se elige en el login: se obtiene de la cuenta autenticada.

## Activación

1. El administrador continúa ingresando con `ADMIN_USUARIO` y `ADMIN_PASSWORD` configurados en el entorno. Las sesiones de ese administrador mantienen compatibilidad.
2. Entrar a **Usuario → Profesores y alumnos**, la pantalla única de registro y administración. Al abrirla se muestran dos tarjetas: Registrar profesor y Registrar alumno, seguidas de las listas de registros. Elegir la tarjeta correspondiente abre su formulario. Tanto profesores como alumnos se registran manualmente desde su tarjeta, creando su cuenta al mismo tiempo. No se seleccionan registros ni postulaciones de prueba.
3. Para Profesor, pulsar **Crear cuenta de profesor**: nombre obligatorio, teléfono y correo opcionales. Se guardan juntos mediante una operación atómica de Google Sheets; no se deja uno creado sin el otro si el lote falla. Todos los profesores oficiales se crean desde cero junto con su cuenta; no se permite vincular registros existentes. Para Alumno, pulsar **Crear cuenta de alumno** e ingresar nombre, contacto opcional, fecha de nacimiento opcional, clase oficial, usuario y contraseña. Se genera un identificador nuevo sin reutilizar postulaciones anteriores.
4. Entregar usuario y contraseña inicial por un medio privado. El titular puede cambiar su contraseña desde **Usuario**. Las contraseñas requieren al menos 8 caracteres. No hay registro público ni contraseñas compartidas predeterminadas.
5. Desactivar acceso o restablecer contraseña desde la cuenta. Ambas acciones invalidan sesiones existentes inmediatamente; el usuario debe volver a ingresar.

El administrador configurado en el entorno no se desactiva ni cambia de contraseña mediante esta pantalla. La gestión permite crear cuentas de profesor y alumno; no crea administradores adicionales.

Cada cuenta de profesor queda asociada al registro nuevo creado en esa misma operación. No existe la opción de vincular profesores anteriores ni de reasignar la cuenta a otra persona. Para recuperar el acceso de un profesor ya creado se restablece su contraseña, sin duplicar su perfil. Las cuentas de alumno conservan la inscripción nueva creada con su alta manual.

## Permisos

Todas las rutas privadas son **solo de administración por defecto**. Solo `/auth/me`, cierre de sesión, cambio de contraseña propio y las rutas de alumnos declaran acceso a los otros perfiles. Las rutas públicas existentes del formulario QR continúan públicas.

El profesor no puede consultar postulaciones generales, gestionar cuentas/profesores, modificar clases ni registrar pagos. Sus alumnos se filtran según el registro de profesor y el nombre de profesor de cada clase. Se exige que ese nombre sea único: la estructura actual de clases almacena nombres, no IDs de profesor. Desactivar/eliminar un profesor o una ambigüedad de nombre bloquea su acceso. Para eliminar esa dependencia se requiere migrar el vínculo de clases a un identificador.

El alumno solo consulta las inscripciones explícitamente asignadas. Cambiar el ID en la URL no permite ver ni modificar otro alumno. Los permisos se validan en la API; ocultar botones o redirigir páginas solo adapta la navegación.

Inicio por perfil:

- Administrador: clases y navegación de administración.
- Profesor: **Mis alumnos y clases**, con filtros de clase/fecha y asistencia.
- Alumno: **Mi plan y asistencia**, con sus solicitudes e historial.

## Almacenamiento y seguridad

La pestaña `CuentasDojo` conserva las columnas técnicas A/B (`id` y `cuentaJson`) y añade una vista legible en C:H: **Nombre, Correo, Celular, Usuario, Perfil y Estado**. Al crear una cuenta junto con el profesor o alumno se copian sus datos de contacto, incluidos los campos opcionales vacíos. Al actualizar la cuenta se actualiza también su fila visible. Las columnas visibles son una vista de consulta; la configuración de acceso sigue almacenada en el JSON. Los registros anteriores de dos columnas siguen siendo compatibles. La primera fila queda fija y la columna `cuentaJson` se presenta con 110 píxeles y texto recortado para no extender la fila. Se rechaza una escritura si C:H contiene cabeceras ajenas, para no sobrescribir datos del usuario. Se crea solo al guardar la primera cuenta, sin cambiar las pestañas anteriores. Conserva usuario, perfil, asignaciones, estado, revisión y contraseña derivada con **scrypt y una sal aleatoria por cuenta**. No almacena contraseñas en texto claro. Los hashes y sales no se devuelven en los endpoints de consulta o creación.

Quien tenga acceso directo a la hoja puede ver/modificar esta información: restringir ese acceso como ya se hace con los datos personales del dojo. No publicar ni compartir la hoja.

El JWT guarda el identificador de cuenta y su revisión. En cada petición se comprueban de nuevo el estado, la revisión y el perfil guardados; no se confía en un rol proporcionado por el cliente. El cambio de contraseña, restablecimiento o desactivación aumenta la revisión. Las cookies mantienen `HttpOnly`, `SameSite=Lax` y `Secure` en producción. Se conserva el límite de intentos de login por IP.

Las escrituras de cuentas, como el seguimiento, requieren una sola instancia de la API y no edición manual simultánea de las pestañas. Consultar no crea hojas, y las cabeceras o datos inválidos provocan un error sin sobrescribir el contenido.

No se han creado cuentas reales ni modificado datos privados durante las pruebas. Se verifican login por perfil, acceso a objetos ajenos, contraseñas, revocación de sesiones y denegación de rutas administrativas usando repositorios simulados.

El contacto del profesor no se usa como usuario de acceso: no necesita teléfono ni correo para iniciar sesión. La lectura de Profesores admite registros anteriores de tres columnas; el alta combinada añade D `telefono` y E `correo` respetando A–C. Para que el profesor vea sus grupos, el nombre en la columna E de `Clases` debe coincidir con su nombre registrado.

La pantalla **Profesores y alumnos** (`/cuentas`) ofrece únicamente dos accesos: **Profesores** (`/profesores`) y **Alumnos** (`/cuentas/alumnos`). Cada página reúne la consulta y la creación de cuentas. El menú no hace lecturas de registros ni abre el canal de actualizaciones; la sincronización se activa al entrar a un listado. Son páginas separadas, con buscador por nombre siempre visible y actualización automática; los datos de cada persona se despliegan al pulsar su nombre. Desde cada listado también se puede crear una cuenta y regresar al listado correspondiente. En cada registro se administra su acceso y contraseña; en profesores también se conserva la activación/desactivación de su registro y la eliminación con confirmación. La lista de alumnos muestra cuentas registradas, sin convertir postulaciones anteriores sin cuenta en candidatos de alta.

El alumno manual y su cuenta se guardan con un único lote atómico: se añade una inscripción nueva aceptada con origen `manual` y se reserva su cupo. La API rechaza `alumnoIds` en el alta y comprueba la clase, sus horarios, cupos y período antes de escribir. La reserva comparte la cola por clase con las aprobaciones de postulaciones de esta instancia para evitar una doble asignación del último cupo. Los datos de prueba existentes no se borran ni se copian al formulario.

## Acceso después de aceptar una postulación

En la estructura profesional, aceptar una solicitud crea el alumno y su inscripción antes de crear su cuenta. En Profesores y alumnos se muestran los alumnos aceptados sin acceso, cada uno con su botón Crear acceso del alumno. El formulario solicita solo usuario y contraseña; usa la inscripción seleccionada y no vuelve a pedir datos personales ni grupo. El endpoint administrativo es `POST /cuentas/inscripciones/:id`.

El ID alumno de la hoja identifica a la persona; los `alumnoIds` internos de la sesión identifican sus inscripciones. La API obtiene las inscripciones del alumno al iniciar o comprobar su sesión, y no concede acceso a otra persona por compartir correo. Los hashes siguen siendo privados en las respuestas de la API. El administrador inicial continúa configurado mediante variables del entorno.

## Actualización automática de los listados

Profesores y alumnos se sincronizan sin botón de recarga. El canal autenticado `GET /cuentas/cambios` utiliza SSE y solo está disponible para administración. Tras una operación HTTP de escritura exitosa se anuncia una revisión, sin nombres, contactos ni credenciales. La página vuelve a consultar sus datos y conserva los filtros, fichas desplegadas y formularios.

Una comprobación cada 30 segundos mientras la página está visible permite recuperar cambios hechos directamente en Sheets o notificaciones perdidas. También se sincroniza al volver a la pestaña, recuperar la conexión y terminar una operación local. Las lecturas anteriores a una modificación propia se descartan para no sobrescribirla con datos viejos. El canal se cierra al salir de la página y envía latidos para evitar conexiones inactivas.

Las notificaciones se comparten dentro de una instancia de la API. Varias réplicas necesitan un canal compartido; la comprobación periódica permite recuperar cambios, pero no sustituye esa coordinación para una entrega inmediata.
