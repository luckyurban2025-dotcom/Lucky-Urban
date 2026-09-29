# Lucky Manager v4 — Admin só Utilizadores

- O Administrador só cria/edita/apaga utilizadores.
- O Admin não abre Lucky Urban, Verseline, Stock, Encomendas, Meta ou Despesas.
- Cada utilizador tem uma área isolada.
- Podes criar Lucky Urban, Verseline, João, etc.
- Cada utilizador recebe os módulos que escolheres.
- Password mostrada quando crias ou redefinis.
- Password antiga nunca é guardada em texto simples nem pode ser recuperada.
- Logo pode ser alterada no cartão do utilizador.

Substitui no GitHub:
index.html, app.js, styles.css, config.js, render.yaml, README.md


## v4.1 — Dashboard por mês
- Campo para escolher qualquer mês.
- Setas mês anterior / mês seguinte.
- Botão Mês atual.
- Receita, Resultado real, Meta, Encomendas, Entregues e Devolvidas mudam com o mês.
- A lista do Dashboard também mostra apenas as encomendas do mês selecionado.
- Stock em casa continua a representar o stock físico atual.


## v5 — Produtos, códigos de barras e scanner
- Todos os utilizadores normais têm uma área `Produtos & Códigos`.
- Cada código pertence exclusivamente ao espaço/utilizador atual.
- Criação de produto com marca, modelo, variante/cor, foto e tamanhos.
- Presets 35–45 e XS–XXL.
- Código de barras CODE128 gerado e imprimível.
- Botão `Imprimir códigos` para criar um livro/caderno físico.
- Scanner pela câmara do telemóvel.
- Ao reconhecer o código mostra FOTO + produto + tamanhos antes de dar entrada.
- Entrada rápida por tamanho e quantidade.
- Regista custo e data de entrada para o dashboard mensal.
- Também existe entrada manual pelo código se a câmara não funcionar.


## v5.1 — Editar encomendas e stock
- Botão Editar em cada encomenda.
- Corrige referência, data, canal, portes, produtos, tamanhos, quantidades, preços e custos.
- Encomendas em trânsito/entregues recalculam o stock com segurança: desfaz o movimento antigo e aplica o novo.
- Encomendas devolvidas bloqueiam identidade/quantidade/origem para não estragar stock já devolvido.
- Botão Editar em cada linha de stock.
- Corrige produto, tamanho, quantidade, custo e código.
- Ajustes rápidos + / - / Qtd. também ficam registados como correções.
- Histórico de correções guardado na base de dados.


## v6 — Gestão de fornecedores por encomenda
- Encomendas passam a abrir filtradas pelo mês atual.
- Podes escolher qualquer mês, estado e situação do fornecedor.
- Resumo: custo fornecedor, já pago e por pagar.
- Cada produto comprado para uma encomenda tem fornecedor próprio.
- Botão Marcar pago / Marcar por pagar em cada produto.
- Artigos usados do stock não aparecem como dívida a fornecedor.
- Nova encomenda permite indicar fornecedor e se já foi pago.
- Editar encomenda permite corrigir fornecedor e pagamento.
- Dashboard mostra Pago a fornecedores e Por pagar a fornecedores das encomendas do mês.
- Estado do pagamento fica separado por utilizador/espaço.

## v7 — Trabalhar sem perder pagamentos pendentes
- Encomendas abre em **Por pagar**, reunindo todos os meses, das encomendas mais antigas para as mais recentes.
- O resumo global mostra o valor por pagar, o valor já pago e o número de encomendas/produtos pendentes.
- **Por mês** mostra as encomendas e valores do mês escolhido. **Todas** mostra o histórico completo. Estado e pesquisa ajudam a encontrar uma encomenda.
- Cada produto comprado mostra fornecedor, tamanho, custo, estado do pagamento e data quando paga. Marcar pago pede confirmação do valor. O pagamento é pelo valor integral do produto; pagamentos parciais ainda não são suportados.
- O Início destaca o total por pagar de todos os meses. O resultado do mês já inclui o custo de produtos comprados mesmo que ainda não tenham sido pagos.
- Artigos de stock com quantidade zero aparecem para poderes corrigir enganos. A data e o mês inicial usam o fuso de Portugal.

### Uso diário
1. Abre **Encomendas → Por pagar** e verifica todas as compras ainda em dívida.
2. Confere produto, tamanho, fornecedor e custo. Se houver erro, usa **Editar encomenda**.
3. Quando pagares o valor integral do produto, clica **Marcar pago** e confirma. Para desfazer, encontra-o em **Todas** ou **Por mês** e clica **Marcar por pagar**.
4. Para ver as encomendas de setembro, abre **Por mês** e escolhe setembro. As dívidas antigas continuam no resumo global e na vista **Por pagar**.

### Atualização
Substitui `index.html`, `app.js`, `styles.css` e `README.md` na raiz do repositório existente. Não alteres `config.js`. O Render publica o ramo `main` quando o deploy automático está ativo.

## v7.1 — Um produto/tamanho por linha no stock
- Stock reúne entradas com o mesmo nome e tamanho, ignorando diferenças de maiúsculas e espaços. A quantidade mostrada é a soma de todas as entradas.
- Exemplo: `AIR FORCE LV` tamanho `41` com 1 unidade numa entrada e 0 noutra aparece uma única vez com quantidade 1.
- Os botões `+`, `−`, `Qtd.` e `Editar` trabalham sobre a quantidade reunida. O histórico das entradas originais e das devoluções mantém-se na base de dados.
- A escolha de artigo ao criar ou editar uma encomenda também apresenta cada nome/tamanho uma só vez.
