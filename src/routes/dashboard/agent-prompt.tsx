import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/agent-prompt")({ component: Page });

const BASE = "https://oxtozbvbyjwokwisrghm.supabase.co/functions/v1/agent-api";
const MANUAL_URL = "https://oxtozbvbyjwokwisrghm.supabase.co/functions/v1/agent-manual";

interface Sys {
  id: string; title: string; scope: string; write: boolean; sensitive?: "medium" | "high";
  md: string;
}

// 每個系統的操作提示（依實際 agent-api / agent_query / agent_write 撰寫）
const SYSTEMS: Sys[] = [
  { id: "me", title: "我的身分 whoami", scope: "me.read", write: false,
    md: "### 我的身分 whoami — scope `me.read`\n讀自身身分與權限。`POST ?action=whoami` → `{agent:{id,name,role_id}, scopes:[...]}`。每次任務開場必用。" },
  { id: "knowledge", title: "知識庫 pack", scope: "knowledge.read", write: false,
    md: "### 知識庫 pack — scope `knowledge.read`\n拉取本 agent 學習包。`POST ?action=pack`（`&format=md` 回純 markdown）。內含身分、人格、系統提示、角色權限、綁定知識。" },
  { id: "cases", title: "案件 cases", scope: "cases.read / cases.write", write: true,
    md: "### 案件 cases — 讀 `cases.read`／寫 `cases.write`\n- 讀欄位：id, code, title, client_id, system_id, type, status, priority, amount, start_date, due_date, closed_at, description, kickoff_date, go_live_date, acceptance_date, warranty_months, warranty_end, created_at\n- 新增(create)：必填 title；可帶 client_id, type, priority(預設 medium), status(預設 open), description, note, start_date, due_date\n- 更新(update)：可改 status, priority, note, description, due_date, go_live_date, acceptance_date" },
  { id: "opportunities", title: "商機 opportunities", scope: "opportunities.read / .write", write: true,
    md: "### 商機 opportunities — 讀 `opportunities.read`／寫 `opportunities.write`\n- 讀欄位：id, code, title, client_id, source, status, est_amount, next_action, next_action_date, converted_project_id, created_at\n- 新增：必填 title；可帶 client_id, source, status(預設 open), est_amount, next_action, next_action_date, note\n- 更新：可改 status, next_action, next_action_date, note" },
  { id: "service_tickets", title: "服務工單 service_tickets", scope: "service_tickets.read / .write", write: true,
    md: "### 服務工單 service_tickets — 讀 `service_tickets.read`／寫 `service_tickets.write`（僅更新）\n- 讀欄位：id, ticket_no, system_id, contract_id, client_id, title, description, type, priority, status, assignee_id, opened_at, responded_at, resolved_at, spent_hours, billable, created_at\n- 更新：可改 status, priority, note, description, type, responded_at, resolved_at, spent_hours。**不可新增**（工單由系統/人員開立）。" },
  { id: "contracts", title: "合約 contracts", scope: "contracts.read", write: false, sensitive: "medium",
    md: "### 合約 contracts — scope `contracts.read`（中敏感，唯讀）\n讀欄位：id, contract_no, contract_type, title, client_id, system_id, project_id, billing_type, contract_amount, dev_fee, maintenance_fee, signed_date, start_date, end_date, term_months, auto_renew, status, payment_status, invoice_status, next_payment_date, maintenance_period, included_hours, sla_hours, created_at" },
  { id: "clients", title: "客戶 clients", scope: "clients.read", write: false, sensitive: "medium",
    md: "### 客戶 clients — scope `clients.read`（中敏感，含個資，唯讀）\n- clients：id, code, name, tax_id, contact_name, phone, email, created_at\n- client_contacts（同 scope，resource=client_contacts）：id, client_id, name, title, phone, email, is_primary, created_at\n- 含電話/Email，僅在任務所需範圍使用。" },
  { id: "payments", title: "付款 payments", scope: "payments.read", write: false, sensitive: "medium",
    md: "### 付款 payments — scope `payments.read`（中敏感 reserved，唯讀）\n讀欄位：id, contract_id, title, amount, due_date, paid_date, status, method, invoice_no, invoice_status, created_at" },
  { id: "invoices", title: "發票 invoices", scope: "invoices.read", write: false, sensitive: "medium",
    md: "### 發票 invoices — scope `invoices.read`（中敏感 reserved，唯讀）\n讀欄位：id, payment_id, contract_id, invoice_no, invoice_date, type, amount_untaxed, tax, amount_total, status, created_at" },
  { id: "ledger", title: "帳本 ledger", scope: "ledger.read", write: false, sensitive: "medium",
    md: "### 帳本 ledger — scope `ledger.read`（中敏感 reserved，唯讀）\n對應 wish_point_ledger。讀欄位：id, period, change, balance, reason, ref_id, created_at" },
  { id: "commission", title: "業務獎金 commission", scope: "commission.read", write: false, sensitive: "high",
    md: "### 業務獎金 commission — scope `commission.read`（高敏感 reserved，唯讀）\n讀欄位：id, contract_id, project_id, payment_id, plan_id, deal_role, base_amount, rate, commission_amount, realized, realized_on, payout_period, payout_status, created_at。高敏感，非必要不授權。" },
];

function preamble(): string {
  return [
    "# 伯洸系統平台 — AI Agent 操作提示詞包",
    "",
    "> 用途：貼進 AI Agent 的系統提示 / 知識庫，讓它知道能操作哪些系統、怎麼呼叫、以及規矩。",
    "",
    "## 〇、快速上手",
    "- Base URL：`" + BASE + "`",
    "- 認證：每次請求帶 Header `Authorization: Bearer psk_xxxxx`（於「帳號管理 → AI Agent → 發 Token」發行，僅顯示一次）。",
    "- 能做什麼由 Token 的 scope 決定；未授權一律回 scope_denied。",
    "- 四個動作：whoami / pack / data（讀）/ write（寫）。第一步先 whoami 確認身分與 scope。",
    "",
    "## 一、系統操作使用限制（硬性規則）",
    "1. Scope 即權限，未授權的系統或動作一律 403 scope_denied，不得繞道。",
    "2. Agent 須為 active；停用後所有 Token 立即失效。",
    "3. Token 可到期/撤銷，僅發行當下顯示一次，嚴禁寫入前端或版本庫。",
    "4. 讀取單次最多 100 筆（預設 50），需更多用 offset 分頁。",
    "5. 可寫入僅：cases（建+改）、opportunities（建+改）、service_tickets（僅改）；其餘唯讀。",
    "6. 一律不可刪除（無 delete 動作）。",
    "7. 新增必填 title；更新必須帶正確 id（先讀出來）。",
    "8. 敏感系統（payments/invoices/ledger reserved、commission 高）非必要不授權。",
    "9. 所有 write 皆寫入稽核日誌（audit_logs，含 before/after）。",
    "10. data 只回預先定義欄位，無法下任意 SQL。",
    "",
    "## 二、對 AI Agent 的要求（行為準則）",
    "1. 先 whoami 認識自己，只在授權 scope 內行動。",
    "2. 不虛構 id/代號/金額；引用附上來源 code/id。",
    "3. 寫入前先向使用者複述內容與對象；update 前先讀出現況確認 id。",
    "4. 收到 scope_denied 明確告知缺哪個 scope，不反覆重試或繞道。",
    "5. 尊重分頁與上限，說明「以下為前 N 筆」。",
    "6. 最小變動；設計流程避免依賴刪除。",
    "7. 保護 Token 與個資（clients/財務類僅任務所需範圍使用）。",
    "8. 以繁體中文回應，技術術語可保留英文，專業務實。",
    "9. 被要求越權即說明權限不足並停止。",
    "10. 需更多脈絡時呼叫 pack 拉學習包。",
    "",
    "## 三、API 介面",
    "POST `" + BASE + "?action=<動作>`，Header 帶 Bearer Token。動作可用 query 或 JSON body。",
    "- data：`?action=data&resource=<系統>&limit=1..100&offset=n`（需 <系統>.read）→ {ok,resource,scope,count,rows:[]}",
    "- write：body `{resource,op:'create'|'update',id,data:{...}}`（需 <系統>.write）→ {ok,op,resource,id,after}",
    "- 錯誤：401 Token 無效；403 scope_denied {need}; 400 參數錯誤。",
    "",
    "## 四、各系統操作提示詞（僅列已勾選）",
    "",
  ].join("\n");
}

function Page() {
  const { can } = useAuth();
  const canView = can("ai_agents", "view");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  if (!canView) return <div className="p-6 text-muted-foreground">您沒有檢視此功能的權限。</div>;

  const toggle = (id: string) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = () => setChecked(new Set(SYSTEMS.map((s) => s.id)));
  const allOff = () => setChecked(new Set());

  const build = (): string => {
    const picked = SYSTEMS.filter((s) => checked.has(s.id));
    return preamble() + picked.map((s) => s.md).join("\n\n") + "\n";
  };
  const download = () => {
    if (checked.size === 0) { toast.error("請至少勾選一個系統"); return; }
    const blob = new Blob([build()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AI-Agent-提示詞包-" + new Date().toISOString().slice(0, 10) + ".md";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("已下載 " + checked.size + " 個系統的提示詞");
  };
  const copyClipboard = async () => {
    if (checked.size === 0) { toast.error("請至少勾選一個系統"); return; }
    await navigator.clipboard.writeText(build());
    toast.success("已複製內容");
  };
  const manualUrl = () =>
    checked.size === 0 ? MANUAL_URL : MANUAL_URL + "?systems=" + [...checked].join(",");
  const copyLink = async () => {
    await navigator.clipboard.writeText(manualUrl());
    toast.success("已複製連結");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="AI 操作提示詞" description="勾選 AI Agent 可用的系統，產生提示詞：可下載/複製內容，或複製連結直接給 Agent 讀取" />

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={allOn}>全選</Button>
            <Button size="sm" variant="outline" onClick={allOff}>清除</Button>
            <span className="text-sm text-muted-foreground ml-2">已選 {checked.size} / {SYSTEMS.length}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {SYSTEMS.map((s) => (
              <label key={s.id} className="flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50">
                <Checkbox checked={checked.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {s.title}
                    {s.write && <Badge variant="secondary" className="text-[10px]">可寫入</Badge>}
                    {s.sensitive === "high" && <Badge variant="destructive" className="text-[10px]">高敏感</Badge>}
                    {s.sensitive === "medium" && <Badge variant="outline" className="text-[10px]">敏感</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{s.scope}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={download}>⬇ 下載提示詞 (.md)</Button>
            <Button variant="outline" onClick={copyClipboard}>複製內容</Button>
            <Button variant="outline" onClick={copyLink}>🔗 複製連結</Button>
          </div>
          <div className="rounded bg-muted p-2 text-xs font-mono break-all">{manualUrl()}</div>
          <p className="text-xs text-muted-foreground">
            兩種餵給 Agent 的方式：① 下載或「複製內容」貼進系統提示；② 直接把上方<b>連結</b>給 Agent，它用 GET 就能取得同樣內容（依勾選系統過濾；未勾選＝全部）。內容 = 使用限制 + 對 Agent 要求 + API 介面 + 勾選系統操作說明。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="text-sm font-medium mb-2">預覽（前段）</div>
          <pre className="text-xs whitespace-pre-wrap max-h-72 overflow-auto rounded bg-muted p-3">
            {checked.size === 0 ? "（勾選系統後這裡顯示產出內容）" : build().slice(0, 1800) + "\n…"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
