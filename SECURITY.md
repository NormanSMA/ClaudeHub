# Política de seguridad

## Cómo reportar una vulnerabilidad

No abras un issue público.

Usa el reporte privado de GitHub:

1. Ve a la pestaña **Security** del repositorio.
2. Pulsa **Report a vulnerability**.
3. Describe el problema, los pasos para reproducirlo y su impacto.

Respondo en unos pocos días. Si el reporte es válido, publico un arreglo y te menciono en las notas de la versión, si así lo quieres.

## Qué protege ClaudeHub

- El servidor escucha solo en `127.0.0.1`.
- Rechaza con `403` cualquier petición cuyo `Host` no sea `127.0.0.1` o `localhost` (DNS rebinding).
- El endpoint que escribe la configuración exige `application/json`, un `Origin` propio y un cuerpo pequeño (CSRF).
- La configuración se valida y se acotan sus valores antes de guardarla.
- La ventana de Electron usa `contextIsolation` y `sandbox`, y expone solo cuatro acciones a la interfaz.
- Solo se leen campos de uso y títulos de chats. No se guardan respuestas.
- Codex, Gemini y OmniRoute se leen solo por campos de uso. Nunca se leen textos de conversaciones.

## Superficies de la versión 0.4

- **`GET /api/events` (SSE).** Pasa por el filtro de `Host`. No envía datos de uso: solo `hello`, `changed` y latidos. Admite 8 clientes y el noveno recibe `429`. No concede CORS.
- **OmniRoute con `docker cp`.** Se ejecuta con `execFile`, sin shell. El nombre del contenedor se valida (`^[\w.-]{1,64}$`). La copia se abre con `node:sqlite` en solo lectura, se valida con `PRAGMA quick_check` y solo se consulta la tabla `usage_history`. La fuente está apagada por defecto.
- **`events.jsonl` del hook de estados.** `scripts/hook.cjs` guarda el evento, el estado, el nombre de la herramienta y la carpeta, con 512 bytes por línea como máximo. No guarda prompts ni argumentos de herramientas. Sale siempre con código 0 y sin salida.
- **Vigilancia de carpetas.** El servidor solo observa `~/.claude/projects`, `~/.codex/sessions`, `~/.gemini/tmp` y la carpeta de datos.
- **Sin CORS nuevo.** Ninguna ruta nueva concede acceso a otros orígenes. `PUT /api/settings` valida las claves `sources` y `omniroute` igual que el resto.

## Límites conocidos

- El comando `/uso` actualiza los límites de Claude solo al ejecutarlo.
- Los límites de Codex se leen de sus rollouts. Valen mientras no venza la ventana.

## Dentro del alcance

- Lectura de datos por parte de una web o un proceso no autorizado.
- Escritura de configuración sin permiso.
- Acceso a archivos fuera de la carpeta de la interfaz.
- Ejecución de código a través de los registros que lee la aplicación.
- Inyección de comandos por el nombre del contenedor de OmniRoute.
- Lectura de datos de uso a través de `/api/events`.

## Fuera del alcance

- Ataques que requieren acceso físico o una cuenta de usuario ya comprometida en tu equipo.
- Fallos de dependencias sin un camino de explotación en ClaudeHub.
- El instalador sin firmar: Windows SmartScreen puede avisar porque el instalador aún no tiene firma de código.

## Versiones con soporte

Solo la última versión publicada recibe arreglos de seguridad.
