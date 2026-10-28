-- Lucky Urban Manager v8.1: editar o total em dívida por espaço.
-- Este ajuste é separado dos custos e pagamentos de cada produto.
alter table public.workspaces
  add column supplier_total_adjustment numeric(12,2) not null default 0;

create or replace function public.set_supplier_total(
  p_workspace_id uuid, p_total_due numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_itemized numeric;
  v_adjustment numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_total_due is null or p_total_due < 0 or p_total_due > 9999999999.99
     or p_total_due <> round(p_total_due,2) then
    raise exception 'Invalid supplier total';
  end if;
  perform 1 from public.workspaces where id=p_workspace_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  if not private.is_workspace_member(p_workspace_id)
     or not private.has_any_module(array['orders']::text[]) then
    raise exception 'Not allowed';
  end if;

  select coalesce(sum(greatest(0,quantity*purchase_price-supplier_amount_paid)),0)
  into v_itemized
  from public.order_items
  where workspace_id=p_workspace_id and source='purchased';

  v_adjustment := round(p_total_due-v_itemized,2);
  update public.workspaces
  set supplier_total_adjustment=v_adjustment
  where id=p_workspace_id;

  return jsonb_build_object('ok',true,'total_due',p_total_due,
    'itemized_due',v_itemized,'adjustment',v_adjustment);
end;
$function$;

revoke all on function public.set_supplier_total(uuid,numeric) from public, anon;
grant execute on function public.set_supplier_total(uuid,numeric) to authenticated;
