# 伯洸系統平台 — Base + 交付台帳 整合版

以 base-standards 管理後台為地基，整合「系統交付台帳」業務模組。
技術棧：TanStack Start (React 19 + Vite + Tailwind v4 + shadcn/ui) + Supabase。

## 已完成的整合

**後端（Supabase 專案 `oxtozbvbyjwokwisrghm`，已套用）**
- Base 平台：19 張表（profiles / roles / user_roles / role_module_permissions / role_page_permissions / menus / lookups / system_configs / activity_logs / audit_logs / error_logs / changelogs / doc_pages / dev_todos / feature_requests / issue_reports / invitations / attachments / wish_point_ledger）
- 函式：`is_admin()`、`user_can(module, action)`、`handle_new_user()`（首位註冊者自動成 admin）、`redeem_invitation(code)`、`daily_maintenance()`
- 全表 RLS：登入者可讀；寫入走 admin / `user_can`；日誌開放寫入
- 台帳模組：`clients` / `systems` / `contracts` + 到期提醒 view `v_maintenance_alerts`、`v_payment_alerts`
- 種子：3 角色、24 選單、30 代碼字典、admin 全權限、範例 1 客戶/系統/合約

**前端**
- `.env`、`supabase/config.toml` 已指向 `oxtozbvbyjwokwisrghm`
- `src/integrations/supabase/types.ts` 已重生（含台帳表與 view）
- 新增台帳頁：`src/routes/dashboard/ledger/`（總覽 index、systems、clients、contracts）
- 側邊欄自動從 `menus` 表載入「交付台帳」群組，權限由 `user_can('ledger', …)` 控管

## 上線步驟

1. **推程式碼**：把本專案內容 push 到 `stevenpuan/puansage-clean-slate`（main），Lovable 會自動拉取。
   - 或在 Lovable 用 GitHub 同步。
2. **建首位管理員**：開啟站台 → `/login` → 註冊分頁 → 用你的 email 註冊。首位註冊者自動成為 admin、狀態 active。
3. **登入**：即可看到左側完整選單與「交付台帳」。範例資料已在，可直接編輯或刪除。
4. **發布**：Lovable → Publish 取得 `xxx.lovable.app`，回填到台帳自身那筆的「發布網址」。

## 權限模型速覽
- `menus.module_key` 控制側邊欄可見性（`can(module,'view')`）
- 頁面內操作鈕依 `can('ledger','create'|'edit'|'delete')` 顯示
- admin 一律全開；staff/viewer 可到「角色權限」頁細調
- 後端 RLS 與前端 `can()` 雙層把關

## 備註
- RLS 為「先能用」的合理預設（登入者可讀、寫入依模組權限）。日後要按人/客戶分權可再收緊 policy。
- 日誌保留 180 天，由 `daily_maintenance()` 清理；可掛 GitHub Actions 每日 ping（參考 base 的 `.github/workflows/keepalive.yml`，記得改成本專案的 URL/anon key）。
