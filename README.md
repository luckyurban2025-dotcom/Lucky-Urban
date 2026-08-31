# Lucky Manager v3 — Admin Clean

Esta versão substitui a v2.

## O que mudou
- Ecrã inicial com cartões de utilizador.
- Administrador separado.
- Admin cria utilizadores sem confirmação de email.
- Permissões reais por utilizador.
- Utilizador pode ter só Stock, ou qualquer combinação de módulos.
- Lucky Urban, Verseline e futuros espaços ficam separados.
- Admin pode trocar de espaço no menu.
- Admin pode criar novas lojas/espaços.
- Cada espaço pode ter a sua logo.
- Stock rápido com `-`, `+` e alteração direta da quantidade.
- Nova encomenda continua dinâmica: escolhes 1–10 produtos e só aparecem esses produtos.
- Em cada produto: usar stock SIM/NÃO.

## Atualizar o GitHub
No repositório `Lucky-Urban`, substitui os ficheiros atuais por estes:
- index.html
- app.js
- styles.css
- config.js
- render.yaml

Podes também enviar este README.md.

Depois faz `Commit changes`. O Render, se estiver ligado ao repositório, faz o deploy automaticamente.

## Primeiro acesso
No ecrã inicial escolhe `Administrador` e entra com o email/password do utilizador administrador que já foi criado.

Depois:
`Administração -> Utilizadores -> + Criar utilizador`

Para o teu irmão podes clicar `Só Stock` e dar apenas esse módulo.

## Logos
`Administração -> Lojas / Espaços -> Alterar logo`

As logos ficam guardadas no Supabase Storage e aparecem nos cartões de login e no menu.
