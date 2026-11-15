# Alumnos, planes y asistencia: primera etapa

Disponible en **Alumnos**, con la cuenta de administración actual. Los profesores se administran desde **Usuario → Profesores**. La vista de Alumnos permite buscar por nombre, profesor, clase, fecha y estado (programados, ausencias avisadas, presentes, congelados y sin plan).

## Flujo preparado

1. Aceptar o aprobar una postulación. El alumno aparece sin crear duplicados ni reservar otro cupo.
2. Registrar su plan: cantidad de clases incluidas en el pago, importe efectivamente recibido, fecha, referencia opcional y días de su clase. Los importes y cantidades se ingresan manualmente: no se presume una mensualidad ni se calcula un próximo cobro.
3. Registrar asistencia. Presente consume una clase pagada. Avisó que faltará y Faltó se registran como pendientes de revisión, sin descontar clases ni aprobar recuperaciones. Se permite avisar ausencias futuras; no marcar presencia o falta futura.
4. Renovar registra otro pago con el mismo formato. Conserva íntegramente el saldo anterior y consume primero las clases del pago más antiguo que ya estuviera vigente en la fecha de asistencia. Corregir una asistencia recalcula los créditos en orden cronológico, sin duplicar descuentos.
5. Congelar exige un motivo y puede indicar una fecha de regreso. Desde esa fecha vuelve a estar activo, sin tarea programada ni vencimiento de créditos. Sin fecha, permanece congelado hasta Reactivar. Durante un congelamiento no se renueva ni se registra asistencia de ese período. Un registro de hoy debe resolverse antes de congelar hoy.

El historial conserva pagos, asistencias y congelamientos. Un plan sin clases pendientes permanece visible: no se inventa una cancelación automática. Para una cancelación del alumno se conserva el flujo existente de estado de la postulación; la gestión específica de cancelaciones y liquidación de saldos queda para la siguiente etapa.

## Cupos y permisos

El cupo sigue dependiendo exclusivamente de la postulación aceptada/aprobada. Congelar no cambia ese estado ni libera cupos. Este módulo no cambia la lógica de cupos de clases.

Las rutas nuevas exigen la sesión de administrador mediante el guard global existente. La vista filtrada por profesor aún **no es una cuenta de profesor**. El acceso individual por profesor y sus permisos sobre alumnos asignados requieren la siguiente etapa de autenticación y roles; no se habilita ninguna ruta pública ni se simula una autorización de profesor.

## Persistencia

La API consulta una pestaña nueva `SeguimientoAlumnos` de la misma hoja de Google. La lectura no crea ni modifica pestañas. En la primera operación válida de escritura crea únicamente esa pestaña, si hace falta, con encabezados `postulacionId` y `seguimientoJson`. El segundo campo almacena el estado completo del alumno vinculado a la postulación, usando `RAW`, sin interpretar fórmulas. No cambia la estructura de las pestañas actuales.

Se valida el encabezado y se rechazan JSON inválidos e identificadores duplicados, sin sobrescribirlos. Se pueden reintentar creaciones interrumpidas antes de escribir el encabezado. Las mutaciones se serializan dentro de una sola instancia de la API y exigen `version`: dos peticiones con la misma versión solo pueden registrar un cambio. Tras un conflicto o respuesta de escritura incierta, se debe actualizar la lista antes de reintentar.

Esta primera implementación requiere **una sola instancia de la API**. No proporciona bloqueo distribuido frente a otras instancias ni ediciones simultáneas manuales de la hoja. Al acercarse al límite de una celda de Sheets se detienen nuevas escrituras antes de perder el historial (45 000 caracteres); para historiales extensos se necesita migrar a eventos en filas separadas o una base de datos. No editar manualmente el JSON.

## Contrato HTTP

- `GET /alumnos`: postulaciones aceptadas/aprobadas y resumen de seguimiento.
- `POST /alumnos/:postulacionId`: comando validado con `version` y una de estas acciones:
  - `iniciar`: `cantidad`, `dias`, `importe`, `fecha`, `referencia` opcional.
  - `renovar`: `fecha`, `referencia` opcional. Repite el plan, sin eliminar saldos.
  - `asistencia`: `fecha`, `estado` (`presente`, `falta` o `avisada`). Una fecha admite un único registro editable.
  - `congelar`: `motivo`, `hasta` (fecha de regreso o `null`). Comienza hoy, según America/Lima.
  - `reactivar`: finaliza manualmente el congelamiento desde hoy.

No hay pasarela de pagos ni cargos automáticos. No se registra una recuperación como aprobada y no se descuentan las faltas mientras las reglas estén pendientes.

## Pendiente de confirmar con el cliente

- Si cada pago cubre una cantidad de clases o un período desde la inscripción.
- Si el máximo de dos recuperaciones se renueva por pago o por mes.
- Cuándo se requiere aviso previo y quién puede autorizar una excepción.

Tras confirmar estas reglas se implementarán vencimientos/plazos de cobro si corresponden, autorización y consumo de recuperaciones (máximo dos por el ciclo acordado), y el acceso independiente de profesores. La configuración actual no debe usarse como aprobación automática de faltas ilimitadas: estas quedan expresamente pendientes de revisión.

## Validación

Pruebas de reglas de saldo, FIFO y corrección retroactiva; congelamiento manual y con fecha; validación de datos; versionado y concurrencia de una instancia; persistencia Sheets simulada y protección de datos inválidos. Pruebas HTTP verifican sesión requerida, alumnos aceptados y operaciones de plan/renovación. La integración real con Google requiere credenciales y no se prueba escribiendo datos de demostración en la hoja del dojo.
