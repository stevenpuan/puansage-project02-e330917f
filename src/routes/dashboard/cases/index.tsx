import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadCsv, todayStamp } from "@/lib/csv";

export const Route = createFileRoute("/dashboard/cases/")({ component: Page });

interface CaseRow {
  id: string; code: string; title: string;
  client_id: string | null; system_id: string | null;
  type: string | null; status: string | null; priority: string | null;
  owner_id: string | null; amount: number | null;
  start_date: string | null; due_date: string | null;
  description: string | null; note: string | null;
  client_name?: string | null; owner_name?: string | null;
  open_task_count?: number | null;
}
const empty: Partial<CaseRow> = { code: "", title: "" };

function useLookups(category: string) {
  return useQuery({
    queryKey: ["lookups", category],
    queryFn: async () => {
      const { data } = await supabase.from("lookups").select("code,label")
        .eq("category", category).eq("is_active", true).order("sort_order");
      return (data ?? []) as { code: string; label: string }[];
    },
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const isOverdue = (r: CaseRow) => !!r.due_date && r.due_date < today() && r.status !== "完成" && r.status !== "已結案" && r.status !== "closed" && r.status !== "done";

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canCreate = can("cases", "create"), canEdit = can("cases", "edit"), canDelete = can("cases", "delete"), canExport = can("cases", "export");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");

  const { data: typeOpts = [] } = useLookups("case_type");
  const { data: statusOpts = [] } = useLookups("case_status");
  const { data: priorityOpts = [] } = useLookups("case_priority");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,code,name").order("code");
      return (data ?? []) as { id: string; code: string; name: string }[];
    },
  });
  const { data: systems = [] } = useQuery({
    queryKey: ["systems-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("systems").select("id,code,name").order("code");
      return (data ?? []) as { id: string; code: string; name: string }[];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email").order("full_name");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const systemLabel = (id: string | null) => { const s = systems.find((x) => x.id === id); return s ? `${s.code} · ${s.name}` : "—"; };
  const ownerName = (id: string | null) => { const p = profiles.find((x) => x.id === id); return p?.full_name || p?.email || "—"; };

  const { data: rows = [] } = useQuery({
    queryKey: ["cases-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_case_summary").select("*").order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as CaseRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["cases-summary"] });

  const [form, setForm] = useState<Partial<CaseRow> | null>(null);
  const isNew = form && !form.id;
  const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

  const save = async () => {
    if (!form?.code || !form?.title) { toast.error("請填寫代號與標題"); return; }
    const payload = {
      code: form.code, title: form.title,
      client_id: form.client_id || null, system_id: form.system_id || null,
      type: form.type || null, status: form.status || statusOpts[0]?.code || "進行中", priority: form.priority || "medium",
      owner_id: form.owner_id || null, amount: numOrNull(form.amount),
      start_date: form.start_date || null, due_date: form.due_date || null,
      description: form.description || null, note: form.note || null,
    };
    const { error } = isNew
      ? await supabase.from("cases").insert(payload as any)
      : await supabase.from("cases").update(payload as any).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增專案" : "已更新"); setForm(null); reload();
  };
  const del = async (r: CaseRow) => {
    if (!confirm(`確定刪除專案「${r.title}」？`)) return;
    const { error } = await supabase.from("cases").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && (r.status ?? "") !== statusFilter) return false;
    if (clientFilter !== "all" && (r.client_id ?? "") !== clientFilter) return false;
    if (q) {
      const s = q.toLowerCase();
      const hay = [r.code, r.title, r.client_name, clientName(r.client_id ?? null)].map((v) => (v ?? "").toString().toLowerCase());
      if (!hay.some((v) => v.includes(s))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="專案列表" description="專案的管理與追蹤" actions={
        <>
          {canExport && (
            <Button variant="outline" onClick={() => downloadCsv(
              `cases_${todayStamp()}.csv`,
              ["代號", "標題", "客戶", "類型", "狀態", "優先", "負責人", "到期日", "未完成待辦"],
              filtered.map((r) => [r.code, r.title, r.client_name ?? clientName(r.client_id ?? null), r.type, r.status, r.priority, r.owner_name ?? ownerName(r.owner_id ?? null), r.due_date, r.open_task_count ?? 0]),
            )}>匯出 CSV</Button>
          )}
          {canCreate && (
            <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
              <DialogTrigger asChild><Button onClick={() => setForm({ ...empty, status: statusOpts[0]?.code })}>新增專案</Button></DialogTrigger>
              <CaseForm form={form} setForm={setForm} save={save} isNew
                clients={clients} systems={systems} profiles={profiles}
                typeOpts={typeOpts} statusOpts={statusOpts} priorityOpts={priorityOpts} />
            </Dialog>
          )}
        </>
      } />

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="搜尋代號 / 標題 / 客戶" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">狀態</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">客戶</Label>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代號</TableHead><TableHead>標題</TableHead><TableHead>客戶</TableHead>
                <TableHead>類型</TableHead><TableHead>狀態</TableHead><TableHead>優先</TableHead>
                <TableHead>負責人</TableHead><TableHead>到期日</TableHead>
                <TableHead className="text-right">未完成待辦</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className={cn(isOverdue(r) && "bg-red-50 dark:bg-red-950/30")}>
                  <TableCell className="font-mono text-sm">
                    <Link to="/dashboard/cases/$caseId" params={{ caseId: r.id }} className="text-primary underline">{r.code}</Link>
                  </TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.client_name ?? clientName(r.client_id ?? null)}</TableCell>
                  <TableCell>{r.type ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.status ?? "—"}</Badge></TableCell>
                  <TableCell>{r.priority ?? "—"}</TableCell>
                  <TableCell>{r.owner_name ?? ownerName(r.owner_id ?? null)}</TableCell>
                  <TableCell>{r.due_date ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.open_task_count ?? 0}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {canEdit && <Button size="sm" variant="outline" onClick={async () => {
                      const { data } = await supabase.from("cases").select("*").eq("id", r.id).maybeSingle();
                      if (data) setForm(data as CaseRow);
                    }}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">尚無專案</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <CaseForm form={form} setForm={setForm} save={save} isNew={false}
          clients={clients} systems={systems} profiles={profiles}
          typeOpts={typeOpts} statusOpts={statusOpts} priorityOpts={priorityOpts} />
      </Dialog>
    </div>
  );
}

function CaseForm({ form, setForm, save, isNew, clients, systems, profiles, typeOpts, statusOpts, priorityOpts }: {
  form: Partial<CaseRow> | null; setForm: (f: Partial<CaseRow> | null) => void; save: () => void; isNew: boolean;
  clients: { id: string; code: string; name: string }[];
  systems: { id: string; code: string; name: string }[];
  profiles: { id: string; full_name: string | null; email: string | null }[];
  typeOpts: { code: string; label: string }[];
  statusOpts: { code: string; label: string }[];
  priorityOpts: { code: string; label: string }[];
}) {
  if (!form) return null;
  const set = <K extends keyof CaseRow>(k: K, v: CaseRow[K] | string) => setForm({ ...form, [k]: v as CaseRow[K] });
  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增專案" : "編輯專案"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="專案代號"><Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} placeholder="CASE-001" /></F>
        <F label="標題"><Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} /></F>
        <F label="客戶">
          <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="系統（選填）">
          <Select value={form.system_id ?? ""} onValueChange={(v) => set("system_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇系統" /></SelectTrigger>
            <SelectContent>{systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} · {s.name}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="類型">
          <Select value={form.type ?? ""} onValueChange={(v) => set("type", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{typeOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="狀態">
          <Select value={form.status ?? ""} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="優先">
          <Select value={form.priority ?? ""} onValueChange={(v) => set("priority", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{priorityOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="負責人">
          <Select value={form.owner_id ?? ""} onValueChange={(v) => set("owner_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="金額"><Input type="number" value={form.amount ?? ""} onChange={(e) => set("amount", e.target.value)} /></F>
        <F label="開始日"><Input type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></F>
        <F label="到期日"><Input type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} /></F>
        <F label="說明" full><Textarea rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></F>
        <F label="備註" full><Textarea rows={2} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}
