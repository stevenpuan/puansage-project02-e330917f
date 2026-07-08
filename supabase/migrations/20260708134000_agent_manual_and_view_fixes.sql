-- 合併修正：v_agent_activity 安全修正 + agent_ops_manual 補上 case_tasks 與寫入範例
-- 皆 idempotent，可安全重跑。（若已套用過 133000 的 view 修正，這裡重跑無害）

-- 1) view 以查詢者身分執行，遵守 RLS
ALTER VIEW public.v_agent_activity SET (security_invoker = true);

-- 2) agent_ops_manual：補入 case_tasks 為可寫入資源，並加建立任務範例
CREATE OR REPLACE FUNCTION public.agent_ops_manual(p_agent uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare granted text; manual text;
begin
  select coalesce(string_agg(distinct value, ', '), '（尚無有效 Token）') into granted
  from ai_agent_tokens t, lateral jsonb_array_elements_text(to_jsonb(t.scopes)) as value
  where t.agent_id = p_agent and t.revoked_at is null and (t.expires_at is null or t.expires_at > now());
  manual := $md$
## 七、系統操作手冊（線上版）

### 使用限制
1. Scope 即權限，未授權一律 403 scope_denied，不得繞道。
2. Agent 須 active；停用後所有 Token 立即失效。Token 可到期/撤銷，僅顯示一次，勿外洩。
3. 讀取單次最多 100 筆（預設 50），用 offset 分頁。
4. 可寫入僅：case_tasks（案件任務 建+改，需 cases.write）、cases（建+改）、opportunities（建+改）、service_tickets（僅改）；其餘唯讀，不可刪除。
5. 新增必填 title；case_tasks 另需 case_id；更新需正確 id。敏感系統非必要不授權；所有 write 記稽核。

### 對 AI Agent 的要求
先 whoami 認識自己並只在授權 scope 內行動；不虛構 id/金額並附來源 code/id；寫入前複述、update 前先讀出確認 id；scope_denied 明確告知缺哪個 scope 不硬做；尊重分頁上限；繁體中文回應。
**收到「建立任務/填任務」類指令時，務必實際呼叫 write API（action=write），不要只回覆文字。**

### API
- data：?action=data&resource=<系統>&limit=1..100&offset=n（需 <系統>.read）
- write：?action=write，body {resource,op:'create'|'update',id,data:{...}}（需 <系統>.write）

### 建立案件任務範例（case_tasks，需 cases.write）
先用 data 讀 cases 取得目標 case 的 id，再：
POST ?action=write
{ "resource":"case_tasks", "op":"create",
  "data":{ "case_id":"<案件UUID>", "title":"任務名稱",
           "priority":"high", "due_date":"2026-07-15", "description":"說明" } }
更新任務：{ "resource":"case_tasks","op":"update","id":"<taskUUID>","data":{"status":"完成"} }
（status 可用：待辦 / 進行中 / 完成；priority：low/medium/high）

### 各系統 resource / scope / 可寫
case_tasks（cases.read/.write 建+改；案件任務，必填 case_id+title）、cases（cases.read/.write 建+改）、opportunities（opportunities.read/.write 建+改）、service_tickets（service_tickets.read/.write 僅改）、contracts（contracts.read 唯讀中敏感）、clients（clients.read 唯讀含個資，client_contacts 同 scope）、payments/invoices/ledger（*.read 唯讀中敏感 reserved）、commission（commission.read 唯讀高敏感）、me.read（whoami）、knowledge.read（pack）
$md$;
  return manual || E'\n**本 Agent 目前有效 Token 授權 scope**：' || granted || E'\n';
end $function$;
