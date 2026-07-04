import { createFileRoute } from "@tanstack/react-router";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/service-tickets")({ component: Page });

interface SummaryRow {
  id: string; ticket_no: string | null; title: string | null;
  type: string | null; priority: string | null; status: string | null;
  system_id: string | null; system_code: string | null; system_name: string | null;
  client_id: string | null; client_name: string | null;
  contract_id: string | null; assignee_id: string | null;
  opened_at: string | null; responded_at: string | null; resolved_at: string | null;
  spent_hours: number | null; billable: boolean | null;
  sla_hours: number | null; sla_due: string | null; sla_breached: boolean | null;
}
interface TicketForm {
  id?: string;
  title: string; description: string;
  system_id: string | null; contract_id: string | null; client_id: string | null;
  type: string | null; priority: string | null; status: string | null;
  assignee_id: string | null;
  opened_at: string; responded_at: string; resolved_at: string;
  spent_hours: string | number;
  billable: boolean;
  note: string;
}
const nowLocal = () => {
  const d = new Date(); d.setSeconds(0, 0);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
const emptyForm: TicketForm = {
  title: "", description: "",
  system_id: null, contract_id: null, client_id: null,
  type: null, priority: null, status: "open",
  assignee_id: null,
  opened_at: nowLocal(), responded_at: "", resolved_at: "",
  spent_hours: "", billable: false, note: "",
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
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));
const dtOrNull = (v: string) => (v ? new Date(v).toISOString() : null);
const toLocalDT = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canCreate = can("maintenance", "create");
  const canEdit = can("maintenance", "edit");
  const canDelete = can("maintenance", "delete");

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: typeOpts = [] } = useLookups("ticket_type");
  const { data: priorityOpts = [] } = useLookups("task_priority");
  const { data: statusOpts = [] } = useLookups("ticket_status");

  const { data: systems = [] } = useQuery({
    queryKey: ["systems-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("systems").select("id,code,name").order("code");
      return (data ?? []) as { id: string; code: string; name: string }[];
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,code,name").order("code");
      return (data ?? []) as { id: string; code: string; name: string }[];
    },
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts-mini2"],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("id,title,contract_no").order("created_at", { ascending: false });
      return (data ?? []) as { id: string; title: string | null; contract_no: string | null }[];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email").order("full_name");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });
  const personLabel = (id: string | null) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "—";
  };

  const { data: rows = [] } = useQuery({
    queryKey: ["service-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_ticket_summary" as any)
        .select("*").order("opened_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as SummaryRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["service-tickets"] });

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    return true;
  }), [rows, statusFilter, typeFilter]);

  const [form, setForm] = useState<TicketForm | null>(null);
  const isNew = form && !form.id;

  const openEdit = async (id: string) => {
    const { data, error } = await supabase.from("service_tickets").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error(error?.message ?? "找不到"); return; }
    setForm({
      id: data.id,
      title: data.title ?? "", description: data.description ?? "",
      system_id: data.system_id, contract_id: data.contract_id, client_id: data.client_id,
      type: data.type, priority: data.priority, status: data.status ?? "open",
      assignee_id: data.assignee_id,
      opened_at: toLocalDT(data.opened_at),
      responded_at: toLocalDT(data.responded_at),
      resolved_at: toLocalDT(data.resolved_at),
      spent_hours: data.spent_hours ?? "",
      billable: !!data.billable,
      note: data.note ?? "",
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.title) { toast.error("請填寫標題"); return; }
    const payload: any = {
      title: form.title, description: form.description || null,
      system_id: form.system_id || null,
      contract_id: form.contract_id || null,
      client_id: form.client_id || null,
      type: form.type || null,
      priority: form.priority || null,
      status: form.status || null,
      assignee_id: form.assignee_id || null,
      opened_at: dtOrNull(form.opened_at),
      responded_at: dtOrNull(form.responded_at),
      resolved_at: dtOrNull(form.resolved_at),
      spent_hours: numOrNull(form.spent_hours),
      billable: !!form.billable,
      note: form.note || null,
    };
    const { error } = form.id
      ? await supabase.from("service_tickets").update(payload).eq("id", form.id)
      : await supabase.from("service_tickets").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "已更新" : "已新增");
    setForm(null); reload();
  };
  const del = async (r: SummaryRow) => {
    if (!confirm(`確定刪除工單「${r.ticket_no}」？`)) return;
    const { error } = await supabase.from("service_tickets").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  const typeLabel = (c: string | null) => typeOpts.find((o) => o.code === c)?.label ?? c ?? "—";
  const statusLabel = (c: string | null) => statusOpts.find((o) => o.code === c)?.label ?? c ?? "—";
  const priorityLabel = (c: string | null) => priorityOpts.find((o) => o.code === c)?.label ?? c ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="服務工單" description="維護服務 SLA 與工時追蹤" actions={
        canCreate && (
          <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
            <DialogTrigger asChild><Button onClick={() => setForm({ ...emptyForm })}>新增工單</Button></DialogTrigger>
            <TicketDialog form={form} setForm={setForm} save={save} isNew
              typeOpts={typeOpts} priorityOpts={priorityOpts} statusOpts={statusOpts}
              systems={systems} clients={clients} contracts={contracts} profiles={profiles} />
          </Dialog>
        )
      } />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>狀態</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>類型</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {typeOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground ml-auto">共 {filtered.length} 筆</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工單編號</TableHead><TableHead>標題</TableHead>
                <TableHead>系統</TableHead><TableHead>客戶</TableHead>
                <TableHead>類型</TableHead><TableHead>優先</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>開單時間</TableHead><TableHead>SLA</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className={cn(r.sla_breached && "bg-red-50 dark:bg-red-950/30")}>
                  <TableCell className="font-medium">{r.ticket_no ?? "—"}</TableCell>
                  <TableCell>{r.title ?? "—"}</TableCell>
                  <TableCell>{r.system_name ?? "—"}</TableCell>
                  <TableCell>{r.client_name ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabel(r.type)}</Badge></TableCell>
                  <TableCell>{priorityLabel(r.priority)}</TableCell>
                  <TableCell><Badge variant="outline">{statusLabel(r.status)}</Badge></TableCell>
                  <TableCell className="text-xs">{r.opened_at ? new Date(r.opened_at).toLocaleString("zh-TW") : "—"}</TableCell>
                  <TableCell className={cn("text-xs", r.sla_breached && "text-red-600 dark:text-red-400 font-medium")}>
                    {r.sla_due ? new Date(r.sla_due).toLocaleString("zh-TW") : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(r.id)}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">尚無工單</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <TicketDialog form={form} setForm={setForm} save={save} isNew={false}
          typeOpts={typeOpts} priorityOpts={priorityOpts} statusOpts={statusOpts}
          systems={systems} clients={clients} contracts={contracts} profiles={profiles} />
      </Dialog>
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}

type Opt = { code: string; label: string };

function TicketDialog({
  form, setForm, save, isNew,
  typeOpts, priorityOpts, statusOpts,
  systems, clients, contracts, profiles,
}: {
  form: TicketForm | null;
  setForm: (f: TicketForm | null) => void;
  save: () => void; isNew: boolean;
  typeOpts: Opt[]; priorityOpts: Opt[]; statusOpts: Opt[];
  systems: { id: string; code: string; name: string }[];
  clients: { id: string; code: string; name: string }[];
  contracts: { id: string; title: string | null; contract_no: string | null }[];
  profiles: { id: string; full_name: string | null; email: string | null }[];
}) {
  if (!form) return null;
  const set = <K extends keyof TicketForm>(k: K, v: TicketForm[K]) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增工單" : "編輯工單"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="標題" full><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></F>
        <F label="說明" full><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></F>
        <F label="系統">
          <Select value={form.system_id ?? ""} onValueChange={(v) => set("system_id", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇系統" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} · {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="合約(可空)">
          <Select value={form.contract_id ?? ""} onValueChange={(v) => set("contract_id", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇合約" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.contract_no ?? "—"} · {c.title ?? ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="客戶">
          <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}
            </SelectContent>
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
        <F label="類型">
          <Select value={form.type ?? ""} onValueChange={(v) => set("type", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{typeOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="優先">
          <Select value={form.priority ?? ""} onValueChange={(v) => set("priority", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{priorityOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="狀態">
          <Select value={form.status ?? ""} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="工時"><Input type="number" value={form.spent_hours} onChange={(e) => set("spent_hours", e.target.value)} /></F>
        <F label="開單時間"><Input type="datetime-local" value={form.opened_at} onChange={(e) => set("opened_at", e.target.value)} /></F>
        <F label="回應時間"><Input type="datetime-local" value={form.responded_at} onChange={(e) => set("responded_at", e.target.value)} /></F>
        <F label="解決時間"><Input type="datetime-local" value={form.resolved_at} onChange={(e) => set("resolved_at", e.target.value)} /></F>
        <F label="是否可計費">
          <div className="flex items-center h-9 gap-2">
            <Checkbox checked={form.billable} onCheckedChange={(v) => set("billable", !!v)} />
            <span className="text-sm text-muted-foreground">此工單可另計費</span>
          </div>
        </F>
        <F label="備註" full><Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
