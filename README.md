# Lucky Urban / Verseline — Gestão

Aplicação web simples, sem Excel.

## O que já está ligado
- Supabase: projeto `ENCOMENDAS/STOCK`
- Workspaces separados:
  - Lucky Urban
  - Verseline
- Stock
- Nova encomenda com 1–10 produtos dinâmicos
- "Vai usar stock?" SIM/NÃO
- Encomendas e estados
- Meta Ads
- Portes
- Despesas
- Dashboard
- Código de barras interno no stock

## Como pôr online no Render

1. Cria um repositório no GitHub.
2. Envia TODOS estes ficheiros para a raiz do repositório:
   - `index.html`
   - `styles.css`
   - `config.js`
   - `app.js`
   - `render.yaml`
3. No Render:
   - New + → Static Site
   - liga o repositório
   - Publish directory: `.`
   - não é preciso comando de build
4. Faz Deploy.

`config.js` usa apenas a chave **publishable** do Supabase. Essa chave foi criada para ser usada no frontend; a segurança real é feita pelas regras RLS da base de dados.

## Primeiro acesso
No site:
1. escolhe Lucky Urban ou Verseline;
2. cria um utilizador com email e palavra-passe;
3. se receberes confirmação por email, confirma;
4. inicia sessão;
5. introduz o código privado de ativação daquele workspace.

Não publiques os códigos privados de ativação no GitHub.

## Nota sobre stock
- "SIM — escolher do stock": escolhes diretamente um artigo físico que já existe no stock.
- "NÃO — comprado/sem stock": escreves manualmente produto, tamanho, preço de venda e custo.
- Se um artigo comprado para a encomenda for devolvido, entra no stock.
- Se um artigo que saiu do stock for devolvido, volta ao stock.
