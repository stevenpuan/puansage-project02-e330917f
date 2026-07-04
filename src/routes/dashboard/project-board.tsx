import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";

export const Route = createFileRoute("/dashboard/project-board")({ component: Page });

const STATUSES = ["待辦", "進行中", "完成", "擱置"] as const;
type Status = typeof STATUSES[number];

interface TaskRow {
  id: string; case_id: string | null;
  case_code: string | null; case_title: string | null;
  title: string | null; description: string | null;
  status: string | null; priority: string | null;
  assignee_id: string | null; assignee_name: string | null;
  due_date: string | null; overdue: boolean | null;
}

interface TaskForm {
  id?: string; case_id: string | null; title: string; description: string;
  assignee_id: string | null; status: string; priority: string | null; due_date: string;
}
const emptyForm: TaskForm = {
  case_id: null, title: "", description: "", assignee_id: null,
  status: "待辦", priority: null, due_date: "",
};

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

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canCreate = can("cases", "create");
  const canEdit = can("cases", "edit");
  const canDelete = can("cases", "delete");

  const { data: priorityOpts = [] } = useLookups("task_priority");

  const { data: cases = [] } = useQuery({
    queryKey: ["cases-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("id,code,title").order("code");
      return (data ?? []) as { id: string; code: string; title: string }[];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email").order("full_name");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["v-project-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_project_tasks" as any)
        .select("*").order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as TaskRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["v-project-tasks"] });

  const [view, setView] = useState<"board" | "list">("board");
  const [caseFilter, setCaseFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<keyof TaskRow>("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => rows.filter((r) => {
    if (caseFilter !== "all" && r.case_id !== caseFilter) return false;
    if (assigneeFilter !== "all" && r.assignee_id !== assigneeFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
    return true;
  }), [rows, caseFilter, assigneeFilter, statusFilter, priorityFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const grouped = useMemo(() => {
    const g: Record<Status, TaskRow[]> = { "待辦": [], "進行中": [], "完成": [], "擱置": [] };
    for (const r of filtered) {
      const s = (r.status ?? "待辦") as Status;
      if (g[s]) g[s].push(r); else g["待辦"].push(r);
    }
    return g;
  }, [filtered]);

  const [form, setForm] = useState<TaskForm | null>(null);
  const isNew = form && !form.id;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const openEdit = async (id: string) => {
    const { data, error } = await supabase.from("case_tasks").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error(error?.message ?? "找不到"); return; }
    setForm({
      id: data.id, case_id: data.case_id,
      title: data.title ?? "", description: data.description ?? "",
      assignee_id: data.assignee_id, status: data.status ?? "待辦",
      priority: data.priority, due_date: data.due_date ?? "",
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.title || !form.case_id) { toast.error("請選擇案件與標題"); return; }
    const payload: any = {
      case_id: form.case_id, title: form.title,
      description: form.description || null,
      assignee_id: form.assignee_id || null,
      status: form.status || "待辦",
      priority: form.priority || null,
      due_date: form.due_date || null,
    };
    if (form.status === "完成") payload.done_at = new Date().toISOString();
    const { error } = form.id
      ? await supabase.from("case_tasks").update(payload).eq("id", form.id)
      : await supabase.from("case_tasks").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "已更新" : "已新增");
    setForm(null); reload();
  };

  const del = async (id: string) => {
    if (!confirm("確定刪除此任務？")) return;
    const { error } = await supabase.from("case_tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  const handleDragEnd = async (ev: DragEndEvent) => {
    if (!canEdit) return;
    const taskId = String(ev.active.id);
    const targetStatus = ev.over?.id ? String(ev.over.id) as Status : null;
    if (!targetStatus) return;
    const task = rows.find((r) => r.id === taskId);
    if (!task || task.status === targetStatus) return;
    const patch: any = { status: targetStatus };
    if (targetStatus === "完成") patch.done_at = new Date().toISOString();
    const { error } = await supabase.from("case_tasks").update(patch).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    reload();
  };

  const toggleSort = (k: keyof TaskRow) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="任務看板" description="全案件任務的看板與列表視圖" actions={
        canCreate && (
          <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
            <DialogTrigger asChild><Button onClick={() => setForm({ ...emptyForm })}>新增任務</Button></DialogTrigger>
            <TaskDialog form={form} setForm={setForm} save={save} isNew
              cases={cases} profiles={profiles} priorityOpts={priorityOpts} />
          </Dialog>
        )
      } />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>案件</Label>
            <Select value={caseFilter} onValueChange={setCaseFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {cases.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>負責人</Label>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>狀態</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>優先</Label>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {priorityOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto">
            <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list")}>
              <TabsList>
                <TabsTrigger value="board">看板</TabsTrigger>
                <TabsTrigger value="list">列表</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {view === "board" ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STATUSES.map((s) => (
              <Column key={s} status={s} tasks={grouped[s]} onEdit={canEdit ? openEdit : undefined} />
            ))}
          </div>
        </DndContext>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead k="case_code" label="案件" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHead k="title" label="任務" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHead k="assignee_name" label="負責人" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHead k="status" label="狀態" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHead k="priority" label="優先" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHead k="due_date" label="到期日" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id} className={cn(r.overdue && "bg-red-50 dark:bg-red-950/30")}>
                    <TableCell>
                      {r.case_id ? (
                        <Link to="/dashboard/cases/$caseId" params={{ caseId: r.case_id }} className="text-primary underline">
                          <span className="font-mono text-xs">{r.case_code}</span>
                          <span className="ml-2">{r.case_title}</span>
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>{r.assignee_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell>{r.priority ?? "—"}</TableCell>
                    <TableCell className={cn(r.overdue && "text-red-600 font-medium")}>{r.due_date ?? "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(r.id)}>編輯</Button>}
                      {canDelete && <Button size="sm" variant="outline" onClick={() => del(r.id)}>刪除</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {sorted.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">尚無任務</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <TaskDialog form={form} setForm={setForm} save={save} isNew={false}
          cases={cases} profiles={profiles} priorityOpts={priorityOpts} />
      </Dialog>
    </div>
  );
}

function SortableHead({ k, label, sortKey, sortDir, onSort }: {
  k: keyof TaskRow; label: string; sortKey: keyof TaskRow; sortDir: "asc" | "desc"; onSort: (k: keyof TaskRow) => void;
}) {
  return (
    <TableHead>
      <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}{sortKey === k && <span className="text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </TableHead>
  );
}

function Column({ status, tasks, onEdit }: { status: Status; tasks: TaskRow[]; onEdit?: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("rounded-lg border bg-muted/30 p-3 min-h-[300px]", isOver && "ring-2 ring-primary")}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">{status}</div>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => <TaskCard key={t.id} task={t} onEdit={onEdit} />)}
        {tasks.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">—</div>}
      </div>
    </div>
  );
}

function TaskCard({ task, onEdit }: { task: TaskRow; onEdit?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={cn("rounded-md border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing", isDragging && "opacity-50")}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm">{task.title}</div>
        {onEdit && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onEdit(task.id)}
            className="text-xs text-primary hover:underline shrink-0">編輯</button>
        )}
      </div>
      <div className="mt-2 text-xs text-muted-foreground space-y-1">
        <div className="font-mono">{task.case_code ?? "—"}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span>{task.assignee_name ?? "未指派"}</span>
          {task.priority && <Badge variant="outline" className="text-[10px] py-0">{task.priority}</Badge>}
        </div>
        {task.due_date && (
          <div className={cn(task.overdue && "text-red-600 font-medium")}>到期 {task.due_date}</div>
        )}
      </div>
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}

function TaskDialog({ form, setForm, save, isNew, cases, profiles, priorityOpts }: {
  form: TaskForm | null; setForm: (f: TaskForm | null) => void; save: () => void; isNew: boolean;
  cases: { id: string; code: string; title: string }[];
  profiles: { id: string; full_name: string | null; email: string | null }[];
  priorityOpts: { code: string; label: string }[];
}) {
  if (!form) return null;
  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增任務" : "編輯任務"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="案件">
          <Select value={form.case_id ?? ""} onValueChange={(v) => set("case_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇案件" /></SelectTrigger>
            <SelectContent>{cases.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.title}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="負責人">
          <Select value={form.assignee_id ?? ""} onValueChange={(v) => set("assignee_id", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="標題" full><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></F>
        <F label="說明" full><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></F>
        <F label="狀態">
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="優先">
          <Select value={form.priority ?? ""} onValueChange={(v) => set("priority", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {priorityOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="到期日"><Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} /></F>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setForm(null)}>取消</Button>
        <Button onClick={save}>儲存</Button>
      </DialogFooter>
    </DialogContent>
  );
}
