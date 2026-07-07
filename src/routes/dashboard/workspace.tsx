import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/workspace")({ component: Page });

interface OpenTaskRow {
  id: string; case_id: string | null; case_code?: string | null; case_title?: string | null;
  client_name?: string | null; title: string; status: string | null; priority: string | null;
  assignee_id: string | null; due_date: string | null;
}
interface PTask {
  id: string; owner_id: string; title: string; description: string | null;
  status: string; priority: string; due_date: string | null; done_at: string | null; visibility: string;
}
const PRIORITIES = [{ v: "high", l: "高" }, { v: "medium", l: "中" }, { v: "low", l: "低" }];
const today = () => new Date().toISOString().slice(0, 10);

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: caseTasks = [] } = useQuery({
    queryKey: ["ws-open-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_open_tasks").select("*").order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as OpenTaskRow[];
    },
  });
  const myCaseTasks = caseTasks.filter((t) => t.assignee_id === user?.id);

  const { data: pTasks = [] } = useQuery({
    queryKey: ["personal-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("personal_tasks" as any).select("*")
        .order("done_at", { nullsFirst: true }).order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as PTask[];
    },
  });
  const reloadP = () => qc.invalidateQueries({ queryKey: ["personal-tasks"] });
  const reloadCase = () => qc.invalidateQueries({ queryKey: ["ws-open-tasks"] });

  const myPersonal = pTasks.filter((t) => t.owner_id === user?.id);
  const publicTasks = pTasks.filter((t) => t.visibility === "public" && t.owner_id !== user?.id);

  const doneCase = async (t: OpenTaskRow) => {
    const { error } = await supabase.from("case_tasks").update({ status: "完成", done_at: new Date().toISOString() }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已標記完成"); reloadCase();
  };
  const togglePDone = async (t: PTask, checked: boolean) => {
    const { error } = await supabase.from("personal_tasks" as any)
      .update(checked ? { status: "完成", done_at: new Date().toISOString() } : { status: "待辦", done_at: null })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    reloadP();
  };
  const delP = async (t: PTask) => {
    if (!confirm(`刪除「${t.title}」？`)) return;
    const { error } = await supabase.from("personal_tasks" as any).delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reloadP();
  };

  const [form, setForm] = useState<Partial<PTask> | null>(null);
  const isNew = form && !form.id;
  const openNew = () => setForm({ title: "", priority: "medium", visibility: "private", due_date: "" });
  const save = async () => {
    if (!form?.title) { toast.error("請填寫標題"); return; }
    const payload = {
      title: form.title, priority: form.priority || "medium",
      due_date: form.due_date || null, visibility: form.visibility || "private",
      description: form.description || null,
    };
    const { error } = isNew
      ? await supabase.from("personal_tasks" as any).insert(payload)
      : await supabase.from("personal_tasks" as any).update(payload).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增" : "已更新"); setForm(null); reloadP();
  };

  const pRow = (t: PTask, editable: boolean) => {
    const done = t.status === "完成";
    const overdue = !done && !!t.due_date && t.due_date < today();
    return (
      <TableRow key={t.id} className={cn(overdue && "bg-red-50 dark:bg-red-950/30")}>
        <TableCell>
          <Checkbox checked={done} onCheckedChange={(v) => togglePDone(t, !!v)} disabled={!editable} />
        </TableCell>
        <TableCell className={cn("font-medium", done && "line-through text-muted-foreground")}>{t.title}</TableCell>
        <TableCell>{PRIORITIES.find((p) => p.v === t.priority)?.l ?? t.priority}</TableCell>
        <TableCell><Badge variant={t.visibility === "public" ? "default" : "outline"}>{t.visibility === "public" ? "公用" : "個人"}</Badge></TableCell>
        <TableCell className={cn(overdue && "text-red-600 font-medium")}>{t.due_date ?? "—"}</TableCell>
        <TableCell className="text-right space-x-2">
          {editable && <Button size="sm" variant="outline" onClick={() => setForm({ ...t })}>編輯</Button>}
          {editable && <Button size="sm" variant="outline" onClick={() => delP(t)}>刪除</Button>}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="我的工作區" description="我的案件任務、個人待辦與公用待辦"
        actions={<Button onClick={openNew}>＋ 新增個人待辦</Button>} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">我負責的案件任務（{myCaseTasks.length}）</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-10" /><TableHead>案件</TableHead><TableHead>客戶</TableHead>
              <TableHead>待辦</TableHead><TableHead>狀態</TableHead><TableHead>優先</TableHead><TableHead>到期日</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {myCaseTasks.map((t) => {
                const overdue = !!t.due_date && t.due_date < today();
                return (
                  <TableRow key={t.id} className={cn(overdue && "bg-red-50 dark:bg-red-950/30")}>
                    <TableCell><Checkbox onCheckedChange={(v) => v && doneCase(t)} /></TableCell>
                    <TableCell>{t.case_id ? (
                      <Link to="/dashboard/cases/$caseId" params={{ caseId: t.case_id }} className="text-primary underline">
                        <span className="font-mono text-xs">{t.case_code ?? "—"}</span><span className="ml-2">{t.case_title ?? ""}</span>
                      </Link>) : "—"}</TableCell>
                    <TableCell>{t.client_name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell><Badge variant="outline">{t.status ?? "—"}</Badge></TableCell>
                    <TableCell>{t.priority ?? "—"}</TableCell>
                    <TableCell className={cn(overdue && "text-red-600 font-medium")}>{t.due_date ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
              {myCaseTasks.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">目前沒有指派給你的案件任務</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">我的個人待辦（{myPersonal.length}）</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-10" /><TableHead>待辦</TableHead><TableHead>優先</TableHead>
              <TableHead>可見</TableHead><TableHead>到期日</TableHead><TableHead className="text-right">操作</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {myPersonal.map((t) => pRow(t, true))}
              {myPersonal.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">尚無個人待辦，點右上「新增個人待辦」</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">公用待辦（{publicTasks.length}）</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-10" /><TableHead>待辦</TableHead><TableHead>優先</TableHead>
              <TableHead>可見</TableHead><TableHead>到期日</TableHead><TableHead className="text-right">操作</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {publicTasks.map((t) => pRow(t, false))}
              {publicTasks.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">尚無公用待辦</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isNew ? "新增個人待辦" : "編輯待辦"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>標題</Label>
                <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>優先</Label>
                  <Select value={form.priority ?? "medium"} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1"><Label>可見範圍</Label>
                  <Select value={form.visibility ?? "private"} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="private">個人（只有我）</SelectItem><SelectItem value="public">公用（全公司）</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <div className="space-y-1"><Label>到期日</Label>
                <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
