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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dashboard/payments")({ component: Page });

interface Payment {
  id: string; contract_id: string | null; title: string | null;
  amount: number | null; due_date: string | null; paid_date: string | null;
  status: string | null; method: string | null;
  invoice_no: string | null; invoice_status: string | null; note: string | null;
  contracts: { id: string; systems: { code: string; name: string; clients: { name: string } | null } | null } | null;
}

const money = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("zh-TW"));
const today = () => new Date().toISOString().slice(0, 10);
const isOverdue = (p: Payment) => p.status !== "已收" && p.due_date && p.due_date < today();

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
  const canCreate = can("finance", "create"), canEdit = can("finance", "edit"), canDelete = can("finance", "delete"), canExport = can("finance", "view");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: statusOpts = [] } = useLookups("payment_status");
  const { data: invOpts = [] } = useLookups("invoice_status");
  const { data: methodOpts = [] } = useLookups("pay_method");

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("contracts")
        .select("id, systems(code,name,clients(name))").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  const contractLabel = (id: string | null) => {
    const c = contracts.find((x: any) => x.id === id);
    if (!c) return "—";
    const s = c.systems;
    return `${s?.code ?? "?"} · ${s?.name ?? ""}${s?.clients?.name ? ` (${s.clients.name})` : ""}`;
  };

  const { data: rows = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments")
        .select("*, contracts(id, systems(code,name,clients(name)))")
        .order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Payment[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["payments"] });

  const filtered = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);

  const [form, setForm] = useState<Partial<Payment> | null>(null);
  const isNew = form && !form.id;
  const [collectFor, setCollectFor] = useState<Payment | null>(null);
  const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const save = async () => {
    if (!form?.contract_id) { toast.error("請選擇合約"); return; }
    const payload = {
      contract_id: form.contract_id, title: form.title || null,
      amount: numOrNull(form.amount), due_date: form.due_date || null,
      paid_date: form.paid_date || null,
      status: form.status || "未收", method: form.method || null,
      invoice_no: form.invoice_no || null, invoice_status: form.invoice_status || null,
      note: form.note || null,
    };
    const { error } = isNew
      ? await supabase.from("payments").insert(payload as any)
      : await supabase.from("payments").update(payload as any).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增" : "已更新"); setForm(null); reload();
  };
  const del = async (r: Payment) => {
    if (!confirm(`確定刪除「${r.title ?? "此收款"}」？`)) return;
    const { error } = await supabase.from("payments").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };
  const markPaid = async (r: Payment) => {
    const { error } = await supabase.from("payments").update({ status: "已收", paid_date: today() }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已標記已收"); reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="收款排程" description="所有合約的分期與到期收款" actions={
        <>
          {canExport && (
            <Button variant="outline" onClick={() => downloadCsv(
              `payments_${todayStamp()}.csv`,
              ["期別", "系統", "客戶", "金額", "到期日", "收款日", "狀態", "發票狀態"],
              filtered.map((r) => {
                const s = r.contracts?.systems;
                return [
                  r.title ?? "", s ? `${s.code} · ${s.name}` : "", s?.clients?.name ?? "",
                  r.amount ?? 0, r.due_date ?? "", r.paid_date ?? "", r.status ?? "", r.invoice_status ?? "",
                ];
              }),
            )}>匯出 CSV</Button>
          )}
          {canCreate && (
            <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
              <DialogTrigger asChild><Button onClick={() => setForm({ status: "未收" })}>新增收款</Button></DialogTrigger>
              <PaymentForm form={form} setForm={setForm} save={save} isNew contracts={contracts} contractLabel={contractLabel}
                statusOpts={statusOpts} invOpts={invOpts} methodOpts={methodOpts} />
            </Dialog>
          )}
        </>
      } />

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">狀態</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>系統 / 客戶</TableHead><TableHead>期別</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead>到期日</TableHead><TableHead>狀態</TableHead><TableHead>發票</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const sys = r.contracts?.systems;
                return (
                  <TableRow key={r.id} className={cn(isOverdue(r) && "bg-red-50 dark:bg-red-950/30")}>
                    <TableCell>
                      <div className="font-medium">{sys ? `${sys.code} · ${sys.name}` : "—"}</div>
                      <div className="text-xs text-muted-foreground">{sys?.clients?.name ?? "—"}</div>
                    </TableCell>
                    <TableCell>{r.title ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(r.amount)}</TableCell>
                    <TableCell>{r.due_date ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.status ?? "—"}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{r.invoice_status ?? "—"}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      {canEdit && r.status !== "已收" && <Button size="sm" onClick={() => markPaid(r)}>標記已收</Button>}
                      {canEdit && r.status !== "已收" && <Button size="sm" variant="outline" onClick={() => setCollectFor(r)}>催收</Button>}
                      {canEdit && <Button size="sm" variant="outline" onClick={() => setForm({ ...r })}>編輯</Button>}
                      {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">尚無收款</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <PaymentForm form={form} setForm={setForm} save={save} isNew={false} contracts={contracts} contractLabel={contractLabel}
          statusOpts={statusOpts} invOpts={invOpts} methodOpts={methodOpts} />
      </Dialog>

      <CollectionDialog payment={collectFor} onClose={() => setCollectFor(null)} />

    </div>
  );
}

function PaymentForm({ form, setForm, save, isNew, contracts, contractLabel, statusOpts, invOpts, methodOpts }: {
  form: Partial<Payment> | null; setForm: (f: Partial<Payment> | null) => void; save: () => void; isNew: boolean;
  contracts: any[]; contractLabel: (id: string | null) => string;
  statusOpts: { code: string; label: string }[]; invOpts: { code: string; label: string }[]; methodOpts: { code: string; label: string }[];
}) {
  if (!form) return null;
  const set = <K extends keyof Payment>(k: K, v: Payment[K] | string) => setForm({ ...form, [k]: v as Payment[K] });
  return (
    <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增收款" : "編輯收款"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="合約" full>
          <Select value={form.contract_id ?? ""} onValueChange={(v) => set("contract_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇合約" /></SelectTrigger>
            <SelectContent>{contracts.map((c) => <SelectItem key={c.id} value={c.id}>{contractLabel(c.id)}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="期別"><Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="第一期 / 首款" /></F>
        <F label="金額"><Input type="number" value={form.amount ?? ""} onChange={(e) => set("amount", e.target.value)} /></F>
        <F label="到期日"><Input type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} /></F>
        <F label="收款日"><Input type="date" value={form.paid_date ?? ""} onChange={(e) => set("paid_date", e.target.value)} /></F>
        <F label="狀態">
          <Select value={form.status ?? "未收"} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="收款方式">
          <Select value={form.method ?? ""} onValueChange={(v) => set("method", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{methodOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="發票號"><Input value={form.invoice_no ?? ""} onChange={(e) => set("invoice_no", e.target.value)} /></F>
        <F label="發票狀態">
          <Select value={form.invoice_status ?? ""} onValueChange={(v) => set("invoice_status", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{invOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="備註" full><Input value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}

interface CollectionLog {
  id: string; payment_id: string; action: string | null;
  note: string | null; next_follow_date: string | null; created_at: string;
}
function CollectionDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: actionOpts = [] } = useLookups("collection_action");
  const key = ["collection-logs", payment?.id];
  const { data: logs = [] } = useQuery({
    queryKey: key,
    enabled: !!payment,
    queryFn: async () => {
      const { data, error } = await supabase.from("collection_logs")
        .select("*").eq("payment_id", payment!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CollectionLog[];
    },
  });
  const [action, setAction] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [next, setNext] = useState<string>("");
  const add = async () => {
    if (!payment) return;
    if (!action) { toast.error("請選擇催收動作"); return; }
    const { error } = await supabase.from("collection_logs").insert({
      payment_id: payment.id, action, note: note || null, next_follow_date: next || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("已新增催收記錄"); setAction(""); setNote(""); setNext("");
    qc.invalidateQueries({ queryKey: key });
  };
  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>催收記錄 · {payment?.title ?? "—"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead><TableHead>動作</TableHead>
                  <TableHead>備註</TableHead><TableHead>下次追蹤</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("zh-TW")}</TableCell>
                    <TableCell><Badge variant="outline">{l.action ?? "—"}</Badge></TableCell>
                    <TableCell>{l.note ?? "—"}</TableCell>
                    <TableCell>{l.next_follow_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">尚無記錄</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 border-t pt-4">
            <div className="text-sm font-medium">新增催收</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>催收動作</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                  <SelectContent>{actionOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>下次追蹤日</Label>
                <Input type="date" value={next} onChange={(e) => setNext(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>備註</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={add}>新增記錄</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
