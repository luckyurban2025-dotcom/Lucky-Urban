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
