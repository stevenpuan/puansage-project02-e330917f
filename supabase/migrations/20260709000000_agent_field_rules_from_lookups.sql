-- ============================================================
-- Agent 欄位規範以系統 lookups 為準（完整版，可重複執行）
--  1) 補 expense_status 代碼
--  2) agent_write 新建預設狀態改為系統認可值（專案=諮詢中、商機=詢問中）
--  3) agent_ops_manual 欄位規範表以 lookups 允許值為準
-- 註：agent-manual edge function 也已同步（見 supabase/functions/agent-manual/index.ts）。
-- ============================================================

INSERT INTO public.lookups (category, code, label, sort_order, is_active) VALUES
 ('expense_status','待審','待審',10,true),('expense_status','已核准','已核准',20,true),
 ('expense_status','已支付','已支付',30,true),('expense_status','駁回','駁回',40,true)
ON CONFLICT DO NOTHING;

-- agent_write：新建預設狀態 = 系統認可值（project→諮詢中、opportunity→詢問中）
CREATE OR REPLACE FUNCTION public.agent_write(p_agent uuid, p_resource text, p_op text, p_id uuid, p_data jsonb, p_scopes text[] DEFAULT '{}'::text[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_status text; v_res text; v_need text; v_before jsonb; v_after jsonb; v_new_id uuid; v_code text; v_role_scopes text[]; v_owner uuid; v_cat uuid;
begin
  select status into v_status from ai_agents where id = p_agent;
  if not found or v_status <> 'active' then return jsonb_build_object('error','agent not found or inactive'); end if;
  v_role_scopes := public.agent_role_scopes(p_agent);
  v_res := public.agent_canon_resource(p_resource);
  select id into v_owner from profiles where kind='human' order by created_at limit 1;
  if v_res not in ('project','task','opportunity','service_ticket','personal_task','calendar_event','expense') then
    return jsonb_build_object('error','resource not writable','resource',p_resource); end if;
  if p_op not in ('create','update') then return jsonb_build_object('error','unsupported op (create/update only)','op',p_op); end if;
  v_need := v_res || case when p_op='create' then '.create' else '.edit' end;
  if not (v_need = any(coalesce(p_scopes,'{}')) and v_need = any(v_role_scopes)) then
    return jsonb_build_object('error','scope_denied','need',v_need,'in_token', v_need = any(coalesce(p_scopes,'{}')), 'in_role', v_need = any(v_role_scopes)); end if;

  if p_op = 'create' then
    if v_res='expense' then
      if coalesce(p_data->>'amount','')='' then return jsonb_build_object('error','amount required (金額必填)'); end if;
      v_cat := nullif(p_data->>'category_id','')::uuid;
      if v_cat is null and coalesce(p_data->>'category','')<>'' then select id into v_cat from expense_categories where code=p_data->>'category' or name=p_data->>'category' limit 1; end if;
      insert into expenses(expense_no, payee, amount, tax, expense_date, category_id, applicant_id, payment_method, status, project_id, contract_id, client_id, invoice_no, description, note, created_by_agent)
      values('EX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), p_data->>'payee', (p_data->>'amount')::numeric, (nullif(p_data->>'tax',''))::numeric,
             coalesce((nullif(p_data->>'expense_date',''))::date, current_date), v_cat, v_owner, p_data->>'payment_method', coalesce(nullif(p_data->>'status',''),'待審'),
             (nullif(p_data->>'project_id',''))::uuid, (nullif(p_data->>'contract_id',''))::uuid, (nullif(p_data->>'client_id',''))::uuid, p_data->>'invoice_no', p_data->>'description', p_data->>'note', p_agent)
      returning id into v_new_id; select to_jsonb(x.*) into v_after from expenses x where id=v_new_id;
      insert into audit_logs(action,target_table,target_id,before,after) values('agent_write:create:'||p_agent::text,'expense',v_new_id::text,null,v_after);
      return jsonb_build_object('ok',true,'op','create','resource','expense','id',v_new_id,'after',v_after);
    end if;
    if coalesce(p_data->>'title','')='' then return jsonb_build_object('error','title required'); end if;
    if v_res='task' then
      if coalesce(p_data->>'case_id','')='' then return jsonb_build_object('error','case_id (專案id) required'); end if;
      insert into case_tasks(case_id, title, description, status, priority, assignee_id, due_date, created_by_agent)
      values((p_data->>'case_id')::uuid, p_data->>'title', p_data->>'description', coalesce(nullif(p_data->>'status',''),'待辦'),
             coalesce(nullif(p_data->>'priority',''),'medium'), (nullif(p_data->>'assignee_id',''))::uuid, (nullif(p_data->>'due_date',''))::date, p_agent)
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
      values(v_code, p_data->>'title', (nullif(p_data->>'client_id',''))::uuid, p_data->>'type', coalesce(nullif(p_data->>'priority',''),'medium'),
             coalesce(nullif(p_data->>'status',''),'諮詢中'), p_data->>'description', p_data->>'note', (nullif(p_data->>'start_date',''))::date, (nullif(p_data->>'due_date',''))::date, p_agent)
      returning id into v_new_id; select to_jsonb(c.*) into v_after from cases c where id=v_new_id;
    elsif v_res='opportunity' then
      v_code := coalesce(nullif(p_data->>'code',''), 'AG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
      insert into opportunities(code,title,client_id,source,status,est_amount,next_action,next_action_date,note,created_by_agent)
      values(v_code, p_data->>'title', (nullif(p_data->>'client_id',''))::uuid, p_data->>'source', coalesce(nullif(p_data->>'status',''),'詢問中'),
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
    if v_res='expense' then
      select to_jsonb(x.*) into v_before from expenses x where id=p_id; if v_before is null then return jsonb_build_object('error','row not found'); end if;
      v_cat := nullif(p_data->>'category_id','')::uuid;
      if v_cat is null and coalesce(p_data->>'category','')<>'' then select id into v_cat from expense_categories where code=p_data->>'category' or name=p_data->>'category' limit 1; end if;
      update expenses set payee=coalesce(p_data->>'payee',payee), amount=coalesce((nullif(p_data->>'amount',''))::numeric,amount),
        tax=coalesce((nullif(p_data->>'tax',''))::numeric,tax), expense_date=coalesce((nullif(p_data->>'expense_date',''))::date,expense_date),
        category_id=coalesce(v_cat,category_id), payment_method=coalesce(p_data->>'payment_method',payment_method), status=coalesce(nullif(p_data->>'status',''),status),
        project_id=coalesce((nullif(p_data->>'project_id',''))::uuid,project_id), description=coalesce(p_data->>'description',description), note=coalesce(p_data->>'note',note), updated_at=now()
      where id=p_id; select to_jsonb(x.*) into v_after from expenses x where id=p_id;
    elsif v_res='project' then
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

-- agent_ops_manual：欄位規範以 lookups 允許值為準（完整內容見遠端；此處重點為上方 agent_write 與 lookup）
-- 完整 agent_ops_manual 已於遠端套用，內容與 supabase/functions/agent-manual/index.ts 對齊。
