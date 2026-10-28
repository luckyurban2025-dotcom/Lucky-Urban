# Lucky Urban Manager

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

## v8 — Stock disponível e dívida editável
- **Stock atual** mostra por defeito só artigos com quantidade positiva. Para corrigir um artigo esgotado, ativa **Mostrar artigos esgotados**; não se apaga nenhum produto nem o respetivo histórico.
- **Encomendas → Por pagar** mostra o que falta pagar em todos os meses. Em cada produto comprado vês o custo, o valor já pago e o saldo em dívida.
- **Alterar dívida** permite escrever o valor que falta pagar, entre zero e o custo do produto. Exemplo: custo de 17 €, escreves 7 € por pagar; o painel mostra 10 € já pagos. Podes corrigir esse saldo novamente.
- **Marcar pago** paga apenas o saldo restante. **Marcar por pagar** volta a colocar o total em dívida. Para corrigir o próprio custo do produto, usa **Editar encomenda**.
- No editor da encomenda, **Já pago ao fornecedor (€)** mantém pagamentos parciais quando alteras produto, quantidade ou custo. O valor já pago não pode ultrapassar o novo custo total.
- O resultado da encomenda continua a incluir o custo total do produto; alterar o saldo em dívida não mexe no lucro.

### Atualização v8
1. A migração `supplier_balance_v8.sql` já foi aplicada ao projeto Supabase ligado ao site. O ficheiro SQL no pacote serve para consulta e histórico; **não é necessário voltar a executá-lo**.
2. Na raiz do repositório `Lucky-Urban`, substitui `index.html`, `app.js`, `styles.css` e `README.md`. Mantém o `config.js` existente e não carregues o ficheiro SQL na raiz do GitHub.
3. Depois do deploy automático do Render, atualiza a página. Em **Stock**, os artigos a zero ficam ocultos até ativares o respetivo controlo; em **Encomendas**, usa **Alterar dívida** no produto.

## v8.1 — Editar o total em dívida
- O valor grande em **Encomendas → Por pagar** e no **Início** usa agora a soma do que realmente falta pagar por produto. Um produto de 17 € com 10 € já pagos acrescenta **7 €**, não 17 €, ao total.
- **Editar total** permite escrever diretamente quanto falta pagar no conjunto. Exemplo: a soma dos produtos é 100 €, mas sabes que deves 80 €; escreves 80 € e o painel mostra um **ajuste manual de −20 €** ao lado da soma.
- O ajuste pertence apenas ao espaço atual. Não muda o custo, os pagamentos nem o resultado de cada encomenda. Quando os saldos por produto mudarem, o total volta a ser calculado com o mesmo ajuste; podes voltar a corrigir ou escolher **Usar soma dos produtos**.
- Se não houver nenhum produto pendente e o total manual continuar positivo, a lista avisa que esse valor é um ajuste manual sem produto associado.
- A migração `supplier_total_v8_1.sql` já foi aplicada ao projeto Supabase do site. Os dois ficheiros SQL neste pacote são para histórico; **não os voltes a executar**.

### Publicar v8.1
Extrai o ZIP e substitui apenas `index.html`, `app.js`, `styles.css` e `README.md` na raiz do ramo `main` de `Lucky-Urban`. Mantém `config.js` e os dados existentes. O Render publica depois do commit quando o deploy automático está ativo.
