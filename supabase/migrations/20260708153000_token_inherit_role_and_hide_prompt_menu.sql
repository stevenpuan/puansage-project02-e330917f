-- token 權限一律 = 角色權限；改角色即同步 token；收掉「AI 操作提示詞」選單
-- idempotent，可安全重跑。

-- 1) token scopes 一律重算成角色 scope（token 只是憑證，角色是控制點）
CREATE OR REPLACE FUNCTION public.clamp_token_scopes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  new.scopes := coalesce(
    (select jsonb_agg(ras.scope order by ras.scope)
     from public.role_agent_scopes ras
     join public.ai_agents a on a.role_id = ras.role_id
     where a.id = new.agent_id),
    '[]'::jsonb);
  return new;
end $$;

-- 2) 改角色 scope 時同步刷新該角色所有 agent 的有效 token
CREATE OR REPLACE FUNCTION public.set_role_scopes(p_role uuid, p_scopes text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.is_admin() then raise exception 'permission denied'; end if;
  delete from public.role_agent_scopes where role_id = p_role;
  insert into public.role_agent_scopes(role_id, scope)
  select p_role, x from unnest(p_scopes) x
  where x in (select scope from public.agent_scopes)
  on conflict do nothing;

  update public.ai_agent_tokens t
  set scopes = (select coalesce(jsonb_agg(scope order by scope),'[]'::jsonb)
                from public.role_agent_scopes where role_id = p_role)
  where t.revoked_at is null
    and t.agent_id in (select id from public.ai_agents where role_id = p_role);
end $$;
GRANT EXECUTE ON FUNCTION public.set_role_scopes(uuid, text[]) TO authenticated;

-- 3) 現有 token 立即對齊角色
UPDATE public.ai_agent_tokens t
SET scopes = (select coalesce(jsonb_agg(ras.scope order by ras.scope),'[]'::jsonb)
              from public.role_agent_scopes ras
              join public.ai_agents a on a.role_id=ras.role_id where a.id=t.agent_id)
WHERE t.revoked_at is null;

-- 4) 收掉「AI 操作提示詞」選單（與「Agent 學習資源」重複）
UPDATE public.menus SET is_active=false WHERE menu_key='ai_agent_prompt';
