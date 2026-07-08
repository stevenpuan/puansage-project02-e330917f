-- ============================================================
-- 專案/個人/行事曆 分流（完整版，可重複執行）
--  1) agent 新增可寫資源 personal_task、calendar_event
--  2) agent_query / agent_write 支援上述資源（owner 綁 human）
--  3) v_calendar 納入 task / personal_task 到期日 + security_invoker
--  4) agent_ops_manual 加分類判斷與 JSON 範例
-- ============================================================

-- 1) 資源正規化
CREATE OR REPLACE FUNCTION public.agent_canon_resource(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(p,''))
    WHEN 'project' THEN 'project' WHEN 'projects' THEN 'project' WHEN 'cases' THEN 'project' WHEN 'case' THEN 'project'
    WHEN 'task' THEN 'task' WHEN 'tasks' THEN 'task' WHEN 'case_tasks' THEN 'task' WHEN 'case_task' THEN 'task'
    WHEN 'personal_task' THEN 'personal_task' WHEN 'personal_tasks' THEN 'personal_task' WHEN 'ptask' THEN 'personal_task' WHEN 'todo' THEN 'personal_task'
    WHEN 'calendar_event' THEN 'calendar_event' WHEN 'calendar_events' THEN 'calendar_event' WHEN 'event' THEN 'calendar_event' WHEN 'calendar' THEN 'calendar_event'
    WHEN 'opportunity' THEN 'opportunity' WHEN 'opportunities' THEN 'opportunity' WHEN 'opp' THEN 'opportunity'
    WHEN 'service_ticket' THEN 'service_ticket' WHEN 'service_tickets' THEN 'service_ticket' WHEN 'ticket' THEN 'service_ticket'
    WHEN 'contract' THEN 'contract' WHEN 'contracts' THEN 'contract'
    WHEN 'client' THEN 'client' WHEN 'clients' THEN 'client'
    WHEN 'client_contact' THEN 'client_contact' WHEN 'client_contacts' THEN 'client_contact'
    WHEN 'quote' THEN 'quote' WHEN 'quotes' THEN 'quote'
    WHEN 'payment' THEN 'payment' WHEN 'payments' THEN 'payment'
    WHEN 'invoice' THEN 'invoice' WHEN 'invoices' THEN 'invoice'
    WHEN 'commission' THEN 'commission' WHEN 'commission_entries' THEN 'commission'
    ELSE lower(coalesce(p,'')) END;
$$;

-- 2) 新 scope + 角色
INSERT INTO public.agent_scopes (scope, category, description, sensitivity, reserved, sort_order) VALUES
 ('personal_task.read','讀取','讀取 個人任務','low',false,20),
 ('calendar_event.read','讀取','讀取 行事曆','low',false,21),
 ('personal_task.create','新增','新增 個人任務','low',false,34),
 ('calendar_event.create','新增','新增 行事曆','low',false,35),
 ('personal_task.edit','修改','修改 個人任務','low',false,44),
 ('calendar_event.edit','修改','修改 行事曆','low',false,45)
ON CONFLICT (scope) DO NOTHING;
INSERT INTO public.role_agent_scopes(role_id, scope)
SELECT r.id, s.scope FROM public.roles r CROSS JOIN (VALUES
  ('personal_task.read'),('calendar_event.read'),('personal_task.create'),
  ('calendar_event.create'),('personal_task.edit'),('calendar_event.edit')
) AS s(scope) WHERE r.code='agent' ON CONFLICT DO NOTHING;

-- 3) v_calendar 納入任務到期日 + security_invoker
CREATE OR REPLACE VIEW public.v_calendar AS
 SELECT 'event:'||e.id::text AS id, 'event'::text AS kind, e.id AS ref_id, e.title,
    e.start_at, e.end_at, e.all_day, COALESCE(e.color,'#6366f1') AS color, true AS editable, e.owner_id, e.visibility
   FROM calendar_events e
 UNION ALL
 SELECT 'case:'||c.id::text, 'case', c.id, ('案件到期：'||COALESCE(c.code,'')||' ')||COALESCE(c.title,''),
    c.due_date::timestamptz, NULL::timestamptz, true, '#3b82f6', false, NULL::uuid, 'public'
   FROM cases c WHERE c.due_date IS NOT NULL
 UNION ALL
 SELECT 'task:'||t.id::text, 'task', t.id, '任務：'||COALESCE(t.title,''),
    t.due_date::timestamptz, NULL::timestamptz, true, '#8b5cf6', false, NULL::uuid, 'public'
   FROM case_tasks t WHERE t.due_date IS NOT NULL AND t.status <> '完成'
 UNION ALL
 SELECT 'ptask:'||pt.id::text, 'personal_task', pt.id, '個人：'||COALESCE(pt.title,''),
    pt.due_date::timestamptz, NULL::timestamptz, true, '#10b981', true, pt.owner_id, pt.visibility
   FROM personal_tasks pt WHERE pt.due_date IS NOT NULL AND pt.status <> '完成'
 UNION ALL
 SELECT 'pay:'||p.id::text, 'payment', p.id, ('收款到期：'||COALESCE(p.title,'')||' $')||COALESCE(p.amount,0)::text,
    p.due_date::timestamptz, NULL::timestamptz, true, '#f59e0b', false, NULL::uuid, 'public'
   FROM payments p WHERE p.due_date IS NOT NULL AND p.status <> '已收'
 UNION ALL
 SELECT 'maint:'||m.id::text, 'maintenance', m.id, '維護到期：'||COALESCE(m.name,''),
    m.maintenance_due::timestamptz, NULL::timestamptz, true, '#ef4444', false, NULL::uuid, 'public'
   FROM v_maintenance_alerts m WHERE m.maintenance_due IS NOT NULL;
ALTER VIEW public.v_calendar SET (security_invoker = true);

-- 4) agent_query（含 personal_task / calendar_event 讀取）
CREATE OR REPLACE FUNCTION public.agent_query(p_agent uuid, p_resource text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_scopes text[] DEFAULT '{}'::text[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_status text; v_res text; v_table text; v_scope text; v_cols text; v_role_scopes text[];
  v_lim int := least(greatest(coalesce(p_limit,50),1),100);
  v_off int := greatest(coalesce(p_offset,0),0); v_rows jsonb;
begin
  select status into v_status from ai_agents where id = p_agent;
  if not found or v_status <> 'active' then return jsonb_build_object('error','agent not found or inactive'); end if;
  v_role_scopes := public.agent_role_scopes(p_agent);
  v_res := public.agent_canon_resource(p_resource);
  case v_res
    when 'project' then v_table:='cases'; v_scope:='project.read';
      v_cols:='id, code, title, client_id, system_id, type, status, priority, amount, start_date, due_date, closed_at, description, kickoff_date, go_live_date, acceptance_date, warranty_months, warranty_end, created_by_agent, created_at';
    when 'task' then v_table:='case_tasks'; v_scope:='task.read';
      v_cols:='id, case_id, title, description, status, priority, assignee_id, due_date, done_at, created_by, created_by_agent, created_at';
    when 'personal_task' then v_table:='personal_tasks'; v_scope:='personal_task.read';
      v_cols:='id, owner_id, title, description, status, priority, due_date, done_at, visibility, created_at';
    when 'calendar_event' then v_table:='calendar_events'; v_scope:='calendar_event.read';
      v_cols:='id, owner_id, title, description, start_at, end_at, all_day, location, visibility, created_at';
    when 'opportunity' then v_table:='opportunities'; v_scope:='opportunity.read';
      v_cols:='id, code, title, client_id, source, status, est_amount, next_action, next_action_date, converted_project_id, created_by_agent, created_at';
    when 'service_ticket' then v_table:='service_tickets'; v_scope:='service_ticket.read';
      v_cols:='id, ticket_no, system_id, contract_id, client_id, title, description, type, priority, status, assignee_id, opened_at, responded_at, resolved_at, spent_hours, billable, created_by_agent, created_at';
    when 'contract' then v_table:='contracts'; v_scope:='contract.read';
      v_cols:='id, contract_no, contract_type, title, client_id, system_id, project_id, billing_type, contract_amount, dev_fee, maintenance_fee, signed_date, start_date, end_date, term_months, auto_renew, status, payment_status, invoice_status, next_payment_date, maintenance_period, included_hours, sla_hours, created_at';
    when 'client' then v_table:='clients'; v_scope:='client.read';
      v_cols:='id, code, name, tax_id, contact_name, phone, email, created_at';
    when 'client_contact' then v_table:='client_contacts'; v_scope:='client.read';
      v_cols:='id, client_id, name, title, phone, email, is_primary, created_at';
    when 'quote' then v_table:='quotes'; v_scope:='quote.read';
      v_cols:='id, quote_no, opportunity_id, client_id, title, quote_date, valid_until, status, subtotal, tax, total, note, created_at';
    when 'payment' then v_table:='payments'; v_scope:='payment.read';
      v_cols:='id, contract_id, title, amount, due_date, paid_date, status, method, invoice_no, invoice_status, created_at';
    when 'invoice' then v_table:='invoices'; v_scope:='invoice.read';
      v_cols:='id, payment_id, contract_id, invoice_no, invoice_date, type, amount_untaxed, tax, amount_total, status, created_at';
    when 'commission' then v_table:='commission_entries'; v_scope:='commission.read';
      v_cols:='id, contract_id, project_id, payment_id, plan_id, deal_role, base_amount, rate, commission_amount, realized, realized_on, payout_period, payout_status, created_at';
    else return jsonb_build_object('error','unknown resource','resource',p_resource);
  end case;
  if not (v_scope = any(coalesce(p_scopes,'{}')) and v_scope = any(v_role_scopes)) then
    return jsonb_build_object('error','scope_denied','need',v_scope,'in_token', v_scope = any(coalesce(p_scopes,'{}')), 'in_role', v_scope = any(v_role_scopes));
  end if;
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select %s from public.%I order by created_at desc nulls last limit %s offset %s) t',
    v_cols, v_table, v_lim, v_off) into v_rows;
  return jsonb_build_object('resource',v_res,'scope',v_scope,'count',jsonb_array_length(v_rows),'rows',v_rows);
end $function$;

-- 5) agent_write（含 personal_task / calendar_event 建立與修改，owner 綁 human）
CREATE OR REPLACE FUNCTION public.agent_write(p_agent uuid, p_resource text, p_op text, p_id uuid, p_data jsonb, p_scopes text[] DEFAULT '{}'::text[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_status text; v_res text; v_need text; v_before jsonb; v_after jsonb; v_new_id uuid; v_code text; v_role_scopes text[]; v_owner uuid;
begin
  select status into v_status from ai_agents where id = p_agent;
  if not found or v_status <> 'active' then return jsonb_build_object('error','agent not found or inactive'); end if;
  v_role_scopes := public.agent_role_scopes(p_agent);
  v_res := public.agent_canon_resource(p_resource);
  select id into v_owner from profiles where kind='human' order by created_at limit 1;
  if v_res not in ('project','task','opportunity','service_ticket','personal_task','calendar_event') then
    return jsonb_build_object('error','resource not writable','resource',p_resource); end if;
  if p_op not in ('create','update') then return jsonb_build_object('error','unsupported op (create/update only)','op',p_op); end if;
  v_need := v_res || case when p_op='create' then '.create' else '.edit' end;
  if not (v_need = any(coalesce(p_scopes,'{}')) and v_need = any(v_role_scopes)) then
    return jsonb_build_object('error','scope_denied','need',v_need,'in_token', v_need = any(coalesce(p_scopes,'{}')), 'in_role', v_need = any(v_role_scopes)); end if;

  if p_op = 'create' then
    if coalesce(p_data->>'title','')='' then return jsonb_build_object('error','title required'); end if;
    if v_res='task' then
      if coalesce(p_data->>'case_id','')='' then return jsonb_build_object('error','case_id (專案id) required'); end if;
      insert into case_tasks(case_id, title, description, status, priority, assignee_id, due_date, created_by_agent)
      values((p_data->>'case_id')::uuid, p_data->>'title', p_data->>'description',
             coalesce(nullif(p_data->>'status',''),'待辦'), coalesce(nullif(p_data->>'priority',''),'medium'),
             (nullif(p_data->>'assignee_id',''))::uuid, (nullif(p_data->>'due_date',''))::date, p_agent)
      returning id into v_new_id; select to_jsonb(t.*) into v_after from case_tasks t where id=v_new_id;
    elsif v_res='personal_task' then
      insert into personal_tasks(owner_id, title, description, status, priority, due_date, visibility)
      values(v_owner, p_data->>'title', p_data->>'description', coalesce(nullif(p_data->>'status',''),'待辦'),
             coalesce(nullif(p_data->>'priority',''),'medium'), (nullif(p_data->>'due_date',''))::date, coalesce(nullif(p_data->>'visibility',''),'private'))
      returning id into v_new_id; select to_jsonb(x.*) into v_after from personal_tasks x where id=v_new_id;
    elsif v_res='calendar_event' then
      if coalesce(p_data->>'start_at','')='' then return jsonb_build_object('error','start_at required (行事曆需開始時間)'); end if;
      insert into calendar_events(owner_id, title, description, start_at, end_at, all_day, location, visibility)
      values(v_owner, p_data->>'title', p_data->>'description', (p_data->>'start_at')::timestamptz, (nullif(p_data->>'end_at',''))::timestamptz,
             coalesce((nullif(p_data->>'all_day',''))::boolean, false), p_data->>'location', coalesce(nullif(p_data->>'visibility',''),'private'))
      returning id into v_new_id; select to_jsonb(x.*) into v_after from calendar_events x where id=v_new_id;
    elsif v_res='project' then
      v_code := coalesce(nullif(p_data->>'code',''), 'AG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
      insert into cases(code,title,client_id,type,priority,status,description,note,start_date,due_date,created_by_agent)
      values(v_code, p_data->>'title', (nullif(p_data->>'client_id',''))::uuid, p_data->>'type',
             coalesce(p_data->>'priority','medium'), coalesce(p_data->>'status','open'), p_data->>'description', p_data->>'note',
             (nullif(p_data->>'start_date',''))::date, (nullif(p_data->>'due_date',''))::date, p_agent)
      returning id into v_new_id; select to_jsonb(c.*) into v_after from cases c where id=v_new_id;
    elsif v_res='opportunity' then
      v_code := coalesce(nullif(p_data->>'code',''), 'AG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
      insert into opportunities(code,title,client_id,source,status,est_amount,next_action,next_action_date,note,created_by_agent)
      values(v_code, p_data->>'title', (nullif(p_data->>'client_id',''))::uuid, p_data->>'source', coalesce(p_data->>'status','open'),
             (nullif(p_data->>'est_amount',''))::numeric, p_data->>'next_action', (nullif(p_data->>'next_action_date',''))::date, p_data->>'note', p_agent)
      returning id into v_new_id; select to_jsonb(o.*) into v_after from opportunities o where id=v_new_id;
    else
      insert into service_tickets(ticket_no,title,description,type,priority,status,client_id,system_id,contract_id,created_by_agent)
      values(coalesce(nullif(p_data->>'ticket_no',''),'AG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))), p_data->>'title', p_data->>'description',
             coalesce(nullif(p_data->>'type',''),'bug'), coalesce(nullif(p_data->>'priority',''),'中'), coalesce(nullif(p_data->>'status',''),'open'),
             (nullif(p_data->>'client_id',''))::uuid, (nullif(p_data->>'system_id',''))::uuid, (nullif(p_data->>'contract_id',''))::uuid, p_agent)
      returning id into v_new_id; select to_jsonb(s.*) into v_after from service_tickets s where id=v_new_id;
    end if;
    insert into audit_logs(action,target_table,target_id,before,after) values('agent_write:create:'||p_agent::text, v_res, v_new_id::text, null, v_after);
    return jsonb_build_object('ok',true,'op','create','resource',v_res,'id',v_new_id,'after',v_after);
  else
    if p_id is null then return jsonb_build_object('error','missing id'); end if;
    if v_res='project' then
      select to_jsonb(c.*) into v_before from cases c where id=p_id; if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update cases set status=coalesce(p_data->>'status',status), priority=coalesce(p_data->>'priority',priority), note=coalesce(p_data->>'note',note),
        description=coalesce(p_data->>'description',description), due_date=coalesce((nullif(p_data->>'due_date',''))::date,due_date), updated_at=now() where id=p_id;
      select to_jsonb(c.*) into v_after from cases c where id=p_id;
    elsif v_res='task' then
      select to_jsonb(t.*) into v_before from case_tasks t where id=p_id; if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update case_tasks set title=coalesce(nullif(p_data->>'title',''),title), status=coalesce(nullif(p_data->>'status',''),status),
        priority=coalesce(nullif(p_data->>'priority',''),priority), description=coalesce(p_data->>'description',description),
        assignee_id=coalesce((nullif(p_data->>'assignee_id',''))::uuid,assignee_id), due_date=coalesce((nullif(p_data->>'due_date',''))::date,due_date),
        done_at=coalesce((nullif(p_data->>'done_at',''))::timestamptz,done_at), updated_at=now() where id=p_id;
      select to_jsonb(t.*) into v_after from case_tasks t where id=p_id;
    elsif v_res='personal_task' then
      select to_jsonb(x.*) into v_before from personal_tasks x where id=p_id; if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update personal_tasks set title=coalesce(nullif(p_data->>'title',''),title), status=coalesce(nullif(p_data->>'status',''),status),
        priority=coalesce(nullif(p_data->>'priority',''),priority), description=coalesce(p_data->>'description',description),
        due_date=coalesce((nullif(p_data->>'due_date',''))::date,due_date), done_at=coalesce((nullif(p_data->>'done_at',''))::timestamptz,done_at), updated_at=now() where id=p_id;
      select to_jsonb(x.*) into v_after from personal_tasks x where id=p_id;
    elsif v_res='calendar_event' then
      select to_jsonb(x.*) into v_before from calendar_events x where id=p_id; if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update calendar_events set title=coalesce(nullif(p_data->>'title',''),title), description=coalesce(p_data->>'description',description),
        start_at=coalesce((nullif(p_data->>'start_at',''))::timestamptz,start_at), end_at=coalesce((nullif(p_data->>'end_at',''))::timestamptz,end_at),
        all_day=coalesce((nullif(p_data->>'all_day',''))::boolean,all_day), location=coalesce(p_data->>'location',location), updated_at=now() where id=p_id;
      select to_jsonb(x.*) into v_after from calendar_events x where id=p_id;
    elsif v_res='opportunity' then
      select to_jsonb(o.*) into v_before from opportunities o where id=p_id; if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update opportunities set status=coalesce(p_data->>'status',status), next_action=coalesce(p_data->>'next_action',next_action),
        next_action_date=coalesce((nullif(p_data->>'next_action_date',''))::date,next_action_date), note=coalesce(p_data->>'note',note), updated_at=now() where id=p_id;
      select to_jsonb(o.*) into v_after from opportunities o where id=p_id;
    else
      select to_jsonb(s.*) into v_before from service_tickets s where id=p_id; if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update service_tickets set status=coalesce(p_data->>'status',status), priority=coalesce(p_data->>'priority',priority), note=coalesce(p_data->>'note',note),
        description=coalesce(p_data->>'description',description), type=coalesce(p_data->>'type',type),
        responded_at=coalesce((nullif(p_data->>'responded_at',''))::timestamptz,responded_at), resolved_at=coalesce((nullif(p_data->>'resolved_at',''))::timestamptz,resolved_at),
        spent_hours=coalesce((nullif(p_data->>'spent_hours',''))::numeric,spent_hours), updated_at=now() where id=p_id;
      select to_jsonb(s.*) into v_after from service_tickets s where id=p_id;
    end if;
    insert into audit_logs(action,target_table,target_id,before,after) values('agent_write:update:'||p_agent::text, v_res, p_id::text, v_before, v_after);
    return jsonb_build_object('ok',true,'op','update','resource',v_res,'id',p_id,'after',v_after);
  end if;
end $function$;
