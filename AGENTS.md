# ClaudeHub para agentes de IA

ClaudeHub es un monitor local de tokens de Claude Code. Este archivo explica cómo instalarlo, ejecutarlo y consultarlo.

## Instalar

Requisitos: Node.js 24 o superior y pnpm 11. Funciona en Windows, macOS y Linux, incluida la bandeja con la mascota flotante: el CI arranca la app completa en los tres sistemas. El instalador `.exe` es solo para Windows; en macOS y Linux usa `pnpm tray` desde el código. En Linux el icono de la bandeja depende del escritorio.

```bash
git clone https://github.com/NormanSMA/ClaudeHub.git
cd ClaudeHub
pnpm install
pnpm build
```

Verifica con `node -v` y `pnpm -v` antes de instalar. Usa pnpm, no npm ni yarn.

En Windows también hay un instalador `.exe` en la página de Releases. No necesita Node ni pnpm.

## Ejecutar

| Objetivo | Comando | Dirección |
|---|---|---|
| Probar con datos ficticios | `pnpm demo` | `http://127.0.0.1:4318` |
| Dashboard con datos reales | `pnpm start` | `http://127.0.0.1:4317` |
| Bandeja y mascota flotante | `pnpm tray` | abre ventanas en el escritorio |

Empieza siempre con `pnpm demo`. No lee ningún archivo del usuario ni su configuración.

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
| `/api/active` | Qué chats están activos y cuánta ventana de contexto usan. Incluye `plan`: límite de 5 horas y semanal del plan (porcentaje, reinicio y tokens), o `null` si no hay datos. |
| `/api/live` | Tokens de hoy y última actividad. |
| `/api/settings` | Configuración actual. `PUT` la guarda (solo `application/json`). |

Filtra con `?range=all|30d|7d` o con `?from=AAAA-MM-DD&to=AAAA-MM-DD`.

`total` de tokens = entrada + escritura de caché + lectura de caché + salida. La lectura de caché suele ser más de 90% del total.

En `/api/active`, `context.source` indica el origen del límite de la ventana: `statusline` (real), `config` (fijado por el usuario) o `estimate` (estimado, con `estimated: true`).

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

## Límite de contexto real

Por defecto el límite de la ventana es una estimación. Para usar el valor real, pide confirmación y agrega la línea de estado en `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"<ruta>\\ClaudeHub\\scripts\\statusline.cjs\""
  }
}
```

Si el usuario ya tiene un `statusLine`, no lo reemplaces: pregúntale cómo combinarlos. El script guarda `context_window.context_window_size` de cada sesión en `context-windows.json` y los límites del plan (`rate_limits.five_hour` y `rate_limits.seven_day`) en `rate-limits.json`, ambos dentro de la carpeta de datos de ClaudeHub.

Los límites del plan solo los envía Claude Code a suscriptores Pro y Max, y después de la primera respuesta de la sesión. El porcentaje incluye todo el uso del plan, no solo Claude Code.

La app de escritorio de Claude no ejecuta `statusLine` (es una función de la terminal). Para obtener los porcentajes hay que usar `claude` en una terminal con la sesión iniciada (`/login`). Aun sin eso, `/api/active` devuelve `plan.blocked` cuando el usuario alcanzó un límite, leído de los registros.

## Configuración opcional

Archivo `config.json` en la carpeta de datos de ClaudeHub (Windows `%APPDATA%\ClaudeHub`, macOS `~/Library/Application Support/ClaudeHub`, Linux `~/.config/ClaudeHub`). También se edita en la pestaña **Ajustes** del dashboard.

```json
{ "name": "Ada", "contextLimits": { "Opus 5": 1000000 }, "activeMinutes": 20, "alertAt": 0.85 }
```

## Reglas para modificar el código

- Usa pnpm. Mantén `packageManager` en `package.json`.
- No uses emojis en código ni comentarios.
- Ejecuta `pnpm test`, `npx tsc --noEmit` y `pnpm build` antes de entregar cambios.
- No guardes ni muestres el texto de las respuestas de Claude. Solo campos de uso.
- El servidor escucha solo en `127.0.0.1`. No cambies eso.
- Las capturas de pantalla salen siempre de `pnpm demo`, nunca de datos reales.
- Al escribir expresiones regulares con barras invertidas dentro de scripts de shell, verifica el resultado: es fácil perder una `\`.
- Lee [CONTRIBUTING.md](CONTRIBUTING.md) y [SECURITY.md](SECURITY.md).
