# Setup local

## 1. Ferramentas

Instale ou confirme:

- Git
- Node.js 22+
- pnpm
- Docker Desktop
- WSL com uma distribuicao Linux instalada, preferencialmente Ubuntu

Observacao: Docker e WSL estao instalados, mas ainda e necessario ter uma distribuicao WSL ativa para o fluxo ideal no Windows.

## 2. Instalar uma distro WSL

No PowerShell:

```powershell
wsl --list --online
wsl --install Ubuntu
```

Depois abra o Ubuntu uma vez e conclua a criacao do usuario.

## 3. Preparar ambiente

```powershell
cd C:\Users\tiago\Documents\Codex\saas_escala
Copy-Item .env.example .env
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install
```

## 4. Subir infraestrutura local

```powershell
docker compose up -d
docker compose ps
```

Servicos:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Mailpit SMTP: `localhost:1025`
- Mailpit UI: `http://localhost:8025`

## 5. Rodar migrations

```powershell
pnpm db:migrate
```

Esse comando cria ou atualiza o schema global `core`. Os schemas de cada espaco sao criados quando um novo espaco e cadastrado.

## 6. Rodar aplicacoes

```powershell
pnpm dev
```

Endpoints planejados:

- Web/PWA: `http://localhost:3000`
- API: `http://localhost:3333`
- Healthcheck: `http://localhost:3333/health`

## 7. Criar o primeiro espaco

Com a API rodando:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3333/tenants `
  -ContentType "application/json" `
  -Body '{"slug":"piloto-marcelo","displayName":"Piloto Marcelo"}'
```

Listar espacos:

```powershell
Invoke-RestMethod http://localhost:3333/tenants
```

Verificar banco:

```powershell
Invoke-RestMethod http://localhost:3333/health/db
```

## 8. Reset local

Apaga volumes de banco e Redis:

```powershell
docker compose down -v
```
