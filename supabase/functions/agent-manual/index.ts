// supabase/functions/agent-manual/index.ts
// 公開 AI Agent 操作手冊（v4：專案/個人/行事曆分流 + 分類判斷）
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const BASE = "https://oxtozbvbyjwokwisrghm.supabase.co/functions/v1/agent-api";
const ALIAS: Record<string, string> = {
  cases: "project", case_tasks: "task", tasks: "task", opportunities: "opportunity",
  service_tickets: "service_ticket", contracts: "contract", clients: "client",
  payments: "payment", invoices: "invoice", ledger: "", commission: "commission",
  personal_tasks: "personal_task", todo: "personal_task",
  calendar_events: "calendar_event", event: "calendar_event", calendar: "calendar_event",
};
type Sys = { id: string; md: string };
const SYSTEMS: Sys[] = [
  { id: "me", md: "### whoami — me.read\nPOST ?action=whoami → {agent, scopes}。開場必先呼叫。" },
  { id: "knowledge", md: "### 學習包 pack — knowledge.read\nPOST ?action=pack。" },
  { id: "project", md: '### 專案 project — project.read/.create/.edit\n新增：{"resource":"project","op":"create","data":{"title":"必填","client_id":"客戶UUID","priority":"medium","due_date":"YYYY-MM-DD"}}' },
  { id: "task", md: '### 專案任務 task — task.read/.create/.edit\n綁專案，新增前先讀 project 取 case_id。\n新增：{"resource":"task","op":"create","data":{"case_id":"專案UUID","title":"必填","priority":"medium","status":"待辦","due_date":"YYYY-MM-DD"}}\n修改：{"resource":"task","op":"update","id":"任務UUID","data":{"status":"完成"}}' },
  { id: "personal_task", md: '### 個人任務 personal_task — personal_task.read/.create/.edit\n個人待辦，不綁專案。\n新增：{"resource":"personal_task","op":"create","data":{"title":"必填","priority":"medium","status":"待辦","due_date":"YYYY-MM-DD","description":"說明"}}' },
  { id: "calendar_event", md: '### 行事曆 calendar_event — calendar_event.read/.create/.edit\n有明確時間點的行程/會議/提醒。\n新增（需 start_at）：{"resource":"calendar_event","op":"create","data":{"title":"必填","start_at":"2026-07-09T06:30:00+08:00","end_at":"2026-07-09T07:30:00+08:00","all_day":false,"location":"地點"}}' },
  { id: "opportunity", md: '### 商機 opportunity — opportunity.read/.create/.edit\n新增：{"resource":"opportunity","op":"create","data":{"title":"必填","client_id":"客戶UUID","est_amount":100000}}' },
  { id: "service_ticket", md: '### 服務工單 service_ticket — service_ticket.read/.create/.edit\n新增：{"resource":"service_ticket","op":"create","data":{"title":"必填","priority":"中","description":"問題描述"}}' },
  { id: "contract", md: "### 合約 contract — contract.read（唯讀）" },
  { id: "client", md: "### 客戶 client — client.read（唯讀，含個資）；client_contact 同 scope" },
  { id: "quote", md: "### 報價單 quote — quote.read（唯讀）" },
  { id: "payment", md: "### 收款排程 payment — payment.read（唯讀）" },
  { id: "invoice", md: "### 發票 invoice — invoice.read（唯讀）" },
  { id: "commission", md: "### 業務獎金 commission — commission.read（唯讀，高敏感）" },
];
function preamble(): string {
  return [
    "# 伯洸系統平台 — AI Agent 操作手冊",
    "",
    "## 〇、快速上手",
    "- Base URL：" + BASE,
    "- 認證：Header `Authorization: Bearer psk_xxxxx`。能做什麼 = Token scope ∩ 角色 scope。",
    "- 四個動作：whoami / pack / data（讀）/ write（寫）。第一步先 whoami。",
    "",
    "## 分類判斷（最重要，避免混雜）",
    "收到待辦/提醒/行程時，先判斷屬於哪一種再寫入正確資源，不要全部塞進專案任務：",
    "- 與客戶/專案相關的工作 → **task**（需 case_id，先讀 project 取得）",
    "- 純個人待辦、與客戶專案無關 → **personal_task**（不需專案）",
    "- 有明確時間點的行程/會議/提醒（例：早會 6:30、健身 11:00、ERP 會議 10:00）→ **calendar_event**（需 start_at）",
    "- 無法判斷時先問使用者，不要硬塞。",
    "",
    "## 使用規則",
    "1. Scope 三級：`.read`/`.create`/`.edit`；未授權 403 scope_denied。可寫：project/task/personal_task/calendar_event/opportunity/service_ticket；其餘唯讀，不可刪除。",
    "2. 新增必填 title；task 需 case_id；calendar_event 需 start_at；修改需正確 id。",
    "3. 依語意判斷欄位合理值；priority=low/medium/high；status=待辦/進行中/完成；日期=YYYY-MM-DD；時間=ISO8601；沒把握的選填欄位留空，不虛構。",
    "4. 絕不要求使用者貼 UUID；需要專案時自己讀 project 用名稱比對取得 case_id。寫入後用看得懂的名稱+id 回報。",
    "",
    "## API",
    "- data：body {resource,limit,offset}（需 resource.read）",
    "- write：body {resource,op:'create'|'update',id,data:{...}}（create 需 .create、update 需 .edit）",
    "",
    "## 各資源欄位與 JSON",
    "",
  ].join("\n");
}
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const raw = (url.searchParams.get("systems") || "").trim();
  let want: string[] | null = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : null;
  if (want) want = want.map((s) => (s in ALIAS ? ALIAS[s] : s)).filter(Boolean);
  const picked = want ? SYSTEMS.filter((s) => want!.includes(s.id)) : SYSTEMS;
  const md = preamble() + picked.map((s) => s.md).join("\n\n") + "\n";
  if ((url.searchParams.get("format") || "") === "json") {
    return new Response(JSON.stringify({ ok: true, systems: picked.map((s) => s.id), markdown: md }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
    });
  }
  return new Response(md, { status: 200, headers: { ...cors, "Content-Type": "text/markdown; charset=utf-8" } });
});
