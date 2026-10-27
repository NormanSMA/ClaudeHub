# claudehub-mod

Mod de Claude Code para ClaudeHub. Complementa a `scripts/statusline.cjs` y `scripts/hook.cjs`, que siguen funcionando.

## Qué hace

- Guarda `rate-limits.json` y `context-windows.json` en la carpeta de datos de ClaudeHub. Usa el mismo formato que `statusline.cjs`. Funciona en la app de escritorio, donde no hay línea de estado ni hace falta `/uso`.
- Agrega el comando `/chub`. Consulta `http://127.0.0.1:4317/api/active` y responde una línea con tokens nuevos, caché y costo de hoy.
- Muestra opcionalmente el porcentaje del límite de 5 horas sobre el prompt. Viene apagado.

El mod no usa la red, salvo `127.0.0.1:4317` para `/chub`. No lee tokens OAuth ni `~/.claude/settings.json`. No guarda prompts ni respuestas. Solo guarda campos de uso.

Carpeta de datos: `%APPDATA%\ClaudeHub` en Windows, `~/Library/Application Support/ClaudeHub` en macOS y `~/.config/ClaudeHub` en Linux.

## Instalar

```bash
claude plugin marketplace add NormanSMA/ClaudeHub
claude plugin install claudehub-mod@claudehub
```

Luego ejecuta `/reload-plugins`.

## Opciones

| Opción | Por defecto | Efecto |
|---|---|---|
| `showBand` | `false` | Muestra `Plan 5 h: NN%` sobre el prompt. Solo aparece en la terminal y en el escritorio. |

## Probar

```bash
claude plugin validate plugins/claudehub-mod
claude plugin test plugins/claudehub-mod
```

## Límites

- `/chub` necesita ClaudeHub en marcha (`pnpm start` o la bandeja). Sin servidor, responde con un aviso.
- Los límites del plan solo llegan a suscriptores Pro y Max, después de la primera respuesta.
- El mod escribe los archivos sin renombrado atómico, porque el mod no tiene `rename`.
