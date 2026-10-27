# ClaudeHub para Chrome, Edge, Brave, Opera, Vivaldi y Firefox

La extension muestra los limites de tu plan y los chats activos de Claude Code. Comparte el codigo con la extension de Safari ([`safari/extension/`](../safari/README.md)).

- **Insignia** del boton: porcentaje del limite de 5 horas. Se actualiza cada minuto.
- **Popup**: limites de 5 horas y semanal, y cada chat activo con su barra de contexto.

## Requisitos

- ClaudeHub corriendo: `pnpm tray` o `pnpm start`.
- Puerto 4317 fijo. Con `pnpm demo` el servidor escucha en 4318. Para datos ficticios usa `CLAUDEHUB_DEMO=1 PORT=4317 pnpm start`.
- Un Chromium con Manifest V3 (version reciente) o Firefox 115 o superior.

## Compilar

```bash
pnpm build:extensions
```

El comando borra y recrea `extensions/dist/chromium/` y `extensions/dist/firefox/`. Copia el codigo de `safari/extension/` y agrega el manifiesto de cada navegador.

## Cargar en Chrome, Edge, Brave, Opera y Vivaldi

1. Abre `chrome://extensions` (en Edge `edge://extensions`).
2. Activa el **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida**.
4. Elige la carpeta `extensions/dist/chromium`.
5. Fija el boton de ClaudeHub en la barra de herramientas.

## Cargar en Firefox

1. Abre `about:debugging#/runtime/this-firefox`.
2. Pulsa **Cargar complemento temporal**.
3. Elige `extensions/dist/firefox/manifest.json`.
4. Abre `about:addons`, entra en **ClaudeHub** y abre la pestana **Permisos**.
5. Activa el acceso a `http://127.0.0.1:4317`.

Firefox MV3 trata los `host_permissions` como opcionales. Sin el paso 5 el popup muestra "No hay conexion" y la insignia muestra `--`.

## Privacidad

La extension solo lee `http://127.0.0.1:4317/api/active`. No envia datos a ningun otro sitio. No guarda nada. El servidor no cambia: escucha solo en `127.0.0.1`.

## Limitaciones conocidas

- Probada en Microsoft Edge 156 (Chromium) con ClaudeHub real: el service worker carga, la insignia muestra el limite de 5 horas, la alarma de 1 minuto se registra y el popup lee `/api/active` sin CORS.
- Sin probar en Chrome, Brave, Opera, Vivaldi ni Firefox. Chrome 155 ignoro `--load-extension` en una prueba automatica: cargala a mano desde `chrome://extensions`.
- En Firefox falta conceder el permiso del host (`about:addons`, Permisos).
- El puerto 4317 esta fijo en el manifiesto y en `safari/extension/shared.js`.
- En Firefox el complemento temporal se quita al cerrar el navegador. Para instalarlo de forma permanente hace falta firmarlo en addons.mozilla.org.
- En Chromium, el service worker se suspende. La insignia se actualiza al despertar con la alarma de 1 minuto.
- Chrome puede mostrar un aviso de extensiones en modo de desarrollador al iniciar.
