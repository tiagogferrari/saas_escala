# Arquitetura do backend

Este documento explica como a API esta organizada hoje e como navegar pelo
codigo sem precisar decorar todos os arquivos. A ideia e servir como mapa para
revisar, manter e criar novas funcionalidades.

## Visao geral

O backend fica em:

```text
apps/api/
```

Ele e uma API em Fastify + TypeScript usando PostgreSQL via `pg` e validacao de
entrada com Zod.

Comandos principais:

```text
pnpm --filter @escala/api typecheck
pnpm --filter @escala/api db:migrate
pnpm dev
```

A estrutura atual da API e:

```text
apps/api/src/
  main.ts
  config/
  shared/
  modules/
```

Pense assim:

```text
main.ts   -> cria o servidor, registra seguranca e rotas
config/   -> carrega variaveis de ambiente
shared/   -> infraestrutura comum da API
modules/  -> dominios do produto
```

## Tecnologias adotadas

```text
Fastify      -> servidor HTTP
TypeScript   -> linguagem da API
Zod          -> validacao de entrada
PostgreSQL   -> banco principal
pg           -> driver SQL
tsx          -> execucao local TypeScript
pnpm         -> gerenciador de pacotes do monorepo
Docker       -> infra local de banco/servicos
```

Nao existe ORM no momento. A API usa SQL explicito. Isso deixa as regras mais
claras nesta fase, principalmente por causa da decisao de multi-tenant por
schema.

## Decisao multi-tenant

A API nasceu multi-tenant.

Hoje existem duas camadas de banco:

```text
core
  tenants
  global_users
  auth_sessions
  tenant_user_memberships
  platform_migrations

schema de cada tenant
  people
  locations
  functions
  schedules
  schedule_series
  assignments
  replacement_requests
  member_access_tokens
  audit_events
  ...
```

O `core` guarda informacoes globais da plataforma. Cada tenant tem seu proprio
schema PostgreSQL com os dados operacionais daquele cliente.

Exemplo mental:

```text
core.tenants
  slug: piloto-marcelo
  schema_name: tenant_xxxxx

tenant_xxxxx.people
tenant_xxxxx.schedules
tenant_xxxxx.assignments
```

O arquivo que resolve isso e:

```text
apps/api/src/shared/tenant-context/tenant-context.ts
```

Ele recebe o `tenantSlug`, busca o tenant no `core`, confere se esta ativo e
devolve:

```text
tenant -> dados do tenant
schema -> schema PostgreSQL ja escapado para SQL
```

## Entrada da API

O ponto de entrada e:

```text
apps/api/src/main.ts
```

Responsabilidades dele:

```text
1. Carregar ambiente
2. Criar app Fastify
3. Registrar CORS e Helmet
4. Configurar autenticacao global para rotas /tenants
5. Configurar tratamento de erro Zod
6. Registrar rotas dos modulos
7. Iniciar scheduler de notificacoes
8. Subir o servidor
```

Rotas publicas hoje:

```text
/
/health
/health/db
/auth/*
/tenants/:tenantSlug/member-access/:accessToken/...
```

Quase tudo que comeca com `/tenants` exige sessao de gestor, exceto o portal do
membro por token.

## Autenticacao de gestor

Arquivos principais:

```text
apps/api/src/shared/auth/auth.routes.ts
apps/api/src/shared/auth/auth.service.ts
apps/api/src/shared/auth/auth.repository.ts
apps/api/src/shared/auth/auth.context.ts
apps/api/src/shared/auth/auth.schemas.ts
apps/api/src/shared/auth/auth.types.ts
apps/api/src/shared/auth/passwords.ts
```

Fluxo:

```text
auth.routes.ts
  recebe HTTP, valida body, define status code/cookie

auth.service.ts
  orquestra login, setup inicial e perfil do gestor

auth.repository.ts
  consulta usuarios, sessoes e permissoes no banco

auth.context.ts
  le cookie escala_session e exige permissao no tenant

auth.schemas.ts
  schemas Zod de login/setup

auth.types.ts
  tipos principais de usuario autenticado
```

O cookie usado e:

```text
escala_session
```

O `main.ts` usa `requireManagerSession` e `requireTenantManagementAccess` para
proteger rotas de gestao.

## Estrutura dos modulos

Os modulos de produto ficam em:

```text
apps/api/src/modules/
```

Padrao geral:

```text
modulo.routes.ts      -> endpoints HTTP
modulo.schemas.ts     -> validacao Zod
modulo.types.ts       -> tipos do dominio
modulo.service.ts     -> regra/orquestracao, quando existe
modulo.repository.ts  -> SQL/persistencia
```

Nem todo modulo precisa ter todos os arquivos. Modulos simples podem ter apenas
`routes`, `schemas`, `types` e `repository`.

Regra mental:

```text
routes -> schemas -> service -> repository
```

Ou, em modulos simples:

```text
routes -> schemas -> repository
```

## Modulos simples

### People

```text
modules/people/
  people.routes.ts
  people.schemas.ts
  people.types.ts
  people.repository.ts
```

Cuida do cadastro/listagem de pessoas do tenant.

### Locations

```text
modules/locations/
  locations.routes.ts
  locations.schemas.ts
  locations.types.ts
  locations.repository.ts
```

Cuida do cadastro/listagem de locais.

### Schedule functions

```text
modules/schedule-functions/
  schedule-functions.routes.ts
  schedule-functions.schemas.ts
  schedule-functions.types.ts
  schedule-functions.repository.ts
```

Cuida das funcoes/papeis da escala, como uma funcao que alguem pode exercer.

### Tenants

```text
modules/tenants/
  tenants.routes.ts
  tenants.schemas.ts
  tenants.types.ts
  tenants.repository.ts
```

Cuida da criacao/listagem de tenants. Tambem e usado pelo auth para criar o
tenant inicial durante o setup.

### Audit

```text
modules/audit/
  audit.routes.ts
  audit.schemas.ts
  audit.types.ts
  audit.repository.ts
```

Cuida da listagem e gravacao do historico/auditoria.

As acoes de auditoria usam nomes como:

```text
schedule.created
schedule.published
schedule.cancelled
schedule_series.created
schedule_series.updated
schedule_occurrence.updated
assignment.created
assignment.responded
replacement.requested
replacement.candidate_invited
replacement.completed
```

## Acesso do membro

```text
modules/member-access/
  member-access.routes.ts
  member-access.schemas.ts
  member-access.types.ts
  member-access.repository.ts
```

Este modulo cuida do portal publico do membro por token.

Fluxo mental:

```text
gestor gera link para pessoa
  -> cria token em member_access_tokens

membro abre link com tenant + memberToken
  -> API valida token
  -> lista escalas daquela pessoa
  -> membro confirma/recusa
  -> membro pode pedir substituicao
```

O membro nao escolhe pessoa manualmente. A pessoa vem do token.

## Schedules

Este e o modulo mais importante e mais complexo.

```text
modules/schedules/
  schedules.routes.ts
  schedules.repository.ts

  schedule.schemas.ts
  schedule.types.ts
  schedule.errors.ts

  schedule-query.service.ts
  schedule-lifecycle.service.ts
  recurrence.service.ts
  assignments.service.ts
  replacements.service.ts
  cancellation.service.ts

  assignment.helpers.ts
  recurrence.helpers.ts
  schedule-audit.helpers.ts
  schedule.mappers.ts
  schedule.rows.ts
  schedule.sql.ts
  schedule.utils.ts
```

O `schedules.repository.ts` existe hoje como arquivo de compatibilidade. Ele
reexporta servicos, erros e tipos para nao quebrar imports antigos.

### Rotas

```text
schedules.routes.ts
```

Responsabilidades:

```text
1. Receber HTTP
2. Validar params/body com schedule.schemas.ts
3. Resolver tenant
4. Montar ator de auditoria do gestor
5. Chamar o service correto
6. Traduzir erros de dominio em status HTTP/mensagem
```

### Schemas

```text
schedule.schemas.ts
```

Concentra validacoes Zod para:

```text
criar escala
criar serie
editar serie
editar ocorrencia
pular/restaurar ocorrencia
cancelar escala
criar assignment
responder assignment
pedir substituicao
convidar candidato
```

### Types

```text
schedule.types.ts
```

Contratos principais do dominio:

```text
ScheduleDraft
ScheduleAssignment
ScheduleSeries
ScheduleSeriesOverview
ScheduleSeriesOccurrence
MemberSchedule
ReplacementRequest
```

### Errors

```text
schedule.errors.ts
```

Erros de dominio usados pelas rotas para responder corretamente:

```text
ScheduleAssignmentError
SchedulePublicationError
ScheduleCancellationError
MemberScheduleError
ReplacementRequestManagerError
ScheduleSeriesError
```

### Services

```text
schedule-query.service.ts
```

Consultas/listagens:

```text
listScheduleDrafts
listMemberSchedules
getScheduleDraftById
listScheduleAssignments
```

```text
schedule-lifecycle.service.ts
```

Ciclo de vida basico:

```text
createScheduleDraft
publishSchedule
```

```text
recurrence.service.ts
```

Recorrencia e ocorrencia individual:

```text
createScheduleSeries
listScheduleSeries
updateScheduleSeries
updateScheduleSeriesOccurrenceDetails
updateScheduleSeriesOccurrence
```

```text
assignments.service.ts
```

Escalacao e resposta:

```text
createScheduleAssignment
respondToMemberScheduleAssignment
```

```text
replacements.service.ts
```

Substituicoes:

```text
createReplacementRequest
inviteReplacementCandidate
completeReplacementRequest
```

```text
cancellation.service.ts
```

Cancelamento:

```text
cancelSchedule
cancelScheduleSeries
```

### Helpers

```text
assignment.helpers.ts
```

Coisas reutilizadas por fluxo de escala/substituicao:

```text
checar conflito de horario
buscar assignment por id
anexar assignments nas escalas
garantir coluna replacement_request_id
```

```text
recurrence.helpers.ts
```

Calculo das datas de recorrencia.

```text
schedule.mappers.ts
```

Transforma linhas do banco em objetos da API.

```text
schedule.rows.ts
```

Tipos internos que representam o formato cru de linhas SQL.

```text
schedule.sql.ts
```

Trechos SQL reutilizados.

```text
schedule-audit.helpers.ts
```

Ajuda a montar objetos `changes` para auditoria.

```text
schedule.utils.ts
```

Helpers pequenos de data/texto/listas.

## Fluxo: criar uma escala avulsa

```text
POST /tenants/:tenantSlug/schedules
  -> main.ts exige gestor autenticado
  -> schedules.routes.ts valida body com createScheduleSchema
  -> resolveTenantContext busca o schema do tenant
  -> schedule-lifecycle.service.ts cria schedule + slot
  -> audit.repository.ts registra schedule.created
  -> retorna ScheduleDraft
```

## Fluxo: publicar uma escala

```text
POST /tenants/:tenantSlug/schedules/:scheduleId/publish
  -> schedules.routes.ts valida params
  -> schedule-lifecycle.service.ts muda draft para published
  -> registra schedule.published
  -> notifications.service.ts tenta enviar convites
  -> retorna escala + resumo de notificacoes
```

Publicar nao exige que todas as vagas estejam preenchidas.

## Fluxo: criar serie recorrente

```text
POST /tenants/:tenantSlug/schedule-series
  -> schedules.routes.ts valida createScheduleSeriesSchema
  -> recurrence.helpers.ts calcula datas
  -> recurrence.service.ts cria schedule_series
  -> cria schedules filhos para ocorrencias nao puladas
  -> cria slots
  -> pode criar assignments iniciais
  -> registra schedule_series.created
```

Regras importantes:

```text
serie pode ser semanal, quinzenal, etc. via recurrenceIntervalWeeks
serie tem uma data final em recurrenceEndsOn
datas podem ser puladas com skippedDates/skippedOccurrences
uma pessoa com conflito de horario nao pode ser atribuida
```

## Fluxo: editar ocorrencia individual

```text
PATCH /tenants/:tenantSlug/schedule-series/:seriesId/occurrences/:occurrenceDate/details
  -> valida body
  -> recurrence.service.ts localiza a ocorrencia
  -> se nao existir schedule, cria rascunho especifico
  -> se existir, atualiza apenas aquela ocorrencia
  -> valida conflitos, capacidade e funcao
  -> registra schedule_occurrence.updated
```

Isso cobre casos como:

```text
serie todo domingo 9h
mas um domingo especifico sera 10h
ou em outro local
ou com outra quantidade de vagas
```

## Fluxo: pular/restaurar ocorrencia

```text
PATCH /tenants/:tenantSlug/schedule-series/:seriesId/occurrences/:occurrenceDate
  -> skipped true ou false
  -> recurrence.service.ts cria/remove excecao
  -> pode cancelar rascunho associado
  -> pode restaurar uma data pulada
  -> registra skipped/restored
```

O campo `note` permite registrar o motivo, por exemplo:

```text
Feriado
Evento especial
Sem atividade nesse domingo
```

## Fluxo: cancelar escala publicada

```text
POST /tenants/:tenantSlug/schedules/:scheduleId/cancel
  -> cancellation.service.ts exige status published
  -> muda schedule para cancelled
  -> cancela assignments ativos
  -> cancela pedidos de substituicao em aberto
  -> registra schedule.cancelled
```

Isso e diferente de simplesmente "pular" uma ocorrencia futura. Cancelamento e
para uma escala publicada que ja existia operacionalmente.

## Fluxo: substituicao

```text
membro pede substituicao
  -> createReplacementRequest
  -> registra replacement.requested

gestor convida candidato
  -> inviteReplacementCandidate
  -> valida conflito de horario
  -> cria assignment convidado
  -> registra replacement.candidate_invited

candidato aceita/recusa
  -> respondToMemberScheduleAssignment
  -> se aceitar, replacement_request vira accepted
  -> se recusar, volta para requested
  -> registra assignment.responded

gestor conclui
  -> completeReplacementRequest
  -> cancela assignment original
  -> marca pedido como completed
  -> registra replacement.completed
```

Regra importante:

```text
o original continua escalado ate o substituto aceitar e o gestor concluir
```

## Notificacoes

```text
modules/notifications/
  notifications.service.ts
  notifications.scheduler.ts
  notifications.email.ts
  notifications.queries.ts
  notifications.errors.ts
  notifications.types.ts
  email.sender.ts
```

Papel de cada arquivo:

```text
notifications.service.ts    -> fila/envio/orquestracao
notifications.scheduler.ts  -> rotina periodica de lembretes
notifications.email.ts      -> assunto, texto e HTML do email
notifications.queries.ts    -> query base de candidatos
notifications.errors.ts     -> erro de dominio
notifications.types.ts      -> tipos do modulo
email.sender.ts             -> transporte SMTP com nodemailer
```

Hoje as notificacoes ja existem estruturalmente, mas ainda podem ser refinadas
depois em produto/UX.

## Banco e migrations

Arquivos:

```text
shared/db/pool.ts
shared/db/migrate.ts
shared/db/identifiers.ts
shared/db/sql/core.sql
shared/db/sql/tenant-template.ts
```

Responsabilidades:

```text
pool.ts             -> conexao PostgreSQL
migrate.ts          -> aplica core.sql e tenant-template nos tenants
identifiers.ts      -> quote seguro de schema/identificadores
core.sql            -> tabelas globais da plataforma
tenant-template.ts  -> tabelas que existem dentro de cada tenant
```

Quando uma nova tabela por tenant for criada, normalmente ela entra em:

```text
shared/db/sql/tenant-template.ts
```

Quando for algo global da plataforma, entra em:

```text
shared/db/sql/core.sql
```

## Como criar uma feature nova

Use este checklist:

```text
1. A feature pertence a qual modulo?
2. Precisa de endpoint novo?
3. Criar/alterar schema Zod em *.schemas.ts
4. Criar/alterar tipo em *.types.ts
5. Colocar regra em *.service.ts quando houver regra de negocio
6. Colocar SQL em *.repository.ts quando for persistencia simples
7. Registrar auditoria se alterar algo importante
8. Rodar typecheck
9. Rodar db:migrate se tocou banco
```

Exemplo: nova regra de escalas.

```text
modules/schedules/
  schedules.routes.ts
  schedule.schemas.ts
  schedule.types.ts
  algum-service.service.ts
```

Exemplo: novo cadastro simples.

```text
modules/novo-modulo/
  novo-modulo.routes.ts
  novo-modulo.schemas.ts
  novo-modulo.types.ts
  novo-modulo.repository.ts
```

## Onde procurar cada coisa

```text
Login/setup/sessao
  shared/auth/

Tenant/schema atual
  shared/tenant-context/

Conexao e migrations
  shared/db/

Pessoas
  modules/people/

Locais
  modules/locations/

Funcoes
  modules/schedule-functions/

Escalas/recorrencia/substituicao/cancelamento
  modules/schedules/

Portal do membro por token
  modules/member-access/

Auditoria
  modules/audit/

Notificacoes
  modules/notifications/
```

## Decisoes importantes ja tomadas

```text
Multi-tenant desde o inicio.
Isolamento por schema PostgreSQL por tenant.
REST agora; GraphQL fica para depois se houver necessidade real.
Membro acessa por token/link, sem conta propria neste MVP.
Gestor usa sessao por cookie.
Pessoas sao individuais; grupos ficam para depois.
Escalas podem ser publicadas com vagas abertas.
Substituicao so conclui quando candidato aceita e gestor finaliza.
Auditoria registra eventos importantes de escala.
```

## Estado atual do backend inicial

O backend inicial ja cobre:

```text
tenants
auth/setup/login
pessoas
locais
funcoes
rascunhos de escala
publicacao
assignments
portal do membro por token
confirmar/recusar
pedido de substituicao
convite de substituto
conclusao de substituicao
recorrencia
pular/restaurar ocorrencia
editar ocorrencia individual
cancelar escala publicada
auditoria
estrutura de notificacoes
```

O proximo passo natural, depois de entender esta estrutura, e revisar o fluxo
de ponta a ponta com calma antes de mexer no frontend.
