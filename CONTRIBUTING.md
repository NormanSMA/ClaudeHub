# Cómo contribuir a ClaudeHub

Gracias por querer mejorar ClaudeHub. Esta guía es corta a propósito.

## Antes de empezar

- Busca en los [issues](https://github.com/NormanSMA/ClaudeHub/issues) si ya existe lo que quieres hacer.
- Para un cambio grande, abre un issue primero y cuéntame la idea.
- Los arreglos pequeños puedes enviarlos directo como pull request.

## Preparar el entorno

Necesitas Node.js 24 o superior y pnpm 11.

```bash
git clone https://github.com/NormanSMA/ClaudeHub.git
cd ClaudeHub
pnpm install
pnpm demo
```

`pnpm demo` usa datos ficticios. No lee tus registros de Claude Code.

## Antes de enviar tu cambio

```bash
npx tsc --noEmit
pnpm test
pnpm build
```

Los tres deben pasar. El CI los corre en Linux, Windows y macOS.

## Reglas del proyecto

- Usa **pnpm**. No uses npm ni yarn.
- TypeScript estricto. No uses `any` si hay una alternativa clara.
- No uses emojis en el código ni en los comentarios.
- **Privacidad primero.** ClaudeHub lee solo campos de uso: modelo, tokens, fechas, sesión y título. No guardes ni muestres el texto de las conversaciones.
- El servidor escucha solo en `127.0.0.1`. No lo cambies.
- Si agregas una función, agrega una prueba en `test/`.
- Las capturas del README salen siempre del modo demo. Nunca subas capturas con tus chats reales.

## Estilo de commits

Un mensaje corto en español, en imperativo: `fix: corrige el orden de la tabla de sesiones`.
Prefijos usados: `feat`, `fix`, `docs`, `test`, `chore`.

## Pull requests

1. Crea una rama desde `main`.
2. Haz cambios pequeños y enfocados.
3. Describe qué cambia y cómo lo probaste.
4. Espera a que pase el CI.

## Seguridad

No abras un issue público para una vulnerabilidad. Lee [SECURITY.md](SECURITY.md).

## Licencia

Al contribuir aceptas que tu aporte se publique bajo la licencia [MIT](LICENSE) del proyecto.
