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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadCsv, todayStamp } from "@/lib/csv";

export const Route = createFileRoute("/dashboard/ledger/systems")({ component: Page });

interface SystemRow {
  id: string; code: string; name: string; client_id: string | null; status: string;
  launch_date: string | null; maintenance_due: string | null; tech_stack: string | null;
  prod_url: string | null; github_repo: string | null; supabase_project: string | null;
  deploy_url: string | null; secrets_location: string | null; note: string | null;
}
const empty: Partial<SystemRow> = { code: "", name: "", status: "開發中" };

function useLookups(category: string) {
  return useQuery({
    queryKey: ["lookups", category],
    queryFn: async () => {
      const { data } = await supabase.from("lookups").select("code,label").eq("category", category).eq("is_active", true).order("sort_order");
      return (data ?? []) as { code: string; label: string }[];
    },
  });
}

function maintState(due: string | null): { label: string; cls: string; variant: "default" | "destructive" | "secondary" } {
  if (!due) return { label: "—", cls: "", variant: "default" };
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "已過期", cls: "bg-red-50 dark:bg-red-950/30", variant: "destructive" };
  if (days <= 30) return { label: "即將到期", cls: "bg-amber-50 dark:bg-amber-950/30", variant: "secondary" };
  return { label: "正常", cls: "", variant: "default" };
}

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canCreate = can("ledger", "create"), canEdit = can("ledger", "edit"), canDelete = can("ledger", "delete"), canExport = can("ledger", "export");
  const [q, setQ] = useState("");
  const { data: statusOpts = [] } = useLookups("system_status");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  const { data: rows = [] } = useQuery({
    queryKey: ["systems"],
    queryFn: async () => {
      const { data, error } = await supabase.from("systems").select("*").order("code");
      if (error) throw error;
      return data as SystemRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["systems"] });

  const [form, setForm] = useState<Partial<SystemRow> | null>(null);
  const isNew = form && !form.id;
  const save = async () => {
    if (!form?.code || !form?.name) { toast.error("請填寫代號與名稱"); return; }
    const payload = {
      code: form.code, name: form.name, client_id: form.client_id || null,
      status: form.status || "開發中", launch_date: form.launch_date || null,
      maintenance_due: form.maintenance_due || null, tech_stack: form.tech_stack || null,
      prod_url: form.prod_url || null, github_repo: form.github_repo || null,
      supabase_project: form.supabase_project || null, deploy_url: form.deploy_url || null,
      secrets_location: form.secrets_location || null, note: form.note || null,
    };
    const { error } = isNew
      ? await supabase.from("systems").insert(payload)
      : await supabase.from("systems").update(payload).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增系統" : "已更新"); setForm(null); reload();
  };
  const del = async (r: SystemRow) => {
    if (!confirm(`確定刪除系統「${r.name}」？其合約也會一併刪除。`)) return;
    const { error } = await supabase.from("systems").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  const filtered = rows.filter((r) =>
    [r.code, r.name, r.tech_stack].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-6">
      <PageHeader title="系統管理" description="已交付系統的交付狀態、維護到期與技術資訊" actions={
        <>
          {canExport && (
            <Button variant="outline" onClick={() => downloadCsv(
              `systems_${todayStamp()}.csv`,
              ["代號", "系統名稱", "客戶", "交付狀態", "上線日期", "維護到期日", "維護狀態", "技術棧", "正式站", "GitHub", "Supabase 專案", "發布網址", "環境變數位置", "備註"],
              filtered.map((r) => [r.code, r.name, clientName(r.client_id), r.status, r.launch_date, r.maintenance_due, maintState(r.maintenance_due).label, r.tech_stack, r.prod_url, r.github_repo, r.supabase_project, r.deploy_url, r.secrets_location, r.note]),
            )}>匯出 CSV</Button>
          )}
          {canCreate && (
            <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
              <DialogTrigger asChild><Button onClick={() => setForm({ ...empty })}>新增系統</Button></DialogTrigger>
              <SystemForm form={form} setForm={setForm} save={save} isNew statusOpts={statusOpts} clients={clients} />
            </Dialog>
          )}
        </>
      } />

      <Input placeholder="搜尋代號 / 名稱 / 技術棧" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代號</TableHead><TableHead>系統名稱</TableHead><TableHead>客戶</TableHead>
                <TableHead>交付狀態</TableHead><TableHead>維護到期日</TableHead><TableHead>維護狀態</TableHead>
                <TableHead>正式站</TableHead><TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const ms = maintState(r.maintenance_due);
                return (
                  <TableRow key={r.id} className={ms.cls}>
                    <TableCell className="font-mono text-sm">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{clientName(r.client_id)}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell>{r.maintenance_due ?? "—"}</TableCell>
                    <TableCell><Badge variant={ms.variant}>{ms.label}</Badge></TableCell>
                    <TableCell>{r.prod_url ? <a href={r.prod_url} target="_blank" rel="noreferrer" className="text-primary underline">開啟</a> : "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {canEdit && <Button size="sm" variant="outline" onClick={() => setForm({ ...r })}>編輯</Button>}
                      {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">尚無系統</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <SystemForm form={form} setForm={setForm} save={save} isNew={false} statusOpts={statusOpts} clients={clients} />
      </Dialog>
    </div>
  );
}

function SystemForm({ form, setForm, save, isNew, statusOpts, clients }: {
  form: Partial<SystemRow> | null; setForm: (f: Partial<SystemRow> | null) => void; save: () => void;
  isNew: boolean; statusOpts: { code: string; label: string }[]; clients: { id: string; name: string }[];
}) {
  if (!form) return null;
  const set = (k: keyof SystemRow, v: string) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增系統" : "編輯系統"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="系統代號"><Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} placeholder="SYS-001" /></F>
        <F label="系統名稱"><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></F>
        <F label="客戶">
          <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="交付狀態">
          <Select value={form.status ?? "開發中"} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="上線日期"><Input type="date" value={form.launch_date ?? ""} onChange={(e) => set("launch_date", e.target.value)} /></F>
        <F label="維護到期日"><Input type="date" value={form.maintenance_due ?? ""} onChange={(e) => set("maintenance_due", e.target.value)} /></F>
        <F label="技術棧" full><Input value={form.tech_stack ?? ""} onChange={(e) => set("tech_stack", e.target.value)} placeholder="Lovable + Supabase" /></F>
        <F label="正式網址"><Input value={form.prod_url ?? ""} onChange={(e) => set("prod_url", e.target.value)} /></F>
        <F label="GitHub Repo"><Input value={form.github_repo ?? ""} onChange={(e) => set("github_repo", e.target.value)} /></F>
        <F label="Supabase 專案"><Input value={form.supabase_project ?? ""} onChange={(e) => set("supabase_project", e.target.value)} /></F>
        <F label="發布網址 (Lovable)"><Input value={form.deploy_url ?? ""} onChange={(e) => set("deploy_url", e.target.value)} /></F>
        <F label="環境變數/帳密位置" full><Input value={form.secrets_location ?? ""} onChange={(e) => set("secrets_location", e.target.value)} placeholder="連結，勿存明碼" /></F>
        <F label="備註" full><Input value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}
