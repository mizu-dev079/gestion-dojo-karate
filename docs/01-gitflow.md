# 1. Flujo de trabajo con Git

El desarrollo se realiza en la rama existente **`construccion`**. Cuando una versión esté lista, se coordina su integración en **`feature/postulaciones-movil`**. No se crean ramas nuevas para los cambios habituales ni se actualizan automáticamente otras ramas.

## Actualizar el proyecto

Antes de comenzar, revisar y conservar cualquier cambio local:

```powershell
git status
git fetch origin
git switch construccion
git pull --ff-only origin construccion
pnpm install --frozen-lockfile
```

Si existen cambios que impiden actualizar, guardarlos mediante un commit o `git stash` antes de continuar. Un error de avance rápido requiere revisar el historial; no se resuelve con un push forzado.

## Guardar y subir cambios

Desde `construccion`, revisar los archivos y preparar únicamente los correspondientes al cambio:

```powershell
git diff
git add <archivos>
pnpm commit
```

Los mensajes siguen [Conventional Commits](02-commits-convencionales.md). Antes de subir, ejecutar las comprobaciones relevantes descritas en [Calidad de código](04-calidad-de-codigo.md).

```powershell
git push origin construccion
```

La integración en `feature/postulaciones-movil` se realiza por separado, cuando se acuerde el pase. La existencia de `main`, `develop` o ramas de bots no cambia el flujo de trabajo actual.

## Colaboración en interfaces

Los compañeros trabajan en una copia independiente del frontend mediante [Live Share y la API simulada](09-colaboracion-simulada.md). Esa copia no tiene Git ni credenciales. Al terminar, el anfitrión revisa e incorpora los archivos al repositorio original, en `construccion`, y comprueba la integración antes de subirlos o borrar la copia.

## Automatizaciones existentes

El CI se ejecuta en los PR y en los pushes a `main` y `develop`; un push aislado a `construccion` no lo activa. Los hooks locales sí se ejecutan al guardar y subir commits.

El workflow `pr-title.yml` conserva una validación antigua de ramas que no admite como destino `construccion` ni `feature/postulaciones-movil`. No se deben crear ramas adicionales para sortear esa regla; el mecanismo de integración se coordina según la configuración existente. Esta documentación no modifica workflows ni protecciones de GitHub.

## Versiones

La versión actual es **0.2.0** y está alineada en `apps/web/package.json`, `apps/api/package.json` y `packages/shared/package.json`. El README y la información del sistema reflejan ese número. El repositorio no publica versiones automáticamente a partir de los commits.
