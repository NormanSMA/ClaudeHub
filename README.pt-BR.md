<div align="center">

<img src="docs/chispa.svg" alt="Chispa, o mascote do ClaudeHub" width="160" />

# ClaudeHub

**Veja para onde seus tokens do Claude Code vão.**
Um monitor local: dashboard web, mascote flutuante na área de trabalho e alertas de contexto.

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
| **Chats ativos** | Lista os chats com atividade recente. Mostra título, projeto, modelo, subagentes ativos e uma barra de contexto que vai de verde para âmbar e para vermelho. |
| **Resumo** | Sessões, mensagens, tokens totais, dias ativos, hora de pico, modelo favorito, mapa de calor diário e percentual de acertos de cache. |
| **Modelos** | Barras empilhadas por dia, com entrada e saída por modelo. Ordena por tokens, entrada, saída ou nome. |
| **Orquestrador vs Subagentes** | Distribuição de tokens entre ambos os papéis, evolução diária e ranking de tipos de subagente. |
| **Sessões e Projetos** | Tabelas ordenáveis por qualquer coluna, com busca por título e filtro por projeto. |
| **Ajustes** | Edite seu nome, limiar de alerta, minutos de atividade e janela de contexto de cada modelo, sem tocar em arquivos. |
| **Filtros de data** | Tudo, 30 dias, 7 dias ou um intervalo De e Até customizado. |
| **Mascote flutuante** | Um personagem de pixel sempre visível. Arrasta, lembra sua posição e abre o painel de chats ativos ao ser tocado. |
| **Limites do plano** | Seu limite de 5 horas e limite semanal como percentual, mostrando quanto tempo falta para reiniciar, junto aos chats ativos (planos Pro e Max). |
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
    <td><img src="docs/screenshots/roles.png" alt="Orquestrador contra subagentes" /></td>
    <td><img src="docs/screenshots/sesiones.png" alt="Sessões ordenáveis com filtros" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Orquestrador vs Subagentes</sub></td>
    <td align="center"><sub>Sessões com título, ordem e filtros</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/ajustes.png" alt="Aba de ajustes" /></td>
    <td><img src="docs/screenshots/activos.png" alt="Chats ativos com barra de contexto" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Ajustes dentro do dashboard</sub></td>
    <td align="center"><sub>Chats ativos e seu contexto</sub></td>
  </tr>
</table>

## O mascote

**Chispa** é um personagem original, desenhado em uma grade de 14 x 12 pixels. Muda de estado conforme o que acontece em seus chats.

<table>
  <tr>
    <td valign="top">

| Estado | Quando aparece |
|---|---|
| Dormindo | Não há chats ativos. |
| Acordado | Chats estão abertos, mas nenhum está escrevendo agora. |
| Trabalhando | Um chat escreveu no último minuto. |
| Alerta | Um chat, ou seu limite de 5 horas, excedeu o limiar. |

Toque nele para abrir o painel de chats ativos. Se abrir o dashboard a partir daí, o mascote se oculta e volta quando você o fecha.

</td>
    <td><img src="docs/screenshots/mascota.png" alt="Painel do mascote com chats ativos" width="300" /></td>
  </tr>
</table>

## Instalação

### Plataformas

| Sistema | Dashboard, demo e API | Bandeja e mascote |
|---|---|---|
| Windows 11 | Testado | Testado |
| Linux | Testado (Debian, Node 24, em Docker e em CI) | Não testado |
| macOS | Testado em CI | Não testado |

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
7. Se estou no Windows, execute `pnpm tray` para abrir a bandeja e o mascote flutuante.
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

Aparecem acima da aba **Ativos** (**Activos**) e no painel do mascote. Se seu limite de 5 horas exceder o limiar de alerta, o mascote o alerta e o sistema notifica você uma vez por janela.

Coisas que você deve saber:

- Claude Code só envia esses dados para assinantes **Pro e Max**, e apenas após a primeira resposta da sessão.
- Anthropic calcula o percentual e inclui todo o seu uso do plano, também web e apps. Os tokens do ClaudeHub contam apenas Claude Code nesta máquina, então os totais não correspondem.
- Os dados são atualizados cada vez que Claude Code executa a linha de status, por exemplo ao enviar uma mensagem. Se passarem mais de 15 minutos sem atividade, ClaudeHub notifica você. Uma janela expirada se oculta.
- Sem a linha de status, ClaudeHub não pode ler esses limites: eles não aparecem nos registros.
- **O app de desktop do Claude não executa a linha de status**: é um recurso do terminal. Se você usa o Claude Code só pelo app de desktop, não verá os percentuais; o ClaudeHub não consegue lê-los em outro lugar. Para vê-los, use `claude` em um terminal com sua conta logada (`/login`). O percentual é de toda a sua conta, então uma mensagem no terminal atualiza o dado, que fica parado até a próxima mensagem no terminal.

### Aviso de limite atingido

Isso não precisa da linha de status. Quando você atinge um limite, o Claude Code o registra nos logs com o horário exato de reinício. O ClaudeHub lê esse registro e mostra um aviso vermelho, por exemplo **Limite de 5 horas atingido. Reinicia em 1 h 12 min**, além de uma notificação do sistema e do mascote em alerta. Também funciona com o app de desktop.

## Como funciona

```
~/.claude/projects/<projeto>/<sessão>.jsonl                     orquestrador
~/.claude/projects/<projeto>/<sessão>/subagents/agent-*.jsonl   subagentes
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
  "alertAt": 0.85
}
```

| Campo | Padrão | Descrição |
|---|---|---|
| `name` | vazio | Nome para a saudação da interface. Sem nome, a saudação não o inclui. |
| `contextLimits` | `{}` | Limite de contexto por nome de modelo. Substitui a estimativa. |
| `activeMinutes` | `20` | Minutos sem atividade antes de um chat parar de ser mostrado como ativo. |
| `alertAt` | `0.85` | Fração de contexto que dispara o alerta (entre 0,5 e 0,99). |

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
| `rate-limits.json` | Limites do plano (5 horas e semanal), se você habilitar a linha de status. |
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
| `GET /api/roles` | Orquestrador contra subagentes e tipos de agente. |
| `GET /api/sessions` | Chats com título, projeto, datas e tokens. |
| `GET /api/projects` | Tokens por projeto. |
| `GET /api/live` | Última atividade e tokens de hoje. |
| `GET /api/active` | Chats ativos com uso de contexto e origem do limite, e limites do plano (`plan`). |
| `GET /api/config` | Nome da saudação e se o modo demo está ativo. |
| `GET /api/settings` | Configuração atual, seu caminho e modelos vistos. |
| `PUT /api/settings` | Valida e salva a configuração. Exige `application/json`. |

Rotas com intervalo aceitam `?range=all|30d|7d` ou `?from=AAAA-MM-DD&to=AAAA-MM-DD`. As datas são locais e ambas as extremidades são incluídas.

```bash
curl "http://127.0.0.1:4317/api/summary?from=2026-09-20&to=2026-09-30"
```

## Privacidade e segurança

- O servidor escuta apenas em `127.0.0.1`.
- Sem telemetria nem chamadas a serviços externos. A única requisição de rede é carregar Google Fonts na interface.
- Apenas campos de uso e títulos de chats são lidos. Respostas não são salvas.
- O cache contém apenas dados agregados por mensagem.
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
│  ├─ launch.cjs          inicializador para o hook SessionStart
│  └─ statusline.cjs      linha de status e registro da janela real
├─ src/
│  ├─ core/               parser, cache, agregação e configuração
│  │  ├─ parse.ts         leitura incremental e deduplicação
│  │  ├─ scan.ts          percurso de registros e caching
│  │  ├─ aggregate.ts     relatórios, intervalos e contexto
│  │  ├─ demo.ts          dados fictícios para modo demo
│  │  ├─ config.ts        configuração validada
│  │  ├─ paths.ts         pastas de dados por sistema
│  │  ├─ windows.ts       janelas de contexto reais
│  │  ├─ plan.ts          limites do plano (5 horas e semanal)
│  │  ├─ models.ts        "claude-opus-5-5" -> "Opus 5.5"
│  │  └─ cli.ts           resumo por terminal
│  ├─ server/index.ts     API local e arquivos estáticos
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
- Testar a bandeja e o mascote em macOS e Linux.
- Assinação de código do instalador do Windows.

## Limitações conhecidas

- Bandeja e mascote são testadas apenas no Windows 11.
- Sem a linha de status, o limite de contexto é uma estimativa.
- O instalador não está assinado.
- A mudança de horário de verão pode deslocar o início dos intervalos de 7 e 30 dias por uma hora em zonas que a usam.
- Depende do formato dos registros do Claude Code, que pode mudar entre versões.

## Licença

[MIT](LICENSE) © 2026 Norman Smith Martínez Acevedo.

Código aberto e público: use-o, modifique-o e compartilhe-o.
