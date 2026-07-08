-- 帳號整合 view + 選單（帳號總覽、Agent 學習資源）+ 學習包改讀 scope
-- idempotent，可安全重跑。

-- 1) 帳號總覽 view（人員 + AI 代理）
CREATE OR REPLACE VIEW public.v_accounts AS
SELECT
  p.id,
  p.kind AS account_type,
  coalesce(a.name, p.full_name) AS name,
  coalesce(a.email, p.email) AS email,
  p.status,
  a.id AS agent_id,
  a.status AS agent_status,
  p.created_at
FROM public.profiles p
LEFT JOIN public.ai_agents a ON a.user_id = p.id;
ALTER VIEW public.v_accounts SET (security_invoker = true);

-- 2) 選單
DO $$
DECLARE v_sys uuid; v_ai uuid;
BEGIN
  SELECT id INTO v_sys FROM public.menus WHERE menu_key='grp_sys';
  SELECT id INTO v_ai  FROM public.menus WHERE menu_key='grp_ai';
  IF v_sys IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.menus WHERE menu_key='accounts') THEN
    UPDATE public.menus SET sort_order = sort_order + 1 WHERE parent_id=v_sys AND sort_order >= 51;
    INSERT INTO public.menus (menu_key, parent_id, title, icon, route, module_key, page_key, sort_order, is_active)
    VALUES ('accounts', v_sys, '帳號總覽', 'UsersRound', '/dashboard/accounts', 'users', 'accounts', 51, true);
  END IF;
  IF v_ai IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.menus WHERE menu_key='ai_agent_learning') THEN
    UPDATE public.menus SET sort_order = sort_order + 1 WHERE parent_id=v_ai AND sort_order >= 62;
    INSERT INTO public.menus (menu_key, parent_id, title, icon, route, module_key, page_key, sort_order, is_active)
    VALUES ('ai_agent_learning', v_ai, 'Agent 學習資源', 'GraduationCap', '/dashboard/agent-learning', 'ai_agents', null, 62, true);
  END IF;
END $$;

-- 3) export_agent_pack：權限段改讀 role_agent_scopes（不再讀人類模組權限），API 段補 data/write 與手冊連結
CREATE OR REPLACE FUNCTION public.export_agent_pack(p_agent uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare a record; r_name text; md text; k record; p record; kn_cnt int;
        base_url text := 'https://oxtozbvbyjwokwisrghm.supabase.co/functions/v1/agent-api';
        manual_url text := 'https://oxtozbvbyjwokwisrghm.supabase.co/functions/v1/agent-manual';
        tok_cnt int; nearest_exp timestamptz;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'permission denied';
  end if;
  select * into a from public.ai_agents where id = p_agent;
  if not found then return null; end if;
  select name into r_name from public.roles where id = a.role_id;

  md := '# AI Agent 學習包：' || a.name || E'\n\n';
  md := md || '> 產生時間：' || to_char(now(),'YYYY-MM-DD HH24:MI') || '　狀態：' || a.status || E'\n\n';
  md := md || '## 一、身分' || E'\n' || coalesce(a.description,'（未填）') || E'\n\n';
  md := md || '## 二、人格設定' || E'\n' || '```json' || E'\n' || coalesce(a.persona::text,'{}') || E'\n' || '```' || E'\n\n';
  if a.system_prompt is not null then
    md := md || '## 三、系統提示' || E'\n' || a.system_prompt || E'\n\n';
  end if;

  md := md || '## 四、權限（角色：' || coalesce(r_name,'—') || '）' || E'\n';
  md := md || '實際權限 = Token scope ∩ 角色 scope。Scope 分三級：`.read`(讀) `.create`(新增) `.edit`(修改)。' || E'\n';
  md := md || '本角色開放的 scope：' || E'\n';
  for p in select ras.scope, s.description from public.role_agent_scopes ras
           left join public.agent_scopes s on s.scope=ras.scope
           where ras.role_id = a.role_id order by ras.scope loop
    md := md || '- `' || p.scope || '`' || coalesce(' — '||p.description,'') || E'\n';
  end loop;

  select count(*), min(expires_at) into tok_cnt, nearest_exp
  from public.ai_agent_tokens where agent_id = p_agent and revoked_at is null
    and (expires_at is null or expires_at > now());
  md := md || E'\n## 五、API 串聯與限制' || E'\n';
  md := md || '- **Base URL**：`' || base_url || '`' || E'\n';
  md := md || '- **操作手冊（名稱對照 + 各資源 JSON 範例）**：`' || manual_url || '`（GET，可帶 ?systems=project,task）' || E'\n';
  md := md || '- **認證**：HTTP Header `Authorization: Bearer <你的 AI Token>`' || E'\n';
  md := md || '- **可用動作**：`whoami` / `pack` / `data`(讀，需 <resource>.read) / `write`(寫，create 需 .create、update 需 .edit)' || E'\n';
  md := md || '- **可寫入資源**：project、task、opportunity、service_ticket；其餘唯讀。' || E'\n';
  md := md || '- **限制**：僅能執行角色開放的 scope；Agent 須 active；' ||
        case when tok_cnt>0 then '目前有效 Token ' || tok_cnt || ' 組' ||
             case when nearest_exp is not null then '，最近到期 ' || to_char(nearest_exp,'YYYY-MM-DD') else '，無到期' end
             else '目前尚無有效 Token' end || '；所有寫入記稽核。' || E'\n\n';

  select count(*) into kn_cnt from public.ai_agent_knowledge ak
    join public.ai_knowledge kn on kn.id=ak.knowledge_id
    where ak.agent_id=p_agent and kn.status='active';
  md := md || '## 六、知識庫（' || kn_cnt || ' 篇）' || E'\n\n';
  if kn_cnt = 0 then
    md := md || '（尚未指派知識文章；可於「知識庫」建立文章並指派給本 Agent）' || E'\n\n';
  end if;
  for k in select kn.title, kn.category, kn.content
           from public.ai_agent_knowledge ak
           join public.ai_knowledge kn on kn.id = ak.knowledge_id
           where ak.agent_id = p_agent and kn.status = 'active'
           order by kn.category nulls last, kn.title loop
    md := md || '### ' || k.title ||
          case when k.category is not null then '（' || k.category || '）' else '' end || E'\n\n'
          || coalesce(k.content,'') || E'\n\n';
  end loop;
  return md;
end $function$;
