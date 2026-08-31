# Revisão técnica — v2

Verificado:
- Sintaxe JavaScript.
- Estrutura para Render Static Site.
- Ligação por chave publishable do Supabase.
- Lucky Urban e Verseline separados por workspace/RLS.
- Códigos de ativação one-time existentes e ainda não usados.
- Stock manual e stock de devoluções.
- Encomendas com 1–10 produtos dinâmicos.
- Meta Ads exclui Vinted.
- Portes por zona.
- Dashboard e despesas.

Correções v2:
- Impede usar mais unidades do mesmo stock quando o mesmo artigo é escolhido em várias linhas.
- Atualização de stock agregada por artigo.
- Limita mudanças de estado perigosas.
- Devoluções restauram quantidades agregadas corretamente.
- Se falhar a gravação dos produtos, remove a encomenda incompleta.
- Mensagem clara para Nº de encomenda/referência duplicado.

Ainda precisa de um teste real no browser depois do primeiro utilizador ser criado/ativado, porque sem um utilizador autenticado não é possível testar o fluxo completo de RLS como cliente.
