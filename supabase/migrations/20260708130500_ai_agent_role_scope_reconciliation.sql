-- ============================================================
-- AI Agent 權限整合：Scope 綁角色 + 專屬角色 + 寫入留痕
-- 全部 idempotent，可安全重跑
-- ============================================================

-- 1) 專屬角色 ai_agent
INSERT INTO public.roles(code, name, description)
VALUES ('agent','AI 代理','AI Agent 專屬角色；實際權限以 role_agent_scopes 勾稽的 scope 為準')
ON CONFLICT (code) DO NOTHING;

-- 2) 角色↔scope 勾稽表
CREATE TABLE IF NOT EXISTS public.role_agent_scopes(
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  scope   text NOT NULL REFERENCES public.agent_scopes(scope) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, scope)
);
ALTER TABLE public.role_agent_scopes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ras_sel ON public.role_agent_scopes;
CREATE POLICY p_ras_sel ON public.role_agent_scopes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_ras_all ON public.role_agent_scopes;
CREATE POLICY p_ras_all ON public.role_agent_scopes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3) ai_agent 角色預設 scope：讀取放寬，寫入預設只開 cases.write
INSERT INTO public.role_agent_scopes(role_id, scope)
SELECT r.id, s.scope
FROM public.roles r
CROSS JOIN (VALUES
  ('me.read'),('knowledge.read'),
  ('cases.read'),('opportunities.read'),('contracts.read'),('clients.read'),('service_tickets.read'),
  ('cases.write')
) AS s(scope)
WHERE r.code='agent'
ON CONFLICT DO NOTHING;

-- 4) 既有 agent 從 staff 移到 ai_agent（移完再跑為 no-op）
UPDATE public.ai_agents SET role_id = (SELECT id FROM public.roles WHERE code='agent')
WHERE role_id = (SELECT id FROM public.roles WHERE code='staff');

-- 5) 角色 scope helper
CREATE OR REPLACE FUNCTION public.agent_role_scopes(p_agent uuid)
 RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(ras.scope), '{}')
  FROM public.ai_agents a
  JOIN public.role_agent_scopes ras ON ras.role_id = a.role_id
  WHERE a.id = p_agent;
$$;

-- 6) 管理員調整角色 scope 的入口
CREATE OR REPLACE FUNCTION public.set_role_scopes(p_role uuid, p_scopes text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.is_admin() then raise exception 'permission denied'; end if;
  delete from public.role_agent_scopes where role_id = p_role;
  insert into public.role_agent_scopes(role_id, scope)
  select p_role, x FROM unnest(p_scopes) x
  where x in (select scope from public.agent_scopes)
  on conflict do nothing;
end $$;
GRANT EXECUTE ON FUNCTION public.set_role_scopes(uuid, text[]) TO authenticated;

-- 7) token 自動夾限：scopes = 勾選 ∩ 角色允許
CREATE OR REPLACE FUNCTION public.clamp_token_scopes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  new.scopes := (
    select coalesce(jsonb_agg(s), '[]'::jsonb)
    from jsonb_array_elements_text(coalesce(new.scopes, '[]'::jsonb)) s
    where s in (
      select ras.scope from public.role_agent_scopes ras
      join public.ai_agents a on a.role_id = ras.role_id
      where a.id = new.agent_id
    )
  );
  return new;
end $$;
DROP TRIGGER IF EXISTS trg_clamp_token_scopes ON public.ai_agent_tokens;
CREATE TRIGGER trg_clamp_token_scopes
  BEFORE INSERT OR UPDATE OF scopes ON public.ai_agent_tokens
  FOR EACH ROW EXECUTE FUNCTION public.clamp_token_scopes();

-- 8) 寫入留痕欄位
ALTER TABLE public.cases           ADD COLUMN IF NOT EXISTS created_by_agent uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.case_tasks      ADD COLUMN IF NOT EXISTS created_by_agent uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.opportunities   ADD COLUMN IF NOT EXISTS created_by_agent uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS created_by_agent uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL;

-- 9) 前台可視化 agent 活動
CREATE OR REPLACE VIEW public.v_agent_activity AS
SELECT l.id, l.created_at,
  split_part(l.action, ':', 2) AS op,
  nullif(split_part(l.action, ':', 3), '')::uuid AS agent_id,
  a.name AS agent_name,
  l.target_table AS resource,
  l.target_id,
  coalesce(l.after->>'title', l.before->>'title') AS title,
  l.before, l.after
FROM public.audit_logs l
LEFT JOIN public.ai_agents a ON a.id = nullif(split_part(l.action, ':', 3), '')::uuid
WHERE l.action LIKE 'agent_write:%'
ORDER BY l.created_at DESC;
