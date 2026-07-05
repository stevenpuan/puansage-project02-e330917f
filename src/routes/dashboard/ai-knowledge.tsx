import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/ai-knowledge")({ component: Page });

interface KnowledgeRow {
  id: string;
  code: string | null;
  title: string;
  category: string | null;
  tags: string[] | null;
  content: string | null;
  source_type: string | null;
  status: string;
  updated_at: string | null;
}

interface FormState {
  id?: string;
  code: string;
  title: string;
  category: string;
  tags: string;   // comma separated in the form
  content: string;
  source_type: string;
  status: string;
}
const EMPTY: FormState = { code: "", title: "", category: "", tags: "", content: "", source_type: "manual", status: "active" };

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canView = can("ai_agents", "view");
  const canCreate = can("ai_agents", "create");
  const canEdit = can("ai_agents", "edit");
  const canDelete = can("ai_agents", "delete");

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const isNew = !form.id;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ai_knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_knowledge")
        .select("id,code,title,category,tags,content,source_type,status,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KnowledgeRow[];
    },
    enabled: canView,
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["ai_knowledge"] });

  const openCreate = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (r: KnowledgeRow) => {
    setForm({
      id: r.id, code: r.code ?? "", title: r.title, category: r.category ?? "",
      tags: (r.tags ?? []).join(", "), content: r.content ?? "",
      source_type: r.source_type ?? "manual", status: r.status ?? "active",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("請輸入標題"); return; }
    const payload = {
      code: form.code.trim() || null,
      title: form.title.trim(),
      category: form.category.trim() || null,
      tags: form.tags.trim() ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      content: form.content || null,
      source_type: form.source_type || "manual",
      status: form.status || "active",
    };
    const { error } = isNew
      ? await supabase.from("ai_knowledge").insert(payload)
      : await supabase.from("ai_knowledge").update(payload).eq("id", form.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增" : "已更新");
    setOpen(false); reload();
  };

  const del = async (r: KnowledgeRow) => {
    if (!confirm(`確定刪除知識「${r.title}」？`)) return;
    const { error } = await supabase.from("ai_knowledge").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  if (!canView) return <div className="p-6 text-muted-foreground">您沒有權限檢視此頁</div>;

  const filtered = rows.filter((r) =>
    !q || `${r.title} ${r.category ?? ""} ${(r.tags ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader title="知識庫" description="AI Agent 可學習的知識條目"
        actions={canCreate ? <Button onClick={openCreate}>新增知識</Button> : null} />

      <Input placeholder="搜尋標題 / 分類 / 標籤" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>標題</TableHead>
                <TableHead>分類</TableHead>
                <TableHead>標籤</TableHead>
                <TableHead>來源</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>更新</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">載入中…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">尚無知識條目</TableCell></TableRow>}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.category ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.tags ?? []).slice(0, 4).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.source_type ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(r)}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(r)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isNew ? "新增知識" : "編輯知識"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>代碼（選填）</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="KB-001" /></div>
            <div className="space-y-1"><Label>標題 *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><Label>分類</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="例：SOP、FAQ" /></div>
            <div className="space-y-1"><Label>標籤（逗號分隔）</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2" /></div>
            <div className="space-y-1">
              <Label>來源</Label>
              <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">manual</SelectItem>
                  <SelectItem value="import">import</SelectItem>
                  <SelectItem value="forum">forum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>狀態</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="draft">draft</SelectItem>
                  <SelectItem value="archived">archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2"><Label>內容</Label><Textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="知識內容（Agent 學習用）" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>{isNew ? "新增" : "儲存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
