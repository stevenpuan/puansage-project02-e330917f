// supabase/functions/agent-manual/index.ts
// 公開的 AI Agent 操作手冊端點（新版：資源用系統名稱、權限分 讀取/新增/修改）
// 用法：GET .../functions/v1/agent-manual?systems=project,task （省略=全部；逗號分隔）
//   format=json 回 JSON；預設 text/markdown。內容僅為說明，取資料仍需有效 psk_ token。

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const BASE = "https://oxtozbvbyjwokwisrghm.supabase.co/functions/v1/agent-api";

// 舊 id → 新 id 別名（讓舊的 systems= 網址仍可用）
const ALIAS: Record<string, string> = {
  cases: "project", case_tasks: "task", tasks: "task", opportunities: "opportunity",
  service_tickets: "service_ticket", contracts: "contract", clients: "client",
  payments: "payment", invoices: "invoice", ledger: "", commission: "commission",
};

type Sys = { id: string; md: string };
const SYSTEMS: Sys[] = [
  { id: "me", md: "### 我的身分 whoami — scope me.read\nPOST ?action=whoami → {agent:{id,name,role_id}, scopes:[...]}。每次任務開場必先呼叫。" },
  { id: "knowledge", md: "### 學習包 pack — scope knowledge.read\nPOST ?action=pack（&format=md 回純 markdown）拉取本 agent 學習包。" },
  { id: "project", md: "### 專案 project — 讀 project.read／新增 project.create／修改 project.edit\n- 讀欄位：id, code, title, client_id, type, status, priority, amount, start_date, due_date, description, created_by_agent, created_at\n- 新增 JSON：{\"resource\":\"project\",\"op\":\"create\",\"data\":{\"title\":\"必填\",\"client_id\":\"客戶UUID\",\"type\":\"顧問/開發/維護\",\"priority\":\"low|medium|high\",\"status\":\"open\",\"start_date\":\"YYYY-MM-DD\",\"due_date\":\"YYYY-MM-DD\",\"description\":\"說明\"}}\n- 修改 JSON（需 id）：{\"resource\":\"project\",\"op\":\"update\",\"id\":\"專案UUID\",\"data\":{\"status\":\"進行中\",\"priority\":\"high\",\"due_date\":\"YYYY-MM-DD\"}}" },
  { id: "task", md: "### 任務 task — 讀 task.read／新增 task.create／修改 task.edit\n任務隸屬專案，新增前必先讀 project 取得 case_id。\n- 讀欄位：id, case_id, title, description, status, priority, assignee_id, due_date, done_at, created_by_agent, created_at\n- 新增 JSON：{\"resource\":\"task\",\"op\":\"create\",\"data\":{\"case_id\":\"專案UUID（必填）\",\"title\":\"必填\",\"priority\":\"low|medium|high\",\"status\":\"待辦|進行中|完成\",\"due_date\":\"YYYY-MM-DD\",\"assignee_id\":\"使用者UUID\",\"description\":\"說明\"}}\n- 修改 JSON（需 id）：{\"resource\":\"task\",\"op\":\"update\",\"id\":\"任務UUID\",\"data\":{\"status\":\"完成\",\"done_at\":\"2026-07-08T12:00:00Z\"}}" },
  { id: "opportunity", md: "### 商機 opportunity — 讀 opportunity.read／新增 opportunity.create／修改 opportunity.edit\n- 讀欄位：id, code, title, client_id, source, status, est_amount, next_action, next_action_date, created_by_agent, created_at\n- 新增 JSON：{\"resource\":\"opportunity\",\"op\":\"create\",\"data\":{\"title\":\"必填\",\"client_id\":\"客戶UUID\",\"source\":\"來源\",\"status\":\"open\",\"est_amount\":100000,\"next_action\":\"下一步\",\"next_action_date\":\"YYYY-MM-DD\",\"note\":\"備註\"}}\n- 修改 JSON（需 id）：{\"resource\":\"opportunity\",\"op\":\"update\",\"id\":\"商機UUID\",\"data\":{\"status\":\"跟進中\",\"next_action\":\"報價\",\"next_action_date\":\"YYYY-MM-DD\"}}" },
  { id: "service_ticket", md: "### 服務工單 service_ticket — 讀 service_ticket.read／新增 service_ticket.create／修改 service_ticket.edit\n- 讀欄位：id, ticket_no, system_id, contract_id, client_id, title, description, type, priority, status, spent_hours, created_by_agent, created_at\n- 新增 JSON：{\"resource\":\"service_ticket\",\"op\":\"create\",\"data\":{\"title\":\"必填\",\"description\":\"問題描述\",\"type\":\"bug\",\"priority\":\"低|中|高\",\"status\":\"open\",\"client_id\":\"客戶UUID\",\"system_id\":\"系統UUID\",\"contract_id\":\"合約UUID\"}}\n- 修改 JSON（需 id）：{\"resource\":\"service_ticket\",\"op\":\"update\",\"id\":\"工單UUID\",\"data\":{\"status\":\"處理中\",\"spent_hours\":2,\"resolved_at\":\"2026-07-08T12:00:00Z\"}}" },
  { id: "contract", md: "### 合約 contract — scope contract.read（唯讀，中敏感）\n讀欄位：id, contract_no, contract_type, title, client_id, contract_amount, status, start_date, end_date, next_payment_date, created_at" },
  { id: "client", md: "### 客戶 client — scope client.read（唯讀，含個資）\n- client：id, code, name, tax_id, contact_name, phone, email\n- client_contact（resource=client_contact，同 scope）：id, client_id, name, title, phone, email, is_primary" },
  { id: "quote", md: "### 報價單 quote — scope quote.read（唯讀）\n讀欄位：id, quote_no, opportunity_id, client_id, title, quote_date, valid_until, status, subtotal, tax, total, note, created_at" },
  { id: "payment", md: "### 收款排程 payment — scope payment.read（唯讀，中敏感）\n讀欄位：id, contract_id, title, amount, due_date, paid_date, status, method, invoice_no, created_at" },
  { id: "invoice", md: "### 發票 invoice — scope invoice.read（唯讀，中敏感）\n讀欄位：id, payment_id, contract_id, invoice_no, invoice_date, amount_total, status, created_at" },
  { id: "commission", md: "### 業務獎金 commission — scope commission.read（唯讀，高敏感）\n讀欄位：id, contract_id, project_id, deal_role, base_amount, rate, commission_amount, realized, payout_status, created_at" },
];

function preamble(): string {
  return [
    "# 伯洸系統平台 — AI Agent 操作手冊",
    "",
    "## 〇、快速上手",
    "- Base URL：" + BASE,
    "- 認證：每次請求帶 Header `Authorization: Bearer psk_xxxxx`（於 AI Agent 頁發行 Token，僅顯示一次）。",
    "- 能做什麼 = Token scope ∩ 角色 scope；未授權一律回 scope_denied。",
    "- 四個動作：whoami / pack / data（讀）/ write（寫）。第一步先 whoami。",
    "",
    "## 名稱對照（你在系統看到的名稱 ↔ API resource）",
    "| 系統名稱 | resource | 讀 | 新增 | 修改 |",
    "|---|---|---|---|---|",
    "| 專案 | project | ✔ | ✔ | ✔ |",
    "| 任務 | task | ✔ | ✔ | ✔ |",
    "| 商機 | opportunity | ✔ | ✔ | ✔ |",
    "| 服務工單 | service_ticket | ✔ | ✔ | ✔ |",
    "| 合約 | contract | ✔ | － | － |",
    "| 客戶 | client / client_contact | ✔ | － | － |",
    "| 報價單 | quote | ✔ | － | － |",
    "| 收款排程 | payment | ✔ | － | － |",
    "| 發票 | invoice | ✔ | － | － |",
    "| 業務獎金 | commission | ✔ | － | － |",
    "",
    "## 一、權限與限制（硬性規則）",
    "1. Scope 分三級：`<resource>.read`（讀）、`.create`（新增）、`.edit`（修改）。未授權一律 403 scope_denied，不繞道。",
    "2. 可寫入：project、task、opportunity、service_ticket（皆可新增+修改）；其餘唯讀；一律不可刪除。",
    "3. 新增必填 title；task 另需 case_id；修改必須帶正確 id（先讀出來）。",
    "4. Agent 須 active；Token 可到期/撤銷，僅發行當下顯示一次，勿寫入前端或版本庫。",
    "5. 讀取單次最多 100 筆（預設 50），用 offset 分頁；所有 write 記稽核。",
    "",
    "## 二、對 AI Agent 的要求",
    "1. 先 whoami 認識自己，只在授權 scope 內行動。",
    "2. 收到「建立/新增/修改/填入」類指令時，務必實際呼叫 write，不可只回文字。",
    "3. 不虛構 id/金額；引用附來源 code/id；update 前先讀出現況確認 id。",
    "4. scope_denied 明確告知缺哪個 scope，不反覆重試或繞道；繁體中文回應並附寫入結果 id。",
    "",
    "## 三、API 介面",
    "POST `" + BASE + "?action=<動作>`，Header 帶 Bearer Token。",
    "- data（讀）：body {resource,limit,offset} → {ok,resource,scope,count,rows:[]}（需 resource.read）",
    "- write（寫）：body {resource,op:'create'|'update',id,data:{...}} → {ok,op,resource,id,after}（create 需 .create、update 需 .edit）",
    "- 錯誤：401 Token 無效；403 scope_denied {need}; 400 參數錯誤。",
    "",
    "## 四、各資源欄位與 JSON 範例",
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
