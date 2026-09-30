<div align="center">

<img src="docs/chispa.svg" alt="Chispa, la mascota de ClaudeHub" width="160" />

# ClaudeHub

**Mira a dónde se van tus tokens de Claude Code.**
Un monitor local para Windows: dashboard web, mascota flotante en el escritorio y alertas de contexto.

![Node](https://img.shields.io/badge/Node-26-339933?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![Plataforma](https://img.shields.io/badge/Windows-11-0078D4?logo=windows11&logoColor=white)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)
![Privacidad](https://img.shields.io/badge/datos-100%25%20locales-2ea44f)

<br />

<img src="docs/screenshots/activos.png" alt="Pestaña Activos: chats con su barra de ventana de contexto" width="760" />

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
- [Cómo funciona](#cómo-funciona)
- [Configuración](#configuración)
- [API local](#api-local)
- [Privacidad y seguridad](#privacidad-y-seguridad)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Hoja de ruta](#hoja-de-ruta)
- [Licencia](#licencia)

## Qué es

ClaudeHub lee los registros que Claude Code guarda en tu PC y los convierte en respuestas claras:

- Cuántos tokens gastas y en qué modelo.
- Qué chats consumen más, con su título.
- Cuánto usa el **orquestador** y cuánto usan los **subagentes**.
- Qué tan llena está la **ventana de contexto** de cada chat activo.

Todo corre en tu máquina. Ningún dato sale de ella.

## Pruébalo en 1 minuto

El modo demo no lee ningún archivo tuyo. Usa datos ficticios, con tres chats activos en verde, ámbar y rojo.

```bash
pnpm install
pnpm build
pnpm demo
```

Abre `http://127.0.0.1:4318`.

## Características

| | |
|---|---|
| **Chats activos** | Lista los chats con actividad reciente. Muestra título, proyecto, modelo, subagentes activos y una barra de contexto que pasa de verde a ámbar y a rojo. |
| **Resumen** | Sesiones, mensajes, tokens totales, días activos, hora pico, modelo favorito, mapa de calor por día y porcentaje de aciertos de caché. |
| **Modelos** | Barras apiladas por día, con entrada y salida por modelo. Se ordena por tokens, entrada, salida o nombre. |
| **Orquestador vs Subagentes** | Reparto de tokens entre ambos roles, evolución diaria y ranking de tipos de subagente. |
| **Sesiones y Proyectos** | Tablas ordenables por cualquier columna, con búsqueda por título y filtro por proyecto. |
| **Filtros de fecha** | Todo, 30 días, 7 días o un rango Desde y Hasta. |
| **Mascota flotante** | Un personaje pixel siempre visible. Se arrastra, recuerda su posición y al tocarla abre el panel de chats activos. |
| **Alertas** | Notificación de Windows cuando un chat pasa de 85% de su ventana de contexto. |
| **Bandeja del sistema** | Icono con los tokens de hoy en el tooltip y menú para abrir el dashboard. |
| **Inicio automático** | Arranca con Windows y, si quieres, al iniciar cualquier sesión de Claude Code. |
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
</table>

## La mascota

**Chispa** es un personaje original, dibujado en una cuadrícula de 14 x 12 píxeles. Cambia de estado según lo que pasa en tus chats.

<table>
  <tr>
    <td valign="top">

| Estado | Cuándo aparece |
|---|---|
| Durmiendo | No hay chats activos. |
| Despierta | Hay chats abiertos, pero ninguno escribe ahora. |
| Trabajando | Un chat escribió en el último minuto. |
| Alerta | Algún chat superó el umbral de contexto. |

Al tocarla se abre el panel de chats activos. Si abres el dashboard desde ahí, la mascota se oculta y vuelve cuando lo cierras.

</td>
    <td><img src="docs/screenshots/mascota.png" alt="Panel de la mascota con chats activos" width="300" /></td>
  </tr>
</table>

## Instalación

### Requisitos

- Windows 11.
- [Node.js](https://nodejs.org) 26 (versión con la que se desarrolló).
- [pnpm](https://pnpm.io) 11.
- Claude Code instalado y con historial en `~/.claude/projects`.

### Pasos

```bash
git clone https://github.com/NormanSMA/ClaudeHub.git
cd ClaudeHub
pnpm install
pnpm build
```

## Instalar con una IA

Copia este texto y pégalo en Claude Code, o en cualquier agente de IA con acceso a tu terminal.

````text
Instala y ejecuta ClaudeHub, un monitor local de tokens de Claude Code, en mi Windows.
Repositorio: https://github.com/NormanSMA/ClaudeHub

1. Clónalo en la carpeta que prefieras y entra en ella.
2. Verifica Node 26 o superior y pnpm 11 con `node -v` y `pnpm -v`. Si falta alguno, dime cómo instalarlo.
3. Ejecuta `pnpm install` y `pnpm build`.
4. Ejecuta `pnpm test` y confirma que pasan.
5. Prueba el modo demo con `pnpm demo` y abre http://127.0.0.1:4318. Usa datos ficticios. Cuando termines, detén el proceso.
6. Ejecuta `pnpm start` y comprueba que http://127.0.0.1:4317/api/summary?range=7d devuelve JSON con mis tokens.
7. Ejecuta `pnpm tray` para abrir la bandeja y la mascota flotante.
8. Pregúntame antes de editar ~/.claude/settings.json. Si acepto, agrega el hook SessionStart de la sección "Abrir al iniciar Claude Code" del README, con la ruta real del proyecto, sin borrar mis hooks actuales.
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

Inicia la bandeja, la mascota y el servidor local si no está activo. La primera vez activa el inicio con Windows. Puedes cambiarlo en el menú del icono de la bandeja.

### Abrir al iniciar Claude Code

ClaudeHub se puede lanzar solo con un hook `SessionStart` en `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"C:\\ruta\\a\\ClaudeHub\\scripts\\launch.cjs\""
          }
        ]
      }
    ]
  }
}
```

El lanzador no imprime nada, porque la salida de un hook `SessionStart` se agrega al contexto de Claude. Si la bandeja ya corre, no hace nada.

### Menú de la bandeja

- **Abrir dashboard**: ventana de 780 x 660.
- **Abrir en el navegador**: la misma interfaz en tu navegador.
- **Mostrar mascota**: muestra u oculta a Chispa.
- **Iniciar con Windows**: activa o desactiva el arranque automático.
- **Salir**.

### Scripts

| Comando | Qué hace |
|---|---|
| `pnpm demo` | Servidor con datos ficticios en `http://127.0.0.1:4318`. |
| `pnpm start` | Servidor con tus datos en `http://127.0.0.1:4317`. |
| `pnpm tray` | Abre la bandeja y la mascota con Electron. |
| `pnpm dev` | Servidor con recarga y Vite en `http://127.0.0.1:5173`. |
| `pnpm build` | Compila la interfaz en `dist/`. |
| `pnpm scan` | Imprime un resumen en la terminal, sin interfaz. |
| `pnpm test` | Ejecuta las pruebas con Vitest. |

## Cómo funciona

```
~/.claude/projects/<proyecto>/<sesion>.jsonl                     orquestador
~/.claude/projects/<proyecto>/<sesion>/subagents/agent-*.jsonl   subagentes
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

### Reglas de conteo

- **Total de tokens** = entrada + escritura de caché + lectura de caché + salida.
- **Deduplicación por `message.id`.** Los registros repiten un mismo mensaje en varias líneas, una por bloque de contenido. ClaudeHub cuenta cada mensaje una sola vez. En un archivo de prueba, 569 de 1383 líneas eran repetidas.
- **Orquestador o subagente.** Un mensaje es de subagente si está en una carpeta `subagents/` o trae `isSidechain: true`. El tipo sale del archivo `.meta.json` de cada agente.
- **Proyectos.** Los worktrees de Git (`--claude-worktrees-*`) se agrupan bajo su proyecto base.
- **Días y horas** usan la zona horaria local.

### Ventana de contexto

El contexto en uso de un chat es la entrada del último mensaje del orquestador: `entrada + escritura de caché + lectura de caché`.

Los registros no dicen cuál es el límite de cada modelo. ClaudeHub lo estima:

- Hasta 200 000 tokens se asume una ventana de 200 000.
- Si el chat ya superó 200 000, se asume 1 000 000.

Los límites estimados llevan un asterisco en la interfaz. Puedes fijarlos en la configuración.

### Rendimiento

- La lectura es **incremental**: guarda cuántos bytes leyó de cada archivo y procesa solo lo nuevo.
- Los archivos grandes se leen por bloques de 8 MB, sin cargarlos completos en memoria.
- Un índice en memoria evita recalcular si ningún archivo cambió.
- Los reportes que pide más de una pantalla se calculan una vez por ciclo.
- Las ventanas ocultas dejan de consultar datos.
- Medido en una laptop con Windows 11: la bandeja usa unos 313 MB de RAM y menos de 1% de CPU. El servidor usa alrededor de 100 MB.

## Configuración

Crea `%APPDATA%\ClaudeHub\config.json`. Todos los campos son opcionales y se releen cada 10 segundos.

```json
{
  "name": "Ada",
  "contextLimits": { "Opus 5": 1000000, "Sonnet 5.5": 200000 },
  "activeMinutes": 20,
  "alertAt": 0.85
}
```

| Campo | Por defecto | Descripción |
|---|---|---|
| `name` | vacío | Nombre para el saludo de la interfaz. Sin nombre, el saludo no lo incluye. |
| `contextLimits` | `{}` | Límite de contexto por nombre de modelo. Reemplaza la estimación. |
| `activeMinutes` | `20` | Minutos sin actividad antes de dejar de mostrar un chat como activo. |
| `alertAt` | `0.85` | Fracción de contexto que dispara la alerta. |

### Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor. Por defecto `4317` (`4318` en modo demo). |
| `CLAUDEHUB_DEMO` | Con valor `1`, usa datos ficticios. `pnpm demo` ya lo activa. |
| `CLAUDE_PROJECTS_DIR` | Carpeta de logs. Por defecto `~/.claude/projects`. |
| `CLAUDEHUB_CACHE` | Ruta del caché en disco. |
| `CLAUDEHUB_CONFIG` | Ruta del archivo de configuración. |

### Archivos que crea

Todo está en `%APPDATA%\ClaudeHub\`:

| Archivo | Uso |
|---|---|
| `cache.json` | Caché de lectura, solo con datos de uso. Se regenera si lo borras. |
| `config.json` | Tu configuración. Lo creas tú. |
| `overlay-pos.json` | Última posición de la mascota. |
| `setup.json` | Marca de que ya se configuró el inicio con Windows. |
| `tray.pid` | Identificador de la bandeja en ejecución. |
| `electron\` | Datos internos de Electron. |

## API local

Solo responde en `127.0.0.1`. Rechaza con `403` cualquier petición cuyo `Host` no sea `127.0.0.1` o `localhost`, lo que evita ataques de DNS rebinding.

| Ruta | Devuelve |
|---|---|
| `GET /api/summary` | Totales, días activos, hora pico, modelo favorito y mapa de calor. |
| `GET /api/models` | Serie diaria por modelo y tabla de modelos. |
| `GET /api/roles` | Orquestador contra subagentes y tipos de agente. |
| `GET /api/sessions` | Chats con título, proyecto, fechas y tokens. |
| `GET /api/projects` | Tokens por proyecto. |
| `GET /api/live` | Última actividad y tokens de hoy. |
| `GET /api/active` | Chats activos con su uso de contexto. |
| `GET /api/config` | Nombre del saludo y si está el modo demo. |

Las rutas con rango aceptan `?range=all|30d|7d` o `?from=AAAA-MM-DD&to=AAAA-MM-DD`. Las fechas son locales y ambos extremos se incluyen.

```bash
curl "http://127.0.0.1:4317/api/summary?from=2026-09-20&to=2026-09-30"
```

## Privacidad y seguridad

- El servidor escucha solo en `127.0.0.1`.
- No hay telemetría ni llamadas a servicios externos. La única petición de red es la carga de las fuentes de Google Fonts en la interfaz.
- Se leen solo campos de uso y títulos de chats. No se guardan respuestas.
- El caché contiene únicamente datos agregados por mensaje.
- La ventana de la mascota usa `contextIsolation` y `sandbox`, y solo expone cuatro acciones al proceso de la interfaz.
- El modo demo nunca toca tus registros.

## Estructura del proyecto

```
ClaudeHub/
├─ scripts/
│  └─ launch.cjs          lanzador para el hook SessionStart
├─ src/
│  ├─ core/               parser, caché, agregación y configuración
│  │  ├─ parse.ts         lectura incremental y deduplicación
│  │  ├─ scan.ts          recorrido de logs y caché
│  │  ├─ aggregate.ts     reportes, rangos y contexto
│  │  ├─ demo.ts          datos ficticios para el modo demo
│  │  ├─ models.ts        "claude-opus-5-5" -> "Opus 5.5"
│  │  ├─ config.ts        config.json
│  │  └─ cli.ts           resumen por terminal
│  ├─ server/index.ts     API local y archivos estáticos
│  ├─ tray/               Electron: bandeja, mascota, alertas
│  └─ web/                React: dashboard y mascota
├─ docs/                  logo y capturas del modo demo
├─ test/parse.test.ts     pruebas
├─ AGENTS.md              guía para agentes de IA
└─ LICENSE                MIT
```

### Pruebas

```bash
pnpm test
```

Cubren la deduplicación por `message.id`, la separación entre orquestador y subagentes, la lectura incremental, los totales, los nombres de modelo y los títulos de chat.

## Hoja de ruta

- Extensión de Chrome que lea el servidor local.
- Demo pública en línea con datos ficticios.
- Imagen de Docker con `~/.claude` montado en solo lectura.

## Limitaciones conocidas

- Solo probado en Windows 11. La bandeja y la mascota son de Windows.
- El límite de contexto es una estimación hasta que lo fijes en `config.json`.
- El cambio de horario de verano puede desplazar una hora el inicio de los rangos de 7 y 30 días en zonas que lo usan.
- Depende del formato de los registros de Claude Code, que puede cambiar entre versiones.

## Licencia

[MIT](LICENSE) © 2026 Norman Smith Martínez Acevedo.

Código abierto y público: úsalo, modifícalo y compártelo.
