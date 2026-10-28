-- Lucky Urban Manager v8: saldo em dívida por produto comprado.
-- Aplicar uma vez no projeto Supabase ENCOMENDAS/STOCK antes de publicar o app.js v8.
alter table public.order_items
  add column supplier_amount_paid numeric(12,2) not null default 0;

update public.order_items
set supplier_amount_paid=round(quantity*purchase_price,2)
where source='purchased' and supplier_paid=true;

alter table public.order_items
  add constraint order_items_supplier_amount_paid_valid
  check (supplier_amount_paid >= 0 and supplier_amount_paid <= quantity*purchase_price);

-- Enquanto o navegador ainda usa a versão anterior, uma nova compra marcada
-- como paga tem de continuar a entrar com o valor total em 'já pago'.
create or replace function private.sync_legacy_supplier_payment_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.source='purchased' and new.supplier_paid and new.supplier_amount_paid=0 then
    new.supplier_amount_paid := round(new.quantity*new.purchase_price,2);
  end if;
  return new;
end;
$function$;
create trigger sync_legacy_supplier_payment_insert
before insert on public.order_items
for each row execute function private.sync_legacy_supplier_payment_insert();
revoke all on function private.sync_legacy_supplier_payment_insert() from public, anon, authenticated;

-- A edição de encomendas aceita os clientes antigos (supplier_paid) e os novos
-- (supplier_amount_paid). O mesmo valor nunca pode ultrapassar o custo do produto.
create or replace function private.supplier_paid_from_payload(p_item jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_total numeric;
  v_paid numeric;
begin
  if p_item->>'source' <> 'purchased' then return 0; end if;
  v_total := coalesce((p_item->>'quantity')::integer,0)
    * greatest(0,coalesce((p_item->>'purchase_price')::numeric,0));
  if p_item ? 'supplier_amount_paid' then
    v_paid := (p_item->>'supplier_amount_paid')::numeric;
  elsif coalesce((p_item->>'supplier_paid')::boolean,false) then
    v_paid := v_total;
  else
    v_paid := 0;
  end if;
  if v_paid is null or v_paid < 0 or v_paid > v_total or v_paid <> round(v_paid,2) then
    raise exception 'Invalid supplier amount paid for product';
  end if;
  return v_paid;
end;
$function$;
revoke all on function private.supplier_paid_from_payload(jsonb) from public, anon, authenticated;

-- Mantém o botão antigo a funcionar durante a atualização do site.
create or replace function public.set_supplier_paid(
  p_order_item_id uuid, p_paid boolean,
  p_supplier_name text default null, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $function$
declare
  v_item public.order_items%rowtype;
  v_amount numeric;
  v_delta numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_item from public.order_items where id=p_order_item_id for update;
  if not found then raise exception 'Order item not found'; end if;
  if not private.is_workspace_member(v_item.workspace_id)
     or not private.has_any_module(array['orders','new-order','dashboard']::text[]) then
    raise exception 'Not allowed';
  end if;
  if v_item.source <> 'purchased' then
    raise exception 'Only purchased items have supplier payment status';
  end if;
  v_amount := round(coalesce(v_item.purchase_price,0)*coalesce(v_item.quantity,0),2);
  v_delta := abs((case when p_paid then v_amount else 0 end)-v_item.supplier_amount_paid);
  update public.order_items
  set supplier_name=coalesce(nullif(trim(p_supplier_name),''),supplier_name),
      supplier_amount_paid=case when p_paid then v_amount else 0 end,
      supplier_paid=p_paid,
      supplier_paid_at=case when p_paid then now() else null end,
      supplier_note=case when p_note is null then supplier_note else nullif(trim(p_note),'') end
  where id=p_order_item_id returning * into v_item;
  if v_delta > 0 then
    insert into public.supplier_payment_logs(
      workspace_id,order_id,order_item_id,supplier_name,amount,action,note,created_by
    ) values(
      v_item.workspace_id,v_item.order_id,v_item.id,v_item.supplier_name,v_delta,
      case when p_paid then 'paid' else 'unpaid' end,
      nullif(trim(coalesce(p_note,'')),''),auth.uid()
    );
  end if;
  return jsonb_build_object('ok',true,'supplier_paid',v_item.supplier_paid,
    'supplier_paid_at',v_item.supplier_paid_at,'amount',v_amount,
    'supplier_amount_paid',v_item.supplier_amount_paid);
end;
$function$;

-- Alterar o saldo por pagar é uma operação atómica sujeita às regras do espaço.
create or replace function public.set_supplier_balance(
  p_order_item_id uuid, p_amount_due numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public', 'private'
as $function$
declare
  v_item public.order_items%rowtype;
  v_total numeric;
  v_new_paid numeric;
  v_delta numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_item from public.order_items where id=p_order_item_id for update;
  if not found then raise exception 'Order item not found or inaccessible'; end if;
  if not private.is_workspace_member(v_item.workspace_id)
     or not private.has_any_module(array['orders']::text[]) then
    raise exception 'Not allowed';
  end if;
  if v_item.source <> 'purchased' then
    raise exception 'Only purchased items have a supplier balance';
  end if;
  v_total := round(v_item.quantity*v_item.purchase_price,2);
  if p_amount_due is null or p_amount_due < 0 or p_amount_due > v_total
     or p_amount_due <> round(p_amount_due,2) then
    raise exception 'Amount due must be between zero and the product cost, with two decimal places';
  end if;
  v_new_paid := v_total-p_amount_due;
  v_delta := v_new_paid-v_item.supplier_amount_paid;
  if v_delta=0 then return jsonb_build_object('ok',true,'amount_due',p_amount_due); end if;
  update public.order_items
  set supplier_amount_paid=v_new_paid,
      supplier_paid=(p_amount_due=0),
      supplier_paid_at=case when p_amount_due=0 then coalesce(supplier_paid_at,now()) else null end
  where id=v_item.id returning * into v_item;
  insert into public.supplier_payment_logs(
    workspace_id,order_id,order_item_id,supplier_name,amount,action,note,created_by
  ) values(
    v_item.workspace_id,v_item.order_id,v_item.id,v_item.supplier_name,abs(v_delta),
    case when v_delta>0 then 'paid' else 'unpaid' end,
    'Saldo do fornecedor ajustado',auth.uid()
  );
  return jsonb_build_object('ok',true,'supplier_amount_paid',v_new_paid,'amount_due',p_amount_due);
end;
$function$;
revoke all on function public.set_supplier_balance(uuid,numeric) from public, anon;
grant execute on function public.set_supplier_balance(uuid,numeric) to authenticated;

-- A função edit_order_full existente é atualizada abaixo para guardar saldos
-- parciais e manter os IDs dos produtos que continuam na encomenda.
CREATE OR REPLACE FUNCTION public.edit_order_full(p_order_id uuid, p_order_ref text, p_order_date date, p_channel text, p_shipping_type text, p_items jsonb, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_order public.orders%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_old_date date;
  v_status text;
  v_total_sale numeric := 0;
  v_product_cost numeric := 0;
  v_shipping_out numeric := 0;
  v_shipping_return numeric := 0;
  v_revenue numeric := 0;
  v_result numeric := 0;
  v_item jsonb;
  v_qty integer;
  v_need record;
  v_old_item record;
  v_new_same jsonb;
  v_paid_amount numeric;
  v_existing_id uuid;
  v_new_id uuid;
  v_seen_ids uuid[] := '{}'::uuid[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.is_workspace_member(v_order.workspace_id)
     or not private.has_any_module(array['orders','new-order']::text[]) then
    raise exception 'Not allowed';
  end if;
  if coalesce(trim(p_order_ref),'')='' then raise exception 'Order reference required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'At least one item required';
  end if;

  v_old_date := v_order.order_date;
  v_status := v_order.status;

  select jsonb_build_object(
    'order',to_jsonb(v_order),
    'items',coalesce(jsonb_agg(to_jsonb(oi) order by oi.created_at),'[]'::jsonb)
  )
  into v_before
  from public.order_items oi
  where oi.order_id=p_order_id;

  if v_before is null then
    v_before:=jsonb_build_object('order',to_jsonb(v_order),'items','[]'::jsonb);
  end if;

  if v_status='Devolvido' then
    if jsonb_array_length(p_items) <> (select count(*) from public.order_items where order_id=p_order_id) then
      raise exception 'Returned order products cannot be added or removed';
    end if;

    for v_old_item in select * from public.order_items where order_id=p_order_id loop
      select elem into v_new_same
      from jsonb_array_elements(p_items) elem
      where (elem->>'id')::uuid=v_old_item.id
      limit 1;

      if v_new_same is null then raise exception 'Returned order products cannot be replaced'; end if;

      if coalesce(v_new_same->>'source','')<>v_old_item.source
         or coalesce(v_new_same->>'product_name','')<>v_old_item.product_name
         or coalesce(v_new_same->>'size','')<>coalesce(v_old_item.size,'')
         or coalesce((v_new_same->>'quantity')::integer,0)<>v_old_item.quantity
         or coalesce(v_new_same->>'stock_item_id','')<>coalesce(v_old_item.stock_item_id::text,'') then
        raise exception 'For returned orders, product identity and quantity are locked to protect stock';
      end if;

      v_paid_amount := private.supplier_paid_from_payload(v_new_same);

      update public.order_items
      set sale_price=greatest(0,coalesce((v_new_same->>'sale_price')::numeric,0)),
          purchase_price=greatest(0,coalesce((v_new_same->>'purchase_price')::numeric,0)),
          supplier_name=nullif(v_new_same->>'supplier_name',''),
          supplier_amount_paid=v_paid_amount,
          supplier_paid=v_old_item.source='purchased' and v_paid_amount >= v_old_item.quantity*greatest(0,coalesce((v_new_same->>'purchase_price')::numeric,0)),
          supplier_paid_at=case
            when v_old_item.source='purchased' and v_paid_amount >= v_old_item.quantity*greatest(0,coalesce((v_new_same->>'purchase_price')::numeric,0))
              then coalesce(supplier_paid_at,now())
            else null
          end,
          supplier_note=nullif(v_new_same->>'supplier_note','')
      where id=v_old_item.id;
    end loop;
  else
    if v_status in ('Em trânsito','Entregue') then
      for v_old_item in
        select * from public.order_items
        where order_id=p_order_id and source='stock' and stock_item_id is not null
      loop
        update public.stock_items
        set quantity=quantity+v_old_item.quantity,updated_at=now()
        where id=v_old_item.stock_item_id;
      end loop;
    end if;

    for v_item in select * from jsonb_array_elements(p_items) loop
      if coalesce(v_item->>'product_name','')='' then raise exception 'Product name required'; end if;
      v_qty:=coalesce((v_item->>'quantity')::integer,0);
      if v_qty<=0 then raise exception 'Quantity must be positive'; end if;
      if coalesce(v_item->>'source','') not in ('stock','purchased') then
        raise exception 'Invalid product source';
      end if;
      if (v_item->>'source')='stock' and nullif(v_item->>'stock_item_id','') is null then
        raise exception 'Stock item required';
      end if;
      perform private.supplier_paid_from_payload(v_item);
    end loop;

    if v_status in ('Em trânsito','Entregue') then
      for v_need in
        select (elem->>'stock_item_id')::uuid stock_id,
               sum((elem->>'quantity')::integer)::integer qty
        from jsonb_array_elements(p_items) elem
        where elem->>'source'='stock'
        group by (elem->>'stock_item_id')::uuid
      loop
        perform 1
        from public.stock_items
        where id=v_need.stock_id
          and workspace_id=v_order.workspace_id
          and quantity>=v_need.qty
        for update;
        if not found then raise exception 'Insufficient stock for one of the selected products'; end if;
      end loop;
    end if;

    for v_item in select * from jsonb_array_elements(p_items) loop
      v_paid_amount := private.supplier_paid_from_payload(v_item);
      v_existing_id := nullif(v_item->>'id','')::uuid;
      if v_existing_id is not null then
        if v_existing_id = any(v_seen_ids) then raise exception 'Duplicate product in order'; end if;
        perform 1 from public.order_items where id=v_existing_id and order_id=p_order_id;
        if not found then raise exception 'Product does not belong to this order'; end if;
        update public.order_items set
          product_name=v_item->>'product_name',
          size=nullif(v_item->>'size',''),
          quantity=(v_item->>'quantity')::integer,
          sale_price=greatest(0,coalesce((v_item->>'sale_price')::numeric,0)),
          source=v_item->>'source',
          purchase_price=greatest(0,coalesce((v_item->>'purchase_price')::numeric,0)),
          stock_item_id=nullif(v_item->>'stock_item_id','')::uuid,
          supplier_name=case when v_item->>'source'='purchased' then nullif(v_item->>'supplier_name','') else null end,
          supplier_amount_paid=v_paid_amount,
          supplier_paid=case when v_item->>'source'='purchased' then v_paid_amount >= (v_item->>'quantity')::integer*greatest(0,coalesce((v_item->>'purchase_price')::numeric,0)) else false end,
          supplier_paid_at=case
            when v_item->>'source'='purchased' and v_paid_amount >= (v_item->>'quantity')::integer*greatest(0,coalesce((v_item->>'purchase_price')::numeric,0))
              then coalesce(nullif(v_item->>'supplier_paid_at','')::timestamptz,now())
            else null end,
          supplier_note=case when v_item->>'source'='purchased' then nullif(v_item->>'supplier_note','') else null end
        where id=v_existing_id;
        v_seen_ids := array_append(v_seen_ids,v_existing_id);
      else
        insert into public.order_items(
        workspace_id,order_id,product_name,size,quantity,sale_price,source,purchase_price,stock_item_id,
        supplier_name,supplier_amount_paid,supplier_paid,supplier_paid_at,supplier_note
        ) values(
        v_order.workspace_id,
        p_order_id,
        v_item->>'product_name',
        nullif(v_item->>'size',''),
        (v_item->>'quantity')::integer,
        greatest(0,coalesce((v_item->>'sale_price')::numeric,0)),
        v_item->>'source',
        greatest(0,coalesce((v_item->>'purchase_price')::numeric,0)),
        nullif(v_item->>'stock_item_id','')::uuid,
        case when v_item->>'source'='purchased' then nullif(v_item->>'supplier_name','') else null end,
        v_paid_amount,
        case when v_item->>'source'='purchased' then v_paid_amount >= (v_item->>'quantity')::integer*greatest(0,coalesce((v_item->>'purchase_price')::numeric,0)) else false end,
        case
          when v_item->>'source'='purchased' and v_paid_amount >= (v_item->>'quantity')::integer*greatest(0,coalesce((v_item->>'purchase_price')::numeric,0))
            then coalesce(nullif(v_item->>'supplier_paid_at','')::timestamptz,now())
          else null
        end,
        case when v_item->>'source'='purchased' then nullif(v_item->>'supplier_note','') else null end
        ) returning id into v_new_id;
        v_seen_ids := array_append(v_seen_ids,v_new_id);
      end if;
    end loop;

    delete from public.order_items where order_id=p_order_id and not (id = any(v_seen_ids));

    if v_status in ('Em trânsito','Entregue') then
      for v_need in
        select (elem->>'stock_item_id')::uuid stock_id,
               sum((elem->>'quantity')::integer)::integer qty
        from jsonb_array_elements(p_items) elem
        where elem->>'source'='stock'
        group by (elem->>'stock_item_id')::uuid
      loop
        update public.stock_items
        set quantity=quantity-v_need.qty,updated_at=now()
        where id=v_need.stock_id;
      end loop;
    end if;
  end if;

  select
    coalesce(sum(quantity*sale_price),0),
    coalesce(sum(case when source='purchased' then quantity*purchase_price else 0 end),0)
  into v_total_sale,v_product_cost
  from public.order_items
  where order_id=p_order_id;

  select coalesce(outbound_cost,0),coalesce(return_cost,0)
  into v_shipping_out,v_shipping_return
  from public.shipping_rates
  where workspace_id=v_order.workspace_id and shipping_type=p_shipping_type
  limit 1;

  if v_status='Cancelado antes envio' then v_shipping_out:=0; end if;
  if v_status<>'Devolvido' then v_shipping_return:=0; end if;
  if v_status='Entregue' then v_revenue:=v_total_sale; else v_revenue:=0; end if;

  v_result:=v_revenue-v_product_cost-v_shipping_out-v_shipping_return-coalesce(v_order.meta_cost,0);

  update public.orders
  set order_ref=p_order_ref,
      order_date=p_order_date,
      channel=p_channel,
      shipping_type=p_shipping_type,
      shipping_out=v_shipping_out,
      shipping_return=v_shipping_return,
      revenue=v_revenue,
      result=v_result,
      updated_at=now()
  where id=p_order_id
  returning * into v_order;

  select jsonb_build_object(
    'order',to_jsonb(v_order),
    'items',coalesce(jsonb_agg(to_jsonb(oi) order by oi.created_at),'[]'::jsonb)
  )
  into v_after
  from public.order_items oi
  where oi.order_id=p_order_id;

  insert into public.order_corrections(workspace_id,order_id,before_data,after_data,created_by)
  values(v_order.workspace_id,p_order_id,v_before,v_after,auth.uid());

  return jsonb_build_object(
    'ok',true,'old_date',v_old_date,'new_date',p_order_date,'status',v_status
  );
end;
$function$;
revoke all on function public.edit_order_full(uuid,text,date,text,text,jsonb,text) from public, anon;
grant execute on function public.edit_order_full(uuid,text,date,text,text,jsonb,text) to authenticated;
revoke all on function public.set_supplier_paid(uuid,boolean,text,text) from public, anon;
grant execute on function public.set_supplier_paid(uuid,boolean,text,text) to authenticated;
revoke all on function public.correct_stock_item(uuid,text,text,integer,numeric,text,text) from public, anon;
grant execute on function public.correct_stock_item(uuid,text,text,integer,numeric,text,text) to authenticated;
