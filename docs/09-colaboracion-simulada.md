# Profesor y alumno: entorno de colaboración

Este entorno permite mejorar las pantallas con datos ficticios. No inicia NestJS, no usa Google Sheets y no requiere archivos `.env` ni una cuenta de servicio. La API simulada funciona dentro del servidor del frontend, en `/api-simulada`.

## Preparación del anfitrión

En el repositorio original, actualizado en `construccion`, ejecutar:

```powershell
pnpm preparar:colaboracion
```

Se crea una carpeta hermana llamada `gestion-dojo-karate-colaboracion`. La exportación incluye el frontend, los contratos compartidos y la simulación; excluye el backend, credenciales, variables de entorno, dependencias instaladas e historial Git. Si la carpeta ya existe, no se sobrescribe. Puede elegirse otra con `pnpm preparar:colaboracion --destino C:\Projects\dojo-colaboracion`.

Abrir **la carpeta de colaboración**, no el repositorio original, en VS Code. En su terminal:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

El servidor queda en segundo plano en **http://localhost:4322**. Basta con un puerto: las peticiones a la API simulada utilizan esa misma dirección, también al abrir el enlace compartido por Live Share. La configuración predeterminada de Astro en la copia también utiliza la simulación. No ejecutar `pnpm dev:api` ni copiar el JSON o archivos `.env`.

En el repositorio original también existe `pnpm dev:simulado`, pero la carpeta exportada es la indicada para compartir.

## Configurar Live Share

1. Instalar **Live Share**, de Microsoft, en VS Code, e iniciar sesión.
2. Desde la carpeta de colaboración, iniciar **Live Share: Start Collaboration Session** y enviar la invitación a los dos compañeros.
3. En el panel de Live Share, en **Shared Servers / Servidores compartidos**, compartir el puerto **4322** y mantenerlo privado para los invitados.
4. Pedir a ambos compañeros que entren antes de que el anfitrión salga, para aprobar su acceso si Live Share lo solicita y comprobar que pueden editar sus archivos. Cada uno abre el servidor compartido desde el panel de Live Share en su propio navegador e inicia sesión con el perfil asignado.
5. Mantener la computadora encendida, sin suspensión, con VS Code y la sesión de Live Share abiertos durante el trabajo.
6. No compartir terminales con escritura ni conceder control de tareas o depuración. El anfitrión ejecuta los comandos.

La configuración de VS Code desactiva el uso compartido automático de servidores y terminales, los archivos externos y el control de tareas y depuración de los invitados. El archivo `.vsls.json` excluye credenciales, archivos de entorno y carpetas internas. La exportación no contiene estos secretos. Live Share y un servidor de desarrollo no son un aislamiento del equipo anfitrión: utilizar la sesión únicamente con personas de confianza. Si se necesita aislamiento frente a ejecución de código, utilizar otra máquina o un contenedor sin secretos montados.

## Cuentas ficticias

La contraseña inicial es igual al usuario:

| Perfil o escenario | Usuario y contraseña |
| --- | --- |
| Profesor | `profesor.prueba` |
| Alumno con saldo y cambio de plan programado | `alumno.prueba` |
| Alumno con recuperación autorizada | `alumno.recuperacion` |
| Alumno con plan congelado | `alumno.congelado` |
| Alumno con solicitud pendiente | `alumno.solicitud` |
| Alumno sin plan | `alumno.sinplan` |

Cada navegador tiene su propia sesión; los cambios de los datos son comunes a los invitados del mismo servidor. Para probar dos perfiles desde un solo equipo, usar ventanas de incógnito separadas o navegadores diferentes.

Las fechas de ejemplo se calculan al iniciar con zona **America/Lima** y la validación de las operaciones utiliza el día actual de esa zona. Los turnos mantienen sus días oficiales: lunes/miércoles/viernes o martes/jueves. En Calendario se debe elegir una fecha del turno; no se registra presencia en fechas futuras.

## Archivos para cada compañero

| Responsable | Entrada del perfil | Carpeta de componentes propios |
| --- | --- | --- |
| Profesor | `apps/web/src/components/perfiles/profesor/PanelProfesor.jsx` | `apps/web/src/components/perfiles/profesor/` |
| Alumno | `apps/web/src/components/perfiles/alumno/PanelAlumno.jsx` | `apps/web/src/components/perfiles/alumno/` |

Ambos componentes ya están conectados al inicio de su perfil en `/alumnos` y muestran la pantalla actual como punto de partida. No se cambió el diseño de las cuentas. Cada compañero puede sustituir su contenido y crear componentes dentro de su carpeta.

Se utiliza `useSesion` para consultar la cuenta actual y `apiFetch`/`leerRespuesta`, de `src/lib/api.js`, para consultar y modificar datos. No escribir direcciones como `localhost:3000` ni cambiar el archivo compartido de acceso a la API.

Coordinar con el anfitrión cualquier cambio en `InicioPerfil.jsx`, `Alumnos.jsx`, `Calendario.jsx`, navegación, estilos globales, contratos o API. Mantener los colores del dojo, la navegación sencilla y evitar párrafos explicativos innecesarios.

## Operaciones disponibles

- Inicio/cierre de sesión y cambio de contraseña ficticia.
- Consulta del perfil, planes, inscripciones y saldo.
- Calendario de sesiones del profesor y marcación de su propia presencia.
- Asistencia de alumnos, avisos y retiro de ausencias.
- Solicitud, aprobación o rechazo de congelamientos y reactivación.
- Autorización y revocación de recuperaciones y ajuste de sus límites.

Solo se puede ingresar como profesor o alumno; no existe una cuenta de administrador en esta simulación. La simulación respeta la separación de perfiles y controla versiones para evitar sobrescribir cambios concurrentes. No incluye administración de cuentas, renovaciones ni integración con Google; sirve para desarrollar la interfaz de profesor y alumno. La validación definitiva de reglas y permisos se realiza contra la API real después de integrar los cambios.

## Reiniciar y terminar

Los movimientos y contraseñas se guardan únicamente en memoria. Para recuperar los ejemplos originales:

```powershell
pnpm stop:simulado
pnpm dev
```

Para terminar, ejecutar `pnpm stop:simulado` y finalizar la sesión de Live Share.

Las pruebas de la API simulada se ejecutan con `pnpm test:simulado`. La compilación del frontend se comprueba con `pnpm build`.

Al finalizar el trabajo, el anfitrión revisa y copia los componentes modificados de la carpeta de colaboración al repositorio original, en `construccion`, antes de probar la integración real. La carpeta exportada no tiene Git ni se sube automáticamente. Conservarla hasta verificar que todos los cambios se hayan integrado.
