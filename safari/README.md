# ClaudeHub para Safari

Extension de Safari que muestra los limites de tu plan y los chats activos de Claude Code. Lee la API local de ClaudeHub (`127.0.0.1:4317`); no envia datos a ningun otro sitio.

- **Insignia** del boton: porcentaje del limite de 5 horas, en verde, ambar o rojo. Se actualiza cada minuto.
- **Popup**: limites de 5 horas y semanal, y cada chat activo con su barra de contexto.

## Requisitos

- macOS con Safari 17 o superior y Xcode.
- ClaudeHub corriendo: `pnpm tray` o `pnpm start`.

## Compilar e instalar

```bash
cd safari
xcodebuild -project ClaudeHub/ClaudeHub.xcodeproj -scheme ClaudeHub -configuration Debug \
  -derivedDataPath build DEVELOPMENT_TEAM=<tu-team-id> -allowProvisioningUpdates build
open build/Build/Products/Debug/ClaudeHub.app
```

Luego, en Safari: **Ajustes > Extensiones**, activa **ClaudeHub** y permite el acceso a `127.0.0.1`. Fija el boton en la barra de herramientas.

Con un perfil gratuito de desarrollo la app caduca a los 7 dias y hay que recompilar. Para probar sin firmar, activa **Desarrollar > Permitir extensiones sin firmar** (se desactiva al cerrar Safari).

## Estructura

- `extension/`: la extension web (Manifest V3, JavaScript sin dependencias).
- `ClaudeHub/`: proyecto de Xcode generado con `xcrun safari-web-extension-converter extension`.

## Servidor

La API solo responde con cabeceras CORS a origenes `safari-web-extension://` y solo en `GET`. El servidor sigue escuchando unicamente en `127.0.0.1`.
