-- Lucky Urban Manager v9: ligar cada entrada de stock ao artigo físico.
-- A aplicação já envia stock_item_id; a coluna faltava na tabela.
alter table public.stock_receipts
  add column stock_item_id uuid references public.stock_items(id) on delete set null;

create index stock_receipts_stock_item_id_idx
  on public.stock_receipts(stock_item_id)
  where stock_item_id is not null;
