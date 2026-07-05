import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/ai-agents")({ component: Page });

const AGENT_ENDPOINT = "https://oxtozbvbyjwokwisrghm.supabase.co/functions/v1/agent-api";

interface AgentRow {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  status: string;
  model: string | null;
  role_id: string | null;
  system_prompt: string | null;
  persona: Record<string, unknown> | null;
  roles?: { name: string | null } | null;
}

interface TokenRow {
  id: string;
  name: string | null;
  token_prefix: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
}

interface PersonaForm {
  tone: string;
  role: string;
  dos: string;
  donts: string;
  examples: string;
}

const EMPTY_PERSONA: PersonaForm = { tone: "", role: "", dos: "", donts: "", examples: "" };

function personaToForm(p: unknown): PersonaForm {
  if (!p || typeof p !== "object") return { ...EMPTY_PERSONA };
  const o = p as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  return {
    tone: s(o.tone),
    role: s(o.role),
    dos: s(o.dos),
    donts: s(o.donts),
    examples: s(o.examples),
  };
}

interface AgentForm {
  code: string;
  name: string;
  description: string;
  status: string;
  role_id: string;
  model: string;
  system_prompt: string;
  persona: PersonaForm;
}

const EMPTY_FORM: AgentForm = {
  code: "",
  name: "",
  description: "",
  status: "active",
  role_id: "",
  model: "google/gemini-2.5-flash",
  system_prompt: "",
  persona: { ...EMPTY_PERSONA },
};

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canView = can("ai_agents", "view");
  const canCreate = can("ai_agents", "create");
  const canEdit = can("ai_agents", "edit");
  const canDelete = can("ai_agents", "delete");

  const { data: agents = [] } = useQuery({
    queryKey: ["ai_agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*, roles(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgentRow[];
    },
    enabled: canView,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgentRow | null>(null);
  const [form, setForm] = useState<AgentForm>(EMPTY_FORM);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };
  const openEdit = (a: AgentRow) => {
    setEditing(a);
    setForm({
      code: a.code ?? "",
      name: a.name,
      description: a.description ?? "",
      status: a.status ?? "active",
      role_id: a.role_id ?? "",
      model: a.model ?? "",
      system_prompt: a.system_prompt ?? "",
      persona: personaToForm(a.persona),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("請輸入名稱");
      return;
    }
    const payload = {
      code: form.code.trim() || null,
      name: form.name.trim(),
      description: form.description || null,
      status: form.status,
      role_id: form.role_id || null,
      model: form.model || null,
      system_prompt: form.system_prompt || null,
      persona: { ...form.persona } as unknown as import("@/integrations/supabase/types").Json,
    };
    const { error } = editing
      ? await supabase.from("ai_agents").update(payload).eq("id", editing.id)
      : await supabase.from("ai_agents").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "已更新" : "已建立");
    setDialogOpen(false);
    qc.invalidateQueries({ queryKey: ["ai_agents"] });
  };

  const del = async (a: AgentRow) => {
    if (!confirm(`確定刪除 Agent「${a.name}」？`)) return;
    const { error } = await supabase.from("ai_agents").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除");
    qc.invalidateQueries({ queryKey: ["ai_agents"] });
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText(AGENT_ENDPOINT);
    toast.success("已複製端點");
  };

  if (!canView) {
    return <div className="p-6 text-muted-foreground">您沒有權限檢視此頁</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Agent"
        description="管理 AI 代理與其 API Token"
        actions={canCreate ? <Button onClick={openCreate}>新增 Agent</Button> : null}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">連線端點</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs break-all">{AGENT_ENDPOINT}</code>
            <Button variant="outline" size="sm" onClick={copyEndpoint}><Copy /> 複製</Button>
          </div>
          <p className="text-muted-foreground">
            Agent 呼叫時請帶 Header：<code className="rounded bg-muted px-1">Authorization: Bearer &lt;token&gt;</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Agent 列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>名稱</TableHead>
                <TableHead>代碼</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>模型</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">尚無資料</TableCell></TableRow>
              )}
              {agents.map((a) => {
                const isOpen = !!expanded[a.id];
                return (
                  <Fragment key={a.id}>
                    <TableRow>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setExpanded((s) => ({ ...s, [a.id]: !s[a.id] }))}>
                          {isOpen ? <ChevronDown /> : <ChevronRight />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground">{a.code || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                      </TableCell>
                      <TableCell>{a.roles?.name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.model || "-"}</TableCell>
                      <TableCell className="text-right">
                        {canEdit && <Button variant="outline" size="sm" onClick={() => openEdit(a)}>編輯</Button>}
                        {canDelete && <Button variant="ghost" size="sm" className="ml-2 text-destructive" onClick={() => del(a)}>刪除</Button>}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={a.id + "-tokens"}>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <TokensPanel agentId={a.id} canManage={canEdit} />
                          <ChannelTestPanel />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "編輯 Agent" : "新增 Agent"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="AGENT-001" /></div>
              <div className="space-y-1"><Label>名稱 *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>狀態</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="disabled">disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>角色</Label>
                <Select value={form.role_id || "__none"} onValueChange={(v) => setForm({ ...form, role_id: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="選擇角色" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— 未指定 —</SelectItem>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2"><Label>模型</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="google/gemini-2.5-flash" /></div>
              <div className="space-y-1 col-span-2"><Label>描述</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            </div>
            <div className="border rounded-md p-3 space-y-2">
              <div className="text-sm font-medium">Persona</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>語氣 tone</Label><Input value={form.persona.tone} onChange={(e) => setForm({ ...form, persona: { ...form.persona, tone: e.target.value } })} /></div>
                <div className="space-y-1"><Label>角色設定 role</Label><Input value={form.persona.role} onChange={(e) => setForm({ ...form, persona: { ...form.persona, role: e.target.value } })} /></div>
                <div className="space-y-1 col-span-2"><Label>可做 dos</Label><Textarea rows={2} value={form.persona.dos} onChange={(e) => setForm({ ...form, persona: { ...form.persona, dos: e.target.value } })} /></div>
                <div className="space-y-1 col-span-2"><Label>禁止 donts</Label><Textarea rows={2} value={form.persona.donts} onChange={(e) => setForm({ ...form, persona: { ...form.persona, donts: e.target.value } })} /></div>
                <div className="space-y-1 col-span-2"><Label>範例 examples</Label><Textarea rows={3} value={form.persona.examples} onChange={(e) => setForm({ ...form, persona: { ...form.persona, examples: e.target.value } })} /></div>
              </div>
            </div>
            <div className="space-y-1"><Label>System Prompt</Label><Textarea rows={6} value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={save}>{editing ? "儲存" : "建立"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TokensPanel({ agentId, canManage }: { agentId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { data: tokens = [] } = useQuery({
    queryKey: ["ai_agent_tokens", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agent_tokens")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TokenRow[];
    },
  });

  const [issueOpen, setIssueOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenExpires, setTokenExpires] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const issue = async () => {
    const { data, error } = await supabase.rpc("create_agent_token", {
      p_agent: agentId,
      p_name: tokenName || undefined,
      p_expires: tokenExpires ? new Date(tokenExpires).toISOString() : undefined,
    });
    if (error) { toast.error(error.message); return; }
    setIssuedToken(String(data));
    setTokenName("");
    setTokenExpires("");
    qc.invalidateQueries({ queryKey: ["ai_agent_tokens", agentId] });
  };

  const revoke = async (t: TokenRow) => {
    if (!confirm(`撤銷 Token「${t.name || t.token_prefix}」？`)) return;
    const { error } = await supabase.from("ai_agent_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已撤銷");
    qc.invalidateQueries({ queryKey: ["ai_agent_tokens", agentId] });
  };

  const copyToken = () => {
    if (!issuedToken) return;
    navigator.clipboard.writeText(issuedToken);
    toast.success("已複製");
  };

  const closeIssueDialog = (open: boolean) => {
    setIssueOpen(open);
    if (!open) setIssuedToken(null);
  };

  return (
    <div className="p-2 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">API Tokens</div>
        {canManage && (
          <Button size="sm" onClick={() => { setIssuedToken(null); setIssueOpen(true); }}>發行 Token</Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名稱</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>到期</TableHead>
            <TableHead>最後使用</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">尚無 Token</TableCell></TableRow>
          )}
          {tokens.map((t) => {
            const revoked = !!t.revoked_at;
            return (
              <TableRow key={t.id}>
                <TableCell>{t.name || "-"}</TableCell>
                <TableCell><code className="text-xs">{t.token_prefix}…</code></TableCell>
                <TableCell className="text-muted-foreground text-xs">{t.expires_at ? new Date(t.expires_at).toLocaleString() : "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "—"}</TableCell>
                <TableCell>
                  <Badge variant={revoked ? "secondary" : "default"}>{revoked ? "已撤銷" : "有效"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canManage && !revoked && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revoke(t)}>撤銷</Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={issueOpen} onOpenChange={closeIssueDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>發行 API Token</DialogTitle></DialogHeader>
          {issuedToken ? (
            <div className="space-y-3">
              <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                此 Token 僅顯示這一次，請立即保存。關閉後將無法再取得。
              </div>
              <div className="space-y-1">
                <Label>Token</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-2 text-xs break-all">{issuedToken}</code>
                  <Button variant="outline" size="sm" onClick={copyToken}><Copy /> 複製</Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => closeIssueDialog(false)}>我已保存，關閉</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1"><Label>名稱</Label><Input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="例：production" /></div>
              <div className="space-y-1"><Label>到期日（選填）</Label><Input type="datetime-local" value={tokenExpires} onChange={(e) => setTokenExpires(e.target.value)} /></div>
              <DialogFooter>
                <Button variant="outline" onClick={() => closeIssueDialog(false)}>取消</Button>
                <Button onClick={issue}>發行</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



const TEST_RESOURCES = [
  "cases", "opportunities", "contracts", "clients", "client_contacts",
  "payments", "invoices", "ledger", "commission", "service_tickets",
] as const;

const WRITE_RESOURCES = ["cases", "opportunities", "service_tickets"] as const;

// 通道測試：以真實 psk_ Token 直接呼叫 agent-api（whoami / pack / data / write）
function ChannelTestPanel() {
  const [token, setToken] = useState("");
  const [resource, setResource] = useState<string>("cases");
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");

  const [wOp, setWOp] = useState<string>("update");
  const [wResource, setWResource] = useState<string>("cases");
  const [wId, setWId] = useState("");
  const [wData, setWData] = useState('{"status":"done","note":"由 agent 更新"}');

  const call = async (action: string, res?: string) => {
    if (!token.trim()) { toast.error("請貼上要測試的 psk_ Token"); return; }
    setLoading(action); setResult("");
    try {
      const qs = new URLSearchParams({ action });
      if (res) qs.set("resource", res);
      const r = await fetch(`${AGENT_ENDPOINT}?${qs.toString()}`, {
        method: "POST", headers: { Authorization: `Bearer ${token.trim()}` },
      });
      const text = await r.text();
      try { setResult(JSON.stringify(JSON.parse(text), null, 2)); } catch { setResult(text); }
    } catch (e) { setResult(String(e)); } finally { setLoading(null); }
  };

  const callWrite = async () => {
    if (!token.trim()) { toast.error("請貼上要測試的 psk_ Token"); return; }
    let data: unknown = {};
    try { data = wData.trim() ? JSON.parse(wData) : {}; }
    catch { toast.error("data 不是合法 JSON"); return; }
    setLoading("write"); setResult("");
    try {
      const r = await fetch(`${AGENT_ENDPOINT}?action=write`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ resource: wResource, op: wOp, id: wId.trim() || undefined, data }),
      });
      const text = await r.text();
      try { setResult(JSON.stringify(JSON.parse(text), null, 2)); } catch { setResult(text); }
    } catch (e) { setResult(String(e)); } finally { setLoading(null); }
  };

  return (
    <div className="p-2 mt-4 border-t pt-4 space-y-4">
      <div className="font-medium text-sm">通道測試（以 Token 實際呼叫 agent-api）</div>
      <div className="space-y-1">
        <Label className="text-xs">psk_ Token</Label>
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="貼上剛發行的 psk_…（僅存於瀏覽器記憶體）" />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => call("whoami")}>whoami</Button>
        <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => call("pack")}>學習包</Button>
        <div className="flex items-end gap-1">
          <Select value={resource} onValueChange={setResource}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{TEST_RESOURCES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => call("data", resource)}>查資料</Button>
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <div className="text-xs font-medium">寫入測試（write）</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">op</Label>
            <Select value={wOp} onValueChange={setWOp}>
              <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="update">update</SelectItem>
                <SelectItem value="create">create</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">resource</Label>
            <Select value={wResource} onValueChange={setWResource}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{WRITE_RESOURCES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[220px]">
            <Label className="text-xs">id（update 必填）</Label>
            <Input value={wId} onChange={(e) => setWId(e.target.value)} placeholder="update 時填該筆 uuid；create 留空" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">data（JSON）</Label>
          <Textarea rows={3} value={wData} onChange={(e) => setWData(e.target.value)} className="font-mono text-xs" />
        </div>
        <Button size="sm" disabled={loading !== null} onClick={callWrite}>送出寫入</Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        實際呼叫 agent-api，等同外部 Agent 的請求；回應依該 Token 對應 Agent 的角色權限而定。Token 不會被儲存。
      </p>
      {(loading || result) && (
        <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all">{loading ? `呼叫 ${loading}…` : result}</pre>
      )}
    </div>
  );
}
