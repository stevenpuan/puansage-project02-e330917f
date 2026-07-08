-- ai_agent 角色補上完整 role_module_permissions（全關）
-- 目的：讓「角色權限」矩陣頁能正常渲染此角色（空資料會導致該頁載入失敗）。
-- 註：agent 實際權限走 scope 系統（role_agent_scopes），此矩陣對 agent 角色僅為顯示用途。
-- idempotent，可安全重跑。

INSERT INTO public.role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete, can_export)
SELECT (SELECT id FROM public.roles WHERE code='agent'), m.module_key, false, false, false, false, false
FROM (SELECT DISTINCT module_key FROM public.role_module_permissions) m
WHERE (SELECT id FROM public.roles WHERE code='agent') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_module_permissions x
    WHERE x.role_id = (SELECT id FROM public.roles WHERE code='agent')
      AND x.module_key = m.module_key
  );
