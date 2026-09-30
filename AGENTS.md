# ClaudeHub para agentes de IA

ClaudeHub es un monitor local de tokens de Claude Code. Este archivo explica cómo instalarlo, ejecutarlo y consultarlo.

## Instalar

Requisitos: Windows 11, Node.js 26 o superior, pnpm 11.

```bash
git clone https://github.com/NormanSMA/ClaudeHub.git
cd ClaudeHub
pnpm install
pnpm build
```

Verifica con `node -v` y `pnpm -v` antes de instalar. Usa pnpm, no npm ni yarn.

## Ejecutar

| Objetivo | Comando | Dirección |
|---|---|---|
| Probar con datos ficticios | `pnpm demo` | `http://127.0.0.1:4318` |
| Dashboard con datos reales | `pnpm start` | `http://127.0.0.1:4317` |
| Bandeja y mascota flotante | `pnpm tray` | abre ventanas en el escritorio |

Empieza siempre con `pnpm demo`. No lee ningún archivo del usuario.

## Consultar los datos

Con el servidor en marcha, pide datos en JSON:

```bash
curl "http://127.0.0.1:4317/api/summary?range=7d"
curl "http://127.0.0.1:4317/api/active"
```

| Ruta | Responde a |
|---|---|
| `/api/summary` | Cuántos tokens, mensajes y sesiones hubo. Modelo favorito y hora pico. |
| `/api/models` | Qué modelos se usaron y cuánto. |
| `/api/roles` | Cuánto gastó el orquestador y cuánto los subagentes. |
| `/api/sessions` | Qué chats gastaron más, con su título. |
| `/api/projects` | Qué proyectos gastaron más. |
| `/api/active` | Qué chats están activos y cuánta ventana de contexto usan. |
| `/api/live` | Tokens de hoy y última actividad. |

Filtra con `?range=all|30d|7d` o con `?from=AAAA-MM-DD&to=AAAA-MM-DD`.

`total` de tokens = entrada + escritura de caché + lectura de caché + salida. La lectura de caché suele ser más de 90% del total.

En `/api/active`, `context.estimated: true` indica que el límite de la ventana es una estimación.

## Abrir ClaudeHub al iniciar Claude Code

Este paso edita la configuración global del usuario. Pide confirmación antes.

Agrega un hook `SessionStart` en `~/.claude/settings.json`. Conserva los hooks que ya existan.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<ruta>\\ClaudeHub\\scripts\\launch.cjs\"" }
        ]
      }
    ]
  }
}
```

Reemplaza `<ruta>` por la carpeta donde clonaste el proyecto. El lanzador no imprime nada y no duplica la bandeja.

## Configuración opcional

Archivo `%APPDATA%\ClaudeHub\config.json`:

```json
{ "name": "Ada", "contextLimits": { "Opus 5": 1000000 }, "activeMinutes": 20, "alertAt": 0.85 }
```

## Reglas para modificar el código

- Usa pnpm. Mantén `packageManager` en `package.json`.
- No uses emojis en código ni comentarios.
- Ejecuta `pnpm test` y `npx tsc --noEmit` antes de entregar cambios.
- No guardes ni muestres el texto de las respuestas de Claude. Solo campos de uso.
- El servidor escucha solo en `127.0.0.1`. No cambies eso.
