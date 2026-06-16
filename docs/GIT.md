# Git e GitHub

Repositorio remoto:

```text
https://github.com/tiagogferrari/saas_escala.git
```

## Criar o repositorio local

Na pasta do projeto:

```powershell
cd C:\Users\tiago\Documents\Codex\saas_escala
git init
git branch -M main
git remote add origin https://github.com/tiagogferrari/saas_escala.git
git add .
git commit -m "chore: scaffold initial monorepo"
git push -u origin main
```

Se o repositorio remoto ja tiver arquivo inicial criado pelo GitHub, use:

```powershell
git pull origin main --allow-unrelated-histories
```

Resolva conflitos se aparecerem, depois rode novamente:

```powershell
git add .
git commit -m "chore: scaffold initial monorepo"
git push -u origin main
```

## Fluxo sugerido

- `main`: sempre funcional.
- branches: `feat/nome-curto`, `fix/nome-curto`, `chore/nome-curto`.
- commits pequenos e descritivos.
- PR mesmo trabalhando sozinho, quando quiser manter historico revisavel.
