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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/invoices")({ component: Page });

interface InvoiceRow {
  id: string;
  invoice_no: string | null; invoice_date: string | null; type: string | null;
  payment_id: string | null; contract_id: string | null;
  buyer_name: string | null; buyer_tax_id: string | null;
  amount_untaxed: number | null; tax: number | null; amount_total: number | null;
  status: string | null; note: string | null;
  payments: { title: string | null; amount: number | null } | null;
  contracts: { title: string | null; contract_no: string | null } | null;
}
interface InvoiceForm {
  id?: string;
  invoice_no: string; invoice_date: string;
  type: string | null;
  payment_id: string | null; contract_id: string | null;
  buyer_name: string; buyer_tax_id: string;
  amount_untaxed: string | number; tax: string | number; amount_total: string | number;
  status: string | null; note: string;
}
const emptyForm: InvoiceForm = {
  invoice_no: "", invoice_date: new Date().toISOString().slice(0, 10),
  type: null, payment_id: null, contract_id: null,
  buyer_name: "", buyer_tax_id: "",
  amount_untaxed: "", tax: "", amount_total: "",
  status: null, note: "",
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
const money = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("zh-TW"));
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canCreate = can("finance", "create"), canEdit = can("finance", "edit"), canDelete = can("finance", "delete");

  const { data: typeOpts = [] } = useLookups("invoice_type");
  const { data: statusOpts = [] } = useLookups("invoice_doc_status");

  const { data: payments = [] } = useQuery({
    queryKey: ["payments-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("id,title,amount,contract_id").order("due_date", { nullsFirst: false });
      return (data ?? []) as { id: string; title: string | null; amount: number | null; contract_id: string | null }[];
    },
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts-mini2"],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("id,title,contract_no").order("created_at", { ascending: false });
      return (data ?? []) as { id: string; title: string | null; contract_no: string | null }[];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("*, payments(title,amount), contracts(title,contract_no)")
        .order("invoice_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["invoices"] });

  const [form, setForm] = useState<InvoiceForm | null>(null);
  const isNew = form && !form.id;

  const openEdit = (r: InvoiceRow) => setForm({
    id: r.id,
    invoice_no: r.invoice_no ?? "",
    invoice_date: r.invoice_date ?? "",
    type: r.type, payment_id: r.payment_id, contract_id: r.contract_id,
    buyer_name: r.buyer_name ?? "", buyer_tax_id: r.buyer_tax_id ?? "",
    amount_untaxed: r.amount_untaxed ?? "", tax: r.tax ?? "", amount_total: r.amount_total ?? "",
    status: r.status, note: r.note ?? "",
  });

  const save = async () => {
    if (!form) return;
    if (!form.invoice_no) { toast.error("請填寫發票號"); return; }
    const payload: any = {
      invoice_no: form.invoice_no,
      invoice_date: form.invoice_date || null,
      type: form.type || null,
      payment_id: form.payment_id || null,
      contract_id: form.contract_id || null,
      buyer_name: form.buyer_name || null,
      buyer_tax_id: form.buyer_tax_id || null,
      amount_untaxed: numOrNull(form.amount_untaxed),
      tax: numOrNull(form.tax),
      amount_total: numOrNull(form.amount_total),
      status: form.status || null,
      note: form.note || null,
    };
    const { error } = form.id
      ? await supabase.from("invoices").update(payload).eq("id", form.id)
      : await supabase.from("invoices").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "已更新" : "已新增");
    setForm(null); reload();
  };
  const del = async (r: InvoiceRow) => {
    if (!confirm(`確定刪除發票「${r.invoice_no}」？`)) return;
    const { error } = await supabase.from("invoices").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  const typeLabel = (c: string | null) => typeOpts.find((o) => o.code === c)?.label ?? c ?? "—";
  const statusLabel = (c: string | null) => statusOpts.find((o) => o.code === c)?.label ?? c ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="發票管理" description="開立、作廢與買方資訊" actions={
        canCreate && (
          <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
            <DialogTrigger asChild><Button onClick={() => setForm({ ...emptyForm })}>新增發票</Button></DialogTrigger>
            <InvoiceDialog form={form} setForm={setForm} save={save} isNew
              typeOpts={typeOpts} statusOpts={statusOpts} payments={payments} contracts={contracts} />
          </Dialog>
        )
      } />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>發票號</TableHead><TableHead>開立日</TableHead>
                <TableHead>類型</TableHead><TableHead>買方</TableHead>
                <TableHead>統編</TableHead>
                <TableHead className="text-right">總額</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={cn(r.status === "作廢" && "opacity-60")}>
                  <TableCell className="font-medium">{r.invoice_no ?? "—"}</TableCell>
                  <TableCell>{r.invoice_date ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabel(r.type)}</Badge></TableCell>
                  <TableCell>{r.buyer_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.buyer_tax_id ?? "—"}</TableCell>
                  <TableCell className="text-right">{money(r.amount_total)}</TableCell>
                  <TableCell><Badge variant="outline">{statusLabel(r.status)}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(r)}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">尚無發票</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <InvoiceDialog form={form} setForm={setForm} save={save} isNew={false}
          typeOpts={typeOpts} statusOpts={statusOpts} payments={payments} contracts={contracts} />
      </Dialog>
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}

type Opt = { code: string; label: string };

function InvoiceDialog({
  form, setForm, save, isNew, typeOpts, statusOpts, payments, contracts,
}: {
  form: InvoiceForm | null;
  setForm: (f: InvoiceForm | null) => void;
  save: () => void; isNew: boolean;
  typeOpts: Opt[]; statusOpts: Opt[];
  payments: { id: string; title: string | null; amount: number | null; contract_id: string | null }[];
  contracts: { id: string; title: string | null; contract_no: string | null }[];
}) {
  if (!form) return null;
  const set = <K extends keyof InvoiceForm>(k: K, v: InvoiceForm[K]) => setForm({ ...form, [k]: v });
  const onUntaxedChange = (v: string) => {
    const n = v === "" ? null : Number(v);
    if (n == null || isNaN(n)) { setForm({ ...form, amount_untaxed: v, tax: "", amount_total: "" }); return; }
    const tax = Math.round(n * 0.05);
    setForm({ ...form, amount_untaxed: v, tax, amount_total: n + tax });
  };
  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增發票" : "編輯發票"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="發票號"><Input value={form.invoice_no} onChange={(e) => set("invoice_no", e.target.value)} /></F>
        <F label="開立日"><Input type="date" value={form.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} /></F>
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
        <F label="對應款項" full>
          <Select value={form.payment_id ?? ""} onValueChange={(v) => {
            const p = payments.find((x) => x.id === v);
            setForm({ ...form, payment_id: v === "__none__" ? null : v, contract_id: p?.contract_id ?? form.contract_id });
          }}>
            <SelectTrigger><SelectValue placeholder="選擇款項" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {payments.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title ?? "(無標題)"}{p.amount != null ? ` · ${Number(p.amount).toLocaleString("zh-TW")}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </F>
        <F label="合約(可空)" full>
          <Select value={form.contract_id ?? ""} onValueChange={(v) => set("contract_id", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇合約" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.contract_no ?? "—"} · {c.title ?? ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </F>
        <F label="買方名稱"><Input value={form.buyer_name} onChange={(e) => set("buyer_name", e.target.value)} /></F>
        <F label="買方統編"><Input value={form.buyer_tax_id} onChange={(e) => set("buyer_tax_id", e.target.value)} /></F>
        <F label="未稅金額"><Input type="number" value={form.amount_untaxed} onChange={(e) => onUntaxedChange(e.target.value)} /></F>
        <F label="稅額 (5%)"><Input type="number" value={form.tax} onChange={(e) => set("tax", e.target.value)} /></F>
        <F label="含稅總額"><Input type="number" value={form.amount_total} onChange={(e) => set("amount_total", e.target.value)} /></F>
        <F label="備註" full><Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
