-- ============================================================
-- 費用支出模組（完整結構）：科目、支出主表、RLS、報表 view、權限、選單、agent scope
-- 註：agent_query / agent_write 也已在遠端加入 expense 分支（行為函式，見 agent RPC）。
-- 可重複執行。
-- ============================================================

-- 支出科目
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE, name text NOT NULL, sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_expcat_sel ON public.expense_categories;
CREATE POLICY p_expcat_sel ON public.expense_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_expcat_all ON public.expense_categories;
CREATE POLICY p_expcat_all ON public.expense_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.expense_categories (code, name, sort_order) VALUES
 ('salary','人事薪資',10),('outsource','外包費',20),('rent','租金',30),('utility','水電雜支',40),
 ('marketing','行銷廣告',50),('travel','差旅交通',60),('software','軟體訂閱',70),('equipment','設備採購',80),
 ('office','辦公用品',90),('entertain','交際費',100),('tax_fee','稅務規費',110),('pro_service','專業服務費',120),
 ('finance_cost','金流手續費',130),('misc','其他雜支',200)
ON CONFLICT (code) DO NOTHING;

-- 費用支出
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_no text UNIQUE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  payee text, amount numeric(14,2) NOT NULL DEFAULT 0, tax numeric(14,2) DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  applicant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_method text, status text NOT NULL DEFAULT '待審',
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, approved_at timestamptz, paid_at timestamptz,
  project_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_no text, description text, note text,
  created_by uuid DEFAULT auth.uid(),
  created_by_agent uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON public.expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_applicant ON public.expenses(applicant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_exp_sel ON public.expenses;
CREATE POLICY p_exp_sel ON public.expenses FOR SELECT TO authenticated
  USING (public.user_can('expenses','view') OR created_by = auth.uid() OR applicant_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS p_exp_ins ON public.expenses;
CREATE POLICY p_exp_ins ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.user_can('expenses','create') OR applicant_id = auth.uid() OR created_by = auth.uid());
DROP POLICY IF EXISTS p_exp_upd ON public.expenses;
CREATE POLICY p_exp_upd ON public.expenses FOR UPDATE TO authenticated
  USING (public.user_can('expenses','edit') OR created_by = auth.uid() OR public.is_admin())
  WITH CHECK (public.user_can('expenses','edit') OR created_by = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS p_exp_del ON public.expenses;
CREATE POLICY p_exp_del ON public.expenses FOR DELETE TO authenticated USING (public.user_can('expenses','delete') OR public.is_admin());

-- 報表 view
CREATE OR REPLACE VIEW public.v_monthly_expenses AS
SELECT to_char(date_trunc('month', expense_date),'YYYY-MM') AS month, count(*) AS cnt, sum(amount) AS spent
FROM public.expenses WHERE status <> '駁回' GROUP BY 1 ORDER BY 1;
ALTER VIEW public.v_monthly_expenses SET (security_invoker = true);

CREATE OR REPLACE VIEW public.v_monthly_pnl AS
WITH inc AS (SELECT month, received AS income FROM public.v_monthly_receipts),
     exp AS (SELECT to_char(date_trunc('month', expense_date),'YYYY-MM') AS month, sum(amount) AS expense
             FROM public.expenses WHERE status <> '駁回' GROUP BY 1)
SELECT COALESCE(inc.month, exp.month) AS month, COALESCE(inc.income,0)::numeric AS income,
  COALESCE(exp.expense,0)::numeric AS expense, (COALESCE(inc.income,0) - COALESCE(exp.expense,0))::numeric AS net
FROM inc FULL OUTER JOIN exp ON inc.month = exp.month ORDER BY 1;
ALTER VIEW public.v_monthly_pnl SET (security_invoker = true);

CREATE OR REPLACE VIEW public.v_project_cost AS
SELECT c.id AS project_id, c.code, c.title, COALESCE(c.amount,0)::numeric AS project_amount,
  COALESCE(e.expense,0)::numeric AS total_expense, (COALESCE(c.amount,0) - COALESCE(e.expense,0))::numeric AS gross_margin
FROM public.cases c
LEFT JOIN (SELECT project_id, sum(amount) AS expense FROM public.expenses WHERE status<>'駁回' GROUP BY project_id) e ON e.project_id=c.id;
ALTER VIEW public.v_project_cost SET (security_invoker = true);

-- 模組權限
INSERT INTO public.role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete, can_export)
SELECT r.id, 'expenses', r.code IN ('admin','staff'), r.code IN ('admin','staff'), r.code IN ('admin','staff'), r.code='admin', r.code='admin'
FROM public.roles r
WHERE NOT EXISTS (SELECT 1 FROM public.role_module_permissions x WHERE x.role_id=r.id AND x.module_key='expenses');

-- 選單
DO $$
DECLARE v_fin uuid;
BEGIN
  SELECT id INTO v_fin FROM public.menus WHERE menu_key='grp_finance';
  IF v_fin IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.menus WHERE menu_key='expenses') THEN
    INSERT INTO public.menus (menu_key, parent_id, title, icon, route, module_key, page_key, sort_order, is_active)
    VALUES ('expenses', v_fin, '費用支出', 'ReceiptText', '/dashboard/expenses', 'expenses', 'expenses', 47, true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.menus WHERE menu_key='monthly_pnl') THEN
    INSERT INTO public.menus (menu_key, parent_id, title, icon, route, module_key, page_key, sort_order, is_active)
    VALUES ('monthly_pnl', v_fin, '月度損益', 'TrendingUp', '/dashboard/pnl', 'reports', null, 48, true);
  END IF;
END $$;

-- agent scope（費用支出）
INSERT INTO public.agent_scopes (scope, category, description, sensitivity, reserved, sort_order) VALUES
 ('expense.read','讀取','讀取 費用支出','medium',false,22),
 ('expense.create','新增','新增 費用支出','medium',false,36),
 ('expense.edit','修改','修改 費用支出','medium',false,46)
ON CONFLICT (scope) DO NOTHING;
INSERT INTO public.role_agent_scopes(role_id, scope)
SELECT r.id, s.scope FROM public.roles r CROSS JOIN (VALUES ('expense.read'),('expense.create'),('expense.edit')) AS s(scope)
WHERE r.code='agent' ON CONFLICT DO NOTHING;

-- 註：agent_canon_resource / agent_query / agent_write 已在遠端加入 expense 分支（見 20260708160000 之後的 agent RPC 版本）。
