# AGENTS.md — Reglas del proyecto Shinken Dojo

Estas instrucciones se aplican a todos los agentes que trabajen en este proyecto.

---

## Comunicación

- Responder siempre en español.
- Escribir comentarios y documentación del código en español.
- Mantener los nombres existentes de variables, funciones, clases y archivos.
- Explicar los errores, sus causas y las soluciones propuestas.
- Priorizar el aprendizaje del usuario durante el desarrollo.

## Autorización

- Antes de modificar archivos, analizar el código y presentar un plan.
- Esperar la aprobación explícita del usuario antes de implementar cambios.
- No eliminar, renombrar ni reestructurar funcionalidades existentes sin autorización.
- No realizar modificaciones fuera del alcance solicitado.

## Arquitectura

- Respetar la estructura real del monorepositorio.
- Inspeccionar las responsabilidades de `apps/web`, `apps/api` y `packages/shared` antes de realizar cambios.
- Reutilizar componentes, servicios, tipos y utilidades existentes.
- Evitar duplicación de código y dependencias innecesarias.
- No cambiar el esquema de la base de datos sin autorización.

## Identidad visual

- Mantener los colores rojo, negro, blanco y tonos neutros de Shinken Dojo.
- Conservar la estética moderna, limpia y profesional.
- Priorizar diseños responsive y mobile-first.
- Evitar elementos decorativos que consuman espacio innecesariamente.
- Mantener consistencia visual con los componentes existentes.

## Seguridad y datos

- Respetar las relaciones reales entre profesores, alumnos, clases, grupos, horarios, sedes y asistencia.
- No inventar entidades ni información inexistente.
- Preservar la integridad e historial de los datos.
- Respetar los permisos y las restricciones de cada rol.
- Verificar las autorizaciones también en el backend, no solamente en la interfaz.

## Calidad

- Identificar la causa raíz de los errores.
- Priorizar soluciones mantenibles.
- No introducir regresiones en funcionalidades existentes.
- Verificar los cambios mediante las pruebas disponibles.
- Comunicar qué archivos fueron modificados y qué pruebas se realizaron.
- No afirmar que algo funciona si no ha sido comprobado.

## Alcance

Estas reglas se aplican al proyecto completo, incluyendo frontend, backend y paquetes compartidos.
