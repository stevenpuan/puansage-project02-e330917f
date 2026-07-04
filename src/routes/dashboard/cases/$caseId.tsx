import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/cases/$caseId")({ component: Page });

interface CaseRow {
  id: string; code: string; title: string;
  client_id: string | null; system_id: string | null;
  type: string | null; status: string | null; priority: string | null;
  owner_id: string | null; amount: number | null;
  start_date: string | null; due_date: string | null;
  description: string | null; note: string | null;
  kickoff_date: string | null; go_live_date: string | null;
  acceptance_date: string | null; warranty_months: number | null;
  warranty_end: string | null;
}
interface WarrantyRow {
  id: string; acceptance_date: string | null; warranty_months: number | null;
  warranty_end: string | null; days_left: number | null;
  in_warranty: boolean | null; expired: boolean | null;
  has_active_maintenance: boolean | null;
}
interface TaskRow {
  id: string; case_id: string; title: string;
  status: string | null; priority: string | null;
  assignee_id: string | null; due_date: string | null;
  description: string | null; done_at: string | null;
}

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

const DONE = new Set(["完成", "已完成", "done", "closed", "已結案"]);
const isTaskDone = (t: TaskRow) => (t.status ? DONE.has(t.status) : false) || !!t.done_at;
const today = () => new Date().toISOString().slice(0, 10);

function Page() {
  const { can } = useAuth();
  const { caseId } = Route.useParams();
  const qc = useQueryClient();
  const canEdit = can("cases", "edit"), canCreate = can("cases", "create"), canDelete = can("cases", "delete");

  const { data: typeOpts = [] } = useLookups("case_type");
  const { data: statusOpts = [] } = useLookups("case_status");
  const { data: priorityOpts = [] } = useLookups("case_priority");
  const { data: taskStatusOpts = [] } = useLookups("task_status");
  const { data: taskPriorityOpts = [] } = useLookups("task_priority");

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
  const personLabel = (id: string | null) => { const p = profiles.find((x) => x.id === id); return p?.full_name || p?.email || "—"; };

  const { data: row } = useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*").eq("id", caseId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as CaseRow | null;
    },
  });
  const [form, setForm] = useState<Partial<CaseRow> | null>(null);
  const current = form ?? row ?? null;
  const set = <K extends keyof CaseRow>(k: K, v: CaseRow[K] | string) => setForm({ ...(current ?? {}), [k]: v as CaseRow[K] });

  const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const saveCase = async () => {
    if (!current) return;
    const payload = {
      code: current.code, title: current.title,
      client_id: current.client_id || null, system_id: current.system_id || null,
      type: current.type || null, status: current.status || null, priority: current.priority || null,
      owner_id: current.owner_id || null, amount: numOrNull(current.amount),
      start_date: current.start_date || null, due_date: current.due_date || null,
      description: current.description || null, note: current.note || null,
      kickoff_date: current.kickoff_date || null,
      go_live_date: current.go_live_date || null,
      acceptance_date: current.acceptance_date || null,
      warranty_months: numOrNull(current.warranty_months),
    };
    const { error } = await supabase.from("cases").update(payload as any).eq("id", caseId);
    if (error) { toast.error(error.message); return; }
    toast.success("已更新"); setForm(null);
    qc.invalidateQueries({ queryKey: ["case", caseId] });
    qc.invalidateQueries({ queryKey: ["cases-summary"] });
    qc.invalidateQueries({ queryKey: ["case-warranty", caseId] });
  };

  // Tasks
  const taskKey = ["case-tasks", caseId];
  const { data: tasks = [] } = useQuery({
    queryKey: taskKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("case_tasks").select("*").eq("case_id", caseId).order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });
  const reloadTasks = () => qc.invalidateQueries({ queryKey: taskKey });

  const [tForm, setTForm] = useState<Partial<TaskRow> | null>(null);
  const isNewTask = tForm && !tForm.id;
  const saveTask = async () => {
    if (!tForm?.title) { toast.error("請填寫標題"); return; }
    const payload = {
      case_id: caseId, title: tForm.title,
      status: tForm.status || null, priority: tForm.priority || null,
      assignee_id: tForm.assignee_id || null, due_date: tForm.due_date || null,
      description: tForm.description || null,
    };
    const { error } = isNewTask
      ? await supabase.from("case_tasks").insert(payload as any)
      : await supabase.from("case_tasks").update(payload as any).eq("id", tForm!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNewTask ? "已新增待辦" : "已更新"); setTForm(null); reloadTasks();
  };
  const delTask = async (t: TaskRow) => {
    if (!confirm(`確定刪除待辦「${t.title}」？`)) return;
    const { error } = await supabase.from("case_tasks").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reloadTasks();
  };
  const toggleDone = async (t: TaskRow, checked: boolean) => {
    const patch = checked
      ? { status: "完成", done_at: new Date().toISOString() }
      : { status: taskStatusOpts[0]?.code ?? "進行中", done_at: null };
    const { error } = await supabase.from("case_tasks").update(patch).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    reloadTasks();
  };

  if (!row && !form) {
    return <div className="p-6 text-muted-foreground">載入中…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`專案詳情 · ${row?.code ?? ""}`} description={row?.title ?? ""} actions={
        <Button variant="outline" asChild><Link to="/dashboard/cases">返回列表</Link></Button>
      } />

      <Card>
        <CardHeader><CardTitle>基本資料</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="專案代號"><Input disabled={!canEdit} value={current?.code ?? ""} onChange={(e) => set("code", e.target.value)} /></F>
            <F label="標題"><Input disabled={!canEdit} value={current?.title ?? ""} onChange={(e) => set("title", e.target.value)} /></F>
            <F label="客戶">
              <Select disabled={!canEdit} value={current?.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
                <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="系統">
              <Select disabled={!canEdit} value={current?.system_id ?? ""} onValueChange={(v) => set("system_id", v)}>
                <SelectTrigger><SelectValue placeholder="選擇系統" /></SelectTrigger>
                <SelectContent>{systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} · {s.name}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="類型">
              <Select disabled={!canEdit} value={current?.type ?? ""} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                <SelectContent>{typeOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="狀態">
              <Select disabled={!canEdit} value={current?.status ?? ""} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="優先">
              <Select disabled={!canEdit} value={current?.priority ?? ""} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                <SelectContent>{priorityOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="負責人">
              <Select disabled={!canEdit} value={current?.owner_id ?? ""} onValueChange={(v) => set("owner_id", v)}>
                <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="金額"><Input type="number" disabled={!canEdit} value={current?.amount ?? ""} onChange={(e) => set("amount", e.target.value)} /></F>
            <F label="開始日"><Input type="date" disabled={!canEdit} value={current?.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></F>
            <F label="到期日"><Input type="date" disabled={!canEdit} value={current?.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} /></F>
            <F label="說明" full><Textarea rows={3} disabled={!canEdit} value={current?.description ?? ""} onChange={(e) => set("description", e.target.value)} /></F>
            <F label="備註" full><Textarea rows={2} disabled={!canEdit} value={current?.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
          </div>
          {canEdit && (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" disabled={!form} onClick={() => setForm(null)}>取消</Button>
              <Button disabled={!form} onClick={saveCase}>儲存變更</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <WarrantySection caseId={caseId} current={current} set={set} canEdit={canEdit} />

      <CloseoutSection caseId={caseId} canEdit={canEdit} />




      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>待辦</CardTitle>
          {canCreate && (
            <Dialog open={!!isNewTask} onOpenChange={(o) => !o && setTForm(null)}>
              <DialogTrigger asChild><Button size="sm" onClick={() => setTForm({ status: taskStatusOpts[0]?.code ?? "" })}>新增待辦</Button></DialogTrigger>
              <TaskForm form={tForm} setForm={setTForm} save={saveTask} isNew profiles={profiles} statusOpts={taskStatusOpts} priorityOpts={taskPriorityOpts} />
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>標題</TableHead><TableHead>狀態</TableHead><TableHead>優先</TableHead>
                <TableHead>負責人</TableHead><TableHead>到期日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => {
                const done = isTaskDone(t);
                const overdue = !done && t.due_date && t.due_date < today();
                return (
                  <TableRow key={t.id} className={cn(overdue && "bg-red-50 dark:bg-red-950/30", done && "opacity-60")}>
                    <TableCell>
                      <Checkbox checked={done} onCheckedChange={(v) => toggleDone(t, !!v)} disabled={!canEdit} />
                    </TableCell>
                    <TableCell className={cn("font-medium", done && "line-through")}>{t.title}</TableCell>
                    <TableCell><Badge variant="outline">{t.status ?? "—"}</Badge></TableCell>
                    <TableCell>{t.priority ?? "—"}</TableCell>
                    <TableCell>{personLabel(t.assignee_id)}</TableCell>
                    <TableCell>{t.due_date ?? "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {canEdit && <Button size="sm" variant="outline" onClick={() => setTForm({ ...t })}>編輯</Button>}
                      {canDelete && <Button size="sm" variant="outline" onClick={() => delTask(t)}>刪除</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {tasks.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">尚無待辦</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MilestonesSection projectId={caseId} canEdit={canEdit} canCreate={canCreate} canDelete={canDelete} />
      <MembersSection projectId={caseId} canEdit={canEdit} canDelete={canDelete} profiles={profiles} />
      <RelatedSection clientId={current?.client_id ?? null} />

      <Dialog open={!!tForm && !isNewTask} onOpenChange={(o) => !o && setTForm(null)}>
        <TaskForm form={tForm} setForm={setTForm} save={saveTask} isNew={false} profiles={profiles} statusOpts={taskStatusOpts} priorityOpts={taskPriorityOpts} />
      </Dialog>
    </div>
  );
}

function TaskForm({ form, setForm, save, isNew, profiles, statusOpts, priorityOpts }: {
  form: Partial<TaskRow> | null; setForm: (f: Partial<TaskRow> | null) => void; save: () => void; isNew: boolean;
  profiles: { id: string; full_name: string | null; email: string | null }[];
  statusOpts: { code: string; label: string }[];
  priorityOpts: { code: string; label: string }[];
}) {
  if (!form) return null;
  const set = <K extends keyof TaskRow>(k: K, v: TaskRow[K] | string) => setForm({ ...form, [k]: v as TaskRow[K] });
  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增待辦" : "編輯待辦"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="標題" full><Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} /></F>
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
          <Select value={form.assignee_id ?? ""} onValueChange={(v) => set("assignee_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="到期日"><Input type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} /></F>
        <F label="說明" full><Textarea rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></F>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}

// ---------- Milestones ----------
interface Milestone {
  id: string; project_id: string; title: string;
  status: string | null; due_date: string | null;
  completed_at: string | null; sort_order: number | null; note: string | null;
}
function MilestonesSection({ projectId, canEdit, canCreate, canDelete }: {
  projectId: string; canEdit: boolean; canCreate: boolean; canDelete: boolean;
}) {
  const qc = useQueryClient();
  const key = ["milestones", projectId];
  const { data: statusOpts = [] } = useLookups("milestone_status");
  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*")
        .eq("project_id", projectId).order("sort_order", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: key });
  const [form, setForm] = useState<Partial<Milestone> | null>(null);
  const isNew = form && !form.id;

  const save = async () => {
    if (!form?.title) { toast.error("請填寫標題"); return; }
    const payload = {
      project_id: projectId, title: form.title,
      status: form.status || null, due_date: form.due_date || null,
      note: form.note || null,
      sort_order: form.sort_order == null || (form.sort_order as unknown as string) === "" ? null : Number(form.sort_order),
    };
    const { error } = isNew
      ? await supabase.from("milestones").insert(payload as any)
      : await supabase.from("milestones").update(payload as any).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增" : "已更新"); setForm(null); reload();
  };
  const del = async (m: Milestone) => {
    if (!confirm(`刪除里程碑「${m.title}」？`)) return;
    const { error } = await supabase.from("milestones").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };
  const toggleDone = async (m: Milestone, checked: boolean) => {
    const patch = checked
      ? { status: "完成", completed_at: today() }
      : { status: statusOpts[0]?.code ?? "待開始", completed_at: null };
    const { error } = await supabase.from("milestones").update(patch).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    reload();
  };

  const done = items.filter((m) => m.status === "完成").length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>里程碑 <span className="ml-2 text-sm font-normal text-muted-foreground">{done}/{items.length}</span></CardTitle>
        {canCreate && (
          <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
            <DialogTrigger asChild><Button size="sm" onClick={() => setForm({ status: statusOpts[0]?.code ?? "" })}>新增里程碑</Button></DialogTrigger>
            <MilestoneForm form={form} setForm={setForm} save={save} isNew statusOpts={statusOpts} />
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>標題</TableHead><TableHead>狀態</TableHead>
              <TableHead>到期日</TableHead><TableHead>備註</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((m) => {
              const isDone = m.status === "完成";
              const overdue = !isDone && m.due_date && m.due_date < today();
              return (
                <TableRow key={m.id} className={cn(overdue && "bg-red-50 dark:bg-red-950/30", isDone && "opacity-60")}>
                  <TableCell>
                    <Checkbox checked={isDone} onCheckedChange={(v) => toggleDone(m, !!v)} disabled={!canEdit} />
                  </TableCell>
                  <TableCell className={cn("font-medium", isDone && "line-through")}>{m.title}</TableCell>
                  <TableCell><Badge variant="outline">{m.status ?? "—"}</Badge></TableCell>
                  <TableCell>{m.due_date ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{m.note ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {canEdit && <Button size="sm" variant="outline" onClick={() => setForm({ ...m })}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="outline" onClick={() => del(m)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">尚無里程碑</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <MilestoneForm form={form} setForm={setForm} save={save} isNew={false} statusOpts={statusOpts} />
      </Dialog>
    </Card>
  );
}
function MilestoneForm({ form, setForm, save, isNew, statusOpts }: {
  form: Partial<Milestone> | null; setForm: (f: Partial<Milestone> | null) => void; save: () => void; isNew: boolean;
  statusOpts: { code: string; label: string }[];
}) {
  if (!form) return null;
  const set = <K extends keyof Milestone>(k: K, v: Milestone[K] | string) => setForm({ ...form, [k]: v as Milestone[K] });
  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增里程碑" : "編輯里程碑"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="標題" full><Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} /></F>
        <F label="狀態">
          <Select value={form.status ?? ""} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="到期日"><Input type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} /></F>
        <F label="排序"><Input type="number" value={form.sort_order ?? ""} onChange={(e) => set("sort_order", e.target.value)} /></F>
        <F label="備註" full><Textarea rows={2} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}

// ---------- Members ----------
interface MemberRow { project_id: string; user_id: string; role_in_project: string | null; }
function MembersSection({ projectId, canEdit, canDelete, profiles }: {
  projectId: string; canEdit: boolean; canDelete: boolean;
  profiles: { id: string; full_name: string | null; email: string | null }[];
}) {
  const qc = useQueryClient();
  const key = ["project-members", projectId];
  const { data: roleOpts = [] } = useLookups("project_role");
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_members").select("*").eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: key });
  const personLabel = (id: string) => { const p = profiles.find((x) => x.id === id); return p?.full_name || p?.email || id; };

  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [role, setRole] = useState<string>("");

  const add = async () => {
    if (!userId) { toast.error("請選擇成員"); return; }
    const { error } = await supabase.from("project_members").insert({
      project_id: projectId, user_id: userId, role_in_project: role || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("已新增"); setOpen(false); setUserId(""); setRole(""); reload();
  };
  const remove = async (m: MemberRow) => {
    if (!confirm(`移除成員「${personLabel(m.user_id)}」？`)) return;
    const { error } = await supabase.from("project_members").delete()
      .eq("project_id", m.project_id).eq("user_id", m.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success("已移除"); reload();
  };

  const available = profiles.filter((p) => !rows.some((r) => r.user_id === p.id));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>專案成員 <span className="ml-2 text-sm font-normal text-muted-foreground">{rows.length}</span></CardTitle>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm">新增成員</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>新增成員</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <F label="成員">
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                    <SelectContent>{available.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="角色">
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                    <SelectContent>{roleOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
              </div>
              <DialogFooter><Button onClick={add}>儲存</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead><TableHead>角色</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.user_id}>
                <TableCell className="font-medium">{personLabel(m.user_id)}</TableCell>
                <TableCell><Badge variant="outline">{m.role_in_project ?? "—"}</Badge></TableCell>
                <TableCell className="text-right">
                  {canDelete && <Button size="sm" variant="outline" onClick={() => remove(m)}>移除</Button>}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">尚無成員</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------- Related ----------
interface RelatedSystem { id: string; code: string; name: string; status: string | null; }
interface RelatedContract {
  id: string; system_id: string; billing_type: string | null;
  contract_amount: number | null; payment_status: string | null; next_payment_date: string | null;
}
function RelatedSection({ clientId }: { clientId: string | null }) {
  const { data: systems = [] } = useQuery({
    queryKey: ["related-systems", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("systems").select("id,code,name,status")
        .eq("client_id", clientId!).order("code");
      if (error) throw error;
      return (data ?? []) as RelatedSystem[];
    },
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["related-contracts", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts")
        .select("id,system_id,billing_type,contract_amount,payment_status,next_payment_date, systems!inner(client_id,code,name)")
        .eq("systems.client_id", clientId!);
      if (error) throw error;
      return (data ?? []) as unknown as (RelatedContract & { systems: { code: string; name: string } })[];
    },
  });

  if (!clientId) {
    return (
      <Card>
        <CardHeader><CardTitle>關聯資訊</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm">未設定客戶</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>關聯資訊</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="text-sm font-medium mb-2">客戶系統 <span className="text-muted-foreground">({systems.length})</span></div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代號</TableHead><TableHead>名稱</TableHead><TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {systems.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">
                    <Link to="/dashboard/ledger/systems" className="underline underline-offset-4">{s.code}</Link>
                  </TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell><Badge variant="outline">{s.status ?? "—"}</Badge></TableCell>
                </TableRow>
              ))}
              {systems.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">尚無系統</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">客戶合約 <span className="text-muted-foreground">({contracts.length})</span></div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>系統</TableHead><TableHead>類型</TableHead><TableHead>金額</TableHead>
                <TableHead>付款狀態</TableHead><TableHead>下次付款日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">
                    <Link to="/dashboard/ledger/systems" className="underline underline-offset-4">{c.systems?.code ?? "—"}</Link>
                  </TableCell>
                  <TableCell>{c.billing_type ?? "—"}</TableCell>
                  <TableCell>{c.contract_amount ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{c.payment_status ?? "—"}</Badge></TableCell>
                  <TableCell>{c.next_payment_date ?? "—"}</TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">尚無合約</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function WarrantySection({ caseId, current, set, canEdit }: {
  caseId: string;
  current: Partial<CaseRow> | null;
  set: <K extends keyof CaseRow>(k: K, v: CaseRow[K] | string) => void;
  canEdit: boolean;
}) {
  const { data: w } = useQuery({
    queryKey: ["case-warranty", caseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_warranty_status" as any)
        .select("*").eq("id", caseId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as WarrantyRow | null;
    },
  });
  const status = w?.in_warranty ? "保固中" : w?.expired ? "已過保固" : "尚未起算";
  const badgeCls = w?.in_warranty
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
    : w?.expired
    ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
    : "bg-muted text-muted-foreground";
  const showAlert = !!w?.expired && w?.has_active_maintenance === false;
  return (
    <Card>
      <CardHeader><CardTitle>關鍵日期與保固</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Kick-off 日"><Input type="date" disabled={!canEdit}
            value={current?.kickoff_date ?? ""} onChange={(e) => set("kickoff_date", e.target.value)} /></F>
          <F label="上線日"><Input type="date" disabled={!canEdit}
            value={current?.go_live_date ?? ""} onChange={(e) => set("go_live_date", e.target.value)} /></F>
          <F label="驗收日"><Input type="date" disabled={!canEdit}
            value={current?.acceptance_date ?? ""} onChange={(e) => set("acceptance_date", e.target.value)} /></F>
          <F label="保固期(月)"><Input type="number" disabled={!canEdit}
            value={current?.warranty_months ?? ""} onChange={(e) => set("warranty_months", e.target.value)} /></F>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">保固到期日：</span>
          <span className="font-medium">{w?.warranty_end ?? "—"}</span>
          <Badge className={cn("border-0", badgeCls)}>{status}</Badge>
          {w?.days_left != null && w.in_warranty && (
            <span className="text-muted-foreground">剩餘 {w.days_left} 天</span>
          )}
        </div>
        {showAlert && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-center justify-between gap-3">
            <div className="text-sm text-amber-900 dark:text-amber-200">
              保固已到期,建議簽維護合約
            </div>
            <Button asChild size="sm"><Link to="/dashboard/contracts">前往合約管理</Link></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
