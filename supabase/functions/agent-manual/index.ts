// supabase/functions/agent-manual/index.ts
// AI Agent 操作手冊 v6（欄位規範以 lookups 為準 + 費用支出）
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
  personal_tasks: "personal_task", todo: "personal_task", calendar_events: "calendar_event",
  event: "calendar_event", calendar: "calendar_event", expenses: "expense",
};
type Sys = { id: string; md: string };
const SYSTEMS: Sys[] = [
  { id: "me", md: "### whoami — me.read\nPOST ?action=whoami。開場必先呼叫。" },
  { id: "knowledge", md: "### 學習包 pack — knowledge.read\nPOST ?action=pack。" },
  { id: "project", md: "### 專案 project — read/create/edit\n必填 title。status 允許值：諮詢中/進行中/暫停/已結案/取消（預設 諮詢中）。type：顧問/開發/維護/其他。priority：low/medium/high。" },
  { id: "task", md: "### 專案任務 task — read/create/edit\n必填 case_id + title。status：待辦/進行中/完成/擱置（預設 待辦，必為這些才會上看板）。priority：low/medium/high。先讀 project 取 case_id。" },
  { id: "personal_task", md: "### 個人任務 personal_task — read/create/edit\n必填 title。status：待辦/進行中/完成（預設 待辦）。不綁專案。" },
  { id: "calendar_event", md: "### 行事曆 calendar_event — read/create/edit\n必填 title + start_at（ISO8601 含 +08:00）。end_at/location 選填。" },
  { id: "expense", md: "### 費用支出 expense — read/create/edit\n必填 amount。status：待審/已核准/已支付/駁回（預設 待審）。category（科目名自動對應）：軟體訂閱/差旅交通/行銷廣告/人事薪資/租金…。payment_method：匯款/現金/支票/刷卡/其他。可帶 project_id 做成本歸屬。" },
  { id: "opportunity", md: "### 商機 opportunity — read/create/edit\n必填 title。status：詢問中/需求評估/報價中/待簽約/已簽約/已流失（預設 詢問中）。source：介紹/官網/BNI/舊客/社群/其他。" },
  { id: "service_ticket", md: "### 服務工單 service_ticket — read/create/edit\n必填 title。status：open/in_progress/waiting/resolved/closed（預設 open）。priority：低/中/高。type：bug/request/consult/preventive。" },
  { id: "contract", md: "### 合約 contract — read（唯讀）" },
  { id: "client", md: "### 客戶 client — read（唯讀，含個資）；client_contact 同 scope" },
  { id: "quote", md: "### 報價單 quote — read（唯讀）" },
  { id: "payment", md: "### 收款排程 payment — read（唯讀）" },
  { id: "invoice", md: "### 發票 invoice — read（唯讀）" },
  { id: "commission", md: "### 業務獎金 commission — read（唯讀，高敏感）" },
];
function preamble(): string {
  return [
    "# 伯洸系統平台 — AI Agent 操作手冊",
    "",
    "## 快速上手",
    "- Base URL：" + BASE,
    "- 認證：Header Authorization: Bearer psk_xxxxx。能做什麼 = Token scope ∩ 角色 scope。",
    "- 四動作：whoami / pack / data（讀）/ write（寫）。第一步先 whoami。",
    "",
    "## 分類判斷（最重要）",
    "客戶/專案工作→task（需 case_id）；個人待辦→personal_task；有時間行程→calendar_event（需 start_at）；花錢→expense。已存在的任務/到期日不要複製成行事曆。無法判斷先問。",
    "",
    "## 欄位規範（務必用系統允許值，否則看板/清單顯示不出來）",
    "- 新建時 status / priority 等看板欄位務必給允許值（見各資源），沒把握的選填欄位留空、不虛構。",
    "- 日期一律 YYYY-MM-DD；時間一律 ISO8601（含 +08:00）；金額純數字。",
    "- 絕不要求使用者貼 UUID；需要專案時自己讀 project 用名稱比對取 case_id。寫入後用看得懂的名稱+id 回報。",
    "",
    "## API",
    "- data：body {resource,limit,offset}｜write：body {resource,op:'create'|'update',id,data:{...}}",
    "",
    "## 各資源欄位規範",
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
