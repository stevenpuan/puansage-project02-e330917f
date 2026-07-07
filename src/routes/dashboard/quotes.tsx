import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard/quotes")({ component: Page });

interface QuoteRow {
  id: string; quote_no: string | null; title: string | null;
  status: string; quote_date: string | null; valid_until: string | null;
  subtotal: number | null; tax: number | null; total: number | null;
  client_id: string | null; client_name: string | null;
  opportunity_id: string | null; opp_code: string | null; opp_title: string | null;
  item_count: number | null; is_expired: boolean | null;
}
interface Item {
  id?: string; description: string; qty: number; unit_price: number; amount: number; sort_order: number;
}
interface QuoteForm {
  id?: string; quote_no: string; title: string;
  client_id: string | null; opportunity_id: string | null;
  quote_date: string | null; valid_until: string | null;
  status: string; note: string | null;
}
const emptyForm: QuoteForm = {
  quote_no: "", title: "", client_id: null, opportunity_id: null,
  quote_date: new Date().toISOString().slice(0, 10), valid_until: null,
  status: "draft", note: "",
};

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
  const canCreate = can("opportunities", "create");
  const canEdit = can("opportunities", "edit");
  const canDelete = can("opportunities", "delete");

  const [form, setForm] = useState<QuoteForm | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const isNew = form && !form.id;

  const { data: statusOpts = [] } = useLookups("quote_status");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,code,name").order("code");
      return (data ?? []) as { id: string; code: string; name: string }[];
    },
  });
  const { data: opps = [] } = useQuery({
    queryKey: ["opps-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("opportunities").select("id,code,title").order("code");
      return (data ?? []) as { id: string; code: string; title: string }[];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["v_quote_summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_quote_summary").select("*")
        .order("quote_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as QuoteRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["v_quote_summary"] });

  const filtered = rows.filter((r) => statusFilter === "all" || r.status === statusFilter);

  const subtotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  const openNew = () => {
    const seq = String(rows.length + 1).padStart(3, "0");
    setForm({ ...emptyForm, quote_no: `Q-${new Date().getFullYear()}-${seq}`, status: statusOpts[0]?.code ?? "draft" });
    setItems([]);
  };
  const openEdit = async (id: string) => {
    const { data: q } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
    if (!q) return;
    const { data: its } = await supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order");
    setForm({
      id: q.id, quote_no: q.quote_no ?? "", title: q.title ?? "",
      client_id: q.client_id, opportunity_id: q.opportunity_id,
      quote_date: q.quote_date, valid_until: q.valid_until,
      status: q.status, note: q.note ?? "",
    });
    setItems((its ?? []).map((i: any, idx: number) => ({
      id: i.id, description: i.description ?? "", qty: Number(i.qty) || 0,
      unit_price: Number(i.unit_price) || 0, amount: Number(i.amount) || 0,
      sort_order: i.sort_order ?? idx,
    })));
  };
  const close = () => { setForm(null); setItems([]); };

  const save = async () => {
    if (!form) return;
    if (!form.quote_no || !form.title) { toast.error("請填寫報價單號與標題"); return; }
    const payload = {
      quote_no: form.quote_no, title: form.title,
      client_id: form.client_id || null, opportunity_id: form.opportunity_id || null,
      quote_date: form.quote_date || null, valid_until: form.valid_until || null,
      status: form.status, note: form.note || null,
      subtotal, tax, total,
    };
    let quoteId = form.id;
    if (isNew) {
      const { data, error } = await supabase.from("quotes").insert(payload as any).select("id").maybeSingle();
      if (error) { toast.error(error.message); return; }
      quoteId = data?.id;
    } else {
      const { error } = await supabase.from("quotes").update(payload as any).eq("id", form.id!);
      if (error) { toast.error(error.message); return; }
    }
    if (!quoteId) { toast.error("儲存失敗"); return; }
    // 明細：全刪重寫，簡單一致
    await supabase.from("quote_items").delete().eq("quote_id", quoteId);
    if (items.length) {
      const payloads = items.map((i, idx) => ({
        quote_id: quoteId, description: i.description, qty: i.qty,
        unit_price: i.unit_price, sort_order: idx,
      }));
      const { error: e2 } = await supabase.from("quote_items").insert(payloads as any);
      if (e2) { toast.error(e2.message); return; }
    }
    toast.success(isNew ? "已新增" : "已更新");
    if (form.status === "accepted") toast.info("此報價已接受，可到「商機看板」轉為專案");
    close();
    reload();
  };

  const del = async (r: QuoteRow) => {
    if (!confirm(`確定刪除報價「${r.title ?? r.quote_no}」？`)) return;
    await supabase.from("quote_items").delete().eq("quote_id", r.id);
    const { error } = await supabase.from("quotes").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  const addItem = () => setItems((prev) => [...prev, { description: "", qty: 1, unit_price: 0, amount: 0, sort_order: prev.length }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, i) => {
    if (i !== idx) return it;
    const next = { ...it, ...patch };
    next.amount = Math.round((Number(next.qty) || 0) * (Number(next.unit_price) || 0) * 100) / 100;
    return next;
  }));

  const statusLabel = (s: string) => statusOpts.find((o) => o.code === s)?.label ?? s;
  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" => {
    if (s === "accepted") return "default";
    if (s === "rejected" || s === "expired") return "destructive";
    if (s === "sent") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="報價單" description="客戶報價單與明細管理" actions={
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              {statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {canCreate && (
            <Dialog open={!!isNew} onOpenChange={(o) => !o && close()}>
              <DialogTrigger asChild><Button onClick={openNew}>新增報價</Button></DialogTrigger>
              <QuoteDialog
                form={form} setForm={setForm} items={items} setItems={setItems}
                subtotal={subtotal} tax={tax} total={total}
                addItem={addItem} removeItem={removeItem} updateItem={updateItem}
                save={save} isNew clients={clients} opps={opps} statusOpts={statusOpts}
              />
            </Dialog>
          )}
        </div>
      } />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>報價單號</TableHead>
                <TableHead>標題</TableHead>
                <TableHead>客戶</TableHead>
                <TableHead>商機</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>有效期</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">總額</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.quote_no ?? "—"}</TableCell>
                  <TableCell className="font-medium">{r.title ?? "—"}</TableCell>
                  <TableCell>{r.client_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.opp_code ?? "—"}</TableCell>
                  <TableCell>{r.quote_date ?? "—"}</TableCell>
                  <TableCell className={cn(r.is_expired && "text-destructive font-medium")}>
                    {r.valid_until ?? "—"}
                    {r.is_expired && <Badge variant="destructive" className="ml-2">已過期</Badge>}
                  </TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge></TableCell>
                  <TableCell className="text-right">{r.total?.toLocaleString() ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(r.id)}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">尚無報價單</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && close()}>
        <QuoteDialog
          form={form} setForm={setForm} items={items} setItems={setItems}
          subtotal={subtotal} tax={tax} total={total}
          addItem={addItem} removeItem={removeItem} updateItem={updateItem}
          save={save} isNew={false} clients={clients} opps={opps} statusOpts={statusOpts}
        />
      </Dialog>
    </div>
  );
}

function QuoteDialog({
  form, setForm, items, subtotal, tax, total,
  addItem, removeItem, updateItem, save, isNew,
  clients, opps, statusOpts,
}: {
  form: QuoteForm | null; setForm: (f: QuoteForm | null) => void;
  items: Item[]; setItems: (i: Item[]) => void;
  subtotal: number; tax: number; total: number;
  addItem: () => void; removeItem: (idx: number) => void; updateItem: (idx: number, patch: Partial<Item>) => void;
  save: () => void; isNew: boolean;
  clients: { id: string; code: string; name: string }[];
  opps: { id: string; code: string; title: string }[];
  statusOpts: { code: string; label: string }[];
}) {
  const prevStatus = useStatusTracker(form?.status);
  useEffect(() => {
    if (!form) return;
    if (prevStatus && prevStatus !== form.status && form.status === "accepted") {
      toast.info("狀態改為「已接受」，可到「商機看板」轉為專案");
    }
  }, [form, prevStatus]);

  if (!form) return null;
  const set = <K extends keyof QuoteForm>(k: K, v: QuoteForm[K]) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增報價單" : "編輯報價單"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="報價單號"><Input value={form.quote_no} onChange={(e) => set("quote_no", e.target.value)} placeholder="Q-2026-001" /></F>
        <F label="標題"><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></F>
        <F label="客戶">
          <Select value={form.client_id ?? ""} onValueChange={(v) => set("client_id", v || null)}>
            <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="商機（可空）">
          <Select value={form.opportunity_id ?? "__none"} onValueChange={(v) => set("opportunity_id", v === "__none" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇商機" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">（無）</SelectItem>
              {opps.map((o) => <SelectItem key={o.id} value={o.id}>{o.code} · {o.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="報價日期"><Input type="date" value={form.quote_date ?? ""} onChange={(e) => set("quote_date", e.target.value || null)} /></F>
        <F label="有效期至"><Input type="date" value={form.valid_until ?? ""} onChange={(e) => set("valid_until", e.target.value || null)} /></F>
        <F label="狀態">
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="備註" full><Textarea rows={2} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Label>明細</Label>
          <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" />新增明細</Button>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>項目說明</TableHead>
                <TableHead className="w-24 text-right">數量</TableHead>
                <TableHead className="w-32 text-right">單價</TableHead>
                <TableHead className="w-32 text-right">金額</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell><Input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" className="text-right" value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) || 0 })} /></TableCell>
                  <TableCell><Input type="number" className="text-right" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) || 0 })} /></TableCell>
                  <TableCell className="text-right font-mono">{it.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">尚無明細</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">小計</span><span className="font-mono">{subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">稅額 (5%)</span><span className="font-mono">{tax.toLocaleString()}</span></div>
            <div className="flex justify-between border-t pt-1 font-medium"><span>總額</span><span className="font-mono">{total.toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}

function useStatusTracker(status: string | undefined) {
  const [prev, setPrev] = useState<string | undefined>(status);
  useEffect(() => {
    const t = setTimeout(() => setPrev(status), 0);
    return () => clearTimeout(t);
  }, [status]);
  return prev;
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}
