# Arquitetura inicial

## Decisoes aprovadas

- Produto nasce como SaaS multi-organizacao.
- A interface usara o termo "espaco" para aceitar organizacoes formais e grupos informais.
- O banco principal sera PostgreSQL.
- O modelo de isolamento sera hibrido:
  - `core`: identidade, autenticacao, tenants, assinaturas, suporte e indice minimo de ocupacao entre espacos.
  - `tenant_<id>`: dados operacionais de cada espaco.
- A API do MVP sera REST com documentacao OpenAPI.
- GraphQL fica como evolucao possivel, com dominio desacoplado do transporte.
- A primeira entrega funcional sera web/PWA.
- Android sera preparado em paralelo e publicado somente depois de validacao.
- iOS entra depois.

## Monorepo

O monorepo separa aplicacoes e pacotes:

- `apps/api`: API HTTP.
- `apps/web`: PWA responsiva.
- `apps/mobile`: base Expo para mobile.
- `packages/shared`: tipos e regras compartilhadas.
- `packages/design-tokens`: tokens de tema.
- `packages/ui-web`: componentes web reutilizaveis.
- `packages/config`: configuracoes compartilhadas.

## Regra importante

As regras de negocio nao devem depender de Next.js, Fastify, Expo, REST ou GraphQL. O fluxo de escala, convite, confirmacao, substituicao e conflito deve ficar em servicos/casos de uso reaproveitaveis.
