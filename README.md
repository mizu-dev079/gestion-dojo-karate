# Shinken Dojo - Hiroshi

**Versión actual: 0.2.0 — en desarrollo.** Esta versión reúne el portal de alumnos, los tres perfiles de acceso y el seguimiento de planes, asistencia, recuperaciones y congelamientos. El número de versión se muestra en Usuario → Ajustes y se mantiene alineado en web, API y contratos compartidos.

Portal web para centralizar la inscripción y el seguimiento de los alumnos de Shinken Dojo - Hiroshi. La plataforma integra la consulta de horarios y planes, el registro de asistencia, la renovación de inscripciones y la gestión de recuperaciones y congelamientos.

El sistema contempla accesos diferenciados para administración, profesores y alumnos. Desde cada perfil se dispone de las funciones correspondientes para organizar la actividad del dojo, consultar el avance de las clases contratadas y dar seguimiento a las solicitudes de los alumnos.

Su desarrollo se orienta a simplificar las tareas administrativas y mejorar el acceso a la información desde celulares y computadoras, manteniendo la continuidad de los planes y la conservación de las clases pendientes.

La solución se organiza como un **monorepo**, con frontend, API y contratos compartidos administrados mediante **pnpm workspaces y Turborepo**. El portal se encuentra en desarrollo; su publicación y aceptación de uso en producción requieren validación independiente.

| Carpeta | Tecnología | Qué es |
|---|---|---|
| `apps/web` | Astro 7 + React 19 + Tailwind CSS 4 + Ant Design 6 | Portal de administración, profesores y alumnos, y formulario público |
| `apps/api` | Node.js 24 + NestJS 12 + Google Sheets (`googleapis`) | API REST, autenticación, reglas de negocio y persistencia |
| `packages/shared` | TypeScript | Tipos, estados y reglas compartidos que utiliza la API |

Los datos se guardan en una hoja de cálculo de Google. La estructura del almacenamiento se detalla en [Datos en Google Sheets](docs/03-google-sheets.md).

## Funcionalidades principales

- **Acceso por perfiles:** inicio de sesión y permisos diferenciados para administrador, profesor y alumno. Cada profesor accede a sus grupos y cada alumno consulta únicamente sus propias inscripciones.
- **Inscripción manual de alumnos:** registro de datos, asignación a una clase oficial y creación de la cuenta de acceso en una sola operación, con comprobación de cupos.
- **Sesiones y asistencia:** consulta por fecha, marcación propia del profesor y registro individual de alumnos. Administración puede asignar reemplazos, corregir la asistencia del profesor y cancelar una sesión sin consumir saldo ni recuperaciones de los alumnos.
- **Admisión desde postulaciones:** en la estructura profesional, aceptar una solicitud crea alumno, inscripción y reserva de cupo juntos. El profesor ve al alumno al actualizar la lista; su cuenta puede crearse después sin duplicar la inscripción.
- **Hoja profesional:** personas, inscripciones, planes, pagos, sesiones y seguimiento se guardan en pestañas legibles, conservando los formatos importados. Se mantiene compatibilidad con la estructura anterior.
- **Portal del alumno:** consulta de horarios, planes, clases pendientes, pagos registrados, asistencia, recuperaciones y estado de las solicitudes de congelamiento.
- **Planes continuos de 4, 8 o 12 clases:** registro de pagos y renovación del mismo plan, con conservación del saldo anterior y consumo de las clases del pago más antiguo primero.
- **Control de asistencia:** registro y corrección de presencias y faltas, avisos de ausencia y filtros por profesor, clase y fecha para consultar los alumnos programados.
- **Recuperaciones manuales:** autorización de clases pendientes en el horario habitual, sin añadir clases al plan. Se contempla una recuperación por pago de 4 clases y dos por pago de 8 o 12, con ajuste del límite y registro del motivo por el profesor o administrador.
- **Congelamiento del plan:** solicitud del alumno y autorización del profesor asignado o administrador, con fecha de regreso o reactivación manual, manteniendo el cupo y las clases pendientes.
- **Gestión unificada de profesores y alumnos:** alta de profesores junto con su cuenta, contacto opcional, administración de accesos, restablecimiento de contraseñas y cambio de contraseña por el titular.
- **Consulta de clases oficiales:** visualización de los grupos registrados en Google Sheets y del calendario de entrenamiento. Los grupos permanentes pueden recibir inscripciones sin una fecha de finalización.
- **Convocatorias y postulaciones:** enlaces y códigos QR descargables, formulario público de inscripción y revisión de solicitudes con control de cupos.
- **Historial de seguimiento:** consulta de pagos, asistencia, congelamientos y recuperaciones, con registro de las autorizaciones y sus motivos.
- **Interfaz adaptable:** navegación para celulares y computadoras, avisos dentro del portal, guía de uso y un único tema claro con la identidad visual del dojo.

## Organización del portal

La administración de personas se concentra en **Usuario → Profesores y alumnos**. Desde esta pantalla se registran profesores y alumnos nuevos junto con sus cuentas de acceso, sin seleccionar datos de prueba ni reutilizar postulaciones anteriores. El nombre es obligatorio; teléfono y correo son opcionales. En el alta de alumno también se indica la clase oficial y, opcionalmente, la fecha de nacimiento.

Las clases se cargan directamente en Google Sheets. La creación desde la web y desde `POST /clases` está deshabilitada; la consulta, el calendario y las operaciones administrativas de edición y eliminación se mantienen disponibles. La preparación de grupos permanentes se detalla en la [guía de clases oficiales](docs/08-clases-oficiales.md).

| Perfil | Funciones disponibles |
|---|---|
| Administrador | Registro y administración de cuentas, clases oficiales, inscripciones, planes, pagos, asistencia, recuperaciones y congelamientos |
| Profesor | Consulta de sus grupos y alumnos asignados, asistencia, autorización de recuperaciones, ajuste de límites y gestión de congelamientos |
| Alumno | Consulta de sus inscripciones, horarios, pagos e historial; aviso o retiro de ausencias actuales/futuras y solicitud de congelamiento |

La inscripción manual crea un registro nuevo y reserva su cupo junto con la cuenta. El plan y el primer pago se registran después desde **Alumnos**. Cada renovación conserva el saldo anterior. El registro de pagos no implica cobros automáticos ni conexión con una pasarela de pago.

El formulario público y las convocatorias por QR siguen disponibles como un flujo adicional de solicitudes. Las postulaciones pendientes no reservan cupo; la aceptación o aprobación sí lo hace. El registro manual no depende de una postulación previa ni elimina registros existentes.

## Guías del proyecto

1. [Referencia de Gitflow](docs/01-gitflow.md): convenciones generales de ramas. El flujo vigente del proyecto utiliza `construccion`, según lo indicado más adelante.
2. [Commits convencionales](docs/02-commits-convencionales.md): cómo escribir los mensajes de commit.
3. [Datos en Google Sheets](docs/03-google-sheets.md): pestañas, columnas, credenciales y validación de postulaciones.
4. [Calidad de código](docs/04-calidad-de-codigo.md): Biome, Husky, pruebas con Vitest y CI.
5. [Mapa de pantallas](docs/05-mapa-de-pantallas.md): rutas y archivos de cada sección.
6. [Alumnos, planes y asistencia](docs/06-alumnos-asistencia.md): pagos, renovaciones, recuperaciones y congelamientos.
7. [Cuentas y perfiles](docs/07-cuentas-y-perfiles.md): altas manuales, autenticación y permisos.
8. [Clases oficiales](docs/08-clases-oficiales.md): preparación de los grupos y horarios en Sheets.

## Requisitos

- **Git** para descargar y actualizar el repositorio.
- **Node.js 24**, la versión indicada en `.nvmrc`.
- **pnpm 12.6.0**, fijado en el campo `packageManager` de `package.json`. Usar la misma versión evita conflictos entre Corepack, pnpm global y las tareas de Turborepo.
- Una cuenta de Google, un proyecto con **Google Sheets API habilitada**, una cuenta de servicio y una hoja compartida con esa cuenta como **Editor**.
- Internet para consultar y guardar datos en Google Sheets.

## Puesta en marcha

La puesta en marcha se realiza mediante **PowerShell en Windows**, desde la carpeta seleccionada para alojar el proyecto. Las dependencias se instalan de forma conjunta mediante pnpm.

```powershell
# 1. Descargar la rama que contiene esta versión
git clone --branch construccion https://github.com/mizu-dev079/gestion-dojo-karate.git
cd gestion-dojo-karate

# 2. Instalar pnpm y las dependencias del proyecto
npm install --global pnpm@12.6.0
pnpm install --frozen-lockfile

# 3. Crear los archivos de configuración local
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env

# 4. Crear la carpeta donde se guardará la credencial de Google
New-Item -ItemType Directory -Force apps/api/credentials
```

La llave JSON de la cuenta de servicio se guarda en `apps/api/credentials/google-service-account.json`. La hoja se prepara con las pestañas **Clases**, **Profesores** y **Postulaciones**, respetando los encabezados y el orden descritos en la [guía de Google Sheets](docs/03-google-sheets.md). Las clases oficiales se cargan antes de asignar alumnos. Los registros anteriores de Profesores con tres columnas siguen siendo compatibles; el alta añade D `telefono` y E `correo`. En Postulaciones se conservan R/S para el consentimiento del formulario público y se utiliza T `origen` para distinguir las altas manuales.

Las pestañas **CuentasDojo** y **SeguimientoAlumnos** se crean en la primera operación válida de escritura que las requiere. La aplicación no carga datos de demostración ni elimina automáticamente registros anteriores.

Los dos archivos `.env` se configuran antes del arranque. La API valida las variables obligatorias y detiene el inicio cuando faltan valores o no se cumplen los requisitos.

| Archivo | Variable | Qué configurar |
|---|---|---|
| `apps/api/.env` | `NODE_ENV` | `development` para el entorno local |
| `apps/api/.env` | `PORT` | Puerto de la API; por defecto, `3000` |
| `apps/api/.env` | `WEB_URL` | Dirección exacta de la web, por ejemplo `http://localhost:4321` |
| `apps/api/.env` | `JWT_SECRET` | Secreto aleatorio de al menos 32 caracteres; sustituir el ejemplo |
| `apps/api/.env` | `JWT_EXPIRES_IN_SECONDS` | Duración de la sesión; por defecto, `28800` segundos (8 horas) |
| `apps/api/.env` | `ADMIN_USUARIO` | Usuario del administrador, de al menos 3 caracteres |
| `apps/api/.env` | `ADMIN_PASSWORD` | Contraseña del administrador, de al menos 12 caracteres; sustituir el ejemplo |
| `apps/api/.env` | `GOOGLE_SPREADSHEET_ID` | Identificador de la hoja de cálculo, tomado de su URL |
| `apps/api/.env` | `GOOGLE_CREDENTIALS_PATH` | Por defecto, `credentials/google-service-account.json`, relativo a `apps/api` |
| `apps/api/.env` | `GOOGLE_CREDENTIALS_JSON` | Alternativa al archivo: JSON de la credencial configurado de forma privada en el alojamiento |
| `apps/api/.env` | `COOKIE_DOMAIN` | Vacío en local; definir según los dominios elegidos al publicar |
| `apps/web/.env` | `PUBLIC_API_URL` | Dirección de la API, por ejemplo `http://localhost:3000` |

La generación de un nuevo secreto se realiza localmente mediante el siguiente comando:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Los `.env` y la carpeta `credentials/` están ignorados por Git. Su traslado a otra computadora se realiza por un medio privado. La URL pública de la API se configura en el frontend; las contraseñas y credenciales permanecen en el backend.

Una vez completada la configuración, se inicia el sistema con:

```powershell
pnpm dev
```

- Web: http://localhost:4321 (presenta el inicio de sesión).
- API: http://localhost:3000 (no es la interfaz del sistema).

El primer acceso de administración utiliza `ADMIN_USUARIO` y `ADMIN_PASSWORD`. Las cuentas de profesor y alumno se crean desde **Usuario → Profesores y alumnos**; no se incluyen cuentas de prueba predeterminadas. Tras iniciar sesión, administración accede a Clases, el profesor a sus alumnos y grupos, y el alumno a su plan y asistencia.

El arranque diario se realiza con `pnpm dev` desde la raíz del proyecto. Se inician el frontend y el backend en una sola terminal y se mantiene la compilación del paquete compartido. Los procesos se detienen con **Ctrl+C**. Cuando existe un frontend iniciado en segundo plano, se detiene con `pnpm stop:web`; también se detienen las instancias de la API abiertas por separado para liberar los puertos.

> La clonación del repositorio ya incluye la inicialización de Git. La reactivación de los hooks después de instalar se realiza con `pnpm run prepare`.

### Actualizar una copia existente

Antes de actualizar, se detiene la aplicación y se comprueba la rama correspondiente a esta versión mediante los siguientes comandos:

```powershell
git fetch origin
git switch construccion
git pull --ff-only origin construccion
pnpm dev
```

Cuando la actualización modifica las dependencias o el lockfile, se ejecuta `pnpm install --frozen-lockfile` antes de `pnpm dev`. Si Git informa de cambios locales que serían sobrescritos, estos se conservan mediante un commit o un respaldo con `git stash` antes de continuar.

### Probar desde un celular

La prueba desde un celular requiere que ambos dispositivos se encuentren conectados a la misma red. En la siguiente configuración, `IP-DE-LA-PC` representa la dirección de red de la computadora:

| Configuración | Valor para la red local |
|---|---|
| `apps/web/.env`: `PUBLIC_API_URL` | `http://IP-DE-LA-PC:3000` |
| `apps/api/.env`: `WEB_URL` | `http://IP-DE-LA-PC:4321` |
| `apps/api/.env`: `COOKIE_DOMAIN` | Vacío |
| Dirección de acceso desde el navegador | `http://IP-DE-LA-PC:4321` |

Después de modificar la configuración, se reinician ambos servicios. Cuando el firewall lo solicita, se habilita el acceso de Node.js en la red privada. La web y la API se acceden mediante el mismo hostname o IP para mantener el funcionamiento de la sesión.

El frontend escucha en la red local. Cuando cambia la IP de la computadora, se actualizan los `.env`, se reinician los servicios y se generan nuevamente los enlaces y QR. En el celular, `localhost` corresponde al propio dispositivo; el acceso al sistema se realiza mediante la IP de la computadora.

## Scripts principales

Desde la raíz del proyecto:

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Compila shared, mantiene sus cambios e inicia frontend y backend en una terminal |
| `pnpm dev:web` / `pnpm dev:api` | Levanta solo una app |
| `pnpm stop:web` | Detiene el frontend si se inició en segundo plano |
| `pnpm build` | Compila los tres paquetes |
| `pnpm typecheck` | Revisa los tipos de la API y shared; web no tiene actualmente un script propio de typecheck |
| `pnpm test` | Ejecuta las pruebas unitarias de la API y shared con Vitest |
| `pnpm --filter api test:e2e` | Pruebas HTTP de la API con repositorios simulados; no usan una hoja real |
| `pnpm lint` | Revisa el código con Biome sin modificarlo |
| `pnpm format` | Aplica formato con Biome |
| `pnpm check` | Formatea y corrige lo que Biome pueda arreglar solo |
| `pnpm ci:check` | Comprueba formato y lint sin escribir cambios, como en CI |
| `pnpm commit` | Asistente para escribir el commit con el formato correcto |
| `postinstall` | Se ejecuta después de instalar dependencias: compila `packages/shared`, que usa la API |

Las comprobaciones recientes de desarrollo incluyen las compilaciones de web y API, typecheck, pruebas unitarias y HTTP, y verificaciones de navegación con Playwright en tamaños móviles y de escritorio. Las verificaciones de navegador no forman parte de un comando de pruebas versionado del frontend. La validación de entrega se completa con pruebas de aceptación acordadas con el cliente.

## Estructura

```text
apps/
  api/src/
    main.ts                  arranque: validación global, cookies y CORS
    config/env.ts            carga y validación de variables de entorno
    auth/                    cuentas, perfiles, contraseñas, JWT y sesiones
    alumnos/                 planes, pagos, asistencia, recuperaciones y congelamientos
    clases/                  clases, postulaciones, cupos y validación de horarios
    profesores/              datos de profesores, contacto y estado del registro
    google/                  cliente de Google Sheets
  api/test/                  pruebas HTTP con repositorios simulados
  web/
    src/
      pages/                 rutas del sistema y formulario público
      components/pantallas/  contenido React de cada pantalla
      components/            navegación, tarjetas, confirmaciones, QR y mensajes
      layouts/               encabezado, navegación y protección de páginas privadas
      hooks/                 sesión del usuario y estado de operaciones
      lib/                   acceso a la API y enlaces de formularios
      styles/                estilos globales y paleta del dojo
packages/shared/src/
  enums/                     estados, duraciones y reglas compartidas
  types/api.ts               contratos de datos entre web y API
docs/                        documentación técnica del proyecto
```

La ubicación de cada pantalla y su ruta se detalla en el [mapa de pantallas](docs/05-mapa-de-pantallas.md).

## Endpoints de la API

Las rutas privadas requieren autenticación y son exclusivas de administración salvo autorización explícita para otro perfil. Los permisos y la asignación del alumno o grupo se comprueban en la API. La sesión se envía mediante cookie HTTP-only.

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| `POST` | `/auth/login` | Público | Autenticación y creación de la sesión según la cuenta |
| `GET` | `/auth/me` | Los tres perfiles | Consulta de la identidad y el perfil autenticado |
| `POST` | `/auth/logout` | Los tres perfiles | Cierre de sesión |
| `POST` | `/auth/password` | Profesor y alumno | Cambio de contraseña propia y cierre de las sesiones anteriores |
| `GET` | `/cuentas` | Administrador | Consulta de cuentas, sin contraseñas ni hashes |
| `GET` | `/cuentas/opciones` | Administrador | Consulta de clases y referencias de los registros con cuenta |
| `POST` | `/cuentas` | Administrador | Alta manual de profesor o alumno nuevo junto con su cuenta |
| `POST` | `/cuentas/inscripciones/:id` | Administrador | Crea el acceso de un alumno ya inscrito sin duplicar persona ni cupo |
| `GET` | `/planes` | Los tres perfiles | Catálogo activo de paquetes, precios y recuperaciones |
| `POST` | `/cuentas/:id` | Administrador | Activación/desactivación del acceso o restablecimiento de contraseña |
| `GET` | `/alumnos` | Según perfil | Seguimiento de todos los alumnos para administración, grupos propios para profesor o inscripciones propias para alumno |
| `POST` | `/alumnos/:id` | Según acción y asignación | Planes, pagos, asistencia, recuperaciones, solicitudes y congelamientos |
| `GET` | `/sesiones?fecha=AAAA-MM-DD` | Administrador o profesor asignado | Sesiones, asistencia del profesor y alumnos del grupo |
| `POST` | `/sesiones/:id/:fecha` | Administrador o profesor asignado | Marcación propia del profesor; administración corrige, asigna reemplazos o cancela |
| `GET` | `/clases` | Administrador | Consulta de clases oficiales y cupos disponibles |
| `GET` | `/clases/:id` | Público | Consulta de la clase del formulario o QR |
| `POST` | `/clases` | Deshabilitado | Respuesta 405 para administración; las altas se realizan en Sheets |
| `POST` | `/clases/:id` | Administrador | Edición de una clase y validación de cruces de horario |
| `DELETE` | `/clases/:id` | Administrador | Eliminación de una clase |
| `GET` | `/clases/postulaciones` | Administrador | Consulta de solicitudes |
| `POST` | `/clases/postulaciones` | Público | Registro de una postulación pendiente con validaciones y consentimiento |
| `POST` | `/clases/postulaciones/estado` | Administrador | Cambio de estado y actualización de cupos |
| `DELETE` | `/clases/postulaciones/:id` | Administrador | Eliminación de una solicitud y recálculo de cupos |
| `GET` | `/profesores` | Administrador | Consulta de registros de profesor y contacto opcional |
| `POST` | `/profesores` | Administrador | Alta independiente heredada de un registro; el portal utiliza `/cuentas` para crear también su acceso |
| `POST` | `/profesores/estado` | Administrador | Activación o desactivación del profesor |
| `DELETE` | `/profesores/:id` | Administrador | Eliminación del registro de profesor |

Las acciones y reglas de `/alumnos/:id` se detallan en la [guía de seguimiento](docs/06-alumnos-asistencia.md). Administración registra los planes y pagos; el profesor gestiona asistencia y autorizaciones de sus alumnos; el alumno solo avisa o retira ausencias permitidas y solicita congelamiento.

Las clases se identifican por id, pero actualmente guardan al profesor por nombre. Al eliminar un profesor, sus clases y solicitudes existentes conservan el nombre guardado; no se eliminan en cascada. Las postulaciones también conservan una copia de los datos de su clase al momento de enviarse.

## Historial de desarrollo

Las entradas fechadas describen etapas anteriores. Las referencias históricas a Mi Dojo, al modo oscuro o a la creación de clases no representan funciones vigentes: el nombre actual es Shinken Dojo - Hiroshi, se mantiene un único tema claro y las clases se cargan desde Sheets.

### Evolución actual

- Se incorporaron perfiles de administrador, profesor y alumno con permisos en la API y cuentas individuales.
- Se unificó el registro y la administración de personas en Profesores y alumnos, con altas manuales desde cero.
- Se añadieron planes continuos, pagos registrados, renovaciones con conservación del saldo, asistencia y recuperaciones manuales.
- Se integraron solicitudes de congelamiento, autorización por el profesor o administrador y reactivación manual o con fecha acordada.
- Se adoptaron el nombre, el logo y la paleta del dojo, y se retiraron la selección de temas y el formulario de creación de clases.

### Cambios realizados (2026-10-07)

- Se corrigió la consulta de postulaciones para utilizar `GET /clases/postulaciones` en lugar de `GET /profesores`.
- Se ajustó el acceso a la API desde la pantalla de postulaciones y se verificó la compilación del frontend.

### Cambios realizados (2026-10-09)

- Se corrigió el tipado de la prueba e2e de la API, eliminando la importación no válida de `supertest/types`.
- Se actualizaron las pruebas unitarias de `ClasesController` y `ClasesService` para registrar sus dependencias mediante mocks.
- Se ejecutó Biome sobre los archivos modificados mediante los hooks de Git.

### Cambios realizados (2026-10-27)

- Se incorporó la validación de postulaciones, el consentimiento y los datos del apoderado para menores, junto con controles de cupos y solicitudes duplicadas.
- Se unificó la navegación inferior y se ajustaron los formularios y tarjetas para pantallas móviles.
- Se organizó la consulta de clases vigentes, próximas y finalizadas, con accesos a postulaciones y convocatoria de cada clase.
- Se permitió compartir convocatorias y recibir postulaciones antes de la fecha de inicio de las clases.
- Se cambió el QR a negro sobre fondo blanco y se corrigió la copia del enlace al acceder mediante una dirección de red local con HTTP.

### Cambios realizados (2026-10-29)

- Se añadieron mensajes de estado dentro de la app y protección contra envíos repetidos durante las operaciones.
- Se incorporaron búsqueda y filtros de postulaciones, indicadores de últimos cupos y número de solicitud al completar el formulario.
- Se agregaron los temas claro, oscuro y automático, junto con la guía rápida y la información del sistema.
- Se centralizaron la cuenta, los ajustes y el cierre de sesión en la sección Usuario de la barra inferior. La creación de clases quedó dentro de Clases.
- Se adoptó el nombre provisional Mi Dojo y se configuró el login como entrada a la aplicación.
- Se reemplazó la confirmación del navegador al eliminar clases por una confirmación dentro de la app.

### Cambios realizados (2026-11-12)

- Se incorporó la eliminación de profesores desde la app y la API, con confirmación y conservación de los nombres en clases y solicitudes existentes.
- Se corrigió la interacción táctil de los botones Editar y Eliminar del menú de clases.
- Se ajustaron los selectores de profesor y duración para mostrar su indicación inicial sin ofrecerla como opción seleccionable.
- Se corrigió la descarga del QR como archivo PNG y se añadió una alternativa para abrir y guardar la imagen desde el celular.
- Se ajustó el campo de nacimiento del formulario público y se pasaron las fechas del aviso y resumen al formato español.
- Se agregó la detección de horarios superpuestos del mismo profesor al crear y editar clases, considerando fechas, días y horas entre sedes.

Las fechas del registro corresponden a la zona horaria de Perú (`America/Lima`).

## Pendiente de mejorar

### Frontend

- Incorporar un script propio de typecheck y una suite de pruebas de navegador versionada, para que las verificaciones móviles puedan repetirse mediante un comando del proyecto.
- Evaluar el uso directo de `@dojo/shared` en el frontend; actualmente sus contratos se utilizan desde la API.

### Backend

- Migrar la relación de profesor en las clases a un identificador estable, en lugar de depender del nombre.
- Optimizar las lecturas completas de Google Sheets y ampliar el almacenamiento del seguimiento si crece el volumen de datos. La implementación actual detiene la escritura antes de superar 45 000 caracteres por historial, sin truncarlo.
- Si se utilizan varias réplicas de la API, reemplazar las colas y límites en memoria por coordinación compartida. Las protecciones actuales se aplican dentro de una instancia y no coordinan ediciones manuales simultáneas en Sheets.

### Entrega y publicación

- Realizar un ensayo de restauración de respaldos en una copia de la hoja del cliente y asignar un responsable a los respaldos manuales.
- Completar las pruebas de aceptación y acordar las condiciones de soporte y la conformidad de entrega con el cliente.
- Completar la carga de los datos oficiales del dojo y confirmar la configuración de los servicios de alojamiento. La identidad del portal ya está definida como Shinken Dojo - Hiroshi.
- Verificar HTTPS, cookies de sesión, CORS y conexión entre frontend y backend con las direcciones definitivas antes de usar datos reales en producción.
- Acordar con el cliente el responsable, el contacto y los plazos de conservación del aviso de datos personales.

## Automatizaciones en GitHub

El repositorio contiene las siguientes configuraciones. Su ejecución depende de las ramas, permisos y servicios habilitados en GitHub.

| Archivo | Qué hace |
|---|---|
| `.github/workflows/ci.yml` | En cada PR y en pushes a `main`/`develop`: configura Biome, typecheck, pruebas, build y pruebas HTTP de la API |
| `.github/workflows/pr-title.yml` | Valida el título del PR (Conventional Commits) y las ramas de Gitflow |
| `.github/dependabot.yml` | Propone actualizaciones de GitHub Actions hacia `develop` |
| `renovate.json` | Configura actualizaciones de dependencias de npm hacia `develop`; requiere habilitar la app Renovate |

El workflow de CI no se dispara por un push aislado a `construccion` ni a `feature/postulaciones-movil`; se ejecuta al abrir o actualizar un PR. El bloque `env` del paso de pruebas e2e requiere corregir la indentación de sus variables. Antes de utilizar el CI como requisito de entrega se debe corregir esa configuración y verificar su ejecución en Actions.

### Flujo de ramas vigente

Los cambios nuevos se desarrollan en **`construccion`**. Su integración posterior en **`feature/postulaciones-movil`** se realiza cuando la versión se considera lista y se autoriza el traslado. La existencia de `main`, `develop` u otras ramas no implica que deban actualizarse automáticamente.

La [guía de Gitflow](docs/01-gitflow.md) y la validación de ramas del workflow de títulos se conservan como referencias técnicas. Los PR deben revisarse frente a las reglas que realmente estén configuradas; no se presupone que esas reglas acepten el flujo actual ni se modifican las ramas o la configuración de GitHub desde esta documentación.

Las protecciones de ramas, los requisitos de revisión, los permisos y los servicios de actualización de dependencias se verifican en la configuración del repositorio antes de utilizarlos como controles de entrega.
