<div align="center">

<img src="docs/chispa.svg" alt="Chispa, la mascota de ClaudeHub" width="160" />

# ClaudeHub

**Mira a dónde se van tus tokens de Claude Code.**
Un monitor local para Windows, macOS y Linux: dashboard web, mascota flotante en el escritorio y alertas de contexto.

**Español** · [English](README.en.md) · [Português](README.pt-BR.md)

[![CI](https://github.com/NormanSMA/ClaudeHub/actions/workflows/ci.yml/badge.svg)](https://github.com/NormanSMA/ClaudeHub/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/NormanSMA/ClaudeHub)](https://github.com/NormanSMA/ClaudeHub/releases/latest)
![Node](https://img.shields.io/badge/Node-24%2B-339933?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![Plataformas](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-informational)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)
![Privacidad](https://img.shields.io/badge/datos-100%25%20locales-2ea44f)

<br />

<img src="docs/screenshots/escritorio.png" alt="ClaudeHub en el escritorio: dashboard y mascota con el panel de chats activos" width="860" />

<sub>Capturas del modo demo: todos los datos son ficticios.</sub>

</div>

---

## Contenido

- [Qué es](#qué-es)
- [Pruébalo en 1 minuto](#pruébalo-en-1-minuto)
- [Características](#características)
- [La mascota](#la-mascota)
- [Instalación](#instalación)
- [Instalar con una IA](#instalar-con-una-ia)
- [Uso](#uso)
- [Límite de contexto real](#límite-de-contexto-real)
- [Límites de tu plan](#límites-de-tu-plan-5-horas-y-semanal)
- [Otras fuentes: Codex, Gemini y OmniRoute](#otras-fuentes-codex-gemini-y-omniroute)
- [Estados por hooks](#estados-por-hooks)
- [Actualización en vivo](#actualización-en-vivo)
- [Cómo funciona](#cómo-funciona)
- [Configuración](#configuración)
- [API local](#api-local)
- [Privacidad y seguridad](#privacidad-y-seguridad)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Contribuir](#contribuir)
- [Hoja de ruta](#hoja-de-ruta)
- [Licencia](#licencia)

## Qué es

ClaudeHub lee los registros que Claude Code guarda en tu PC y los convierte en respuestas claras:

- Cuántos tokens gastas y en qué modelo.
- Qué chats consumen más, con su título.
- Cuánto usa el **orquestador** y cuánto usan los **subagentes**.
- Qué tan llena está la **ventana de contexto** de cada chat activo.
- Cuánto gastan también **Codex**, **Gemini CLI** y **OmniRoute**, con un filtro por fuente.
- Qué agentes trabajan ahora, cuáles esperan un permiso y si dos pisan la misma carpeta.

Todo corre en tu máquina. Ningún dato sale de ella.

## Pruébalo en 1 minuto

El modo demo no lee ningún archivo tuyo ni tu configuración. Usa datos ficticios, con tres chats activos en verde, ámbar y rojo.

```bash
pnpm install
pnpm build
pnpm demo
```

Abre `http://127.0.0.1:4318`.

## Características

| | |
|---|---|
| **Agentes** | Pestaña inicial. Lista los chats de Claude con actividad reciente (título, proyecto, modelo, subagentes activos y una barra de contexto que pasa de verde a ámbar y a rojo), los límites de Claude y de Codex, y los agentes en vivo con su estado, los atascos y los choques. |
| **Resumen** | Sesiones, mensajes, tokens totales, días activos, hora pico, modelo favorito, mapa de calor por día y porcentaje de aciertos de caché. Incluye **Orquestador vs Subagentes**: reparto de tokens entre ambos roles, evolución diaria y ranking de tipos de subagente. |
| **Modelos** | Barras apiladas por día, con entrada y salida por modelo. Se ordena por tokens, entrada, salida o nombre. |
| **Sesiones y Proyectos** | Tablas ordenables por cualquier columna, con búsqueda por título y filtro por proyecto. |
| **Fuentes** | Selector Todas, Claude, Codex, Gemini u OmniRoute para Resumen, Modelos, Sesiones y Proyectos. Cada fuente muestra si se pudo leer. |
| **En vivo** | El dashboard se refresca solo cuando cambian los archivos, sin esperar al sondeo. |
| **Ajustes** | Edita tu nombre, el umbral de alerta, los minutos de actividad y la ventana de contexto de cada modelo, sin tocar archivos. |
| **Filtros de fecha** | Todo, 30 días, 7 días o un rango Desde y Hasta. |
| **Mascota flotante** | Un personaje pixel siempre visible. Se arrastra, recuerda su posición y al tocarla abre el panel de chats activos. |
| **Límites del plan** | Tu límite de 5 horas y el semanal como porcentaje, con cuánto falta para que se restablezcan, para Claude (planes Pro y Max) y para Codex. |
| **Estados por hooks** | Un hook opcional anota si cada agente piensa, usa una herramienta, espera un permiso o falló. Alimenta la pestaña **Agentes** y la mascota. |
| **Comando `/uso`** | Guarda los límites de Claude desde la app de escritorio, donde la línea de estado no corre. |
| **Alertas** | Notificación del sistema cuando un chat o tu límite de 5 horas pasan del umbral (85% por defecto). |
| **Bandeja del sistema** | Icono con los tokens de hoy en el tooltip y menú para abrir el dashboard. |
| **Línea de estado** | Script opcional que muestra `ctx 43% | 5h 51%` en Claude Code y le da a ClaudeHub el tamaño real de la ventana y los límites de tu plan. |
| **Inicio automático** | Arranca con el sistema y, si quieres, al iniciar cualquier sesión de Claude Code. |
| **Tema** | Oscuro, claro o automático, con la paleta terracota de Claude. |
| **Enlaces a vistas** | La pestaña queda en la dirección (`#/modelos`), así que puedes enlazarla. |

<table>
  <tr>
    <td><img src="docs/screenshots/resumen.png" alt="Resumen con mapa de calor" /></td>
    <td><img src="docs/screenshots/modelos.png" alt="Modelos por día" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Resumen y mapa de calor</sub></td>
    <td align="center"><sub>Tokens por modelo y por día</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/roles.png" alt="Orquestador contra subagentes" /></td>
    <td><img src="docs/screenshots/sesiones.png" alt="Sesiones ordenables con filtros" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Orquestador vs Subagentes</sub></td>
    <td align="center"><sub>Sesiones con título, orden y filtros</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/ajustes.png" alt="Pestaña de ajustes" /></td>
    <td><img src="docs/screenshots/activos.png" alt="Chats activos con barra de contexto" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Ajustes dentro del dashboard</sub></td>
    <td align="center"><sub>Chats activos y su contexto</sub></td>
  </tr>
</table>

## La mascota

**Chispa** es un personaje original, dibujado en una cuadrícula de 14 x 12 píxeles. Cambia de estado según lo que pasa en tus chats.

Con el [hook de estados](#estados-por-hooks) instalado, Chispa tiene 7 estados. Si hay varios, gana el primero de esta tabla:

<table>
  <tr>
    <td valign="top">

| Estado | Cuándo aparece |
|---|---|
| Esperando | Un agente espera que apruebes un permiso. |
| Error | Una herramienta o la respuesta de un agente falló. |
| Alerta | Dos agentes activos en la misma carpeta, un agente atascado o un límite sobre el umbral. |
| Herramienta | Un agente ejecuta una herramienta. |
| Pensando | Un agente piensa o arranca una sesión. |
| Contenta | Un agente terminó hace menos de 10 segundos. |
| Durmiendo | No hay nada que mostrar. |

Un agente se considera atascado tras 5 minutos pensando o 15 minutos en una herramienta. Dos agentes chocan si trabajan 10 segundos o más en la misma carpeta.

Sin el hook rige la regla simple: durmiendo (sin chats activos), despierta (hay chats, ninguno escribe), trabajando (un chat escribió en el último minuto) y alerta (un chat o tu límite de 5 horas superó el umbral).

Si un agente de Codex trabaja (según el hook), Chispa muestra una insignia de Codex. No es una segunda mascota.

Al tocarla se abre el panel de chats activos. Si abres el dashboard desde ahí, la mascota se oculta y vuelve cuando lo cierras.

</td>
    <td><img src="docs/screenshots/mascota.png" alt="Panel de la mascota con chats activos" width="300" /></td>
  </tr>
</table>

## Instalación

### Plataformas

| Sistema | Dashboard, demo y API | Bandeja, mascota y alertas |
|---|---|---|
| Windows 11 | Probado | Probado (uso diario) |
| macOS | Probado en CI y a mano | Probado en CI y a mano (macOS 27, Apple Silicon) |
| Linux | Probado en CI y en Docker | Probado en CI y en Docker con pantalla virtual |

Probado a mano en macOS 27 (Apple Silicon, Node 26, Electron 44): bandeja, mascota con su panel y dashboard abren y funcionan. Capturas del modo demo:

<p align="center"><img src="docs/screenshots/macos-mascota.png" alt="ClaudeHub en macOS: panel de la mascota" width="420" /> <img src="docs/screenshots/macos-dashboard.png" alt="ClaudeHub en macOS: dashboard" width="420" /></p>

Las pruebas de macOS y Linux son automáticas: el CI arranca la aplicación completa, abre el dashboard, comprueba que la mascota y el dashboard se ven y cierra por **Salir**. No sustituyen una prueba a mano en tu escritorio. En Linux el icono de la bandeja depende del escritorio (GNOME necesita la extensión AppIndicator) y las notificaciones necesitan un servicio de notificaciones.

El instalador `.exe` es solo para Windows. En macOS y Linux se usa desde el código (`pnpm tray`).

### Opción A: instalador de Windows

Descarga `ClaudeHub-Setup-x.y.z.exe` desde [Releases](https://github.com/NormanSMA/ClaudeHub/releases/latest) y ábrelo. No necesitas Node ni pnpm.

> El instalador aún no tiene firma de código. Windows SmartScreen puede avisar: pulsa **Más información** y luego **Ejecutar de todos modos**.

Se instala solo para tu usuario, sin pedir permisos de administrador. Para desinstalarlo usa **Configuración > Aplicaciones**.

### Opción B: desde el código

Requisitos:

- [Node.js](https://nodejs.org) 24 o superior.
- [pnpm](https://pnpm.io) 11.
- Claude Code instalado y con historial en `~/.claude/projects`.

```bash
git clone https://github.com/NormanSMA/ClaudeHub.git
cd ClaudeHub
pnpm install
pnpm build
```

Para generar tu propio instalador: `pnpm dist`. El resultado queda en `release/`.

## Instalar con una IA

Copia este texto y pégalo en Claude Code, o en cualquier agente de IA con acceso a tu terminal.

````text
Instala y ejecuta ClaudeHub, un monitor local de tokens de Claude Code.
Repositorio: https://github.com/NormanSMA/ClaudeHub

1. Clónalo en la carpeta que prefieras y entra en ella.
2. Verifica Node 24 o superior y pnpm 11 con `node -v` y `pnpm -v`. Si falta alguno, dime cómo instalarlo.
3. Ejecuta `pnpm install` y `pnpm build`.
4. Ejecuta `pnpm test` y confirma que pasan.
5. Prueba el modo demo con `pnpm demo` y abre http://127.0.0.1:4318. Usa datos ficticios. Cuando termines, detén el proceso.
6. Ejecuta `pnpm start` y comprueba que http://127.0.0.1:4317/api/summary?range=7d devuelve JSON con mis tokens.
7. Ejecuta `pnpm tray` para abrir la bandeja y la mascota flotante.
8. Pregúntame antes de editar ~/.claude/settings.json. Si acepto, agrega el hook SessionStart y la línea de estado de las secciones "Abrir al iniciar Claude Code" y "Límite de contexto real" del README, con las rutas reales del proyecto, sin borrar mis ajustes actuales.
9. Al terminar, dime mis tokens de los últimos 7 días y qué chats están activos, usando /api/summary y /api/active.

Lee AGENTS.md del repositorio para más detalles.
````

El archivo [`AGENTS.md`](AGENTS.md) explica a un agente cómo instalarlo, ejecutarlo y consultar la API.

## Uso

### Solo el dashboard

```bash
pnpm start
```

Abre `http://127.0.0.1:4317`.

### Bandeja y mascota

```bash
pnpm tray
```

Inicia la bandeja, la mascota y el servidor local si no está activo. La primera vez activa el inicio con el sistema. Puedes cambiarlo en el menú del icono de la bandeja.

Con el instalador, abre **ClaudeHub** desde el menú Inicio.

### Abrir al iniciar Claude Code

ClaudeHub se puede lanzar solo con un hook `SessionStart` en `~/.claude/settings.json`.

Desde el código fuente:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node \"C:\\ruta\\a\\ClaudeHub\\scripts\\launch.cjs\"" }
        ]
      }
    ]
  }
}
```

En macOS y Linux la ruta lleva barras normales, por ejemplo `node "/home/ada/ClaudeHub/scripts/launch.cjs"`.

Con el instalador de Windows, apunta al ejecutable:

```json
{ "type": "command", "command": "\"C:\\Users\\<tu-usuario>\\AppData\\Local\\Programs\\ClaudeHub\\ClaudeHub.exe\" --background" }
```

El lanzador no imprime nada, porque la salida de un hook `SessionStart` se agrega al contexto de Claude. Si la bandeja ya corre, no hace nada.

### Menú de la bandeja

- **Abrir dashboard**: ventana de 780 x 660.
- **Abrir en el navegador**: la misma interfaz en tu navegador.
- **Mostrar mascota**: muestra u oculta a Chispa.
- **Iniciar con el sistema**: activa o desactiva el arranque automático.
- **Salir**.

### Scripts

| Comando | Qué hace |
|---|---|
| `pnpm demo` | Servidor con datos ficticios en `http://127.0.0.1:4318`. |
| `pnpm start` | Servidor con tus datos en `http://127.0.0.1:4317`. |
| `pnpm tray` | Abre la bandeja y la mascota con Electron. |
| `pnpm dev` | Servidor con recarga y Vite en `http://127.0.0.1:5173`. |
| `pnpm build` | Compila la interfaz en `dist/`. |
| `pnpm build:server` | Empaqueta el servidor en `dist-server/server.cjs`. |
| `pnpm dist` | Genera el instalador de Windows en `release/`. |
| `pnpm scan` | Imprime un resumen en la terminal, sin interfaz. |
| `pnpm test` | Ejecuta las pruebas con Vitest. |

## Límite de contexto real

Los registros de Claude Code no dicen cuál es la ventana de contexto de cada modelo. Por defecto ClaudeHub la **estima** (las cifras llevan un asterisco).

Para usar el valor **real**, activa la línea de estado de ClaudeHub. Claude Code le pasa a ese script el tamaño de la ventana de cada sesión, y ClaudeHub lo guarda y lo usa.

Agrega esto en `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"C:\\ruta\\a\\ClaudeHub\\scripts\\statusline.cjs\""
  }
}
```

Además de guardar el tamaño, el script muestra en la barra de Claude Code una línea como:

```
[Opus] ctx 43% (430k/1.0M) | 5h 51% | 7d 33%
```

El color cambia a amarillo desde 60% y a rojo desde 85%.

Orden de prioridad del límite:

1. Tamaño real registrado por la línea de estado.
2. Valor fijado en la pestaña **Ajustes** (o en `config.json`).
3. Estimación: hasta 200 000 tokens se asume una ventana de 200 000; si el chat ya la superó, 1 000 000.

Si ya tienes una línea de estado propia, pídele a tu script que invoque a `statusline.cjs` pasándole el mismo JSON por entrada estándar.

## Límites de tu plan (5 horas y semanal)

Con la línea de estado activada, ClaudeHub muestra tus límites de uso, los mismos que ves en **Límites de uso del plan** de Claude:

- **Límite de 5 horas:** porcentaje usado y cuánto falta para que se restablezca.
- **Semanal:** lo mismo para la ventana de 7 días.
- **Tokens en la ventana:** cuántos tokens de Claude Code de este equipo caben dentro de cada ventana.

Aparecen en la pestaña **Agentes** y en el panel de la mascota. Si tu límite de 5 horas pasa del umbral de alerta, la mascota se alerta y el sistema te avisa, una vez por ventana.

Cosas que debes saber:

- Claude Code solo envía estos datos a suscriptores **Pro y Max**, y solo después de la primera respuesta de la sesión.
- El porcentaje lo calcula Anthropic e incluye todo tu uso del plan, también el de la web y las apps. Los tokens de ClaudeHub solo cuentan Claude Code en este equipo, así que no suman el mismo total.
- El dato se actualiza cada vez que Claude Code ejecuta la línea de estado, por ejemplo al enviar un mensaje. Si pasan más de 15 minutos sin actividad, ClaudeHub lo avisa. Una ventana vencida se oculta.
- Sin la línea de estado ni el comando `/uso`, ClaudeHub no puede leer estos límites: no salen en los registros.
- **La app de escritorio de Claude no ejecuta la línea de estado**: es una función de la terminal. Si usas Claude Code solo desde la app de escritorio, usa el comando `/uso` (siguiente sección). También puedes usar `claude` en una terminal con tu sesión iniciada (`/login`). El porcentaje es de toda tu cuenta, así que un mensaje desde la terminal actualiza el dato, que queda fijo hasta el siguiente mensaje de terminal.

### Límites desde la app de escritorio: comando `/uso`

El comando `/uso` llama a la herramienta `get_usage` de Claude Code y guarda las dos ventanas en `rate-limits.json` con `scripts/write-limits.cjs`. El script valida los porcentajes (0 a 100) y las fechas de reinicio antes de escribir.

Instálalo una vez:

1. Copia `scripts/commands/uso.md` a `~/.claude/commands/uso.md`.
2. Reemplaza `<ruta-de-ClaudeHub>` por la carpeta donde clonaste el proyecto.

Ejecuta `/uso` en una sesión de Claude Code. Muestra el porcentaje y la hora de reinicio de cada ventana. Si `get_usage` no devuelve una ventana, el comando la omite y conserva la guardada mientras no haya vencido.

Los datos se actualizan solo cuando ejecutas `/uso`. Ningún hook puede llamar a `get_usage`.

## Otras fuentes: Codex, Gemini y OmniRoute

Además de Claude Code, ClaudeHub lee el uso de tres fuentes. La ruta `/api/sources` indica si cada una se pudo leer.

| Fuente | De dónde lee | Qué lee |
|---|---|---|
| Codex | `~/.codex/sessions/AAAA/MM/DD/rollout-*.jsonl` | Tokens por sesión (se toma el aumento del acumulado), modelo, carpeta de trabajo y límites del plan (`rate_limits`). |
| Gemini CLI | `~/.gemini/tmp/<proyecto>/chats/session-*.jsonl` | Tokens por mensaje de Gemini (sin repetidos, por `id`) y modelo. El proyecto sale del nombre de la carpeta. |
| OmniRoute | La tabla `usage_history` de su base `storage.sqlite` | Proveedor, modelo y tokens (entrada, salida, caché, razonamiento) por llamada. |

Solo se leen campos de uso. Nunca se leen ni se guardan los textos de las conversaciones, de los pensamientos ni de las instrucciones.

### Codex y Gemini

Están activas por defecto. Si no tienes la carpeta, la fuente queda vacía sin error. Puedes apagarlas con `sources.codex` y `sources.gemini` en `config.json`.

Los límites de Codex salen del `rate_limits` más reciente de sus 5 rollouts modificados último. Valen mientras no venza la ventana: una ventana con el reinicio ya pasado se oculta. Solo se actualizan al usar Codex.

### OmniRoute

OmniRoute corre en un contenedor Docker y su API de uso pide sesión del panel, así que ClaudeHub lee su base en solo lectura:

1. Cada 60 segundos ejecuta `docker cp` (sin shell) para copiar `storage.sqlite`, y `-wal` y `-shm` si existen, desde el contenedor a `omniroute/` dentro de la carpeta de datos.
2. Abre la copia con `node:sqlite` en solo lectura, la valida con `PRAGMA quick_check` y lee solo la tabla `usage_history`.
3. Si la copia sale dañada, reintenta. Si falla, conserva la lectura anterior y marca la fuente como desactualizada.

Está apagada por defecto. Actívala con `sources.omniroute: true`. Sin Docker o sin el contenedor, la fuente queda con error y el resto sigue funcionando.

Si montas la base en tu disco, fija `omniroute.dbPath` con la ruta de `storage.sqlite` y ClaudeHub la abre directo, sin `docker cp`.

## Estados por hooks

El script `scripts/hook.cjs` anota cada evento de un agente en `events.jsonl` (carpeta de datos). Es opcional. Sin él, la pestaña **Agentes** y la mascota usan la regla simple.

Cada línea tiene este formato y pesa 512 bytes como máximo:

```json
{"v":1,"ts":1760000000000,"source":"claude","session":"<id>","event":"PreToolUse","state":"tool","tool":"Edit","cwd":"<carpeta>"}
```

| Evento | Estado |
|---|---|
| `SessionStart` | starting |
| `UserPromptSubmit`, `PostToolUse`, `PermissionDenied` | thinking |
| `PreToolUse` | tool |
| `PermissionRequest` | waiting |
| `PostToolUseFailure`, `StopFailure` | error |
| `Stop` | done |
| `SessionEnd` | idle |

Garantías del script:

- Sale siempre con código 0 y no escribe nada en la salida estándar ni en la de error. Una salida o el código 2 podrían bloquear al agente.
- Termina en menos de 1 segundo, aunque la entrada llegue vacía o rota.
- No guarda el prompt, `tool_input` ni la salida de las herramientas. Solo el evento, el nombre de la herramienta y la carpeta.
- Rota `events.jsonl` a `events.1.jsonl` al pasar de 256 KB.

### Instalar el hook

Pide confirmación antes de editar `~/.claude/settings.json`. Conserva los hooks que ya existan, incluido el `SessionStart` del lanzador: agrega un bloque nuevo a cada lista.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node \"C:\\ruta\\a\\ClaudeHub\\scripts\\hook.cjs\" claude" } ] }
    ],
    "PreToolUse": [
      { "hooks": [ { "type": "command", "command": "node \"C:\\ruta\\a\\ClaudeHub\\scripts\\hook.cjs\" claude" } ] }
    ]
  }
}
```

Repite el mismo bloque con los demás eventos de la tabla. Para Codex usa el argumento `codex` en lugar de `claude`, en los eventos que tu versión de Codex admita en su configuración de hooks.

## Actualización en vivo

El servidor vigila `~/.claude/projects`, `~/.codex/sessions`, `~/.gemini/tmp` y la carpeta de datos. Agrupa los cambios en ráfagas de 500 ms y avisa al dashboard y a la mascota por `/api/events`. Solo cuentan los archivos `.jsonl`, `.json` y `.sqlite`. Las carpetas que no existen se reintentan cada 60 segundos.

La interfaz mantiene un sondeo de respaldo. Con el aviso en vivo abierto, el sondeo pasa a un ciclo de 60 segundos como mínimo. Si el aviso falla, vuelve al ciclo normal.

### Aviso de límite alcanzado

Esto no necesita la línea de estado. Cuando llegas a un límite, Claude Code lo anota en los registros con la hora exacta de reinicio. ClaudeHub lo lee y muestra un aviso rojo, por ejemplo **Límite de 5 horas alcanzado. Se restablece en 1 h 12 min**, además de una notificación del sistema y la mascota en alerta. Funciona también con la app de escritorio.

## Cómo funciona

```
~/.claude/projects/<proyecto>/<sesion>.jsonl                     orquestador
~/.claude/projects/<proyecto>/<sesion>/subagents/agent-*.jsonl   subagentes
~/.codex/sessions, ~/.gemini/tmp, OmniRoute (opcional)            otras fuentes
<datos>/events.jsonl                                              hook de estados
                     |
                     v
            src/core  (parser + agregación)
                     |
                     v
        src/server  (API local en 127.0.0.1:4317)
            |                        |
            v                        v
     src/web (React)          src/tray (Electron)
   dashboard y mascota       bandeja, ventana y alertas
```

### Qué se lee de cada log

Solo campos de uso: modelo, tokens (entrada, escritura y lectura de caché, salida), fecha, carpeta de trabajo, sesión, título del chat y último prompt para nombrarlo si no tiene título. No se guardan ni se muestran las respuestas.

De Codex, Gemini y OmniRoute se leen solo campos de uso (ver [Otras fuentes](#otras-fuentes-codex-gemini-y-omniroute)). Del hook se guarda el evento, el estado, la herramienta y la carpeta, nunca el texto del usuario.

### Reglas de conteo

- **Total de tokens** = entrada + escritura de caché + lectura de caché + salida.
- **Deduplicación por `message.id`.** Los registros repiten un mismo mensaje en varias líneas, una por bloque de contenido. ClaudeHub cuenta cada mensaje una sola vez. En un archivo de prueba, 569 de 1383 líneas eran repetidas.
- **Orquestador o subagente.** Un mensaje es de subagente si está en una carpeta `subagents/` o trae `isSidechain: true`. El tipo sale del archivo `.meta.json` de cada agente.
- **Proyectos.** Los worktrees de Git (`--claude-worktrees-*`) se agrupan bajo su proyecto base. Funciona con rutas de Windows, macOS y Linux.
- **Días y horas** usan la zona horaria local.

### Ventana de contexto

El contexto en uso de un chat es la entrada del último mensaje del orquestador: `entrada + escritura de caché + lectura de caché`. El límite sale de [Límite de contexto real](#límite-de-contexto-real).

### Rendimiento

- La lectura es **incremental**: guarda cuántos bytes leyó de cada archivo y procesa solo lo nuevo.
- Los archivos grandes se leen por bloques de 8 MB, sin cargarlos completos en memoria.
- Un índice en memoria evita recalcular si ningún archivo cambió.
- Los reportes que pide más de una pantalla se calculan una vez por ciclo.
- Las ventanas ocultas dejan de consultar datos.
- El servidor corre en un proceso aparte, así que no frena la mascota.
- Medido en una laptop con Windows 11: la bandeja usa entre 300 y 450 MB de RAM y cerca de 0% de CPU en reposo.

## Configuración

Lo más fácil es la pestaña **Ajustes** del dashboard. También puedes editar el archivo `config.json` a mano. Todos los campos son opcionales y se releen cada 10 segundos.

```json
{
  "name": "Ada",
  "contextLimits": { "Opus 5": 1000000, "Sonnet 5.5": 200000 },
  "activeMinutes": 20,
  "alertAt": 0.85,
  "sources": { "codex": true, "gemini": true, "omniroute": false },
  "omniroute": { "container": "omniroute", "dbPath": "" }
}
```

| Campo | Por defecto | Descripción |
|---|---|---|
| `name` | vacío | Nombre para el saludo de la interfaz. Sin nombre, el saludo no lo incluye. |
| `contextLimits` | `{}` | Límite de contexto por nombre de modelo. Reemplaza la estimación. |
| `activeMinutes` | `20` | Minutos sin actividad antes de dejar de mostrar un chat como activo. |
| `alertAt` | `0.85` | Fracción de contexto que dispara la alerta (entre 0.5 y 0.99). |
| `sources.codex` | `true` | Lee el uso y los límites de Codex. |
| `sources.gemini` | `true` | Lee el uso de Gemini CLI. |
| `sources.omniroute` | `false` | Lee el uso de OmniRoute. |
| `omniroute.container` | `omniroute` | Nombre del contenedor Docker. Solo letras, números, punto, guion y guion bajo (hasta 64). |
| `omniroute.dbPath` | vacío | Ruta de `storage.sqlite`. Con valor, se abre directo y no se usa `docker cp`. |

### Dónde se guarda

| Sistema | Carpeta de datos |
|---|---|
| Windows | `%APPDATA%\ClaudeHub\` |
| macOS | `~/Library/Application Support/ClaudeHub/` |
| Linux | `~/.config/ClaudeHub/` |

### Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor. Por defecto `4317` (`4318` en modo demo). |
| `CLAUDEHUB_DEMO` | Con valor `1`, usa datos ficticios. `pnpm demo` ya lo activa. |
| `CLAUDEHUB_DATA` | Reemplaza la carpeta de datos. |
| `CLAUDE_PROJECTS_DIR` | Carpeta de logs. Por defecto `~/.claude/projects`. |
| `CODEX_SESSIONS_DIR` | Carpeta de sesiones de Codex. Por defecto `~/.codex/sessions`. |
| `GEMINI_TMP_DIR` | Carpeta de chats de Gemini CLI. Por defecto `~/.gemini/tmp`. |
| `CLAUDEHUB_CACHE` | Ruta del caché en disco. |
| `CLAUDEHUB_CONFIG` | Ruta del archivo de configuración. |
| `CLAUDEHUB_WINDOWS` | Ruta del archivo de ventanas reales de contexto. |
| `CLAUDEHUB_PLAN` | Ruta del archivo de límites del plan. |

### Archivos que crea

| Archivo | Uso |
|---|---|
| `cache.json` | Caché de lectura, solo con datos de uso. Se regenera si lo borras. |
| `config.json` | Tu configuración. Se crea al guardar en Ajustes. |
| `context-windows.json` | Ventanas de contexto reales, si activas la línea de estado. |
| `rate-limits.json` | Límites del plan de Claude (5 horas y semanal), si activas la línea de estado o ejecutas `/uso`. |
| `events.jsonl` y `events.1.jsonl` | Eventos del hook de estados. Rota al pasar de 256 KB. |
| `omniroute/` | Copia temporal de la base de OmniRoute, si activas esa fuente. |
| `overlay-pos.json` | Última posición de la mascota. |
| `setup.json` | Marca de que ya se configuró el inicio automático. |
| `tray.pid` | Identificador de la bandeja en ejecución. |
| `electron/` | Datos internos de Electron. |

## API local

Solo responde en `127.0.0.1`. Rechaza con `403` cualquier petición cuyo `Host` no sea `127.0.0.1` o `localhost`, lo que evita ataques de DNS rebinding.

| Ruta | Devuelve |
|---|---|
| `GET /api/summary` | Totales, días activos, hora pico, modelo favorito y mapa de calor. |
| `GET /api/models` | Serie diaria por modelo y tabla de modelos. |
| `GET /api/roles` | Orquestador contra subagentes y tipos de agente. Solo Claude. |
| `GET /api/sessions` | Chats con título, proyecto, fechas y tokens. |
| `GET /api/projects` | Tokens por proyecto. |
| `GET /api/sources` | Por fuente: si está activa, cuántos archivos y registros leyó y si se pudo leer. |
| `GET /api/live` | Última actividad y tokens de hoy. |
| `GET /api/active` | Chats activos de Claude con su uso de contexto y el origen del límite. Además: `plan` (límites de Claude), `plans` (`claude` y `codex`), `agents`, `collisions` y `mascot`. |
| `GET /api/events` | Avisos en vivo por SSE. No lleva datos de uso. |
| `GET /api/config` | Nombre del saludo y si está el modo demo. |
| `GET /api/settings` | Configuración actual, su ruta y los modelos vistos. |
| `PUT /api/settings` | Valida y guarda la configuración. Exige `application/json`. |

Las rutas con rango aceptan `?range=all|30d|7d` o `?from=AAAA-MM-DD&to=AAAA-MM-DD`. Las fechas son locales y ambos extremos se incluyen.

`summary`, `models`, `sessions` y `projects` aceptan además `?source=all|claude|codex|gemini|omniroute`. Un valor desconocido equivale a `all`.

```bash
curl "http://127.0.0.1:4317/api/summary?from=2026-09-20&to=2026-09-30"
curl "http://127.0.0.1:4317/api/models?range=7d&source=codex"
```

### Campos nuevos de `/api/active`

| Campo | Contenido |
|---|---|
| `plans` | `{ claude, codex }`. Cada uno tiene la forma de `plan`, o `null` sin datos vigentes. |
| `agents` | Una entrada por sesión con hook: `source`, `session` (8 caracteres), `project` (solo el nombre de la carpeta), `state`, `since`, `tool` y `stuck`. |
| `collisions` | Carpetas con dos agentes activos a la vez: `project`, `sessions` y `since`. |
| `mascot` | Estado de Chispa: `waiting`, `error`, `alert`, `tool`, `thinking`, `happy` o `sleeping`. |

`plan` se mantiene igual para quien ya lo consume.

### `/api/events`

Flujo SSE sin datos de uso. Envía `hello` al conectar, `changed` cuando cambian los archivos vigilados y un latido cada 25 segundos. Admite 8 clientes a la vez: el noveno recibe `429`. No agrega cabeceras CORS y pasa por el mismo filtro de `Host`.

## Privacidad y seguridad

- El servidor escucha solo en `127.0.0.1`.
- No hay telemetría ni llamadas a servicios externos. La única petición de red es la carga de las fuentes de Google Fonts en la interfaz.
- Se leen solo campos de uso y títulos de chats. No se guardan respuestas ni textos de Codex, Gemini u OmniRoute.
- El caché contiene únicamente datos agregados por mensaje.
- El hook de estados no guarda prompts ni argumentos de herramientas, y sale siempre con código 0 y sin salida.
- `/api/events` no envía datos de uso, admite 8 clientes y no concede CORS.
- OmniRoute se lee con `docker cp` sin shell, con el nombre del contenedor validado, y la copia se abre en solo lectura.
- La escritura de ajustes exige JSON, un origen propio y un cuerpo pequeño, y valida y acota cada valor.
- La ventana de la mascota usa `contextIsolation` y `sandbox`, y solo expone cuatro acciones al proceso de la interfaz.
- El modo demo nunca toca tus registros ni tu configuración.

Para reportar una vulnerabilidad, lee [SECURITY.md](SECURITY.md).

## Estructura del proyecto

```
ClaudeHub/
├─ .github/               CI, plantillas de issues y de pull requests
├─ build/icon.png         icono de la aplicación
├─ scripts/
│  ├─ commands/uso.md     comando /uso para los límites del plan
│  ├─ hook.cjs            hook de estados (escribe events.jsonl)
│  ├─ launch.cjs          lanzador para el hook SessionStart
│  ├─ statusline.cjs      línea de estado y registro de la ventana real
│  └─ write-limits.cjs    guarda los límites del plan que usa /uso
├─ src/
│  ├─ core/               parser, caché, agregación y configuración
│  │  ├─ parse.ts         lectura incremental y deduplicación
│  │  ├─ scan.ts          recorrido de logs y caché
│  │  ├─ sources/         Codex, Gemini y OmniRoute
│  │  ├─ agents.ts        estados de agentes, atascos, choques y mascota
│  │  ├─ overview.ts      campos extra de /api/active
│  │  ├─ aggregate.ts     reportes, rangos y contexto
│  │  ├─ demo.ts          datos ficticios para el modo demo
│  │  ├─ config.ts        configuración validada
│  │  ├─ paths.ts         carpetas de datos por sistema
│  │  ├─ windows.ts       ventanas de contexto reales
│  │  ├─ plan.ts          límites del plan (5 horas y semanal)
│  │  ├─ models.ts        "claude-opus-5-5" -> "Opus 5.5"
│  │  └─ cli.ts           resumen por terminal
│  ├─ server/             API local, archivos estáticos y avisos en vivo
│  │  ├─ index.ts         rutas
│  │  └─ watch.ts         vigilancia de carpetas y SSE
│  ├─ tray/               Electron: bandeja, mascota, alertas
│  └─ web/                React: dashboard, ajustes y mascota
├─ docs/                  logo y capturas del modo demo
├─ test/                  pruebas
├─ AGENTS.md              guía para agentes de IA
└─ LICENSE                MIT
```

## Contribuir

Las contribuciones son bienvenidas. Lee [CONTRIBUTING.md](CONTRIBUTING.md) y el [código de conducta](CODE_OF_CONDUCT.md).

```bash
npx tsc --noEmit && pnpm test && pnpm build
```

El CI corre esas tres comprobaciones en Linux, Windows y macOS.

## Hoja de ruta

- Extensión de Chrome que lea el servidor local.
- Demo pública en línea con datos ficticios.
- Imagen de Docker con `~/.claude` montado en solo lectura.
- Instaladores para macOS (`.dmg`) y Linux (`.AppImage` y `.deb`).
- Firma de código del instalador de Windows.

## Limitaciones conocidas

- La bandeja y la mascota se prueban de forma automática en macOS y Linux, pero solo se usan a diario en Windows 11. En Linux el icono de la bandeja depende del escritorio.
- Sin la línea de estado, el límite de contexto es una estimación.
- El comando `/uso` actualiza los límites de Claude solo al ejecutarlo. Ningún hook puede llamar a `get_usage`.
- Los límites de Codex se leen de sus rollouts y valen mientras no venza la ventana. Solo se actualizan al usar Codex.
- OmniRoute necesita Docker (o `omniroute.dbPath`) y Node con `node:sqlite`. La copia se renueva cada 60 segundos.
- Los estados por hooks necesitan instalar el hook. Sin él, la mascota usa la regla simple de 4 estados.
- El instalador no está firmado.
- El cambio de horario de verano puede desplazar una hora el inicio de los rangos de 7 y 30 días en zonas que lo usan.
- Depende del formato de los registros de Claude Code, que puede cambiar entre versiones.

## Licencia

[MIT](LICENSE) © 2026 Norman Smith Martínez Acevedo.

Código abierto y público: úsalo, modifícalo y compártelo.
