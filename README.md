# Shinken Dojo - Hiroshi

**Versión actual: 0.2.0 — en desarrollo.**

Portal web para centralizar la inscripción y el seguimiento de los alumnos de Shinken Dojo - Hiroshi. Integra horarios, planes continuos, asistencia, recuperaciones y congelamientos, con acceso diferenciado para administrador, profesor y alumno.

La interfaz se adapta a celulares y computadoras y utiliza la identidad visual del dojo. La solución se organiza como un monorepo con frontend, API y contratos compartidos, administrados mediante pnpm workspaces y Turborepo.

| Carpeta | Tecnología | Qué es |
|---|---|---|
| `apps/web` | Astro 7 + React 19 + Tailwind CSS 4 | Portal de administración, profesores y alumnos, y formulario público |
| `apps/api` | Node.js 24 + NestJS 12 + Google Sheets (`googleapis`) | API REST, autenticación, reglas de negocio y persistencia |
| `packages/shared` | TypeScript | Tipos, estados y reglas compartidos entre web y API |

Los datos se guardan en una hoja de cálculo de Google. La estructura del almacenamiento se detalla en [Datos en Google Sheets](docs/03-google-sheets.md).

## Funcionalidades principales

- **Acceso por perfiles:** permisos para administrador, profesor y alumno. Cada profesor accede a sus grupos y cada alumno consulta sus propias inscripciones.
- **Clases oficiales:** consulta de Mini Samuráis, Jóvenes Guerreros y Avanzados, con turnos por días y edades, horarios y cupos independientes.
- **Inscripción y postulaciones:** formulario público mediante enlace o QR y revisión de solicitudes. La aceptación crea alumno e inscripción y reserva el cupo; las solicitudes pendientes no ocupan vacante.
- **Profesores y alumnos:** registro manual junto con su cuenta de acceso, búsqueda por nombre, administración de accesos y restablecimiento de contraseñas. El primer plan del alumno puede activarse en el mismo formulario.
- **Planes continuos de 4, 8 o 12 clases:** activación y renovación con conservación del saldo anterior. El cambio de plan se programa para cuando se terminen las clases pendientes. Se consumen primero las clases del paquete más antiguo, sin vencimiento mensual.
- **Calendario de asistencia:** marcación propia del profesor y registro de los alumnos por fecha. Administración puede asignar reemplazos, corregir registros y cancelar una sesión sin consumir saldo ni recuperaciones.
- **Recuperaciones manuales:** autorización por inasistencias justificadas, sin añadir clases al plan. Se contempla una recuperación por paquete de 4 clases y dos por paquete de 8 o 12, con ajuste del límite y registro del motivo.
- **Congelamiento del plan:** solicitud del alumno y autorización del profesor o administrador, con fecha de regreso o reactivación manual, conservando el cupo y las clases pendientes.
- **Portal del alumno:** consulta de plan, saldo, horarios e historial; aviso o retiro de ausencias desde Calendario y seguimiento de solicitudes de congelamiento.
- **Historial de seguimiento:** registro de activaciones, renovaciones, asistencia, recuperaciones, congelamientos y autorizaciones.

## Organización del portal

La administración de personas se concentra en **Usuario → Profesores y alumnos**, con apartados individuales para profesores y alumnos. El nombre es obligatorio; teléfono y correo son opcionales. El registro manual del alumno incluye su clase y turno, y permite crear el acceso y activar el primer plan en una sola operación.

Cuando el ingreso se realiza por postulación, administración acepta la solicitud y después puede crear el acceso y activar el plan sin duplicar la inscripción ni ocupar otro cupo.

**Clases** permite consultar los grupos oficiales y editar los datos de sus turnos. **Calendario** concentra la asistencia de profesores y alumnos. **Alumnos** reúne los planes, renovaciones, recuperaciones y congelamientos. La guía de uso y la versión se consultan en **Usuario → Ayuda e información**.

| Perfil | Funciones disponibles |
|---|---|
| Administrador | Administración de cuentas, turnos, postulaciones, inscripciones, planes, renovaciones, asistencia, recuperaciones y congelamientos |
| Profesor | Consulta de sus grupos y alumnos, marcación de asistencia, autorización de recuperaciones y gestión de congelamientos |
| Alumno | Consulta de plan e historial, aviso o retiro de ausencias actuales o futuras y solicitud de congelamiento |

Google Sheets se utiliza como almacenamiento; la gestión cotidiana se realiza desde la aplicación. Las clases oficiales no se crean ni se eliminan desde el portal. Los cobros se coordinan fuera de la app: no se registran importes, medios de pago ni comprobantes.

## Guías del proyecto

1. [Referencia de Gitflow](docs/01-gitflow.md): convenciones generales de ramas. El flujo vigente del proyecto utiliza `construccion`, según lo indicado más adelante.
2. [Commits convencionales](docs/02-commits-convencionales.md): cómo escribir los mensajes de commit.
3. [Datos en Google Sheets](docs/03-google-sheets.md): pestañas, columnas, credenciales y validación de postulaciones.
4. [Calidad de código](docs/04-calidad-de-codigo.md): Biome, Husky, pruebas con Vitest y CI.
5. [Mapa de pantallas](docs/05-mapa-de-pantallas.md): rutas y archivos de cada sección.
6. [Alumnos, planes y asistencia](docs/06-alumnos-asistencia.md): activaciones, renovaciones, recuperaciones y congelamientos.
7. [Cuentas y perfiles](docs/07-cuentas-y-perfiles.md): altas manuales, autenticación y permisos.
8. [Clases oficiales](docs/08-clases-oficiales.md): preparación de los grupos y horarios en Sheets.
9. [Colaboración con API simulada](docs/09-colaboracion-simulada.md): preparación de Live Share sin credenciales ni conexión con Sheets.

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

La llave JSON de la cuenta de servicio se guarda en `apps/api/credentials/google-service-account.json`, o se proporciona mediante `GOOGLE_CREDENTIALS_JSON`. La estructura de personas, inscripciones y movimientos se describe en la [guía de Google Sheets](docs/03-google-sheets.md). La hoja debe contener las tres clases oficiales y sus cinco turnos. La sede y el profesor se completan desde **Editar turno**; un turno sin configurar no admite inscripciones.

Las pestañas y encabezados de la hoja deben coincidir con la estructura documentada. Las fechas se muestran como **dd-mm-aaaa**, con zona horaria **America/Lima**; la API conserva las horas de registro internamente.

Los dos archivos `.env` se configuran antes del arranque. La API valida las variables obligatorias y detiene el inicio cuando faltan valores o no se cumplen los requisitos.

| Archivo | Variable | Qué configurar |
|---|---|---|
| `apps/api/.env` | `NODE_ENV` | `development` para el entorno local |
| `apps/api/.env` | `PORT` | Puerto de la API; por defecto, `3000` |
| `apps/api/.env` | `WEB_URL` | Dirección exacta de la web, por ejemplo `http://localhost:4321` |
| `apps/api/.env` | `JWT_SECRET` | Secreto aleatorio de al menos 32 caracteres; sustituir el ejemplo |
| `apps/api/.env` | `JWT_EXPIRES_IN_SECONDS` | Duración de la sesión; por defecto, `28800` segundos (8 horas) |
| `apps/api/.env` | `ADMIN_USUARIO` | Usuario del administrador, de al menos 3 caracteres |
| `apps/api/.env` | `ADMIN_PASSWORD` | Contraseña del administrador, de al menos 8 caracteres; sustituir el ejemplo |
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
| `pnpm preparar:colaboracion` | Genera una copia independiente del frontend para Live Share, sin backend ni credenciales |
| `pnpm dev:simulado` / `pnpm stop:simulado` | Inicia o detiene el frontend con API ficticia en el puerto 4322 |
| `pnpm test:simulado` | Verifica la simulación y la exportación de la copia de colaboración |
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

## Estructura

```text
apps/
  api/src/
    main.ts                  arranque: validación global, cookies y CORS
    config/env.ts            carga y validación de variables de entorno
    auth/                    cuentas, perfiles, contraseñas, JWT y sesiones
    alumnos/                 planes, renovaciones, asistencia, recuperaciones y congelamientos
    clases/                  clases, postulaciones, cupos y validación de horarios
    profesores/              datos de profesores, contacto y estado del registro
    google/                  cliente de Google Sheets
    portal/                  lectura y escritura de personas, inscripciones, movimientos y fechas
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
  enums/                     estados de postulación y reglas de cupos
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
| `POST` | `/cuentas` | Administrador | Alta manual de profesor o alumno junto con su cuenta y plan inicial opcional |
| `POST` | `/cuentas/inscripciones/:id` | Administrador | Crea acceso y plan inicial opcional para un alumno inscrito, sin duplicar persona ni cupo |
| `GET` | `/planes` | Los tres perfiles | Catálogo activo de paquetes, precios y recuperaciones |
| `POST` | `/cuentas/:id` | Administrador | Activación/desactivación del acceso o restablecimiento de contraseña |
| `GET` | `/alumnos` | Según perfil | Seguimiento de todos los alumnos para administración, grupos propios para profesor o inscripciones propias para alumno |
| `POST` | `/alumnos/:id` | Según acción y asignación | Planes, renovaciones, asistencia, recuperaciones, solicitudes y congelamientos |
| `GET` | `/sesiones?fecha=AAAA-MM-DD` | Administrador o profesor asignado | Sesiones, asistencia del profesor y alumnos del grupo |
| `POST` | `/sesiones/:id/:fecha` | Administrador o profesor asignado | Marcación propia del profesor; administración corrige, asigna reemplazos o cancela |
| `GET` | `/clases/catalogo` | Público | Clases agrupadas con sus turnos |
| `GET` | `/clases` | Administrador | Consulta de clases oficiales y cupos disponibles |
| `GET` | `/clases/:id` | Público | Consulta de la clase del formulario o QR |
| `POST` | `/clases/:id` | Administrador | Edición de un turno y validación de cruces de horario |
| `GET` | `/clases/postulaciones` | Administrador | Consulta de solicitudes |
| `POST` | `/clases/postulaciones` | Público | Registro de una postulación pendiente con validaciones y consentimiento |
| `POST` | `/clases/postulaciones/estado` | Administrador | Cambio de estado y actualización de cupos |
| `DELETE` | `/clases/postulaciones/:id` | Administrador | Eliminación de una solicitud y recálculo de cupos |
| `GET` | `/profesores` | Administrador | Consulta de registros de profesor y contacto opcional |
| `POST` | `/profesores/estado` | Administrador | Activación o desactivación del profesor |
| `DELETE` | `/profesores/:id` | Administrador | Eliminación del registro de profesor |

Las acciones y reglas de `/alumnos/:id` se detallan en la [guía de seguimiento](docs/06-alumnos-asistencia.md). Administración activa y renueva los planes; el profesor gestiona asistencia y autorizaciones de sus alumnos; el alumno solo avisa o retira ausencias permitidas y solicita congelamiento.

Al eliminar un profesor, las clases y solicitudes existentes conservan el nombre guardado. Las postulaciones mantienen los datos de la clase elegida al momento de su envío.

## Automatizaciones en GitHub

El repositorio contiene las siguientes configuraciones. Su ejecución depende de las ramas, permisos y servicios habilitados en GitHub.

| Archivo | Qué hace |
|---|---|
| `.github/workflows/ci.yml` | En cada PR y en pushes a `main`/`develop`: configura Biome, typecheck, pruebas, build y pruebas HTTP de la API |
| `.github/workflows/pr-title.yml` | Valida el título del PR (Conventional Commits) y las ramas de Gitflow |
| `.github/dependabot.yml` | Propone actualizaciones de GitHub Actions hacia `develop` |
| `renovate.json` | Configura actualizaciones de dependencias de npm hacia `develop`; requiere habilitar la app Renovate |

### Flujo de ramas vigente

Los cambios nuevos se desarrollan en **`construccion`**. Su integración posterior en **`feature/postulaciones-movil`** se realiza cuando la versión se considera lista y se autoriza el traslado. La existencia de `main`, `develop` u otras ramas no implica que deban actualizarse automáticamente.
