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

## Dentro del alcance

- Lectura de datos por parte de una web o un proceso no autorizado.
- Escritura de configuración sin permiso.
- Acceso a archivos fuera de la carpeta de la interfaz.
- Ejecución de código a través de los registros que lee la aplicación.

## Fuera del alcance

- Ataques que requieren acceso físico o una cuenta de usuario ya comprometida en tu equipo.
- Fallos de dependencias sin un camino de explotación en ClaudeHub.
- El instalador sin firmar: Windows SmartScreen puede avisar porque el instalador aún no tiene firma de código.

## Versiones con soporte

Solo la última versión publicada recibe arreglos de seguridad.
