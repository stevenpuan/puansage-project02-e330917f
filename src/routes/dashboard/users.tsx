import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/users")({ component: UsersPage });

interface RoleRow { id: string; name: string; code: string }
interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  kind?: string | null;
  created_at: string;
  last_login_at?: string | null;
  user_roles?: { roles: { id: string; code: string; name: string } | null }[];
}
interface Invitation {
  id: string; code: string; email: string | null; status: string;
  expires_at: string | null; roles?: { name: string } | null;
}
interface AgentRow {
  id: string; code: string | null; name: string | null; status: string | null;
  model: string | null; roles?: { name: string | null } | null;
}
interface TokenRow { agent_id: string | null; revoked_at: string | null; expires_at: string | null }
interface ScopeRow { scope: string; category: string | null; description: string | null; sensitivity: string | null }

const statusLabel: Record<string, string> = {
  pending: "待審核", active: "已啟用", disabled: "已停用", rejected: "已拒絕",
};
const invStatusLabel: Record<string, string> = { unused: "未使用", used: "已使用", expired: "已過期" };

function genCode() {
  return (Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)).toUpperCase();
}
function tokenActive(t: TokenRow) {
  if (t.revoked_at) return false;
  if (t.expires_at && new Date(t.expires_at) <= new Date()) return false;
  return true;
}

function UsersPage() {
  const { can, user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const editable = can("users", "edit");
  const canAgents = can("ai_agents", "view");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(roles(id,code,name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProfileRow[];
    },
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data } = await supabase.from("roles").select("id,name,code").order("created_at");
      return (data ?? []) as RoleRow[];
    },
  });
  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations").select("*, roles(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invitation[];
    },
  });
  const { data: agents = [] } = useQuery({
    queryKey: ["accounts-agents"],
    enabled: canAgents,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents").select("id,code,name,status,model,roles(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AgentRow[];
    },
  });
  const { data: agentTokens = [] } = useQuery({
    queryKey: ["accounts-agent-tokens"],
    enabled: canAgents,
    queryFn: async () => {
      const { data } = await supabase.from("ai_agent_tokens").select("agent_id,revoked_at,expires_at");
      return (data ?? []) as TokenRow[];
    },
  });

  const activeTokenCount = (agentId: string) =>
    agentTokens.filter((t) => t.agent_id === agentId && tokenActive(t)).length;

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (status === "active") {
      const { data: existing } = await supabase.from("user_roles").select("role_id").eq("user_id", id);
      if (!existing || existing.length === 0) {
        const { data: role } = await supabase.from("roles").select("id").eq("code", "member").maybeSingle();
        if (role) await supabase.from("user_roles").insert({ user_id: id, role_id: role.id });
      }
    }
    toast.success("已更新");
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  // 邀請碼產生
  const [invRole, setInvRole] = useState("member");
  const [invEmail, setInvEmail] = useState("");
  const [invDays, setInvDays] = useState("7");
  const generate = async () => {
    const roleObj = roles.find((r) => r.code === invRole) ?? roles.find((r) => r.code === "member");
    const days = parseInt(invDays || "7", 10);
    const { error } = await supabase.from("invitations").insert({
      code: genCode(), email: invEmail || null, role_id: roleObj?.id ?? null,
      invited_by: user?.id ?? null, expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("已產生邀請碼");
    setInvEmail("");
    qc.invalidateQueries({ queryKey: ["invitations"] });
  };
  const copy = (text: string) => { navigator.clipboard?.writeText(text); toast.success("已複製：" + text); };

  // 對話框狀態
  const [newOpen, setNewOpen] = useState(false);
  const [editRow, setEditRow] = useState<ProfileRow | null>(null);
  const [tokenAgent, setTokenAgent] = useState<AgentRow | null>(null);

  const pending = rows.filter((r) => r.status === "pending");
  const active = rows.filter((r) => r.status === "active");

  const renderUsers = (list: ProfileRow[]) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名稱</TableHead><TableHead>信箱</TableHead><TableHead>角色</TableHead>
              <TableHead>狀態</TableHead><TableHead>建立時間</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">沒有資料</TableCell></TableRow>
            )}
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>{(r.user_roles ?? []).map((x) => x.roles?.name).filter(Boolean).join("、") || "—"}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "active" ? "default" : r.status === "pending" ? "secondary" : "outline"}>
                    {statusLabel[r.status] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-2">
                  {editable && r.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => setStatus(r.id, "active")}>核准</Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "rejected")}>拒絕</Button>
                    </>
                  )}
                  {editable && r.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "disabled")}>停用</Button>
                  )}
                  {editable && (r.status === "disabled" || r.status === "rejected") && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "active")}>啟用</Button>
                  )}
                  {editable && <Button size="sm" variant="outline" onClick={() => setEditRow(r)}>編輯</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="帳號管理"
        description="人員與 AI Agent 帳號、角色、API Token 與邀請碼"
        actions={isAdmin ? <Button onClick={() => setNewOpen(true)}>＋ 新增人員帳號</Button> : null}
      />
      {isLoading ? (
        <p className="text-muted-foreground">載入中…</p>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">全部 ({rows.length})</TabsTrigger>
            <TabsTrigger value="people">人員 ({active.length})</TabsTrigger>
            {canAgents && <TabsTrigger value="agents">AI Agent ({agents.length})</TabsTrigger>}
            <TabsTrigger value="pending">待審核 ({pending.length})</TabsTrigger>
            <TabsTrigger value="invite">邀請碼</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">{renderUsers(rows)}</TabsContent>
          <TabsContent value="people" className="mt-4">{renderUsers(active)}</TabsContent>
          <TabsContent value="pending" className="mt-4">{renderUsers(pending)}</TabsContent>

          {canAgents && (
            <TabsContent value="agents" className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Button asChild variant="outline">
                  <Link to="/dashboard/ai-agents">前往 AI Agent 完整管理（含 persona / scope）</Link>
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>代碼</TableHead><TableHead>名稱</TableHead><TableHead>角色</TableHead>
                        <TableHead>模型</TableHead><TableHead>狀態</TableHead>
                        <TableHead>有效 Token</TableHead><TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">尚無 Agent</TableCell></TableRow>
                      )}
                      {agents.map((a) => {
                        const cnt = activeTokenCount(a.id);
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono text-xs">{a.code ?? "—"}</TableCell>
                            <TableCell className="font-medium">{a.name ?? "—"}</TableCell>
                            <TableCell>{a.roles?.name ?? "—"}</TableCell>
                            <TableCell className="text-xs">{a.model ?? "—"}</TableCell>
                            <TableCell><Badge variant={a.status === "active" ? "default" : "outline"}>{a.status ?? "—"}</Badge></TableCell>
                            <TableCell>
                              {cnt > 0
                                ? <Badge>{cnt}</Badge>
                                : <Badge variant="destructive">無</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              {can("ai_agents", "edit") && (
                                <Button size="sm" onClick={() => setTokenAgent(a)}>發 Token</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                Agent 呼叫端點：<code className="rounded bg-muted px-1">/functions/v1/agent-api</code>，
                請帶 Header <code className="rounded bg-muted px-1">Authorization: Bearer &lt;token&gt;</code>。Token 僅在發行當下顯示一次。
              </p>
            </TabsContent>
          )}

          <TabsContent value="invite" className="mt-4 space-y-4">
            {editable && (
              <Card>
                <CardContent className="py-4 flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">角色</Label>
                    <Select value={invRole} onValueChange={setInvRole}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => <SelectItem key={r.id} value={r.code}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">指定信箱（選填）</Label>
                    <Input className="w-56" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">有效天數</Label>
                    <Input className="w-24" type="number" value={invDays} onChange={(e) => setInvDays(e.target.value)} />
                  </div>
                  <Button onClick={generate}>產生邀請碼</Button>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>邀請碼</TableHead><TableHead>角色</TableHead><TableHead>信箱</TableHead>
                      <TableHead>狀態</TableHead><TableHead>到期</TableHead><TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">尚無邀請碼</TableCell></TableRow>
                    )}
                    {invitations.map((iv) => (
                      <TableRow key={iv.id}>
                        <TableCell className="font-mono">{iv.code}</TableCell>
                        <TableCell>{iv.roles?.name ?? "—"}</TableCell>
                        <TableCell>{iv.email ?? "—"}</TableCell>
                        <TableCell><Badge variant={iv.status === "unused" ? "secondary" : "outline"}>{invStatusLabel[iv.status] ?? iv.status}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{iv.expires_at ? new Date(iv.expires_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => copy(iv.code)}>複製</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">
              使用方式：把邀請碼給對方，對方在登入頁「註冊」時填入邀請碼，即自動啟用並取得指定角色。
            </p>
          </TabsContent>
        </Tabs>
      )}

      <NewUserDialog open={newOpen} onOpenChange={setNewOpen} roles={roles}
        onDone={() => qc.invalidateQueries({ queryKey: ["users"] })} />
      <EditUserDialog key={editRow?.id ?? "none"} row={editRow} onOpenChange={(o) => !o && setEditRow(null)} roles={roles}
        onDone={() => qc.invalidateQueries({ queryKey: ["users"] })} />
      <IssueTokenDialog key={tokenAgent?.id ?? "none"} agent={tokenAgent} onOpenChange={(o) => !o && setTokenAgent(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["accounts-agent-tokens"] })} />
    </div>
  );
}

// ---------- 新增人員帳號（呼叫 admin-create-user edge function）----------
function NewUserDialog({ open, onOpenChange, roles, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; roles: RoleRow[]; onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const reset = () => { setEmail(""); setFullName(""); setRoleId(""); setLink(null); };
  const submit = async () => {
    if (!email.includes("@")) { toast.error("請輸入正確 email"); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: email.trim(), full_name: fullName.trim() || null, role_id: roleId || null },
    });
    setBusy(false);
    if (error) { toast.error(`建立失敗：${error.message}`); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    toast.success("帳號已建立");
    if ((data as any)?.email_sent) toast.success("已寄出設定密碼信");
    else if ((data as any)?.action_link) setLink((data as any).action_link);
    onDone();
    if (!(data as any)?.action_link || (data as any)?.email_sent) { reset(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>＋ 新增人員帳號</DialogTitle></DialogHeader>
        {link ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">帳號已建立。信件未寄出，請把下方「設定密碼連結」交給對方（僅顯示一次）：</p>
            <div className="flex gap-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(link); toast.success("已複製"); }}>複製</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1">
              <Label>名稱</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>角色</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger><SelectValue placeholder="選擇角色" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">系統會建立帳號並寄出「設定密碼」連結；若未設定寄信服務，畫面會顯示連結供你手動轉交。</p>
          </div>
        )}
        <DialogFooter>
          {link
            ? <Button onClick={() => { reset(); onOpenChange(false); }}>完成</Button>
            : <Button onClick={submit} disabled={busy}>{busy ? "建立中…" : "建立帳號"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- 編輯人員（姓名 / 角色 / 狀態）----------
function EditUserDialog({ row, onOpenChange, roles, onDone }: {
  row: ProfileRow | null; onOpenChange: (o: boolean) => void; roles: RoleRow[]; onDone: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (row && loadedFor !== row.id) {
    setLoadedFor(row.id);
    setFullName(row.full_name ?? "");
    setStatus(row.status);
    setRoleId(row.user_roles?.[0]?.roles?.id ?? "");
  }

  const save = async () => {
    if (!row) return;
    setBusy(true);
    const { error: pErr } = await supabase.from("profiles")
      .update({ full_name: fullName.trim() || null, status }).eq("id", row.id);
    if (pErr) { setBusy(false); toast.error(pErr.message); return; }
    // 單一主要角色：先清空再指派
    await supabase.from("user_roles").delete().eq("user_id", row.id);
    if (roleId) await supabase.from("user_roles").insert({ user_id: row.id, role_id: roleId });
    setBusy(false);
    toast.success("已儲存");
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>編輯帳號</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>名稱</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Email</Label>
            <Input readOnly value={row?.email ?? ""} className="bg-muted" /></div>
          <div className="space-y-1"><Label>角色</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="選擇角色" /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>狀態</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">已啟用</SelectItem>
                <SelectItem value="disabled">已停用</SelectItem>
                <SelectItem value="pending">待審核</SelectItem>
                <SelectItem value="rejected">已拒絕</SelectItem>
              </SelectContent>
            </Select></div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy}>{busy ? "儲存中…" : "儲存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- 為既有 Agent 發行 Token（create_agent_token RPC）----------
function IssueTokenDialog({ agent, onOpenChange, onDone }: {
  agent: AgentRow | null; onOpenChange: (o: boolean) => void; onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [expires, setExpires] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const { data: scopes = [] } = useQuery({
    queryKey: ["agent-scopes"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_scopes" as any)
        .select("scope,category,description,sensitivity").order("sort_order");
      return (data ?? []) as unknown as ScopeRow[];
    },
  });

  if (agent && loadedFor !== agent.id) {
    setLoadedFor(agent.id);
    setName(`${agent.name ?? agent.code ?? "agent"} token`);
    setExpires(""); setChecked(new Set()); setIssued(null);
  }

  const toggle = (s: string) => {
    setChecked((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  };
  const submit = async () => {
    if (!agent) return;
    setBusy(true);
    const expiresAt = expires ? new Date(expires).toISOString() : undefined;
    const { data, error } = await supabase.rpc("create_agent_token", {
      p_agent: agent.id, p_name: name.trim() || "token", p_expires: expiresAt, p_scopes: [...checked],
    });
    setBusy(false);
    if (error) { toast.error(`發行失敗：${error.message}`); return; }
    setIssued(String(data));
    onDone();
  };

  return (
    <Dialog open={!!agent} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>發行 API Token — {agent?.name ?? agent?.code}</DialogTitle></DialogHeader>
        {issued ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">此 Token <b>僅顯示這一次</b>，請立即複製保存。</p>
            <div className="flex gap-2">
              <Input readOnly value={issued} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(issued); toast.success("已複製"); }}>複製</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1"><Label>Token 名稱</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label>有效期（選填）</Label>
              <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>權限 Scope</Label>
              <div className="max-h-48 overflow-auto rounded border p-2 space-y-1">
                {scopes.length === 0 && <p className="text-xs text-muted-foreground">尚無可用 scope</p>}
                {scopes.map((s) => (
                  <label key={s.scope} className="flex items-start gap-2 text-sm">
                    <Checkbox checked={checked.has(s.scope)} onCheckedChange={() => toggle(s.scope)} />
                    <span><code className="text-xs">{s.scope}</code>
                      {s.description && <span className="text-muted-foreground"> — {s.description}</span>}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Token 依勾選的 scope 決定 Agent 能做什麼。</p>
            </div>
          </div>
        )}
        <DialogFooter>
          {issued
            ? <Button onClick={() => onOpenChange(false)}>完成</Button>
            : <Button onClick={submit} disabled={busy}>{busy ? "發行中…" : "發行 Token"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
