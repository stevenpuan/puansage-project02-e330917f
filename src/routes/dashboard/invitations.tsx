import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/invitations")({ component: Page });

interface Invitation {
  id: string; code: string; email: string | null; role_id: string | null;
  status: string; expires_at: string | null; created_at: string; used_at: string | null;
}
interface Role { id: string; code: string; name: string }

function randomCode(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(len);
  (globalThis.crypto ?? window.crypto).getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}
function plusDaysISO(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString();
}

function Page() {
  const { can, isAdmin } = useAuth();
  const qc = useQueryClient();
  const allowed = isAdmin || can("users", "create");

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id,code,name").order("name");
      if (error) throw error;
      return (data ?? []) as Role[];
    },
  });
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? "—";

  const { data: rows = [] } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invitations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
    enabled: allowed,
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["invitations"] });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; role_id: string; days: number }>({
    email: "", role_id: "", days: 7,
  });

  const create = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id ?? null;
    const code = randomCode(12);
    const payload = {
      code,
      email: form.email.trim() || null,
      role_id: form.role_id || null,
      expires_at: plusDaysISO(Number(form.days) || 7),
      invited_by: uid,
      status: "pending",
    };
    const { error } = await supabase.from("invitations").insert(payload);
    if (error) { toast.error(error.message); return; }
    try { await navigator.clipboard?.writeText(code); } catch { /* ignore */ }
    toast.success(`已建立邀請碼 ${code}（已複製到剪貼簿）`);
    setForm({ email: "", role_id: "", days: 7 });
    setOpen(false);
    reload();
  };

  const disable = async (r: Invitation) => {
    const { error } = await supabase.from("invitations").update({ status: "disabled" }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已停用"); reload();
  };
  const remove = async (r: Invitation) => {
    if (!confirm(`確定刪除邀請碼「${r.code}」？`)) return;
    const { error } = await supabase.from("invitations").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };
  const copy = async (code: string) => {
    try {
      await navigator.clipboard?.writeText(code);
      toast.success("已複製");
    } catch {
      toast.error("複製失敗");
    }
  };

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="邀請成員" />
        <Card><CardContent className="py-8 text-center text-muted-foreground">無權限</CardContent></Card>
      </div>
    );
  }

  const statusVariant = (s: string): "default" | "destructive" | "secondary" | "outline" => {
    if (s === "used") return "default";
    if (s === "disabled") return "destructive";
    if (s === "expired") return "secondary";
    return "outline";
  };
  const isExpired = (r: Invitation) =>
    r.expires_at && new Date(r.expires_at).getTime() < Date.now() && r.status === "pending";

  return (
    <div className="space-y-6">
      <PageHeader title="邀請成員" description="產生邀請碼供新成員註冊,可指定角色與到期時間" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>新增邀請</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>新增邀請</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Email（選填）</Label>
                <Input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
              </div>
              <div className="space-y-1">
                <Label>角色（選填）</Label>
                <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                  <SelectTrigger><SelectValue placeholder="不指定" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>有效天數</Label>
                <Input type="number" min={1} max={90} value={form.days}
                  onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter><Button onClick={create}>產生邀請碼</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邀請碼</TableHead><TableHead>Email</TableHead><TableHead>角色</TableHead>
                <TableHead>狀態</TableHead><TableHead>到期時間</TableHead><TableHead>建立時間</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const expired = isExpired(r);
                const shown = expired ? "expired" : r.status;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.email ?? "—"}</TableCell>
                    <TableCell>{roleName(r.role_id)}</TableCell>
                    <TableCell><Badge variant={statusVariant(shown)}>{shown}</Badge></TableCell>
                    <TableCell>{r.expires_at ? new Date(r.expires_at).toLocaleString("zh-TW") : "—"}</TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleString("zh-TW")}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => copy(r.code)}>複製</Button>
                      {r.status === "pending" && !expired && (
                        <Button size="sm" variant="outline" onClick={() => disable(r)}>停用</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => remove(r)}>刪除</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">尚無邀請</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
