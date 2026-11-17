# 4. Calidad de código

Las comprobaciones se ejecutan desde la raíz del repositorio. pnpm y Turborepo administran las tareas de los paquetes; las versiones de Node.js y pnpm se indican en el [README](../README.md).

## Formato y análisis estático

Biome utiliza la configuración de `biome.json`: dos espacios, comillas simples en JavaScript y ancho de línea de 100 caracteres.

| Comando | Función |
| --- | --- |
| `pnpm lint` | Revisa el código sin modificarlo |
| `pnpm format` | Aplica formato |
| `pnpm check` | Aplica formato y correcciones automáticas disponibles |
| `pnpm ci:check` | Comprueba formato y lint sin escribir cambios |
| `pnpm typecheck` | Revisa los tipos de la API y `@dojo/shared` |

Los archivos `.astro` están excluidos de Biome y se editan con la extensión de Astro. Los componentes React sí se revisan con Biome. La web no tiene un script propio de typecheck: su compilación se comprueba mediante `pnpm build`. Las preferencias de formato del editor están en `.vscode/settings.json`.

## Hooks de Git

La instalación ejecuta `prepare` para activar Husky en el repositorio original.

| Hook | Comprobación |
| --- | --- |
| `pre-commit` | lint-staged ejecuta Biome sobre los archivos preparados que coinciden con su configuración |
| `commit-msg` | commitlint valida el mensaje |
| `pre-push` | Turborepo ejecuta typecheck y pruebas unitarias de los paquetes |

Las pruebas HTTP, la simulación y la compilación no forman parte del hook pre-push. Se ejecutan cuando corresponden al cambio. No omitir los hooks para evitar un fallo: revisar su causa y corregirla.

## Pruebas disponibles

| Área | Archivos | Comando |
| --- | --- | --- |
| API: reglas, servicios y repositorios | `apps/api/src/**/*.spec.ts` | `pnpm --filter api test` |
| Contratos y reglas compartidas | `packages/shared/src/**/*.test.ts` | `pnpm --filter @dojo/shared test` |
| API: flujos HTTP y permisos | `apps/api/test/**/*.e2e-spec.ts` | `pnpm --filter api test:e2e` |
| API ficticia y exportación de la copia | `apps/web/simulacion/*.test.mjs`, `scripts/*.test.mjs` | `pnpm test:simulado` |
| Compilación de los paquetes | Web, API y shared | `pnpm build` |

`pnpm test` ejecuta las pruebas unitarias de API y shared. `pnpm --filter api test:watch` permite repetir las unitarias durante el desarrollo.

Las unitarias y las pruebas HTTP utilizan repositorios o clientes de Google simulados y variables de prueba, sin escribir en la hoja real. Las configuraciones de Vitest comparten sus ajustes a través de `apps/api/vitest.config.ts`; la configuración e2e cambia el patrón de archivos.

La simulación utiliza el ejecutor de pruebas de Node.js y verifica permisos, versiones, saldos, congelamientos, recuperaciones y exclusión de archivos sensibles en la exportación. En la copia de colaboración, `pnpm test:simulado` ejecuta únicamente las pruebas de su API ficticia, porque el exportador no se incluye allí.

La revisión de navegación y diseño en navegador se realiza adicionalmente; todavía no hay una suite de navegador versionada del frontend. Para cambios visuales, comprobar los perfiles afectados, estados vacíos, carga, errores y tamaños de celular y escritorio.

## Comprobación antes de integrar

```powershell
pnpm ci:check
pnpm typecheck
pnpm test
pnpm test:simulado
pnpm --filter api test:e2e
pnpm build
```

Seleccionar las comprobaciones según el alcance: una edición de documentación necesita revisión de enlaces y coherencia; un cambio de reglas o permisos necesita las pruebas correspondientes. No probar operaciones de escritura contra los datos reales para verificar el código.

## GitHub Actions

`ci.yml` ejecuta lint, tipos, unitarias, pruebas de simulación, compilación y pruebas HTTP. Se activa en PR y pushes a `main` y `develop`. Los requisitos para unir un PR dependen de las protecciones configuradas en GitHub. El trabajo habitual continúa en `construccion`, según la [guía de Git](01-gitflow.md).
