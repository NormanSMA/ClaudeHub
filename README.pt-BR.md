<div align="center">

<img src="docs/chispa.svg" alt="Chispa, o mascote do ClaudeHub" width="160" />

# ClaudeHub

**Veja para onde seus tokens do Claude Code vão.**
Um monitor local para Windows, macOS e Linux: dashboard web, mascote flutuante na área de trabalho e alertas de contexto.

[Español](README.md) · [English](README.en.md) · **Português**

[![CI](https://github.com/NormanSMA/ClaudeHub/actions/workflows/ci.yml/badge.svg)](https://github.com/NormanSMA/ClaudeHub/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/NormanSMA/ClaudeHub)](https://github.com/NormanSMA/ClaudeHub/releases/latest)
![Node](https://img.shields.io/badge/Node-24%2B-339933?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![Plataformas](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-informational)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)
![Privacidade](https://img.shields.io/badge/dados-100%25%20locais-2ea44f)

<br />

<img src="docs/screenshots/escritorio.png" alt="ClaudeHub na área de trabalho: dashboard e mascote com o painel de chats ativos" width="860" />

<sub>Capturas do modo demo: todos os dados são fictícios.</sub>

</div>

---

## Conteúdo

- [O que é](#o-que-é)
- [Experimente em 1 minuto](#experimente-em-1-minuto)
- [Recursos](#recursos)
- [O mascote](#o-mascote)
- [Instalação](#instalação)
- [Instalar com uma IA](#instalar-com-uma-ia)
- [Uso](#uso)
- [Limite real de contexto](#limite-real-de-contexto)
- [Limites do seu plano](#limites-do-seu-plano-5-horas-e-semanal)
- [Outras fontes: Codex, Gemini e OmniRoute](#outras-fontes-codex-gemini-e-omniroute)
- [Estados por hooks](#estados-por-hooks)
- [Atualização ao vivo](#atualização-ao-vivo)
- [Como funciona](#como-funciona)
- [Configuração](#configuração)
- [API local](#api-local)
- [Privacidade e segurança](#privacidade-e-segurança)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Contribuir](#contribuir)
- [Roteiro](#roteiro)
- [Licença](#licença)

## O que é

ClaudeHub lê os registros que Claude Code salva no seu PC e os converte em respostas claras:

- Quantos tokens você gasta e em qual modelo.
- Quais chats consomem mais, com seu título.
- Quanto o **orquestrador** usa e quanto os **subagentes** usam.
- Quão cheia está a **janela de contexto** de cada chat ativo.
- Quanto **Codex**, **Gemini CLI** e **OmniRoute** também gastam, com um filtro por fonte.
- Quais agentes trabalham agora, quais esperam uma permissão e se dois pisam na mesma pasta.

Tudo funciona na sua máquina. Nenhum dado sai dela.

## Experimente em 1 minuto

O modo demo não lê nenhum arquivo seu nem sua configuração. Usa dados fictícios, com três chats ativos em verde, âmbar e vermelho.

```bash
pnpm install
pnpm build
pnpm demo
```

Abra `http://127.0.0.1:4318`.

## Recursos

| | |
|---|---|
| **Agentes** | Aba inicial. Lista os chats do Claude com atividade recente (título, projeto, modelo, subagentes ativos e uma barra de contexto que vai de verde para âmbar e para vermelho), os limites do Claude e do Codex, e os agentes ao vivo com seu estado, travamentos e choques. |
| **Resumo** | Sessões, mensagens, tokens totais, dias ativos, hora de pico, modelo favorito, mapa de calor diário e percentual de acertos de cache. Inclui **Orquestrador vs Subagentes**: distribuição de tokens entre ambos os papéis, evolução diária e ranking de tipos de subagente. |
| **Modelos** | Barras empilhadas por dia, com entrada e saída por modelo. Ordena por tokens, entrada, saída ou nome. |
| **Sessões e Projetos** | Tabelas ordenáveis por qualquer coluna, com busca por título e filtro por projeto. |
| **Fontes** | Seletor Todas, Claude, Codex, Gemini ou OmniRoute para Resumo, Modelos, Sessões e Projetos. Cada fonte mostra se pôde ser lida. |
| **Ao vivo** | O dashboard se atualiza sozinho quando os arquivos mudam, sem esperar a consulta periódica. |
| **Ajustes** | Edite seu nome, limiar de alerta, minutos de atividade e janela de contexto de cada modelo, sem tocar em arquivos. |
| **Filtros de data** | Tudo, 30 dias, 7 dias ou um intervalo De e Até customizado. |
| **Mascote flutuante** | Um personagem de pixel sempre visível. Arrasta, lembra sua posição e abre o painel de chats ativos ao ser tocado. |
| **Limites do plano** | Seu limite de 5 horas e limite semanal como percentual, mostrando quanto tempo falta para reiniciar, para o Claude (planos Pro e Max) e para o Codex. |
| **Estados por hooks** | Um hook opcional anota se cada agente pensa, usa uma ferramenta, espera uma permissão ou falhou. Alimenta a aba **Agentes** e o mascote. |
| **Comando `/uso`** | Salva os limites do Claude a partir do app de desktop, onde a linha de status não roda. |
| **Alertas** | Notificação do sistema quando um chat ou seu limite de 5 horas excede o limiar (85% por padrão). |
| **Bandeja do sistema** | Ícone com os tokens de hoje na dica de ferramenta e menu para abrir o dashboard. |
| **Linha de status** | Script opcional que mostra `ctx 43% \| 5h 51%` no Claude Code e dá ao ClaudeHub o tamanho real da janela e seus limites de plano. |
| **Inicialização automática** | Inicia com o sistema e, se quiser, ao iniciar qualquer sessão do Claude Code. |
| **Tema** | Escuro, claro ou automático, com a paleta terracota do Claude. |
| **Links de visualização** | A aba fica na URL (`#/modelos`), para que você possa vinculá-la. |

<table>
  <tr>
    <td><img src="docs/screenshots/resumen.png" alt="Resumo com mapa de calor" /></td>
    <td><img src="docs/screenshots/modelos.png" alt="Modelos por dia" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Resumo e mapa de calor</sub></td>
    <td align="center"><sub>Tokens por modelo e por dia</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/roles.png" alt="Resumo: orquestrador contra subagentes (só Claude)" /></td>
    <td><img src="docs/screenshots/sesiones.png" alt="Sessões ordenáveis com filtros" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Resumo com Orquestrador vs Subagentes</sub></td>
    <td align="center"><sub>Sessões com título, ordem e filtros</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/ajustes.png" alt="Aba de ajustes" /></td>
    <td><img src="docs/screenshots/agentes.png" alt="Agentes: limites por fonte e agentes ao vivo" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Ajustes dentro do dashboard</sub></td>
    <td align="center"><sub>Agentes, limites por fonte e chats ativos</sub></td>
  </tr>
</table>

## O mascote

**Chispa** é um personagem original, desenhado em uma grade de 14 x 12 pixels. Muda de estado conforme o que acontece em seus chats.

Com o [hook de estados](#estados-por-hooks) instalado, Chispa tem 7 estados. Se vários se aplicam, vale o primeiro desta tabela:

<table>
  <tr>
    <td valign="top">

| Estado | Quando aparece |
|---|---|
| Esperando | Um agente espera que você aprove uma permissão. |
| Erro | Uma ferramenta ou a resposta de um agente falhou. |
| Alerta | Dois agentes ativos na mesma pasta, um agente travado ou um limite acima do limiar. |
| Ferramenta | Um agente executa uma ferramenta. |
| Pensando | Um agente pensa ou inicia uma sessão. |
| Feliz | Um agente terminou há menos de 10 segundos. |
| Dormindo | Não há nada a mostrar. |

Um agente conta como travado após 5 minutos pensando ou 15 minutos em uma ferramenta. Dois agentes colidem se trabalham 10 segundos ou mais na mesma pasta.

Sem o hook vale a regra simples: dormindo (sem chats ativos), acordado (há chats, nenhum escreve), trabalhando (um chat escreveu no último minuto) e alerta (um chat ou seu limite de 5 horas excedeu o limiar).

Se um agente do Codex trabalha (segundo o hook), Chispa mostra um selo do Codex. Não é um segundo mascote.

Toque nele para abrir o painel de chats ativos. Se abrir o dashboard a partir daí, o mascote se oculta e volta quando você o fecha.

</td>
    <td><img src="docs/screenshots/mascota.png" alt="Painel do mascote com chats ativos" width="300" /></td>
  </tr>
</table>

## Instalação

### Plataformas

| Sistema | Dashboard, demo e API | Bandeja, mascote e alertas |
|---|---|---|
| Windows 11 | Testado | Testado (uso diário) |
| macOS | Testado em CI e à mão | Testado em CI e à mão (macOS 27, Apple Silicon) |
| Linux | Testado em CI e em Docker | Testado em CI e em Docker com tela virtual |

Testado à mão no macOS 27 (Apple Silicon, Node 26, Electron 44): bandeja, mascote com seu painel e dashboard abrem e funcionam. Capturas do modo demo:

<p align="center"><img src="docs/screenshots/macos-mascota.png" alt="ClaudeHub no macOS: painel do mascote" width="420" /> <img src="docs/screenshots/macos-dashboard.png" alt="ClaudeHub no macOS: dashboard" width="420" /></p>

Os testes de macOS e Linux são automáticos: o CI inicia o aplicativo completo, abre o dashboard, verifica que o mascote e o dashboard estão visíveis e fecha por **Sair**. Eles não substituem um teste manual na sua área de trabalho. No Linux o ícone da bandeja depende do ambiente de desktop (o GNOME precisa da extensão AppIndicator) e as notificações precisam de um serviço de notificações.

O instalador `.exe` é só para Windows. No macOS e no Linux, use-o a partir do código (`pnpm tray`).

### Opção A: instalador do Windows

Baixe `ClaudeHub-Setup-x.y.z.exe` de [Releases](https://github.com/NormanSMA/ClaudeHub/releases/latest) e abra-o. Você não precisa de Node nem pnpm.

> O instalador ainda não está assinado com código. O Windows SmartScreen pode avisar: clique em **Mais informações** e depois em **Executar mesmo assim**.

Instala apenas para seu usuário, sem solicitar permissão de administrador. Para desinstalar, use **Configurações > Aplicativos**.

### Opção B: a partir do código

Requisitos:

- [Node.js](https://nodejs.org) 24 ou superior.
- [pnpm](https://pnpm.io) 11.
- Claude Code instalado e com histórico em `~/.claude/projects`.

```bash
git clone https://github.com/NormanSMA/ClaudeHub.git
cd ClaudeHub
pnpm install
pnpm build
```

Para gerar seu próprio instalador: `pnpm dist`. O resultado fica em `release/`.

## Instalar com uma IA

Copie este texto e cole-o no Claude Code, ou em qualquer agente de IA com acesso ao seu terminal.

````text
Instale e execute ClaudeHub, um monitor local para tokens do Claude Code.
Repositório: https://github.com/NormanSMA/ClaudeHub

1. Clone-o em uma pasta que preferir e entre nela.
2. Verifique Node 24 ou superior e pnpm 11 com `node -v` e `pnpm -v`. Se algum estiver faltando, diga-me como instalá-lo.
3. Execute `pnpm install` e `pnpm build`.
4. Execute `pnpm test` e confirme que passam.
5. Experimente o modo demo com `pnpm demo` e abra http://127.0.0.1:4318. Usa dados fictícios. Quando terminar, pare o processo.
6. Execute `pnpm start` e verifique se http://127.0.0.1:4317/api/summary?range=7d retorna JSON com meus tokens.
7. Execute `pnpm tray` para abrir a bandeja e o mascote flutuante.
8. Pergunte-me antes de editar ~/.claude/settings.json. Se eu concordar, adicione o hook SessionStart e a linha de status das seções "Abrir ao iniciar Claude Code" e "Limite real de contexto" do README, com os caminhos reais do projeto, sem remover minhas configurações atuais.
9. Quando terminar, diga-me meus tokens dos últimos 7 dias e quais chats estão ativos, usando /api/summary e /api/active.

Veja AGENTS.md no repositório para mais detalhes.
````

O arquivo [`AGENTS.md`](AGENTS.md) explica a um agente como instalar, executar e consultar a API.

## Uso

### Apenas dashboard

```bash
pnpm start
```

Abra `http://127.0.0.1:4317`.

### Bandeja e mascote

```bash
pnpm tray
```

Inicia a bandeja, o mascote e o servidor local se não estiver em execução. A primeira vez ativa o inicializar com o sistema. Você pode mudá-lo no menu do ícone da bandeja.

Com o instalador, abra **ClaudeHub** no menu Iniciar.

### Abrir ao iniciar Claude Code

ClaudeHub pode ser iniciado apenas com um hook `SessionStart` em `~/.claude/settings.json`.

A partir do código:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node \"C:\\caminho\\para\\ClaudeHub\\scripts\\launch.cjs\"" }
        ]
      }
    ]
  }
}
```

No macOS e no Linux o caminho usa barras normais, por exemplo `node "/home/ada/ClaudeHub/scripts/launch.cjs"`.

Com o instalador do Windows, aponte para o executável:

```json
{ "type": "command", "command": "\"C:\\Users\\<seu-usuário>\\AppData\\Local\\Programs\\ClaudeHub\\ClaudeHub.exe\" --background" }
```

O inicializador não produz saída, porque a saída de um hook `SessionStart` é adicionada ao contexto do Claude. Se a bandeja já está em execução, não faz nada.

### Menu da bandeja

- **Abrir dashboard**: janela de 780 x 660.
- **Abrir no navegador**: a mesma interface no seu navegador.
- **Mostrar mascote**: mostra ou oculta Chispa.
- **Iniciar com o sistema**: ativa ou desativa o inicializar automático.
- **Sair**.

### Scripts

| Comando | O que faz |
|---|---|
| `pnpm demo` | Servidor com dados fictícios em `http://127.0.0.1:4318`. |
| `pnpm start` | Servidor com seus dados em `http://127.0.0.1:4317`. |
| `pnpm tray` | Abre a bandeja e o mascote com Electron. |
| `pnpm dev` | Servidor com recarga e Vite em `http://127.0.0.1:5173`. |
| `pnpm build` | Compila a interface para `dist/`. |
| `pnpm build:server` | Empacota o servidor em `dist-server/server.cjs`. |
| `pnpm dist` | Gera o instalador do Windows em `release/`. |
| `pnpm scan` | Imprime um resumo no terminal, sem interface. |
| `pnpm test` | Executa testes com Vitest. |

## Limite real de contexto

Os registros do Claude Code não dizem qual é a janela de contexto de cada modelo. Por padrão, ClaudeHub a **estima** (os números têm um asterisco).

Para usar o valor **real**, ative a linha de status do ClaudeHub. Claude Code passa a esse script o tamanho da janela de cada sessão, e ClaudeHub o salva e usa.

Adicione isto a `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"C:\\caminho\\para\\ClaudeHub\\scripts\\statusline.cjs\""
  }
}
```

Além de salvar o tamanho, o script mostra na barra de status do Claude Code uma linha como:

```
[Opus] ctx 43% (430k/1.0M) | 5h 51% | 7d 33%
```

A cor muda para amarelo a partir de 60% e para vermelho a partir de 85%.

Ordem de prioridade do limite:

1. Tamanho real registrado pela linha de status.
2. Valor definido na aba **Ajustes** (ou em `config.json`).
3. Estimativa: até 200.000 tokens assume uma janela de 200.000; se o chat já a excedeu, 1.000.000.

Se você já tem sua própria linha de status, peça ao seu script para chamar `statusline.cjs` passando o mesmo JSON na entrada padrão.

## Limites do seu plano (5 horas e semanal)

Com a linha de status habilitada, ClaudeHub mostra seus limites de uso, os mesmos que você vê em **Limites de uso do plano** no Claude:

- **Limite de 5 horas:** percentual usado e quanto tempo falta para reiniciar.
- **Semanal:** o mesmo para a janela de 7 dias.
- **Tokens na janela:** quantos tokens do Claude Code desta máquina cabem em cada janela.

Aparecem na aba **Agentes** e no painel do mascote. Se seu limite de 5 horas exceder o limiar de alerta, o mascote o alerta e o sistema notifica você uma vez por janela.

Coisas que você deve saber:

- Claude Code só envia esses dados para assinantes **Pro e Max**, e apenas após a primeira resposta da sessão.
- Anthropic calcula o percentual e inclui todo o seu uso do plano, também web e apps. Os tokens do ClaudeHub contam apenas Claude Code nesta máquina, então os totais não correspondem.
- Os dados são atualizados cada vez que Claude Code executa a linha de status, por exemplo ao enviar uma mensagem. Se passarem mais de 15 minutos sem atividade, ClaudeHub notifica você. Uma janela expirada se oculta.
- Sem a linha de status nem o comando `/uso`, ClaudeHub não pode ler esses limites: eles não aparecem nos registros.
- **O app de desktop do Claude não executa a linha de status**: é um recurso do terminal. Se você usa o Claude Code só pelo app de desktop, use o comando `/uso` (próxima seção). Você também pode usar `claude` em um terminal com sua conta logada (`/login`). O percentual é de toda a sua conta, então uma mensagem no terminal atualiza o dado, que fica parado até a próxima mensagem no terminal.

### Limites a partir do app de desktop: comando `/uso`

O comando `/uso` chama a ferramenta `get_usage` do Claude Code e salva as duas janelas em `rate-limits.json` com `scripts/write-limits.cjs`. O script valida os percentuais (0 a 100) e as datas de reinício antes de escrever.

Instale-o uma vez:

1. Copie `scripts/commands/uso.md` para `~/.claude/commands/uso.md`.
2. Substitua `<ruta-de-ClaudeHub>` pela pasta onde você clonou o projeto.

Execute `/uso` em uma sessão do Claude Code. Mostra o percentual e a hora de reinício de cada janela. Se `get_usage` não devolve uma janela, o comando a omite e mantém a salva enquanto não tiver expirado.

Os dados são atualizados apenas quando você executa `/uso`. Nenhum hook pode chamar `get_usage`.

## Outras fontes: Codex, Gemini e OmniRoute

Além do Claude Code, ClaudeHub lê o uso de três fontes. A rota `/api/sources` indica se cada uma pôde ser lida.

| Fonte | De onde lê | O que lê |
|---|---|---|
| Codex | `~/.codex/sessions/AAAA/MM/DD/rollout-*.jsonl` | Tokens por sessão (o aumento do acumulado), modelo, pasta de trabalho e limites do plano (`rate_limits`). |
| Gemini CLI | `~/.gemini/tmp/<projeto>/chats/session-*.jsonl` | Tokens por mensagem do Gemini (sem repetidas, por `id`) e modelo. O projeto vem do nome da pasta. |
| OmniRoute | A tabela `usage_history` do seu banco `storage.sqlite` | Provedor, modelo e tokens (entrada, saída, cache, raciocínio) por chamada. |

Apenas campos de uso são lidos. Os textos das conversas, dos pensamentos e das instruções nunca são lidos nem salvos.

### Codex e Gemini

Estão ativas por padrão. Se você não tem a pasta, a fonte fica vazia sem erro. Você pode desativá-las com `sources.codex` e `sources.gemini` em `config.json`.

Os limites do Codex vêm do `rate_limits` mais recente dos 5 rollouts modificados por último. Valem enquanto a janela não tiver vencido: uma janela com o reinício já passado se oculta. Só se atualizam ao usar o Codex.

### OmniRoute

OmniRoute roda em um contêiner Docker e sua API de uso pede sessão do painel, então ClaudeHub lê seu banco em somente leitura:

1. A cada 60 segundos executa `docker cp` (sem shell) para copiar `storage.sqlite`, e `-wal` e `-shm` se existirem, do contêiner para `omniroute/` dentro da pasta de dados.
2. Abre a cópia com `node:sqlite` em somente leitura, a valida com `PRAGMA quick_check` e lê apenas a tabela `usage_history`.
3. Se a cópia sair danificada, tenta de novo. Se falhar, mantém a leitura anterior e marca a fonte como desatualizada.

Está desativada por padrão. Ative-a com `sources.omniroute: true`. Sem Docker ou sem o contêiner, a fonte fica com erro e o resto continua funcionando.

Se você monta o banco no seu disco, defina `omniroute.dbPath` com o caminho de `storage.sqlite` e ClaudeHub o abre direto, sem `docker cp`.

## Estados por hooks

O script `scripts/hook.cjs` anota cada evento de um agente em `events.jsonl` (pasta de dados). É opcional. Sem ele, a aba **Agentes** e o mascote usam a regra simples.

Cada linha tem este formato e pesa no máximo 512 bytes:

```json
{"v":1,"ts":1760000000000,"source":"claude","session":"<id>","event":"PreToolUse","state":"tool","tool":"Edit","cwd":"<pasta>"}
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

Garantias do script:

- Sai sempre com código 0 e não escreve nada na saída padrão nem na de erro. Uma saída ou o código 2 poderiam bloquear o agente.
- Termina em menos de 1 segundo, mesmo que a entrada chegue vazia ou quebrada.
- Não salva o prompt, `tool_input` nem a saída das ferramentas. Só o evento, o nome da ferramenta e a pasta.
- Rotaciona `events.jsonl` para `events.1.jsonl` ao passar de 256 KB.

### Instalar o hook

Peça confirmação antes de editar `~/.claude/settings.json`. Mantenha os hooks que já existam, incluindo o `SessionStart` do inicializador: adicione um bloco novo a cada lista.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node \"C:\\caminho\\para\\ClaudeHub\\scripts\\hook.cjs\" claude" } ] }
    ],
    "PreToolUse": [
      { "hooks": [ { "type": "command", "command": "node \"C:\\caminho\\para\\ClaudeHub\\scripts\\hook.cjs\" claude" } ] }
    ]
  }
}
```

Repita o mesmo bloco com os demais eventos da tabela. Para o Codex use o argumento `codex` em vez de `claude`, nos eventos que sua versão do Codex aceite na configuração de hooks.

## Atualização ao vivo

O servidor vigia `~/.claude/projects`, `~/.codex/sessions`, `~/.gemini/tmp` e a pasta de dados. Agrupa as mudanças em rajadas de 500 ms e avisa o dashboard e o mascote por `/api/events`. Só contam os arquivos `.jsonl`, `.json` e `.sqlite`. As pastas que não existem são tentadas de novo a cada 60 segundos.

A interface mantém uma consulta periódica de reserva. Com o aviso ao vivo aberto, a consulta passa a um ciclo de 60 segundos no mínimo. Se o aviso falhar, volta ao ciclo normal.

### Aviso de limite atingido

Isso não precisa da linha de status. Quando você atinge um limite, o Claude Code o registra nos logs com o horário exato de reinício. O ClaudeHub lê esse registro e mostra um aviso vermelho, por exemplo **Limite de 5 horas atingido. Reinicia em 1 h 12 min**, além de uma notificação do sistema e do mascote em alerta. Também funciona com o app de desktop.

## Como funciona

```
~/.claude/projects/<projeto>/<sessão>.jsonl                     orquestrador
~/.claude/projects/<projeto>/<sessão>/subagents/agent-*.jsonl   subagentes
~/.codex/sessions, ~/.gemini/tmp, OmniRoute (opcional)           outras fontes
<dados>/events.jsonl                                             hook de estados
                     |
                     v
            src/core  (parser + agregação)
                     |
                     v
        src/server  (API local em 127.0.0.1:4317)
            |                        |
            v                        v
     src/web (React)          src/tray (Electron)
   dashboard e mascote       bandeja, janela e alertas
```

### O que é lido de cada registro

Apenas campos de uso: modelo, tokens (entrada, escrita e leitura de cache, saída), data, pasta de trabalho, sessão, título do chat e último prompt para nomeá-lo se não tiver título. Respostas não são salvas ou exibidas.

Do Codex, Gemini e OmniRoute apenas campos de uso são lidos (veja [Outras fontes](#outras-fontes-codex-gemini-e-omniroute)). Do hook se salva o evento, o estado, a ferramenta e a pasta, nunca o texto do usuário.

### Regras de contagem

- **Tokens totais** = entrada + escrita de cache + leitura de cache + saída.
- **Deduplicação por `message.id`.** Registros repetem a mesma mensagem em várias linhas, uma por bloco de conteúdo. ClaudeHub conta cada mensagem uma vez. Em um arquivo de teste, 569 de 1.383 linhas eram repetidas.
- **Orquestrador ou subagente.** Uma mensagem é subagente se está em uma pasta `subagents/` ou tem `isSidechain: true`. O tipo vem do arquivo `.meta.json` de cada agente.
- **Projetos.** Worktrees do Git (`--claude-worktrees-*`) são agrupadas sob seu projeto base. Funciona com caminhos do Windows, macOS e Linux.
- **Dias e horas** usam o fuso horário local.

### Janela de contexto

O contexto em uso de um chat é a entrada da última mensagem do orquestrador: `entrada + escrita de cache + leitura de cache`. O limite vem de [Limite real de contexto](#limite-real-de-contexto).

### Desempenho

- A leitura é **incremental**: salva quantos bytes leu de cada arquivo e processa apenas o novo.
- Arquivos grandes são lidos em chunks de 8 MB, não carregados totalmente na memória.
- Um índice na memória evita recalcular se nenhum arquivo mudou.
- Relatórios que ocupam mais de uma tela são calculados uma vez por ciclo.
- Janelas ocultas param de consultar dados.
- O servidor funciona em um processo separado, para não desacelerar o mascote.
- Medido em um laptop com Windows 11: a bandeja usa entre 300 e 450 MB de RAM e cerca de 0% de CPU em repouso.

## Configuração

A forma mais fácil é a aba **Ajustes** do dashboard. Você também pode editar o arquivo `config.json` manualmente. Todos os campos são opcionais e relidos a cada 10 segundos.

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

| Campo | Padrão | Descrição |
|---|---|---|
| `name` | vazio | Nome para a saudação da interface. Sem nome, a saudação não o inclui. |
| `contextLimits` | `{}` | Limite de contexto por nome de modelo. Substitui a estimativa. |
| `activeMinutes` | `20` | Minutos sem atividade antes de um chat parar de ser mostrado como ativo. |
| `alertAt` | `0.85` | Fração de contexto que dispara o alerta (entre 0,5 e 0,99). |
| `sources.codex` | `true` | Lê o uso e os limites do Codex. |
| `sources.gemini` | `true` | Lê o uso do Gemini CLI. |
| `sources.omniroute` | `false` | Lê o uso do OmniRoute. |
| `omniroute.container` | `omniroute` | Nome do contêiner Docker. Apenas letras, números, ponto, hífen e sublinhado (até 64). |
| `omniroute.dbPath` | vazio | Caminho de `storage.sqlite`. Com valor, abre direto e não usa `docker cp`. |

### Onde é salvo

| Sistema | Pasta de dados |
|---|---|
| Windows | `%APPDATA%\ClaudeHub\` |
| macOS | `~/Library/Application Support/ClaudeHub/` |
| Linux | `~/.config/ClaudeHub/` |

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor. Padrão `4317` (`4318` em modo demo). |
| `CLAUDEHUB_DEMO` | Com valor `1`, usa dados fictícios. `pnpm demo` já a ativa. |
| `CLAUDEHUB_DATA` | Substitui a pasta de dados. |
| `CLAUDE_PROJECTS_DIR` | Pasta de registros. Padrão `~/.claude/projects`. |
| `CODEX_SESSIONS_DIR` | Pasta de sessões do Codex. Padrão `~/.codex/sessions`. |
| `GEMINI_TMP_DIR` | Pasta de chats do Gemini CLI. Padrão `~/.gemini/tmp`. |
| `CLAUDEHUB_CACHE` | Caminho do cache em disco. |
| `CLAUDEHUB_CONFIG` | Caminho do arquivo de configuração. |
| `CLAUDEHUB_WINDOWS` | Caminho do arquivo de janelas de contexto reais. |
| `CLAUDEHUB_PLAN` | Caminho do arquivo de limites do plano. |

### Arquivos que cria

| Arquivo | Uso |
|---|---|
| `cache.json` | Cache de leitura, apenas dados de uso. Se você o deletar, se regenera. |
| `config.json` | Sua configuração. Criado ao salvar em Ajustes. |
| `context-windows.json` | Janelas de contexto reais, se você habilitar a linha de status. |
| `rate-limits.json` | Limites do plano do Claude (5 horas e semanal), se você habilitar a linha de status ou executar `/uso`. |
| `events.jsonl` e `events.1.jsonl` | Eventos do hook de estados. Rotaciona ao passar de 256 KB. |
| `omniroute/` | Cópia temporária do banco do OmniRoute, se você ativar essa fonte. |
| `overlay-pos.json` | Última posição do mascote. |
| `setup.json` | Marca que o inicializar automático foi configurado. |
| `tray.pid` | ID do processo da bandeja em execução. |
| `electron/` | Dados internos do Electron. |

## API local

Só responde em `127.0.0.1`. Rejeita com `403` qualquer requisição cuja `Host` não seja `127.0.0.1` ou `localhost`, o que previne ataques de DNS rebinding.

| Rota | Retorna |
|---|---|
| `GET /api/summary` | Totais, dias ativos, hora de pico, modelo favorito e mapa de calor. |
| `GET /api/models` | Série diária por modelo e tabela de modelos. |
| `GET /api/roles` | Orquestrador contra subagentes e tipos de agente. Apenas Claude. |
| `GET /api/sessions` | Chats com título, projeto, datas e tokens. |
| `GET /api/projects` | Tokens por projeto. |
| `GET /api/sources` | Por fonte: se está ativa, quantos arquivos e registros leu e se pôde ser lida. |
| `GET /api/live` | Última atividade e tokens de hoje. |
| `GET /api/active` | Chats ativos do Claude com uso de contexto e origem do limite. Além disso: `plan` (limites do Claude), `plans` (`claude` e `codex`), `agents`, `collisions` e `mascot`. |
| `GET /api/events` | Avisos ao vivo por SSE. Não leva dados de uso. |
| `GET /api/config` | Nome da saudação e se o modo demo está ativo. |
| `GET /api/settings` | Configuração atual, seu caminho e modelos vistos. |
| `PUT /api/settings` | Valida e salva a configuração. Exige `application/json`. |

Rotas com intervalo aceitam `?range=all|30d|7d` ou `?from=AAAA-MM-DD&to=AAAA-MM-DD`. As datas são locais e ambas as extremidades são incluídas.

`summary`, `models`, `sessions` e `projects` também aceitam `?source=all|claude|codex|gemini|omniroute`. Um valor desconhecido equivale a `all`.

```bash
curl "http://127.0.0.1:4317/api/summary?from=2026-09-20&to=2026-09-30"
curl "http://127.0.0.1:4317/api/models?range=7d&source=codex"
```

### Campos novos de `/api/active`

| Campo | Conteúdo |
|---|---|
| `plans` | `{ claude, codex }`. Cada um tem a forma de `plan`, ou `null` sem dados vigentes. |
| `agents` | Uma entrada por sessão com hook: `source`, `session` (8 caracteres), `project` (apenas o nome da pasta), `state`, `since`, `tool` e `stuck`. |
| `collisions` | Pastas com dois agentes ativos ao mesmo tempo: `project`, `sessions` e `since`. |
| `mascot` | Estado de Chispa: `waiting`, `error`, `alert`, `tool`, `thinking`, `happy` ou `sleeping`. |

`plan` permanece igual para quem já o consome.

### `/api/events`

Fluxo SSE sem dados de uso. Envia `hello` ao conectar, `changed` quando os arquivos vigiados mudam e um batimento a cada 25 segundos. Aceita 8 clientes ao mesmo tempo: o nono recebe `429`. Não adiciona cabeçalhos CORS e passa pelo mesmo filtro de `Host`.

## Privacidade e segurança

- O servidor escuta apenas em `127.0.0.1`.
- Sem telemetria nem chamadas a serviços externos. A única requisição de rede é carregar Google Fonts na interface.
- Apenas campos de uso e títulos de chats são lidos. Respostas não são salvas, nem textos do Codex, Gemini ou OmniRoute.
- O cache contém apenas dados agregados por mensagem.
- O hook de estados não salva prompts nem argumentos de ferramentas, e sai sempre com código 0 e sem saída.
- `/api/events` não envia dados de uso, aceita 8 clientes e não concede CORS.
- OmniRoute é lido com `docker cp` sem shell, com o nome do contêiner validado, e a cópia é aberta em somente leitura.
- Escrita de ajustes exige JSON, origem própria, corpo pequeno e valida e limita cada valor.
- A janela do mascote usa `contextIsolation` e `sandbox` e expõe apenas quatro ações ao processo da interface.
- O modo demo nunca toca seus registros ou configuração.

Para relatar uma vulnerabilidade, leia [SECURITY.md](SECURITY.md).

## Estrutura do projeto

```
ClaudeHub/
├─ .github/               CI, modelos de issues e pull requests
├─ build/icon.png         ícone da aplicação
├─ scripts/
│  ├─ commands/uso.md     comando /uso para os limites do plano
│  ├─ hook.cjs            hook de estados (escreve events.jsonl)
│  ├─ launch.cjs          inicializador para o hook SessionStart
│  ├─ statusline.cjs      linha de status e registro da janela real
│  └─ write-limits.cjs    salva os limites do plano que /uso usa
├─ src/
│  ├─ core/               parser, cache, agregação e configuração
│  │  ├─ parse.ts         leitura incremental e deduplicação
│  │  ├─ scan.ts          percurso de registros e caching
│  │  ├─ sources/         Codex, Gemini e OmniRoute
│  │  ├─ agents.ts        estados de agentes, travamentos, choques e mascote
│  │  ├─ overview.ts      campos extras de /api/active
│  │  ├─ aggregate.ts     relatórios, intervalos e contexto
│  │  ├─ demo.ts          dados fictícios para modo demo
│  │  ├─ config.ts        configuração validada
│  │  ├─ paths.ts         pastas de dados por sistema
│  │  ├─ windows.ts       janelas de contexto reais
│  │  ├─ plan.ts          limites do plano (5 horas e semanal)
│  │  ├─ models.ts        "claude-opus-5-5" -> "Opus 5.5"
│  │  └─ cli.ts           resumo por terminal
│  ├─ server/             API local, arquivos estáticos e avisos ao vivo
│  │  ├─ index.ts         rotas
│  │  └─ watch.ts         vigilância de pastas e SSE
│  ├─ tray/               Electron: bandeja, mascote, alertas
│  └─ web/                React: dashboard, ajustes e mascote
├─ docs/                  logo e capturas do modo demo
├─ test/                  testes
├─ AGENTS.md              guia para agentes de IA
└─ LICENSE                MIT
```

## Contribuir

As contribuições são bem-vindas. Leia [CONTRIBUTING.md](CONTRIBUTING.md) e o [código de conduta](CODE_OF_CONDUCT.md).

```bash
npx tsc --noEmit && pnpm test && pnpm build
```

CI executa essas três verificações em Linux, Windows e macOS.

## Roteiro

- Extensão do Chrome que lê o servidor local.
- Demo pública online com dados fictícios.
- Imagem do Docker com `~/.claude` montada em leitura apenas.
- Instaladores para macOS (`.dmg`) e Linux (`.AppImage` e `.deb`).
- Assinação de código do instalador do Windows.

## Limitações conhecidas

- Bandeja e mascote são testados automaticamente no macOS e no Linux, mas só usados no dia a dia no Windows 11. No Linux o ícone da bandeja depende do ambiente de desktop.
- Sem a linha de status, o limite de contexto é uma estimativa.
- O comando `/uso` atualiza os limites do Claude apenas ao ser executado. Nenhum hook pode chamar `get_usage`.
- Os limites do Codex são lidos dos seus rollouts e valem enquanto a janela não tiver vencido. Só se atualizam ao usar o Codex.
- OmniRoute precisa de Docker (ou `omniroute.dbPath`) e de Node com `node:sqlite`. A cópia se renova a cada 60 segundos.
- Os estados por hooks precisam do hook instalado. Sem ele, o mascote usa a regra simples de 4 estados.
- O instalador não está assinado.
- A mudança de horário de verão pode deslocar o início dos intervalos de 7 e 30 dias por uma hora em zonas que a usam.
- Depende do formato dos registros do Claude Code, que pode mudar entre versões.

## Licença

[MIT](LICENSE) © 2026 Norman Smith Martínez Acevedo.

Código aberto e público: use-o, modifique-o e compartilhe-o.
