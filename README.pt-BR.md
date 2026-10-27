<div align="center">

<img src="docs/chispa-saludo.svg" alt="Chispa, a mascote do ClaudeHub, acenando" width="170" />

# ClaudeHub

**Veja para onde vão seus tokens do Claude Code.**

Dashboard local, mascote na área de trabalho e alertas de contexto. Windows, macOS e Linux.

[Español](README.md) · [English](README.en.md) · **Português**

[![CI](https://github.com/NormanSMA/ClaudeHub/actions/workflows/ci.yml/badge.svg)](https://github.com/NormanSMA/ClaudeHub/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/NormanSMA/ClaudeHub)](https://github.com/NormanSMA/ClaudeHub/releases/latest)
![Plataformas](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-informational)
![Privacidade](https://img.shields.io/badge/dados-100%25%20locais-2ea44f)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)

<br />

<img src="docs/screenshots/agentes.png" alt="Aba Agentes: nível de consumo, limites do plano e chats ativos" width="760" />

<sub>Capturas do modo demo: todos os dados são fictícios. A interface está em espanhol.</sub>

</div>

## O que faz

- **Tokens e custo** por dia, modelo, chat e projeto.
- **Contexto** de cada chat ativo, com alerta quando enche.
- **Limites do plano**: 5 horas e semanal, com projeção de quando acabam.
- **Orquestrador contra subagentes**: quem gasta o quê.
- **Outras fontes**: Codex, Gemini CLI e OmniRoute.
- **Chispa**: mascote no canto ou como ilha na borda superior.

Tudo roda no seu computador. Nenhum dado sai dele.

## Experimente

O modo demo usa dados fictícios e não lê nada seu.

```bash
git clone https://github.com/NormanSMA/ClaudeHub.git
cd ClaudeHub
pnpm install && pnpm build
pnpm demo
```

Abra `http://127.0.0.1:4318`.

## Instalar

| Sistema | Como |
|---|---|
| **Windows** | Baixe `ClaudeHub-Setup-x.y.z.exe` em [Releases](https://github.com/NormanSMA/ClaudeHub/releases/latest). Não precisa de Node. |
| **macOS e Linux** | A partir do código, com Node 24 e pnpm 11: `pnpm install`, `pnpm build` e `pnpm tray`. |
| **Navegador** | Extensão para [Chrome, Edge, Brave e Firefox](extensions/README.md) e para [Safari](safari/README.md). |

> O instalador não tem assinatura. Se o SmartScreen avisar, clique em **Mais informações** e **Executar assim mesmo**. Para atualizar, feche o ClaudeHub com **Salir** (Sair) antes de instalar.

## O que você vê

<table>
  <tr>
    <td><img src="docs/screenshots/resumen.png" alt="Resumo: custo, tokens, mapa de calor e gráfico de área" /></td>
    <td><img src="docs/screenshots/modelos.png" alt="Modelos: tokens por dia e por modelo" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Resumo</b>: custo, cache e atividade</sub></td>
    <td align="center"><sub><b>Modelos</b>: tokens por dia e valor de API</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/sesiones.png" alt="Sessões ordenáveis com busca" /></td>
    <td><img src="docs/screenshots/isla.png" alt="Ilha superior expandida com os chats ativos" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Sessões</b>: quais chats gastam mais</sub></td>
    <td align="center"><sub><b>Ilha</b>: chats ativos a partir da borda superior</sub></td>
  </tr>
</table>

## Chispa

A Chispa muda de estado conforme seus chats: dorme, pensa, usa ferramentas, espera uma permissão ou entra em alerta. Escolha a posição em **Ajustes > Mascota** (Configurações > Mascote):

- **Canto**: arraste-a; um clique abre o painel de chats.
- **Ilha superior**: mostra chats, nível, custo de hoje e velocidade. Expande ao passar o cursor.

<p align="center"><img src="docs/screenshots/isla-compacta.png" alt="Ilha compacta: chats, Chispa e nível" width="300" /></p>

## Conecte ao Claude Code

Tudo é opcional. Cada passo está no [guia técnico](docs/guia.md#integraciones-con-claude-code) (em espanhol).

| Você quer | Use |
|---|---|
| Abrir o ClaudeHub ao iniciar o Claude Code | Hook `SessionStart` com `scripts/launch.cjs` |
| Contexto real e limites no terminal | Linha de status `scripts/statusline.cjs` |
| Limites a partir do app de desktop | Comando `/uso` |
| Estado de cada agente na Chispa | Hook `scripts/hook.cjs` |

<details>
<summary><b>Instalar com uma IA</b></summary>

Cole isto no Claude Code ou em outro agente com acesso ao terminal:

````text
Instale e execute o ClaudeHub: https://github.com/NormanSMA/ClaudeHub
1. Clone e entre na pasta.
2. Verifique Node 24+ e pnpm 11 com `node -v` e `pnpm -v`.
3. Execute `pnpm install`, `pnpm build` e `pnpm test`.
4. Teste `pnpm demo` em http://127.0.0.1:4318 e pare-o.
5. Execute `pnpm tray` para a bandeja e a mascote.
6. Pergunte-me antes de editar ~/.claude/settings.json. Se eu aceitar, adicione o hook SessionStart e a linha de status de docs/guia.md, com os caminhos reais e sem apagar minhas configurações.
7. Diga meus tokens dos últimos 7 dias usando /api/summary.
Leia AGENTS.md para mais detalhes.
````

</details>

## Privacidade

- O servidor escuta apenas em `127.0.0.1`.
- Lê só campos de uso e títulos de chats. Nunca respostas.
- Sem telemetria. A única consulta externa procura versões novas e pode ser desligada em **Ajustes** (Configurações).

## Mais informações

| Documento | Para |
|---|---|
| [Guia técnico](docs/guia.md) (em espanhol) | Configuração, API, hooks, cálculos e arquitetura. |
| [AGENTS.md](AGENTS.md) (em espanhol) | Agentes de IA que instalam ou consultam o ClaudeHub. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribuir. Verifique com `npx tsc --noEmit && pnpm test && pnpm build`. |
| [SECURITY.md](SECURITY.md) | Reportar vulnerabilidades. |

## Colaboradores

<table>
  <tr>
    <td align="center"><a href="https://github.com/NormanSMA"><img src="https://github.com/NormanSMA.png?size=100" width="72" alt="" /><br /><sub><b>Norman Martínez</b></sub></a><br /><sub>Autor</sub></td>
    <td align="center"><a href="https://github.com/kisnner26"><img src="https://github.com/kisnner26.png?size=100" width="72" alt="" /><br /><sub><b>Kisnner Obando</b></sub></a><br /><sub>Teste no macOS e extensão do Safari</sub></td>
  </tr>
</table>

## Licença

[MIT](LICENSE) © 2026 Norman Smith Martínez Acevedo.
