# Guía de contribución

El desarrollo se realiza en **`construccion`**, sin crear ramas nuevas. El pase a la rama existente `feature/postulaciones-movil` se coordina cuando la versión esté lista. No se actualizan automáticamente `main`, `develop` ni otras ramas.

## Preparar el trabajo

```powershell
git status
git fetch origin
git switch construccion
git pull --ff-only origin construccion
pnpm install --frozen-lockfile
```

Conservar los cambios locales antes de actualizar. La instalación, las variables de entorno y el inicio de la app real se describen en el [README](README.md).

Para colaborar en las interfaces de profesor y alumno sin credenciales, utilizar la [copia de colaboración con API simulada](docs/09-colaboracion-simulada.md). El anfitrión revisa e incorpora los cambios de esa copia al repositorio original.

## Commits y revisión

```text
<tipo>(<scope>): <descripción>
```

Ejemplos:

```text
feat(web): mejorar la consulta del plan del alumno
fix(api): conservar el saldo al renovar
docs(sheets): actualizar la estructura de la hoja
```

Los scopes permitidos son `web`, `api`, `shared`, `sheets`, `ci`, `deps`, `config`, `docs` y `release`. Se puede utilizar `pnpm commit` como asistente. Ver [Commits convencionales](docs/02-commits-convencionales.md).

Preparar únicamente los archivos del cambio. Antes de subir a `construccion`, revisar el diff y ejecutar las comprobaciones relevantes de [Calidad de código](docs/04-calidad-de-codigo.md). No forzar pushes ni saltar los hooks para ocultar errores.

Si se utiliza un PR, describir el resultado, el motivo y las validaciones. El workflow de ramas conserva reglas antiguas de Gitflow; no se deben crear ramas nuevas para satisfacerlo. El flujo vigente se detalla en [Trabajo con Git](docs/01-gitflow.md).

## Documentación y datos

- Mantener las guías alineadas con las rutas, permisos, comandos y columnas actuales.
- Documentar cambios en Sheets en [Datos en Google Sheets](docs/03-google-sheets.md) y cambios de configuración en los `.env.example` correspondientes.
- Utilizar datos simulados para las pruebas automatizadas y el desarrollo compartido de interfaces.
- Mantener `.env`, credenciales JSON, contraseñas y datos personales fuera de Git y de las carpetas compartidas.
- Actualizar web, API y shared de forma coordinada cuando cambie un contrato.

Los hooks revisan formato/lint de archivos preparados, mensajes convencionales, tipos y unitarias. La compilación, las pruebas HTTP y la simulación se ejecutan por separado según el cambio.
