-- 側邊選單掛入兩個 agent 頁（AI 與研發 群組底下）
-- 整段以 menu_key 是否存在做守衛，可安全重跑（避免 sort_order 重複位移）

DO $$
DECLARE v_grp uuid;
BEGIN
  SELECT id INTO v_grp FROM public.menus WHERE menu_key='grp_ai';
  IF v_grp IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menus WHERE menu_key='ai_agent_scopes') THEN
    -- 群組內 sort_order>=65 的項目往後挪 2 位，空出位置
    UPDATE public.menus SET sort_order = sort_order + 2
      WHERE parent_id = v_grp AND sort_order >= 65;

    INSERT INTO public.menus (menu_key, parent_id, title, icon, route, module_key, page_key, sort_order, is_active)
    VALUES ('ai_agent_scopes', v_grp, 'Agent 權限', 'ShieldCheck', '/dashboard/agent-scopes', 'role_permissions', 'agent_scopes', 65, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menus WHERE menu_key='ai_agent_activity') THEN
    INSERT INTO public.menus (menu_key, parent_id, title, icon, route, module_key, page_key, sort_order, is_active)
    VALUES ('ai_agent_activity', v_grp, 'Agent 活動', 'Activity', '/dashboard/agent-activity', 'ai_agents', 'agent_activity', 66, true);
  END IF;
END $$;
