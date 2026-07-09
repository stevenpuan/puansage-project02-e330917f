-- 用詞一致化：AI 代理相關選單統一中文命名；角色說明不露資料表名。可重複執行。
UPDATE public.menus SET title='AI 代理'     WHERE menu_key='ai_agents';
UPDATE public.menus SET title='代理學習資源' WHERE menu_key='ai_agent_learning';
UPDATE public.menus SET title='代理權限'     WHERE menu_key='ai_agent_scopes';
UPDATE public.menus SET title='代理活動'     WHERE menu_key='ai_agent_activity';
UPDATE public.menus SET title='代理稽核'     WHERE menu_key='ai_agent_audit';

UPDATE public.roles SET description='AI 代理專屬角色；權限由「代理權限」頁的 Scope 設定決定。'
WHERE code='agent';
