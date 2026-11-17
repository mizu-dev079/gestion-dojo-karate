# 2. Commits convencionales

Los mensajes utilizan [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) para identificar el alcance del cambio.

```text
<tipo>(<scope>): <descripción>
```

La descripción debe ser concreta, preferentemente en imperativo y sin punto final. El encabezado admite hasta 100 caracteres. El cuerpo es opcional y permite explicar decisiones o validaciones relevantes.

## Tipos y ejemplos

| Tipo | Uso | Ejemplo |
| --- | --- | --- |
| `feat` | Funcionalidad nueva | `feat(web): mostrar el cambio de plan programado` |
| `fix` | Corrección | `fix(sheets): mostrar fechas con la zona horaria de Lima` |
| `docs` | Documentación | `docs(sheets): actualizar las columnas de la hoja vigente` |
| `refactor` | Reorganización del código | `refactor(api): unificar contratos compartidos` |
| `test` | Pruebas | `test(web): verificar la API simulada` |
| `build` | Compilación y dependencias | `build(deps): actualizar astro` |
| `ci` | Automatizaciones | `ci(config): ejecutar las pruebas de simulación` |
| `style` | Formato sin cambiar comportamiento | `style(web): ordenar imports` |
| `perf` | Rendimiento | `perf(api): agrupar lecturas concurrentes de Sheets` |
| `chore` | Mantenimiento | `chore(config): actualizar herramientas de desarrollo` |
| `revert` | Reversión | `revert(web): revertir el ajuste de navegación` |

## Scopes y validación

Los scopes permitidos por `commitlint.config.js` son `web`, `api`, `shared`, `sheets`, `ci`, `deps`, `config`, `docs` y `release`. Un scope diferente se rechaza; omitirlo genera una advertencia. Se recomienda incluirlo.

El hook `commit-msg` ejecuta commitlint. El workflow de títulos de PR comprueba el título convencional cuando se utiliza ese mecanismo de revisión. Las reglas de ramas se describen en [Flujo de trabajo](01-gitflow.md).

## Cambios incompatibles

Los cambios que requieren adaptar consumidores se marcan con `!` y se explican en el cuerpo:

```text
feat(api)!: cambiar el contrato de consulta de alumnos

BREAKING CHANGE: explicar el contrato anterior, el nuevo y la adaptación necesaria.
```

Esta marca documenta la incompatibilidad; no cambia versiones ni publica entregas automáticamente.

## Asistente

```powershell
git add <archivos>
pnpm commit
```

El asistente solicita tipo, scope, descripción y detalles opcionales. También puede utilizarse `git commit -m "tipo(scope): descripción"`. No incluir contraseñas, JSON de cuentas de servicio ni datos personales en mensajes de commit.
