import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
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

export const Route = createFileRoute("/dashboard/contracts")({ component: Page });

interface SummaryRow {
  id: string; contract_no: string | null; title: string | null;
  contract_type: string | null; status: string | null;
  client_id: string | null; client_name: string | null;
  project_id: string | null; project_code: string | null; project_title: string | null;
  system_id: string | null; system_code: string | null; system_name: string | null;
  billing_type: string | null;
  contract_amount: number | null; dev_fee: number | null; maintenance_fee: number | null;
  signed_date: string | null; start_date: string | null; end_date: string | null;
  term_months: number | null; auto_renew: boolean | null;
  maintenance_period: string | null;
  next_payment_date: string | null; payment_status: string | null; invoice_status: string | null;
  days_to_end: number | null; is_expiring: boolean | null;
}

interface ContractForm {
  id?: string;
  contract_type: string | null; contract_no: string | null; title: string | null;
  client_id: string | null; project_id: string | null; system_id: string | null;
  billing_type: string | null;
  contract_amount: string | number | null; dev_fee: string | number | null; maintenance_fee: string | number | null;
  signed_date: string | null; start_date: string | null; end_date: string | null;
  term_months: string | number | null; auto_renew: boolean;
  status: string | null; maintenance_period: string | null;
  included_hours: string | number | null; sla_hours: string | number | null;
  next_payment_date: string | null; payment_status: string | null; invoice_status: string | null;
  note: string | null;
}

const emptyForm: ContractForm = {
  contract_type: "dev", contract_no: "", title: "",
  client_id: null, project_id: null, system_id: null,
  billing_type: null,
  contract_amount: "", dev_fee: "", maintenance_fee: "",
  signed_date: "", start_date: "", end_date: "",
  term_months: "", auto_renew: false,
  status: "active", maintenance_period: null,
  included_hours: "", sla_hours: "",
  next_payment_date: "", payment_status: "未收", invoice_status: "未開",
  note: "",
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

const money = (n: number | null) => (n == null ? "—" : Number(n).toLocaleString("zh-TW"));
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canCreate = can("contracts", "create");
  const canEdit = can("contracts", "edit");
  const canDelete = can("contracts", "delete");

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: typeOpts = [] } = useLookups("contract_type");
  const { data: statusOpts = [] } = useLookups("contract_status");
  const { data: periodOpts = [] } = useLookups("maintenance_period");
  const { data: billingOpts = [] } = useLookups("billing_type");
  const { data: payOpts = [] } = useLookups("payment_status");
  const { data: invOpts = [] } = useLookups("invoice_status");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,code,name").order("code");
      return (data ?? []) as { id: string; code: string; name: string }[];
    },
  });
  const { data: cases = [] } = useQuery({
    queryKey: ["cases-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("id,code,title").order("code");
      return (data ?? []) as { id: string; code: string; title: string }[];
    },
  });
  const { data: systems = [] } = useQuery({
    queryKey: ["systems-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("systems").select("id,code,name").order("code");
      return (data ?? []) as { id: string; code: string; name: string }[];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["contract-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_contract_summary" as any)
        .select("*").order("signed_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as SummaryRow[];
    },
  });

  const filtered = useMemo(() => rows.filter((r) => {
    if (typeFilter !== "all" && r.contract_type !== typeFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  }), [rows, typeFilter, statusFilter]);

  const [form, setForm] = useState<ContractForm | null>(null);
  const isNew = form && !form.id;

  const openEdit = async (id: string) => {
    const { data, error } = await supabase.from("contracts").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error(error?.message ?? "找不到"); return; }
    setForm({
      id: data.id,
      contract_type: data.contract_type ?? "dev",
      contract_no: data.contract_no ?? "",
      title: data.title ?? "",
      client_id: data.client_id ?? null,
      project_id: data.project_id ?? null,
      system_id: data.system_id ?? null,
      billing_type: data.billing_type ?? null,
      contract_amount: data.contract_amount ?? "",
      dev_fee: data.dev_fee ?? "",
      maintenance_fee: data.maintenance_fee ?? "",
      signed_date: data.signed_date ?? "",
      start_date: data.start_date ?? "",
      end_date: data.end_date ?? "",
      term_months: data.term_months ?? "",
      auto_renew: !!data.auto_renew,
      status: data.status ?? "active",
      maintenance_period: data.maintenance_period ?? null,
      included_hours: (data as any).included_hours ?? "",
      sla_hours: (data as any).sla_hours ?? "",
      next_payment_date: data.next_payment_date ?? "",
      payment_status: data.payment_status ?? "未收",
      invoice_status: data.invoice_status ?? "未開",
      note: data.note ?? "",
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.contract_no || !form.title) { toast.error("請填寫合約編號與標題"); return; }
    const payload: any = {
      contract_type: form.contract_type,
      contract_no: form.contract_no,
      title: form.title,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      system_id: form.system_id || null,
      billing_type: form.billing_type || null,
      contract_amount: numOrNull(form.contract_amount),
      dev_fee: numOrNull(form.dev_fee),
      maintenance_fee: numOrNull(form.maintenance_fee),
      signed_date: form.signed_date || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      term_months: numOrNull(form.term_months),
      auto_renew: !!form.auto_renew,
      status: form.status || null,
      maintenance_period: form.contract_type === "maintenance" ? (form.maintenance_period || null) : null,
      included_hours: numOrNull(form.included_hours),
      sla_hours: numOrNull(form.sla_hours),
      next_payment_date: form.next_payment_date || null,
      payment_status: form.payment_status || null,
      invoice_status: form.invoice_status || null,
      note: form.note || null,
    };
    const { error } = form.id
      ? await supabase.from("contracts").update(payload).eq("id", form.id)
      : await supabase.from("contracts").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "已更新" : "已新增");
    setForm(null);
    qc.invalidateQueries({ queryKey: ["contract-summary"] });
  };

  const del = async (r: SummaryRow) => {
    if (!confirm(`確定刪除合約「${r.contract_no}」？`)) return;
    const { error } = await supabase.from("contracts").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除");
    qc.invalidateQueries({ queryKey: ["contract-summary"] });
  };

  const genMaintPayments = async (contractId: string) => {
    if (!confirm("確定為此維護合約產生週期收款？")) return;
    const { data, error } = await supabase.rpc("gen_maintenance_payments" as any, { p_contract: contractId } as any);
    if (error) { toast.error(error.message); return; }
    const n = typeof data === "number" ? data : Number(data ?? 0);
    toast.success(`已新增 ${n} 筆收款`);
    qc.invalidateQueries({ queryKey: ["payments"] });
  };

  const typeLabel = (c: string | null) => typeOpts.find((o) => o.code === c)?.label ?? c ?? "—";
  const statusLabel = (c: string | null) => statusOpts.find((o) => o.code === c)?.label ?? c ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="合約管理" description="開發與維護合約的生命週期" actions={
        canCreate && (
          <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm({ ...emptyForm })}>新增合約</Button>
            </DialogTrigger>
            <ContractDialog form={form} setForm={setForm} save={save} isNew={!!isNew}
              typeOpts={typeOpts} statusOpts={statusOpts} periodOpts={periodOpts}
              billingOpts={billingOpts} payOpts={payOpts} invOpts={invOpts}
              clients={clients} cases={cases} systems={systems} canEdit={canEdit} canDelete={canDelete} />
          </Dialog>
        )
      } />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>合約類型</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {typeOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
          <div className="text-sm text-muted-foreground ml-auto">
            共 {filtered.length} 筆
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>合約編號</TableHead><TableHead>標題</TableHead>
                <TableHead>類型</TableHead><TableHead>客戶</TableHead>
                <TableHead>專案</TableHead><TableHead>狀態</TableHead>
                <TableHead>簽約日</TableHead><TableHead>起訖</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead className="text-right">剩餘天數</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className={cn(r.is_expiring && "bg-amber-50 dark:bg-amber-950/30")}>
                  <TableCell className="font-medium">{r.contract_no ?? "—"}</TableCell>
                  <TableCell>{r.title ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{typeLabel(r.contract_type)}</Badge>
                  </TableCell>
                  <TableCell>{r.client_name ?? "—"}</TableCell>
                  <TableCell>{r.project_code ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{statusLabel(r.status)}</Badge></TableCell>
                  <TableCell>{r.signed_date ?? "—"}</TableCell>
                  <TableCell className="text-xs">{(r.start_date ?? "—") + " ~ " + (r.end_date ?? "—")}</TableCell>
                  <TableCell className="text-right">{money(r.contract_amount)}</TableCell>
                  <TableCell className="text-right">{r.days_to_end == null ? "—" : `${r.days_to_end} 天`}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {canEdit && r.contract_type === "maintenance" && (
                      <Button size="sm" variant="outline" onClick={() => genMaintPayments(r.id)}>產生週期收款</Button>
                    )}
                    {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(r.id)}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">尚無合約</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <ContractDialog form={form} setForm={setForm} save={save} isNew={false}
          typeOpts={typeOpts} statusOpts={statusOpts} periodOpts={periodOpts}
          billingOpts={billingOpts} payOpts={payOpts} invOpts={invOpts}
          clients={clients} cases={cases} systems={systems} canEdit={canEdit} canDelete={canDelete} />
      </Dialog>

      <div className="text-xs text-muted-foreground">
        <Link to="/dashboard/cases" className="underline">前往專案列表</Link>
      </div>
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}

type Opt = { code: string; label: string };

function ContractDialog({
  form, setForm, save, isNew,
  typeOpts, statusOpts, periodOpts, billingOpts, payOpts, invOpts,
  clients, cases, systems, canEdit, canDelete,
}: {
  form: ContractForm | null;
  setForm: (f: ContractForm | null) => void;
  save: () => void; isNew: boolean;
  typeOpts: Opt[]; statusOpts: Opt[]; periodOpts: Opt[]; billingOpts: Opt[]; payOpts: Opt[]; invOpts: Opt[];
  clients: { id: string; code: string; name: string }[];
  cases: { id: string; code: string; title: string }[];
  systems: { id: string; code: string; name: string }[];
  canEdit: boolean; canDelete: boolean;
}) {
  if (!form) return null;
  const set = <K extends keyof ContractForm>(k: K, v: ContractForm[K]) => setForm({ ...form, [k]: v });
  const isMaint = form.contract_type === "maintenance";
  return (
    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增合約" : "編輯合約"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="合約類型">
          <Select value={form.contract_type ?? ""} onValueChange={(v) => set("contract_type", v)}>
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
        <F label="合約編號"><Input value={form.contract_no ?? ""} onChange={(e) => set("contract_no", e.target.value)} /></F>
        <F label="標題"><Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} /></F>
        <F label="客戶">
          <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="專案">
          <Select value={form.project_id ?? ""} onValueChange={(v) => set("project_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇專案" /></SelectTrigger>
            <SelectContent>{cases.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.title}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="系統(可空)">
          <Select value={form.system_id ?? ""} onValueChange={(v) => set("system_id", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇系統" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} · {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="計費方式">
          <Select value={form.billing_type ?? ""} onValueChange={(v) => set("billing_type", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{billingOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="合約金額"><Input type="number" value={form.contract_amount ?? ""} onChange={(e) => set("contract_amount", e.target.value)} /></F>
        <F label="開發費"><Input type="number" value={form.dev_fee ?? ""} onChange={(e) => set("dev_fee", e.target.value)} /></F>
        <F label="維護費"><Input type="number" value={form.maintenance_fee ?? ""} onChange={(e) => set("maintenance_fee", e.target.value)} /></F>
        <F label="簽約日"><Input type="date" value={form.signed_date ?? ""} onChange={(e) => set("signed_date", e.target.value)} /></F>
        <F label="開始日"><Input type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></F>
        <F label="結束日"><Input type="date" value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} /></F>
        <F label="合約期(月)"><Input type="number" value={form.term_months ?? ""} onChange={(e) => set("term_months", e.target.value)} /></F>
        <F label="自動續約">
          <div className="flex items-center h-9 gap-2">
            <Checkbox checked={form.auto_renew} onCheckedChange={(v) => set("auto_renew", !!v)} />
            <span className="text-sm text-muted-foreground">到期自動續約</span>
          </div>
        </F>
        {isMaint && (
          <F label="維護週期">
            <Select value={form.maintenance_period ?? ""} onValueChange={(v) => set("maintenance_period", v)}>
              <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
              <SelectContent>{periodOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </F>
        )}
        <F label="包含工時"><Input type="number" value={form.included_hours ?? ""} onChange={(e) => set("included_hours", e.target.value)} /></F>
        <F label="SLA 時數"><Input type="number" value={form.sla_hours ?? ""} onChange={(e) => set("sla_hours", e.target.value)} /></F>
        <F label="下次收款日"><Input type="date" value={form.next_payment_date ?? ""} onChange={(e) => set("next_payment_date", e.target.value)} /></F>
        <F label="收款狀態">
          <Select value={form.payment_status ?? ""} onValueChange={(v) => set("payment_status", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{payOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="發票狀態">
          <Select value={form.invoice_status ?? ""} onValueChange={(v) => set("invoice_status", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{invOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="備註" full><Textarea rows={2} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      {form.id && <ContractAttachments contractId={form.id} canEdit={canEdit} canDelete={canDelete} />}
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}

interface AttachmentRow {
  id: string; bucket: string; path: string; filename: string | null;
  mime: string | null; size: number | null; created_at: string;
}

function ContractAttachments({ contractId, canEdit, canDelete }: { contractId: string; canEdit: boolean; canDelete: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const prefix = `contracts/${contractId}/`;
  const key = ["contract-attachments", contractId];

  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("attachments").select("*")
        .eq("entity_type", "contract").eq("entity_id", contractId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AttachmentRow[];
    },
  });

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-\u4e00-\u9fff]+/g, "_");
        const path = `${prefix}${Date.now()}_${safe}`;
        const up = await supabase.storage.from("attachments").upload(path, file, {
          cacheControl: "3600", upsert: false, contentType: file.type || undefined,
        });
        if (up.error) { toast.error(up.error.message); continue; }
        const ins = await supabase.from("attachments").insert({
          bucket: "attachments", path, filename: file.name,
          mime: file.type || null, size: file.size, uploaded_by: uid,
          entity_type: "contract", entity_id: contractId,
        } as any);
        if (ins.error) { toast.error(ins.error.message); continue; }
      }
      toast.success("已上傳");
      qc.invalidateQueries({ queryKey: key });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const download = async (r: AttachmentRow) => {
    const { data, error } = await supabase.storage.from(r.bucket).createSignedUrl(r.path, 60);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "下載失敗"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = r.filename ?? r.path.split("/").pop() ?? "file";
    a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const remove = async (r: AttachmentRow) => {
    if (!confirm(`確定刪除「${r.filename ?? r.path}」？`)) return;
    const rm = await supabase.storage.from(r.bucket).remove([r.path]);
    if (rm.error) { toast.error(rm.error.message); return; }
    const del = await supabase.from("attachments").delete().eq("id", r.id);
    if (del.error) { toast.error(del.error.message); return; }
    toast.success("已刪除");
    qc.invalidateQueries({ queryKey: key });
  };

  const fmtSize = (n: number | null) => {
    if (n == null) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">附件</Label>
        {canEdit && (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "上傳中…" : "上傳檔案"}
            </Button>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚無附件</p>
      ) : (
        <ul className="divide-y rounded border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.filename ?? r.path.split("/").pop()}</div>
                <div className="text-xs text-muted-foreground">{fmtSize(r.size)} · {r.mime ?? "—"}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => download(r)}>下載</Button>
                {canDelete && <Button size="sm" variant="outline" onClick={() => remove(r)}>刪除</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
