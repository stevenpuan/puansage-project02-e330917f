import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent,
} from "@dnd-kit/core";

export const Route = createFileRoute("/dashboard/opportunities")({ component: Page });

interface Opp {
  id: string; code: string; title: string;
  client_id: string | null; source: string | null; status: string;
  est_amount: number | null; owner_id: string | null;
  next_action: string | null; next_action_date: string | null;
  note: string | null; converted_project_id: string | null;
  sort_order: number;
}
const empty: Partial<Opp> = { code: "", title: "", status: "" };

function useLookups(category: string) {
  return useQuery({
    queryKey: ["lookups", category],
    queryFn: async () => {
      const { data } = await supabase.from("lookups").select("code,label,sort_order")
        .eq("category", category).eq("is_active", true).order("sort_order");
      return (data ?? []) as { code: string; label: string; sort_order: number }[];
    },
  });
}

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canCreate = can("opportunities", "create");
  const canEdit = can("opportunities", "edit");
  const canDelete = can("opportunities", "delete");

  const [view, setView] = useState<"board" | "list">("board");
  const [form, setForm] = useState<Partial<Opp> | null>(null);
  const isNew = form && !form.id;

  const { data: statusOpts = [] } = useLookups("opp_status");
  const { data: sourceOpts = [] } = useLookups("opp_source");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,code,name").order("code");
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
  const ownerName = (id: string | null) => { const p = profiles.find((x) => x.id === id); return p?.full_name || p?.email || "—"; };

  const { data: rows = [] } = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("*")
        .order("sort_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Opp[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["opportunities"] });

  const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const save = async () => {
    if (!form?.code || !form?.title || !form?.status) { toast.error("請填寫代號、標題、狀態"); return; }
    const payload = {
      code: form.code, title: form.title, status: form.status,
      client_id: form.client_id || null, source: form.source || null,
      est_amount: numOrNull(form.est_amount), owner_id: form.owner_id || null,
      next_action: form.next_action || null, next_action_date: form.next_action_date || null,
      note: form.note || null,
    };
    const { error } = isNew
      ? await supabase.from("opportunities").insert(payload as any)
      : await supabase.from("opportunities").update(payload as any).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增" : "已更新"); setForm(null); reload();
  };
  const del = async (r: Opp) => {
    if (!confirm(`確定刪除「${r.title}」？`)) return;
    const { error } = await supabase.from("opportunities").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };
  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("opportunities").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    reload();
  };
  const convert = async (r: Opp) => {
    if (r.converted_project_id) { toast.info("此任務已轉為專案"); navigate({ to: "/dashboard/cases" }); return; }
    if (!confirm(`確定將「${r.title}」轉為專案？`)) return;
    const { error } = await supabase.rpc("convert_opportunity", { p_opp: r.id });
    if (error) { toast.error(error.message); return; }
    toast.success("已轉為專案"); reload();
    navigate({ to: "/dashboard/cases" });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const r = rows.find((x) => x.id === id);
    if (!r || r.status === overId) return;
    updateStatus(id, overId);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="商機看板" description="商機任務的看板追蹤與轉專案" actions={
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list")}>
            <TabsList>
              <TabsTrigger value="board">看板</TabsTrigger>
              <TabsTrigger value="list">列表</TabsTrigger>
            </TabsList>
          </Tabs>
          {canCreate && (
            <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
              <DialogTrigger asChild><Button onClick={() => setForm({ ...empty, status: statusOpts[0]?.code ?? "" })}>新增商機</Button></DialogTrigger>
              <OppForm form={form} setForm={setForm} save={save} isNew
                clients={clients} profiles={profiles} statusOpts={statusOpts} sourceOpts={sourceOpts} />
            </Dialog>
          )}
        </div>
      } />

      {view === "board" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {statusOpts.map((s) => {
              const list = rows.filter((r) => r.status === s.code);
              return (
                <Column key={s.code} status={s.code} label={s.label} count={list.length}>
                  {list.map((r) => (
                    <OppCard key={r.id} r={r}
                      clientName={clientName(r.client_id)}
                      ownerName={ownerName(r.owner_id)}
                      canEdit={canEdit} canDelete={canDelete}
                      onEdit={async () => {
                        const { data } = await supabase.from("opportunities").select("*").eq("id", r.id).maybeSingle();
                        if (data) setForm(data as unknown as Opp);
                      }}
                      onDelete={() => del(r)}
                      onConvert={() => convert(r)}
                    />
                  ))}
                  {list.length === 0 && <div className="text-xs text-muted-foreground py-6 text-center">—</div>}
                </Column>
              );
            })}
          </div>
        </DndContext>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>代號</TableHead><TableHead>標題</TableHead><TableHead>客戶</TableHead>
                  <TableHead>狀態</TableHead><TableHead>預估金額</TableHead><TableHead>負責人</TableHead>
                  <TableHead>下一步</TableHead><TableHead>日期</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>{clientName(r.client_id)}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <Badge variant="outline">{r.status}</Badge>}
                    </TableCell>
                    <TableCell>{r.est_amount ?? "—"}</TableCell>
                    <TableCell>{ownerName(r.owner_id)}</TableCell>
                    <TableCell>{r.next_action ?? "—"}</TableCell>
                    <TableCell>{r.next_action_date ?? "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {canEdit && <Button size="sm" variant="outline" onClick={async () => {
                        const { data } = await supabase.from("opportunities").select("*").eq("id", r.id).maybeSingle();
                        if (data) setForm(data as unknown as Opp);
                      }}>編輯</Button>}
                      <Button size="sm" variant="outline" onClick={() => convert(r)}>轉專案</Button>
                      {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">尚無商機</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <OppForm form={form} setForm={setForm} save={save} isNew={false}
          clients={clients} profiles={profiles} statusOpts={statusOpts} sourceOpts={sourceOpts} />
      </Dialog>
    </div>
  );
}

function Column({ status, label, count, children }: { status: string; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("w-72 shrink-0 rounded-lg border bg-muted/30 p-2", isOver && "ring-2 ring-primary")}>
      <div className="flex items-center justify-between px-2 py-1">
        <div className="font-medium text-sm">{label}</div>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <div className="space-y-2 mt-2 min-h-[80px]">{children}</div>
    </div>
  );
}

function OppCard({ r, clientName, ownerName, canEdit, canDelete, onEdit, onDelete, onConvert }: {
  r: Opp; clientName: string; ownerName: string;
  canEdit: boolean; canDelete: boolean;
  onEdit: () => void; onDelete: () => void; onConvert: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: r.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <Card ref={setNodeRef} style={style} {...attributes}
      className={cn("bg-background", isDragging && "opacity-50")}>
      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <div {...listeners} className="cursor-grab active:cursor-grabbing flex-1">
            <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
            <CardTitle className="text-sm">{r.title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1 space-y-1 text-xs">
        <div>客戶：{clientName}</div>
        <div>金額：{r.est_amount ?? "—"}</div>
        <div>負責：{ownerName}</div>
        {r.next_action && <div className="text-muted-foreground">下一步：{r.next_action}{r.next_action_date ? ` (${r.next_action_date})` : ""}</div>}
        <div className="flex flex-wrap gap-1 pt-2">
          {canEdit && <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onEdit}>編輯</Button>}
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onConvert}>轉專案</Button>
          {canDelete && <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onDelete}>刪除</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function OppForm({ form, setForm, save, isNew, clients, profiles, statusOpts, sourceOpts }: {
  form: Partial<Opp> | null; setForm: (f: Partial<Opp> | null) => void; save: () => void; isNew: boolean;
  clients: { id: string; code: string; name: string }[];
  profiles: { id: string; full_name: string | null; email: string | null }[];
  statusOpts: { code: string; label: string }[];
  sourceOpts: { code: string; label: string }[];
}) {
  if (!form) return null;
  const set = <K extends keyof Opp>(k: K, v: Opp[K] | string) => setForm({ ...form, [k]: v as Opp[K] });
  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增商機" : "編輯商機"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="代號"><Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} placeholder="OPP-001" /></F>
        <F label="標題"><Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} /></F>
        <F label="客戶">
          <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="來源">
          <Select value={form.source ?? ""} onValueChange={(v) => set("source", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{sourceOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="狀態">
          <Select value={form.status ?? ""} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="預估金額"><Input type="number" value={form.est_amount ?? ""} onChange={(e) => set("est_amount", e.target.value)} /></F>
        <F label="負責人">
          <Select value={form.owner_id ?? ""} onValueChange={(v) => set("owner_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="下一步"><Input value={form.next_action ?? ""} onChange={(e) => set("next_action", e.target.value)} /></F>
        <F label="下一步日期"><Input type="date" value={form.next_action_date ?? ""} onChange={(e) => set("next_action_date", e.target.value)} /></F>
        <F label="備註" full><Textarea rows={2} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}
