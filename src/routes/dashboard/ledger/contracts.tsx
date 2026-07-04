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
import { useRef } from "react";

export const Route = createFileRoute("/dashboard/ledger/contracts")({ component: Page });

interface ContractRow {
  id: string; system_id: string | null; contract_url: string | null; billing_type: string | null;
  contract_amount: number | null; dev_fee: number | null; maintenance_fee: number | null;
  next_payment_date: string | null; payment_status: string; invoice_status: string; note: string | null;
}
const empty: Partial<ContractRow> = { payment_status: "未收", invoice_status: "未開" };

function useLookups(category: string) {
  return useQuery({
    queryKey: ["lookups", category],
    queryFn: async () => {
      const { data } = await supabase.from("lookups").select("code,label").eq("category", category).eq("is_active", true).order("sort_order");
      return (data ?? []) as { code: string; label: string }[];
    },
  });
}
const money = (n: number | null) => (n == null ? "—" : n.toLocaleString("zh-TW"));
function payTint(date: string | null, status: string) {
  if (!date || status === "已收") return "";
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (days < 0) return "bg-red-50 dark:bg-red-950/30";
  if (days <= 30) return "bg-amber-50 dark:bg-amber-950/30";
  return "";
}

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canCreate = can("ledger", "create"), canEdit = can("ledger", "edit"), canDelete = can("ledger", "delete"), canExport = can("ledger", "export");
  const [payFilter, setPayFilter] = useState("all");
  const { data: billingOpts = [] } = useLookups("billing_type");
  const { data: payOpts = [] } = useLookups("payment_status");
  const { data: invOpts = [] } = useLookups("invoice_status");

  const { data: systems = [] } = useQuery({
    queryKey: ["systems-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("systems").select("id,code,name").order("code");
      return (data ?? []) as { id: string; code: string; name: string }[];
    },
  });
  const sysLabel = (id: string | null) => {
    const s = systems.find((x) => x.id === id);
    return s ? `${s.code} · ${s.name}` : "—";
  };

  const { data: rows = [] } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("next_payment_date", { nullsFirst: false });
      if (error) throw error;
      return data as ContractRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["contracts"] });

  const [form, setForm] = useState<Partial<ContractRow> | null>(null);
  const isNew = form && !form.id;
  const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const save = async () => {
    if (!form?.system_id) { toast.error("請選擇對應系統"); return; }
    const payload = {
      system_id: form.system_id, contract_url: form.contract_url || null,
      billing_type: form.billing_type || null, contract_amount: numOrNull(form.contract_amount),
      dev_fee: numOrNull(form.dev_fee), maintenance_fee: numOrNull(form.maintenance_fee),
      next_payment_date: form.next_payment_date || null,
      payment_status: form.payment_status || "未收", invoice_status: form.invoice_status || "未開",
      note: form.note || null,
    };
    const { error } = isNew
      ? await supabase.from("contracts").insert(payload)
      : await supabase.from("contracts").update(payload).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增合約" : "已更新"); setForm(null); reload();
  };
  const del = async (r: ContractRow) => {
    if (!confirm("確定刪除此合約？")) return;
    const { error } = await supabase.from("contracts").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  const filtered = payFilter === "all" ? rows : rows.filter((r) => r.payment_status === payFilter);

  return (
    <div className="space-y-6">
      <PageHeader title="合約與費用" description="各系統的合約、金額與收款/發票狀態" actions={
        <>
          {canExport && (
            <Button variant="outline" onClick={() => downloadCsv(
              `contracts_${todayStamp()}.csv`,
              ["系統", "收費模式", "合約金額", "開發費", "維護費", "下次收款日", "收款狀態", "發票狀態", "合約檔連結", "備註"],
              filtered.map((r) => [sysLabel(r.system_id), r.billing_type, r.contract_amount, r.dev_fee, r.maintenance_fee, r.next_payment_date, r.payment_status, r.invoice_status, r.contract_url, r.note]),
            )}>匯出 CSV</Button>
          )}
          {canCreate && (
            <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
              <DialogTrigger asChild><Button onClick={() => setForm({ ...empty })}>新增合約</Button></DialogTrigger>
              <ContractForm form={form} setForm={setForm} save={save} isNew systems={systems}
                billingOpts={billingOpts} payOpts={payOpts} invOpts={invOpts} sysLabel={sysLabel} />
            </Dialog>
          )}
        </>
      } />

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">收款狀態</Label>
        <Select value={payFilter} onValueChange={setPayFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {payOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>系統</TableHead><TableHead>收費模式</TableHead><TableHead className="text-right">合約金額</TableHead>
                <TableHead>下次收款日</TableHead><TableHead>收款</TableHead><TableHead>發票</TableHead>
                <TableHead>合約檔</TableHead><TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className={payTint(r.next_payment_date, r.payment_status)}>
                  <TableCell className="font-medium">{sysLabel(r.system_id)}</TableCell>
                  <TableCell>{r.billing_type ?? "—"}</TableCell>
                  <TableCell className="text-right">{money(r.contract_amount)}</TableCell>
                  <TableCell>{r.next_payment_date ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.payment_status}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{r.invoice_status}</Badge></TableCell>
                  <TableCell>{r.contract_url ? <a href={r.contract_url} target="_blank" rel="noreferrer" className="text-primary underline">開啟</a> : "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {canEdit && <Button size="sm" variant="outline" onClick={() => setForm({ ...r })}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">尚無合約</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <ContractForm form={form} setForm={setForm} save={save} isNew={false} systems={systems}
          billingOpts={billingOpts} payOpts={payOpts} invOpts={invOpts} sysLabel={sysLabel} />
      </Dialog>
    </div>
  );
}

function ContractForm({ form, setForm, save, isNew, systems, billingOpts, payOpts, invOpts }: {
  form: Partial<ContractRow> | null; setForm: (f: Partial<ContractRow> | null) => void; save: () => void; isNew: boolean;
  systems: { id: string; code: string; name: string }[];
  billingOpts: { code: string; label: string }[]; payOpts: { code: string; label: string }[];
  invOpts: { code: string; label: string }[]; sysLabel: (id: string | null) => string;
}) {
  if (!form) return null;
  const set = (k: keyof ContractRow, v: string) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增合約" : "編輯合約"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="對應系統" full>
          <Select value={form.system_id ?? ""} onValueChange={(v) => set("system_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇系統" /></SelectTrigger>
            <SelectContent>{systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} · {s.name}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="收費模式">
          <Select value={form.billing_type ?? ""} onValueChange={(v) => set("billing_type", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{billingOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="下次收款日"><Input type="date" value={form.next_payment_date ?? ""} onChange={(e) => set("next_payment_date", e.target.value)} /></F>
        <F label="合約金額"><Input type="number" value={form.contract_amount ?? ""} onChange={(e) => set("contract_amount", e.target.value)} /></F>
        <F label="開發費"><Input type="number" value={form.dev_fee ?? ""} onChange={(e) => set("dev_fee", e.target.value)} /></F>
        <F label="維護費"><Input type="number" value={form.maintenance_fee ?? ""} onChange={(e) => set("maintenance_fee", e.target.value)} /></F>
        <F label="收款狀態">
          <Select value={form.payment_status ?? "未收"} onValueChange={(v) => set("payment_status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{payOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="發票狀態">
          <Select value={form.invoice_status ?? "未開"} onValueChange={(v) => set("invoice_status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{invOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="合約檔連結" full><Input value={form.contract_url ?? ""} onChange={(e) => set("contract_url", e.target.value)} placeholder="雲端硬碟連結" /></F>
        <F label="備註" full><Input value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      {form.id && <Installments contractId={form.id} />}
      {form.id && <Attachments contractId={form.id} />}
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}

interface AttachmentRow {
  id: string; bucket: string; path: string; filename: string | null;
  mime: string | null; size: number | null; created_at: string;
}

function Attachments({ contractId }: { contractId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const prefix = `contracts/${contractId}/`;
  const key = ["attachments", contractId];

  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("attachments").select("*")
        .eq("bucket", "attachments").like("path", `${prefix}%`).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttachmentRow[];
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
        });
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
    const { data, error } = await supabase.storage.from(r.bucket).download(r.path);
    if (error || !data) { toast.error(error?.message ?? "下載失敗"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = r.filename ?? r.path.split("/").pop() ?? "file";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
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
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "上傳中…" : "上傳檔案"}
          </Button>
        </div>
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
                <Button size="sm" variant="outline" onClick={() => remove(r)}>刪除</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// ---------- Installments ----------
interface PaymentRow {
  id: string; contract_id: string; title: string | null;
  amount: number | null; due_date: string | null; paid_date: string | null;
  status: string | null; invoice_no: string | null; invoice_status: string | null; note: string | null;
}
const todayStr = () => new Date().toISOString().slice(0, 10);

function Installments({ contractId }: { contractId: string }) {
  const { can } = useAuth();
  const canCreate = can("finance", "create"), canEdit = can("finance", "edit"), canDelete = can("finance", "delete");
  const qc = useQueryClient();
  const key = ["contract-installments", contractId];
  const { data: statusOpts = [] } = useLookups("payment_status");
  const { data: invOpts2 = [] } = useLookups("invoice_status");

  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*")
        .eq("contract_id", contractId).order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: key });

  const [form, setForm] = useState<Partial<PaymentRow> | null>(null);
  const isNew = form && !form.id;
  const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const save = async () => {
    const payload = {
      contract_id: contractId, title: form?.title || null,
      amount: numOrNull(form?.amount), due_date: form?.due_date || null,
      paid_date: form?.paid_date || null, status: form?.status || "未收",
      invoice_no: form?.invoice_no || null, invoice_status: form?.invoice_status || null,
      note: form?.note || null,
    };
    const { error } = isNew
      ? await supabase.from("payments").insert(payload as any)
      : await supabase.from("payments").update(payload as any).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增" : "已更新"); setForm(null); reload();
  };
  const del = async (p: PaymentRow) => {
    if (!confirm(`刪除「${p.title ?? "此期"}」？`)) return;
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };
  const markPaid = async (p: PaymentRow) => {
    const { error } = await supabase.from("payments").update({ status: "已收", paid_date: todayStr() }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    reload();
  };
  const isOverdueP = (p: PaymentRow) => p.status !== "已收" && p.due_date && p.due_date < todayStr();

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">分期收款 <span className="ml-2 text-xs text-muted-foreground">{rows.length}</span></Label>
        {canCreate && (
          <Button size="sm" variant="outline" onClick={() => setForm({ status: "未收" })}>新增分期</Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚無分期</p>
      ) : (
        <div className="rounded border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>期別</TableHead><TableHead className="text-right">金額</TableHead>
                <TableHead>到期</TableHead><TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} className={cn(isOverdueP(p) && "bg-red-50 dark:bg-red-950/30")}>
                  <TableCell>{p.title ?? "—"}</TableCell>
                  <TableCell className="text-right">{money(p.amount)}</TableCell>
                  <TableCell>{p.due_date ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{p.status ?? "—"}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    {canEdit && p.status !== "已收" && <Button size="sm" onClick={() => markPaid(p)}>已收</Button>}
                    {canEdit && <Button size="sm" variant="outline" onClick={() => setForm({ ...p })}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="outline" onClick={() => del(p)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isNew ? "新增分期" : "編輯分期"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="期別" full><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="第一期 / 首款" /></F>
              <F label="金額"><Input type="number" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value as any })} /></F>
              <F label="到期日"><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></F>
              <F label="收款日"><Input type="date" value={form.paid_date ?? ""} onChange={(e) => setForm({ ...form, paid_date: e.target.value })} /></F>
              <F label="狀態">
                <Select value={form.status ?? "未收"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="發票號"><Input value={form.invoice_no ?? ""} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} /></F>
              <F label="發票狀態">
                <Select value={form.invoice_status ?? ""} onValueChange={(v) => setForm({ ...form, invoice_status: v })}>
                  <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                  <SelectContent>{invOpts2.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="備註" full><Input value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} /></F>
            </div>
          )}
          <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

