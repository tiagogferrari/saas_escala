# SaaS Escala

SaaS para gestao de escalas e voluntariado, com suporte a multiplos espacos, grupos, confirmacoes, substituicoes e historico auditavel.

## Status

Projeto em fase inicial. Esta estrutura prepara o monorepo, a infraestrutura local e os pacotes base para iniciar o MVP.

## Estrutura

```text
apps/
  api/       API HTTP do produto
  web/       PWA responsiva
  mobile/    base Expo para Android e futuro iOS
packages/
  config/        configuracoes compartilhadas
  design-tokens/ tokens de tema e identidade visual
  shared/        tipos e utilitarios de dominio
  ui-web/        biblioteca web inicial
infra/
  postgres/      scripts locais de banco
docs/
  SETUP.md       primeiros passos
  GIT.md         fluxo de Git/GitHub
  ARCHITECTURE.md decisoes tecnicas iniciais
```

## Primeiros comandos

Depois de instalar Git, Node.js 22+, pnpm e Docker:

```powershell
cd C:\Users\tiago\Documents\Codex\saas_escala
Copy-Item .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

Veja os detalhes em [docs/SETUP.md](docs/SETUP.md).
