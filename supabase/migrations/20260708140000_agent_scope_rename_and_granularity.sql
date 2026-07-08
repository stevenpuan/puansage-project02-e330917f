-- ============================================================
-- AI Agent scope 重整：改用系統實際名稱（project/task/opportunity/service_ticket…）
-- 寫入拆成 新增(.create)/修改(.edit)；手冊加名稱對照表與欄位 JSON 範例
-- 對應遠端已套用之三段變更，合併於此檔。可重複執行。
-- ============================================================

-- 1) 資源名稱正規化（新英文名 + 舊技術名 → canonical）
CREATE OR REPLACE FUNCTION public.agent_canon_resource(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(p,''))
    WHEN 'project' THEN 'project' WHEN 'projects' THEN 'project' WHEN 'cases' THEN 'project' WHEN 'case' THEN 'project'
    WHEN 'task' THEN 'task' WHEN 'tasks' THEN 'task' WHEN 'case_tasks' THEN 'task' WHEN 'case_task' THEN 'task'
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

-- 2) 重建 agent_scopes
DELETE FROM public.role_agent_scopes;
DELETE FROM public.agent_scopes;
INSERT INTO public.agent_scopes (scope, category, description, sensitivity, reserved, sort_order) VALUES
 ('me.read','讀取','讀取自身身分與權限 (whoami)','low',false,1),
 ('knowledge.read','讀取','拉取學習包 / 知識','low',false,2),
 ('project.read','讀取','讀取 專案','low',false,10),
 ('task.read','讀取','讀取 任務','low',false,11),
 ('opportunity.read','讀取','讀取 商機','low',false,12),
 ('service_ticket.read','讀取','讀取 服務工單','low',false,13),
 ('contract.read','讀取','讀取 合約','medium',false,14),
 ('client.read','讀取','讀取 客戶（含聯絡人）','medium',false,15),
 ('quote.read','讀取','讀取 報價單','low',false,16),
 ('payment.read','讀取','讀取 收款排程','medium',true,17),
 ('invoice.read','讀取','讀取 發票','medium',true,18),
 ('commission.read','讀取','讀取 業務獎金','high',true,19),
 ('project.create','新增','新增 專案','medium',false,30),
 ('task.create','新增','新增 任務','low',false,31),
 ('opportunity.create','新增','新增 商機','medium',false,32),
 ('service_ticket.create','新增','新增 服務工單','medium',false,33),
 ('project.edit','修改','修改 專案','medium',false,40),
 ('task.edit','修改','修改 任務','low',false,41),
 ('opportunity.edit','修改','修改 商機','medium',false,42),
 ('service_ticket.edit','修改','修改 服務工單','medium',false,43);

-- 3) ai_agent 角色預設：全部（可到 Agent 權限頁再調）
INSERT INTO public.role_agent_scopes(role_id, scope)
SELECT r.id, s.scope FROM public.roles r CROSS JOIN public.agent_scopes s WHERE r.code='agent';

-- 4) 既有 token 更新為新 scope（clamp 與角色取交集）
UPDATE public.ai_agent_tokens t
SET scopes = (SELECT jsonb_agg(ras.scope) FROM public.role_agent_scopes ras
              JOIN public.ai_agents a ON a.role_id=ras.role_id WHERE a.id=t.agent_id)
WHERE t.revoked_at IS NULL;

-- 5) agent_query：canonical 資源名 + 新 .read scope + quote 讀取
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
    return jsonb_build_object('error','scope_denied','need',v_scope,
      'in_token', v_scope = any(coalesce(p_scopes,'{}')), 'in_role', v_scope = any(v_role_scopes));
  end if;

  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select %s from public.%I order by created_at desc nulls last limit %s offset %s) t',
    v_cols, v_table, v_lim, v_off) into v_rows;
  return jsonb_build_object('resource',v_res,'scope',v_scope,'count',jsonb_array_length(v_rows),'rows',v_rows);
end $function$;

-- 6) agent_write：canonical + create→.create / update→.edit；service_ticket 可新增
CREATE OR REPLACE FUNCTION public.agent_write(p_agent uuid, p_resource text, p_op text, p_id uuid, p_data jsonb, p_scopes text[] DEFAULT '{}'::text[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_status text; v_res text; v_need text; v_before jsonb; v_after jsonb; v_new_id uuid; v_code text; v_role_scopes text[];
begin
  select status into v_status from ai_agents where id = p_agent;
  if not found or v_status <> 'active' then return jsonb_build_object('error','agent not found or inactive'); end if;
  v_role_scopes := public.agent_role_scopes(p_agent);
  v_res := public.agent_canon_resource(p_resource);

  if v_res not in ('project','task','opportunity','service_ticket') then
    return jsonb_build_object('error','resource not writable','resource',p_resource);
  end if;
  if p_op not in ('create','update') then
    return jsonb_build_object('error','unsupported op (create/update only)','op',p_op);
  end if;

  v_need := v_res || case when p_op='create' then '.create' else '.edit' end;
  if not (v_need = any(coalesce(p_scopes,'{}')) and v_need = any(v_role_scopes)) then
    return jsonb_build_object('error','scope_denied','need',v_need,
      'in_token', v_need = any(coalesce(p_scopes,'{}')), 'in_role', v_need = any(v_role_scopes));
  end if;

  if p_op = 'create' then
    if coalesce(p_data->>'title','')='' then return jsonb_build_object('error','title required'); end if;

    if v_res='task' then
      if coalesce(p_data->>'case_id','')='' then return jsonb_build_object('error','case_id (專案id) required'); end if;
      insert into case_tasks(case_id, title, description, status, priority, assignee_id, due_date, created_by_agent)
      values((p_data->>'case_id')::uuid, p_data->>'title', p_data->>'description',
             coalesce(nullif(p_data->>'status',''),'待辦'), coalesce(nullif(p_data->>'priority',''),'medium'),
             (nullif(p_data->>'assignee_id',''))::uuid, (nullif(p_data->>'due_date',''))::date, p_agent)
      returning id into v_new_id;
      select to_jsonb(t.*) into v_after from case_tasks t where id=v_new_id;

    elsif v_res='project' then
      v_code := coalesce(nullif(p_data->>'code',''), 'AG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
      insert into cases(code,title,client_id,type,priority,status,description,note,start_date,due_date,created_by_agent)
      values(v_code, p_data->>'title', (nullif(p_data->>'client_id',''))::uuid, p_data->>'type',
             coalesce(p_data->>'priority','medium'), coalesce(p_data->>'status','open'),
             p_data->>'description', p_data->>'note',
             (nullif(p_data->>'start_date',''))::date, (nullif(p_data->>'due_date',''))::date, p_agent)
      returning id into v_new_id;
      select to_jsonb(c.*) into v_after from cases c where id=v_new_id;

    elsif v_res='opportunity' then
      v_code := coalesce(nullif(p_data->>'code',''), 'AG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
      insert into opportunities(code,title,client_id,source,status,est_amount,next_action,next_action_date,note,created_by_agent)
      values(v_code, p_data->>'title', (nullif(p_data->>'client_id',''))::uuid, p_data->>'source',
             coalesce(p_data->>'status','open'), (nullif(p_data->>'est_amount',''))::numeric,
             p_data->>'next_action', (nullif(p_data->>'next_action_date',''))::date, p_data->>'note', p_agent)
      returning id into v_new_id;
      select to_jsonb(o.*) into v_after from opportunities o where id=v_new_id;

    else -- service_ticket
      insert into service_tickets(ticket_no,title,description,type,priority,status,client_id,system_id,contract_id,created_by_agent)
      values(coalesce(nullif(p_data->>'ticket_no',''),'AG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
             p_data->>'title', p_data->>'description',
             coalesce(nullif(p_data->>'type',''),'bug'), coalesce(nullif(p_data->>'priority',''),'中'),
             coalesce(nullif(p_data->>'status',''),'open'),
             (nullif(p_data->>'client_id',''))::uuid, (nullif(p_data->>'system_id',''))::uuid, (nullif(p_data->>'contract_id',''))::uuid, p_agent)
      returning id into v_new_id;
      select to_jsonb(s.*) into v_after from service_tickets s where id=v_new_id;
    end if;

    insert into audit_logs(action,target_table,target_id,before,after)
      values('agent_write:create:'||p_agent::text, v_res, v_new_id::text, null, v_after);
    return jsonb_build_object('ok',true,'op','create','resource',v_res,'id',v_new_id,'after',v_after);

  else -- update
    if p_id is null then return jsonb_build_object('error','missing id'); end if;
    if v_res='project' then
      select to_jsonb(c.*) into v_before from cases c where id=p_id;
      if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update cases set status=coalesce(p_data->>'status',status), priority=coalesce(p_data->>'priority',priority),
        note=coalesce(p_data->>'note',note), description=coalesce(p_data->>'description',description),
        due_date=coalesce((nullif(p_data->>'due_date',''))::date,due_date),
        go_live_date=coalesce((nullif(p_data->>'go_live_date',''))::date,go_live_date),
        acceptance_date=coalesce((nullif(p_data->>'acceptance_date',''))::date,acceptance_date), updated_at=now()
      where id=p_id;
      select to_jsonb(c.*) into v_after from cases c where id=p_id;
    elsif v_res='task' then
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
    elsif v_res='opportunity' then
      select to_jsonb(o.*) into v_before from opportunities o where id=p_id;
      if v_before is null then return jsonb_build_object('error','row not found'); end if;
      update opportunities set status=coalesce(p_data->>'status',status), next_action=coalesce(p_data->>'next_action',next_action),
        next_action_date=coalesce((nullif(p_data->>'next_action_date',''))::date,next_action_date),
        note=coalesce(p_data->>'note',note), updated_at=now()
      where id=p_id;
      select to_jsonb(o.*) into v_after from opportunities o where id=p_id;
    else -- service_ticket
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
      values('agent_write:update:'||p_agent::text, v_res, p_id::text, v_before, v_after);
    return jsonb_build_object('ok',true,'op','update','resource',v_res,'id',p_id,'after',v_after);
  end if;
end $function$;

-- 7) agent_ops_manual：名稱對照表 + 欄位 JSON 範例
CREATE OR REPLACE FUNCTION public.agent_ops_manual(p_agent uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare granted text; manual text;
begin
  select coalesce(string_agg(distinct value, ', '), '（尚無有效 Token）') into granted
  from ai_agent_tokens t, lateral jsonb_array_elements_text(to_jsonb(t.scopes)) as value
  where t.agent_id = p_agent and t.revoked_at is null and (t.expires_at is null or t.expires_at > now());
  manual := $md$
## 七、系統操作手冊（線上版）

### 名稱對照（你在系統看到的名稱 ↔ API resource）
| 系統名稱 | resource | 讀 | 新增 | 修改 |
|---|---|---|---|---|
| 專案 | project | ✔ | ✔ | ✔ |
| 任務 | task | ✔ | ✔ | ✔ |
| 商機 | opportunity | ✔ | ✔ | ✔ |
| 服務工單 | service_ticket | ✔ | ✔ | ✔ |
| 合約 | contract | ✔ | － | － |
| 客戶（含聯絡人） | client / client_contact | ✔ | － | － |
| 報價單 | quote | ✔ | － | － |
| 收款排程 | payment | ✔ | － | － |
| 發票 | invoice | ✔ | － | － |
| 業務獎金 | commission | ✔ | － | － |

### 權限規則
- Scope 分三級：`<resource>.read`（讀）、`.create`（新增）、`.edit`（修改）。未授權一律 403 scope_denied。
- 實際權限 = Token scope ∩ 角色 scope。讀取單次最多 100 筆（預設 50）。所有 write 記稽核。

### API
- 讀取：POST ?action=data，body {resource,limit,offset}
- 寫入：POST ?action=write，body {resource,op:'create'|'update',id,data:{...}}
- 收到「建立/新增/修改/填入」類指令時，務必實際呼叫 write，不可只回文字。

### 各資源新增/修改的 data 欄位 JSON
【專案 project】.create
{ "resource":"project","op":"create","data":{ "title":"必填","client_id":"客戶UUID","type":"顧問/開發/維護","priority":"low|medium|high","status":"open","start_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD","description":"說明" } }
【專案 project】.edit（需 id）
{ "resource":"project","op":"update","id":"專案UUID","data":{ "status":"進行中","priority":"high","due_date":"YYYY-MM-DD" } }

【任務 task】.create（先讀 project 取得 case_id）
{ "resource":"task","op":"create","data":{ "case_id":"專案UUID（必填）","title":"必填","priority":"low|medium|high","status":"待辦|進行中|完成","due_date":"YYYY-MM-DD","assignee_id":"使用者UUID","description":"說明" } }
【任務 task】.edit（需 id）
{ "resource":"task","op":"update","id":"任務UUID","data":{ "status":"完成","done_at":"2026-07-08T12:00:00Z" } }

【商機 opportunity】.create
{ "resource":"opportunity","op":"create","data":{ "title":"必填","client_id":"客戶UUID","source":"來源","status":"open","est_amount":100000,"next_action":"下一步","next_action_date":"YYYY-MM-DD","note":"備註" } }
【商機 opportunity】.edit（需 id）
{ "resource":"opportunity","op":"update","id":"商機UUID","data":{ "status":"跟進中","next_action":"報價","next_action_date":"YYYY-MM-DD" } }

【服務工單 service_ticket】.create
{ "resource":"service_ticket","op":"create","data":{ "title":"必填","description":"問題描述","type":"bug","priority":"低|中|高","status":"open","client_id":"客戶UUID","system_id":"系統UUID","contract_id":"合約UUID" } }
【服務工單 service_ticket】.edit（需 id）
{ "resource":"service_ticket","op":"update","id":"工單UUID","data":{ "status":"處理中","spent_hours":2,"resolved_at":"2026-07-08T12:00:00Z" } }

### 對 AI Agent 的要求
先 whoami 認識自己與授權 scope；只在授權內行動；不虛構 id/金額，寫入前先用 data 讀出來源確認 id；update 前先讀出確認；scope_denied 明確告知缺哪個 scope；繁體中文回覆並附寫入結果 id。
$md$;
  return manual || E'\n**本 Agent 目前有效 Token 授權 scope**：' || granted || E'\n';
end $function$;
