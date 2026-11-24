# Shinken Dojo - Hiroshi

Portal para administración, profesores y alumnos: clases, postulaciones, planes continuos y asistencia. Utiliza Astro y React en la web, NestJS en la API y Google Sheets como almacenamiento.

## Requisitos e instalación

Node.js 24 y pnpm 12.6.0. Desde la raíz del proyecto:

```sh
pnpm install --frozen-lockfile
```

Copia `apps/api/.env.example` a `apps/api/.env` y `apps/web/.env.example` a `apps/web/.env`. En PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Configura el ID de la hoja, las credenciales de Google, `JWT_SECRET`, `ADMIN_USUARIO` y `ADMIN_PASSWORD` en la API. Comparte la hoja como Editor con la cuenta de servicio. Usa la estructura vigente del dojo, con tres clases y cinco turnos; sus encabezados y relaciones se describen en la documentación de almacenamiento entregada por separado.

Guarda la credencial en `apps/api/credentials/google-service-account.json` o configura `GOOGLE_CREDENTIALS_JSON`. Mantén las credenciales y los archivos `.env` fuera de Git.

Para desarrollo local, `PUBLIC_API_URL` puede ser `http://localhost:3000` y `WEB_URL` debe coincidir con la dirección de la web, normalmente `http://localhost:4321`. Los detalles y requisitos de cada variable están en los `.env.example`.

## Comandos

| Comando | Función |
| --- | --- |
| `pnpm dev` | Iniciar web y API |
| `pnpm stop:web` | Detener el servidor web en segundo plano |
| `pnpm build` | Compilar el proyecto |
| `pnpm typecheck` | Comprobar tipos |
| `pnpm test` | Ejecutar pruebas unitarias |
| `pnpm --filter api test:e2e` | Ejecutar pruebas de integración con repositorios simulados |
| `pnpm test:simulado` | Comprobar simulación, navegación y exportación |
| `pnpm ci:check` | Comprobar formato y lint |
| `pnpm dev:simulado` | Iniciar la web con datos ficticios, sin Sheets |
| `pnpm stop:simulado` | Detener el entorno simulado |
| `pnpm preparar:colaboracion` | Crear una copia de colaboración sin credenciales |

La simulación incluye profesor y alumno; las cuentas `profesor.prueba` y `alumno.prueba` utilizan su propio usuario como contraseña. El administrador de la app real utiliza las credenciales configuradas en la API.

## Estructura y desarrollo

- `apps/web`: interfaz y simulación.
- `apps/api`: permisos, reglas de negocio y persistencia en Sheets.
- `packages/shared`: contratos y reglas compartidas.
- `scripts`: herramientas de desarrollo y colaboración.

Se trabaja en `construccion`. Los commits siguen el formato `tipo(scope): descripción`, por ejemplo `fix(web): conservar el turno al regresar`.

Las guías completas de instalación, almacenamiento, funcionamiento y colaboración se mantienen por separado del repositorio. Los archivos `AGENTS.md` y `CLAUDE.md` contienen instrucciones para las herramientas de desarrollo.
