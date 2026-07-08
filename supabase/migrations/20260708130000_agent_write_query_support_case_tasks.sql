-- 讓 AI Agent 能讀寫 case_tasks（沿用 cases.read / cases.write scope）
-- 註：此檔的 agent_write/agent_query 於後續 migration 會再被覆寫加入角色勾稽，
--     保留於此以忠實反映遠端套用順序。CREATE OR REPLACE 可安全重跑。

CREATE OR REPLACE FUNCTION public.agent_query(p_agent uuid, p_resource text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_scopes text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_status text; v_table text; v_scope text; v_cols text;
  v_lim int := least(greatest(coalesce(p_limit,50),1),100);
  v_off int := greatest(coalesce(p_offset,0),0); v_rows jsonb;
begin
  select status into v_status from ai_agents where id = p_agent;
  if not found or v_status <> 'active' then return jsonb_build_object('error','agent not found or inactive'); end if;

  case p_resource
    when 'cases' then v_table:='cases'; v_scope:='cases.read';
      v_cols:='id, code, title, client_id, system_id, type, status, priority, amount, start_date, due_date, closed_at, description, kickoff_date, go_live_date, acceptance_date, warranty_months, warranty_end, created_at';
    when 'case_tasks' then v_table:='case_tasks'; v_scope:='cases.read';
      v_cols:='id, case_id, title, description, status, priority, assignee_id, due_date, done_at, created_by, created_at';
    when 'opportunities' then v_table:='opportunities'; v_scope:='opportunities.read';
      v_cols:='id, code, title, client_id, source, status, est_amount, next_action, next_action_date, converted_project_id, created_at';
    when 'contracts' then v_table:='contracts'; v_scope:='contracts.read';
      v_cols:='id, contract_no, contract_type, title, client_id, system_id, project_id, billing_type, contract_amount, dev_fee, maintenance_fee, signed_date, start_date, end_date, term_months, auto_renew, status, payment_status, invoice_status, next_payment_date, maintenance_period, included_hours, sla_hours, created_at';
    when 'clients' then v_table:='clients'; v_scope:='clients.read';
      v_cols:='id, code, name, tax_id, contact_name, phone, email, created_at';
    when 'client_contacts' then v_table:='client_contacts'; v_scope:='clients.read';
      v_cols:='id, client_id, name, title, phone, email, is_primary, created_at';
    when 'payments' then v_table:='payments'; v_scope:='payments.read';
      v_cols:='id, contract_id, title, amount, due_date, paid_date, status, method, invoice_no, invoice_status, created_at';
    when 'invoices' then v_table:='invoices'; v_scope:='invoices.read';
      v_cols:='id, payment_id, contract_id, invoice_no, invoice_date, type, amount_untaxed, tax, amount_total, status, created_at';
    when 'ledger' then v_table:='wish_point_ledger'; v_scope:='ledger.read';
      v_cols:='id, period, change, balance, reason, ref_id, created_at';
    when 'commission' then v_table:='commission_entries'; v_scope:='commission.read';
      v_cols:='id, contract_id, project_id, payment_id, plan_id, deal_role, base_amount, rate, commission_amount, realized, realized_on, payout_period, payout_status, created_at';
    when 'service_tickets' then v_table:='service_tickets'; v_scope:='service_tickets.read';
      v_cols:='id, ticket_no, system_id, contract_id, client_id, title, description, type, priority, status, assignee_id, opened_at, responded_at, resolved_at, spent_hours, billable, created_at';
    else return jsonb_build_object('error','unknown resource','resource',p_resource);
  end case;

  if not (v_scope = any(coalesce(p_scopes,'{}'))) then
    return jsonb_build_object('error','scope_denied','need',v_scope);
  end if;

  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select %s from public.%I order by created_at desc nulls last limit %s offset %s) t',
    v_cols, v_table, v_lim, v_off) into v_rows;
  return jsonb_build_object('resource',p_resource,'scope',v_scope,'count',jsonb_array_length(v_rows),'rows',v_rows);
end $function$;


CREATE OR REPLACE FUNCTION public.agent_write(p_agent uuid, p_resource text, p_op text, p_id uuid, p_data jsonb, p_scopes text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_status text; v_scope text; v_before jsonb; v_after jsonb; v_new_id uuid; v_code text;
begin
  select status into v_status from ai_agents where id = p_agent;
  if not found or v_status <> 'active' then return jsonb_build_object('error','agent not found or inactive'); end if;

  if p_resource='cases' then v_scope:='cases.write';
  elsif p_resource='case_tasks' then v_scope:='cases.write';
  elsif p_resource='opportunities' then v_scope:='opportunities.write';
  elsif p_resource='service_tickets' then v_scope:='service_tickets.write';
  else return jsonb_build_object('error','resource not writable','resource',p_resource); end if;

  if not (v_scope = any(coalesce(p_scopes,'{}'))) then
    return jsonb_build_object('error','scope_denied','need',v_scope);
  end if;

  if p_op = 'create' then
    if p_resource='service_tickets' then return jsonb_build_object('error','create not allowed for this resource'); end if;
    if coalesce(p_data->>'title','')='' then return jsonb_build_object('error','title required'); end if;

    if p_resource='case_tasks' then
      if coalesce(p_data->>'case_id','')='' then return jsonb_build_object('error','case_id required'); end if;
      insert into case_tasks(case_id, title, description, status, priority, assignee_id, due_date)
      values((p_data->>'case_id')::uuid, p_data->>'title', p_data->>'description',
             coalesce(nullif(p_data->>'status',''),'待辦'), coalesce(nullif(p_data->>'priority',''),'medium'),
             (nullif(p_data->>'assignee_id',''))::uuid, (nullif(p_data->>'due_date',''))::date)
      returning id into v_new_id;
      select to_jsonb(t.*) into v_after from case_tasks t where id=v_new_id;
    else
      v_code := coalesce(nullif(p_data->>'code',''), 'AG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
      if p_resource='cases' then
        insert into cases(code,title,client_id,type,priority,status,description,note,start_date,due_date)
        values(v_code, p_data->>'title', (nullif(p_data->>'client_id',''))::uuid, p_data->>'type',
               coalesce(p_data->>'priority','medium'), coalesce(p_data->>'status','open'),
               p_data->>'description', p_data->>'note',
               (nullif(p_data->>'start_date',''))::date, (nullif(p_data->>'due_date',''))::date)
        returning id into v_new_id;
        select to_jsonb(c.*) into v_after from cases c where id=v_new_id;
      else
        insert into opportunities(code,title,client_id,source,status,est_amount,next_action,next_action_date,note)
        values(v_code, p_data->>'title', (nullif(p_data->>'client_id',''))::uuid, p_data->>'source',
               coalesce(p_data->>'status','open'), (nullif(p_data->>'est_amount',''))::numeric,
               p_data->>'next_action', (nullif(p_data->>'next_action_date',''))::date, p_data->>'note')
        returning id into v_new_id;
        select to_jsonb(o.*) into v_after from opportunities o where id=v_new_id;
      end if;
    end if;

    insert into audit_logs(action,target_table,target_id,before,after)
      values('agent_write:create:'||p_agent::text, p_resource, v_new_id::text, null, v_after);
    return jsonb_build_object('ok',true,'op','create','resource',p_resource,'id',v_new_id,'after',v_after);

  elsif p_op = 'update' then
    if p_id is null then return jsonb_build_object('error','missing id'); end if;
    if p_resource='cases' then
      select to_jsonb(c.*) into v_before from cases c where id=p_id;
      if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update cases set status=coalesce(p_data->>'status',status), priority=coalesce(p_data->>'priority',priority),
        note=coalesce(p_data->>'note',note), description=coalesce(p_data->>'description',description),
        due_date=coalesce((nullif(p_data->>'due_date',''))::date,due_date),
        go_live_date=coalesce((nullif(p_data->>'go_live_date',''))::date,go_live_date),
        acceptance_date=coalesce((nullif(p_data->>'acceptance_date',''))::date,acceptance_date), updated_at=now()
      where id=p_id;
      select to_jsonb(c.*) into v_after from cases c where id=p_id;
    elsif p_resource='case_tasks' then
      select to_jsonb(t.*) into v_before from case_tasks t where id=p_id;
      if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update case_tasks set title=coalesce(nullif(p_data->>'title',''),title),
        status=coalesce(nullif(p_data->>'status',''),status),
        priority=coalesce(nullif(p_data->>'priority',''),priority),
        description=coalesce(p_data->>'description',description),
        assignee_id=coalesce((nullif(p_data->>'assignee_id',''))::uuid,assignee_id),
        due_date=coalesce((nullif(p_data->>'due_date',''))::date,due_date),
        done_at=coalesce((nullif(p_data->>'done_at',''))::timestamptz,done_at), updated_at=now()
      where id=p_id;
      select to_jsonb(t.*) into v_after from case_tasks t where id=p_id;
    elsif p_resource='opportunities' then
      select to_jsonb(o.*) into v_before from opportunities o where id=p_id;
      if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update opportunities set status=coalesce(p_data->>'status',status), next_action=coalesce(p_data->>'next_action',next_action),
        next_action_date=coalesce((nullif(p_data->>'next_action_date',''))::date,next_action_date),
        note=coalesce(p_data->>'note',note), updated_at=now()
      where id=p_id;
      select to_jsonb(o.*) into v_after from opportunities o where id=p_id;
    else
      select to_jsonb(s.*) into v_before from service_tickets s where id=p_id;
      if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update service_tickets set status=coalesce(p_data->>'status',status), priority=coalesce(p_data->>'priority',priority),
        note=coalesce(p_data->>'note',note), description=coalesce(p_data->>'description',description),
        type=coalesce(p_data->>'type',type),
        responded_at=coalesce((nullif(p_data->>'responded_at',''))::timestamptz,responded_at),
        resolved_at=coalesce((nullif(p_data->>'resolved_at',''))::timestamptz,resolved_at),
        spent_hours=coalesce((nullif(p_data->>'spent_hours',''))::numeric,spent_hours), updated_at=now()
      where id=p_id;
      select to_jsonb(s.*) into v_after from service_tickets s where id=p_id;
    end if;
    insert into audit_logs(action,target_table,target_id,before,after)
      values('agent_write:update:'||p_agent::text, p_resource, p_id::text, v_before, v_after);
    return jsonb_build_object('ok',true,'op','update','resource',p_resource,'id',p_id,'after',v_after);
  else
    return jsonb_build_object('error','unsupported op (create/update only)','op',p_op);
  end if;
end $function$;
