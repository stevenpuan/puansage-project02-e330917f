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
import { Copy, ChevronDown, ChevronRight, Check, ShieldAlert, Loader2, Mail } from "lucide-react";

export const Route = createFileRoute("/dashboard/ai-agents")({ component: Page });

const AGENT_ENDPOINT = "https://oxtozbvbyjwokwisrghm.supabase.co/functions/v1/agent-api";
const EXPIRY_OPTIONS = [7, 30, 90, 180, 365];
const SCOPE_CATEGORIES = ["讀取", "寫入", "高權"] as const;

interface AgentRow {
  id: string; code: string | null; name: string; email: string | null; description: string | null; status: string;
  model: string | null; role_id: string | null; system_prompt: string | null;
  persona: Record<string, unknown> | null; roles?: { name: string | null } | null;
}
interface TokenRow {
  id: string; name: string | null; token_prefix: string | null; expires_at: string | null;
  last_used_at: string | null; revoked_at: string | null; created_at: string | null; scopes?: string[] | null;
}
interface ScopeRow { scope: string; category: string; description: string | null; sensitivity: string; reserved: boolean; sort_order: number; }
interface PersonaForm { tone: string; role: string; dos: string; donts: string; examples: string; }
const EMPTY_PERSONA: PersonaForm = { tone: "", role: "", dos: "", donts: "", examples: "" };
function personaToForm(p: unknown): PersonaForm {
  if (!p || typeof p !== "object") return { ...EMPTY_PERSONA };
  const o = p as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  return { tone: s(o.tone), role: s(o.role), dos: s(o.dos), donts: s(o.donts), examples: s(o.examples) };
}
interface AgentForm { code: string; name: string; email: string; description: string; status: string; role_id: string; model: string; system_prompt: string; persona: PersonaForm; }
const EMPTY_FORM: AgentForm = { code: "", name: "", email: "", description: "", status: "active", role_id: "", model: "google/gemini-2.5-flash", system_prompt: "", persona: { ...EMPTY_PERSONA } };

function useScopeCatalog() {
  return useQuery({
    queryKey: ["agent_scopes"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_scopes").select("scope,category,description,sensitivity,reserved,sort_order").order("sort_order");
      return (data ?? []) as ScopeRow[];
    },
  });
}

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
      const { data, error } = await supabase.from("ai_agents").select("*, roles(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgentRow[];
    },
    enabled: canView,
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["roles_all"],
    queryFn: async () => {
      const { data } = await supabase.from("roles").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editDialog, setEditDialog] = useState(false);
  const [editing, setEditing] = useState<AgentRow | null>(null);
  const [form, setForm] = useState<AgentForm>(EMPTY_FORM);
  const [newOpen, setNewOpen] = useState(false);

  const openEdit = (a: AgentRow) => {
    setEditing(a);
    setForm({ code: a.code ?? "", name: a.name, email: a.email ?? "", description: a.description ?? "", status: a.status ?? "active",
      role_id: a.role_id ?? "", model: a.model ?? "", system_prompt: a.system_prompt ?? "", persona: personaToForm(a.persona) });
    setEditDialog(true);
  };
  const saveEdit = async () => {
    if (!form.name.trim()) { toast.error("請輸入名稱"); return; }
    if (!form.email.trim()) { toast.error("請輸入 Email"); return; }
    const payload = {
      code: form.code.trim() || null, name: form.name.trim(), email: form.email.trim().toLowerCase(),
      description: form.description || null,
      status: form.status, role_id: form.role_id || null, model: form.model || null,
      system_prompt: form.system_prompt || null,
      persona: { ...form.persona } as unknown as import("@/integrations/supabase/types").Json,
    };
    const { error } = editing
      ? await supabase.from("ai_agents").update(payload).eq("id", editing.id)
      : await supabase.from("ai_agents").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("已更新"); setEditDialog(false);
    qc.invalidateQueries({ queryKey: ["ai_agents"] });
  };
  const del = async (a: AgentRow) => {
    if (!confirm(`確定刪除 Agent「${a.name}」？`)) return;
    const { error } = await supabase.from("ai_agents").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); qc.invalidateQueries({ queryKey: ["ai_agents"] });
  };
  const copyEndpoint = () => { navigator.clipboard.writeText(AGENT_ENDPOINT); toast.success("已複製端點"); };

  if (!canView) return <div className="p-6 text-muted-foreground">您沒有權限檢視此頁</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="AI Agent" description="管理 AI 代理與其 API Token"
        actions={canCreate ? <Button onClick={() => setNewOpen(true)}>✨ 新增 Agent（含 Token）</Button> : null} />

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">連線端點</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs break-all">{AGENT_ENDPOINT}</code>
            <Button variant="outline" size="sm" onClick={copyEndpoint}><Copy /> 複製</Button>
          </div>
          <p className="text-muted-foreground">Agent 呼叫時請帶 Header：<code className="rounded bg-muted px-1">Authorization: Bearer &lt;token&gt;</code></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Agent 列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8"></TableHead><TableHead>名稱</TableHead><TableHead>Email</TableHead><TableHead>代碼</TableHead>
              <TableHead>狀態</TableHead><TableHead>角色</TableHead><TableHead>模型</TableHead><TableHead className="text-right">操作</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {agents.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">尚無資料</TableCell></TableRow>}
              {agents.map((a) => {
                const isOpen = !!expanded[a.id];
                return (
                  <Fragment key={a.id}>
                    <TableRow>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => setExpanded((s) => ({ ...s, [a.id]: !s[a.id] }))}>{isOpen ? <ChevronDown /> : <ChevronRight />}</Button></TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground">{a.code || "-"}</TableCell>
                      <TableCell><Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
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

      {/* 一站式：新增 Agent（含 Token） */}
      <NewAgentWithTokenDialog open={newOpen} onOpenChange={setNewOpen} roles={roles}
        onDone={() => qc.invalidateQueries({ queryKey: ["ai_agents"] })} />

      {/* 編輯 Agent */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>編輯 Agent</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="AGENT-001" /></div>
              <div className="space-y-1"><Label>名稱 *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>狀態</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">active</SelectItem><SelectItem value="disabled">disabled</SelectItem></SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>角色</Label>
                <Select value={form.role_id || "__none"} onValueChange={(v) => setForm({ ...form, role_id: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="選擇角色" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">— 未指定 —</SelectItem>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1 col-span-2"><Label>模型</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
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
          <DialogFooter><Button variant="outline" onClick={() => setEditDialog(false)}>取消</Button><Button onClick={saveEdit}>儲存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScopePicker({ catalog, checked, toggle }: { catalog: ScopeRow[]; checked: Set<string>; toggle: (s: string) => void }) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="text-sm font-medium">權限 (SCOPES)</div>
      {SCOPE_CATEGORIES.map((cat) => {
        const items = catalog.filter((s) => s.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground">{cat}類</div>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((s) => {
                const on = checked.has(s.scope); const dis = s.reserved;
                return (
                  <button key={s.scope} type="button" disabled={dis} onClick={() => toggle(s.scope)} title={s.description ?? ""}
                    className={["flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
                      dis ? "opacity-40 cursor-not-allowed border-border" : on ? "border-primary bg-primary/10" : "border-border hover:bg-muted"].join(" ")}>
                    <span className={["w-4 h-4 rounded border flex items-center justify-center shrink-0", on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"].join(" ")}>
                      {on && <Check className="w-3 h-3" />}
                    </span>
                    <code className="text-xs">{s.scope}</code>
                    {s.reserved && <span className="text-[10px] text-muted-foreground">(保留)</span>}
                    {s.sensitivity === "high" && <ShieldAlert className="w-3.5 h-3.5 text-red-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground">Token 依勾選的 scope 決定 Agent 能做什麼（SDK 權限）。</p>
    </div>
  );
}

function NewAgentWithTokenDialog({ open, onOpenChange, roles, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; roles: { id: string; name: string }[]; onDone: () => void;
}) {
  const { data: catalog = [] } = useScopeCatalog();
  const [name, setName] = useState("");
  const [model, setModel] = useState("google/gemini-2.5-flash");
  const [roleId, setRoleId] = useState("");
  const [expires, setExpires] = useState(90);
  const [purpose, setPurpose] = useState("");
  const [email, setEmail] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set(["me.read"]));
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const reset = () => { setName(""); setModel("google/gemini-2.5-flash"); setRoleId(""); setExpires(90); setPurpose(""); setEmail(""); setChecked(new Set(["me.read"])); setBusy(false); setIssued(null); };
  const toggle = (s: string) => setChecked((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const submit = async () => {
    if (!name.trim()) { toast.error("請輸入 Agent 名稱"); return; }
    setBusy(true);
    try {
      const { data: agent, error: aErr } = await supabase.from("ai_agents")
        .insert({ name: name.trim(), model, description: purpose || null, role_id: roleId || null, status: "active", kind: "inbound", provider: "internal" })
        .select("id").single();
      if (aErr) { toast.error(`建立 Agent 失敗：${aErr.message}`); return; }
      const expiresAt = new Date(Date.now() + expires * 86400000).toISOString();
      const { data: token, error: tErr } = await supabase.rpc("create_agent_token", {
        p_agent: agent.id, p_name: `${name.trim()} token`, p_expires: expiresAt, p_scopes: [...checked],
      });
      if (tErr) { toast.error(`發行 Token 失敗：${tErr.message}`); return; }
      setIssued(String(token));
      if (email.trim()) {
        const { error: eErr } = await supabase.functions.invoke("send-email", {
          body: { to: email.trim(), subject: `您的 AI Agent Token — ${name.trim()}`,
            html: `<p>Agent：<b>${name.trim()}</b></p><p>Token（僅此一次）：</p><pre>${token}</pre><p>端點：${AGENT_ENDPOINT}</p>` },
        });
        if (eErr) toast.error(`Token 已建立，但寄信失敗：${eErr.message}`);
        else toast.success(`已寄送到 ${email.trim()}`);
      }
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>✨ 新增 Agent（含 API Token）</DialogTitle></DialogHeader>
        {issued ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-3">
              <div className="text-sm font-semibold text-primary flex items-center gap-2"><Check className="w-4 h-4" /> 已建立並發行</div>
              <p className="text-xs text-muted-foreground">此 Token <b>僅顯示這一次</b>，請立即複製或下載。{email && "（已同時寄出）"}</p>
              <div className="flex gap-2">
                <Input readOnly value={issued} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(issued); toast.success("已複製"); }}><Copy className="w-4 h-4" /></Button>
              </div>
              <div className="text-xs text-muted-foreground">Base URI：<code className="rounded bg-muted px-1">{AGENT_ENDPOINT}</code></div>
            </div>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>完成</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2"><Label>名稱 *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：Claude-Sonnet" /></div>
              <div className="space-y-1"><Label>模型</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
              <div className="space-y-1"><Label>Token 有效期</Label>
                <Select value={String(expires)} onValueChange={(v) => setExpires(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPIRY_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} 天</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1 col-span-2"><Label>角色（選填）</Label>
                <Select value={roleId || "__none"} onValueChange={(v) => setRoleId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="選擇角色" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">— 未指定 —</SelectItem>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1 col-span-2"><Label>用途說明</Label><Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="這個 Agent 用來做什麼？" /></div>
            </div>
            <ScopePicker catalog={catalog} checked={checked} toggle={toggle} />
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> 寄送 Token 到 Email（選填）</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="留空則不寄，發行後畫面顯示一次" />
            </div>
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800">⚠ 建立成功後 Token 只會顯示一次，請立即複製或用 Email 寄送。</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "建立並發行 Token"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TokensPanel({ agentId, canManage }: { agentId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { data: tokens = [] } = useQuery({
    queryKey: ["ai_agent_tokens", agentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_agent_tokens").select("*").eq("agent_id", agentId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TokenRow[];
    },
  });
  const { data: catalog = [] } = useScopeCatalog();

  const [issueOpen, setIssueOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenExpires, setTokenExpires] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set(["me.read"]));
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const toggle = (s: string) => setChecked((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const issue = async () => {
    const { data, error } = await supabase.rpc("create_agent_token", {
      p_agent: agentId, p_name: tokenName || undefined,
      p_expires: tokenExpires ? new Date(tokenExpires).toISOString() : undefined, p_scopes: [...checked],
    });
    if (error) { toast.error(error.message); return; }
    setIssuedToken(String(data)); setTokenName(""); setTokenExpires("");
    qc.invalidateQueries({ queryKey: ["ai_agent_tokens", agentId] });
  };
  const revoke = async (t: TokenRow) => {
    if (!confirm(`撤銷 Token「${t.name || t.token_prefix}」？`)) return;
    const { error } = await supabase.from("ai_agent_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已撤銷"); qc.invalidateQueries({ queryKey: ["ai_agent_tokens", agentId] });
  };
  const closeIssueDialog = (open: boolean) => { setIssueOpen(open); if (!open) { setIssuedToken(null); setChecked(new Set(["me.read"])); } };

  return (
    <div className="p-2 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">API Tokens</div>
        {canManage && <Button size="sm" onClick={() => { setIssuedToken(null); setChecked(new Set(["me.read"])); setIssueOpen(true); }}>發行 Token</Button>}
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>名稱</TableHead><TableHead>Prefix</TableHead><TableHead>Scopes</TableHead>
          <TableHead>到期</TableHead><TableHead>最後使用</TableHead><TableHead>狀態</TableHead><TableHead className="text-right">操作</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {tokens.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">尚無 Token</TableCell></TableRow>}
          {tokens.map((t) => {
            const revoked = !!t.revoked_at;
            return (
              <TableRow key={t.id}>
                <TableCell>{t.name || "-"}</TableCell>
                <TableCell><code className="text-xs">{t.token_prefix}…</code></TableCell>
                <TableCell className="text-xs text-muted-foreground">{Array.isArray(t.scopes) ? t.scopes.length : 0}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{t.expires_at ? new Date(t.expires_at).toLocaleString() : "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "—"}</TableCell>
                <TableCell><Badge variant={revoked ? "secondary" : "default"}>{revoked ? "已撤銷" : "有效"}</Badge></TableCell>
                <TableCell className="text-right">{canManage && !revoked && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revoke(t)}>撤銷</Button>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={issueOpen} onOpenChange={closeIssueDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>發行 API Token</DialogTitle></DialogHeader>
          {issuedToken ? (
            <div className="space-y-3">
              <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">此 Token 僅顯示這一次，請立即保存。</div>
              <div className="space-y-1"><Label>Token</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-2 text-xs break-all">{issuedToken}</code>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(issuedToken); toast.success("已複製"); }}><Copy /> 複製</Button>
                </div>
              </div>
              <DialogFooter><Button onClick={() => closeIssueDialog(false)}>我已保存，關閉</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1"><Label>名稱</Label><Input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="例：production" /></div>
              <div className="space-y-1"><Label>到期日（選填）</Label><Input type="datetime-local" value={tokenExpires} onChange={(e) => setTokenExpires(e.target.value)} /></div>
              <ScopePicker catalog={catalog} checked={checked} toggle={toggle} />
              <DialogFooter><Button variant="outline" onClick={() => closeIssueDialog(false)}>取消</Button><Button onClick={issue}>發行</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TEST_RESOURCES = ["cases", "opportunities", "contracts", "clients", "client_contacts", "payments", "invoices", "ledger", "commission", "service_tickets"] as const;
const WRITE_RESOURCES = ["cases", "opportunities", "service_tickets"] as const;

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
      const r = await fetch(`${AGENT_ENDPOINT}?${qs.toString()}`, { method: "POST", headers: { Authorization: `Bearer ${token.trim()}` } });
      const text = await r.text();
      try { setResult(JSON.stringify(JSON.parse(text), null, 2)); } catch { setResult(text); }
    } catch (e) { setResult(String(e)); } finally { setLoading(null); }
  };
  const callWrite = async () => {
    if (!token.trim()) { toast.error("請貼上要測試的 psk_ Token"); return; }
    let data: unknown = {};
    try { data = wData.trim() ? JSON.parse(wData) : {}; } catch { toast.error("data 不是合法 JSON"); return; }
    setLoading("write"); setResult("");
    try {
      const r = await fetch(`${AGENT_ENDPOINT}?action=write`, {
        method: "POST", headers: { Authorization: `Bearer ${token.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ resource: wResource, op: wOp, id: wId.trim() || undefined, data }),
      });
      const text = await r.text();
      try { setResult(JSON.stringify(JSON.parse(text), null, 2)); } catch { setResult(text); }
    } catch (e) { setResult(String(e)); } finally { setLoading(null); }
  };

  return (
    <div className="p-2 mt-4 border-t pt-4 space-y-4">
      <div className="font-medium text-sm">通道測試（以 Token 實際呼叫 agent-api）</div>
      <div className="space-y-1"><Label className="text-xs">psk_ Token</Label>
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="貼上剛發行的 psk_…（僅存於瀏覽器記憶體）" /></div>
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => call("whoami")}>whoami</Button>
        <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => call("pack")}>學習包</Button>
        <div className="flex items-end gap-1">
          <Select value={resource} onValueChange={setResource}><SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{TEST_RESOURCES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => call("data", resource)}>查資料</Button>
        </div>
      </div>
      <div className="rounded-md border p-3 space-y-2">
        <div className="text-xs font-medium">寫入測試（write）</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1"><Label className="text-xs">op</Label>
            <Select value={wOp} onValueChange={setWOp}><SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="update">update</SelectItem><SelectItem value="create">create</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-xs">resource</Label>
            <Select value={wResource} onValueChange={setWResource}><SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{WRITE_RESOURCES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1 flex-1 min-w-[220px]"><Label className="text-xs">id（update 必填）</Label>
            <Input value={wId} onChange={(e) => setWId(e.target.value)} placeholder="update 時填該筆 uuid；create 留空" /></div>
        </div>
        <div className="space-y-1"><Label className="text-xs">data（JSON）</Label>
          <Textarea rows={3} value={wData} onChange={(e) => setWData(e.target.value)} className="font-mono text-xs" /></div>
        <Button size="sm" disabled={loading !== null} onClick={callWrite}>送出寫入</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">實際呼叫 agent-api，等同外部 Agent 的請求；回應依該 Token 的 scope 而定。Token 不會被儲存。</p>
      {(loading || result) && <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all">{loading ? `呼叫 ${loading}…` : result}</pre>}
    </div>
  );
}
