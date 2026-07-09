// src/components/finance/ExpensesList.tsx
// 費用支出：列表 + 新增/編輯（含科目、支出對象、金額、申請人、關聯專案）
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Loader2, Plus, ReceiptText } from "lucide-react";
import { toast } from "sonner";

type Cat = { id: string; name: string };
type Proj = { id: string; code: string | null; title: string };
type Prof = { id: string; full_name: string | null };
type Expense = {
  id: string; expense_no: string | null; category_id: string | null; payee: string | null;
  amount: number; tax: number | null; expense_date: string; applicant_id: string | null;
  payment_method: string | null; status: string; project_id: string | null;
  invoice_no: string | null; description: string | null;
};

const STATUSES = ["待審", "已核准", "已支付", "駁回"];
const METHODS = ["現金", "銀行轉帳", "信用卡", "支票", "其他"];
const statusColor: Record<string, string> = {
  "待審": "bg-amber-100 text-amber-700", "已核准": "bg-blue-100 text-blue-700",
  "已支付": "bg-emerald-100 text-emerald-700", "駁回": "bg-red-100 text-red-700",
};
const money = (n: number) => "NT$ " + (n ?? 0).toLocaleString();
const emptyForm = {
  category_id: "", payee: "", amount: "", tax: "", expense_date: new Date().toISOString().slice(0, 10),
  applicant_id: "", payment_method: "", status: "待審", project_id: "", invoice_no: "", description: "",
};

export default function ExpensesList() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [projs, setProjs] = useState<Proj[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    setLoading(true);
    const [{ data: e }, { data: c }, { data: p }, { data: pr }] = await Promise.all([
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
      supabase.from("expense_categories").select("id,name").eq("is_active", true).order("sort_order"),
      supabase.from("cases").select("id,code,title").order("code"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
    ]);
    setRows((e as Expense[]) ?? []);
    setCats((c as Cat[]) ?? []);
    setProjs((p as Proj[]) ?? []);
    setProfs((pr as Prof[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const catName = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c.name])), [cats]);
  const projName = useMemo(() => Object.fromEntries(projs.map((p) => [p.id, `${p.code ?? ""} ${p.title}`])), [projs]);
  const profName = useMemo(() => Object.fromEntries(profs.map((p) => [p.id, p.full_name ?? ""])), [profs]);
  const total = useMemo(() => rows.filter((r) => r.status !== "駁回").reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (r: Expense) => {
    setEditId(r.id);
    setForm({
      category_id: r.category_id ?? "", payee: r.payee ?? "", amount: String(r.amount ?? ""),
      tax: r.tax != null ? String(r.tax) : "", expense_date: r.expense_date, applicant_id: r.applicant_id ?? "",
      payment_method: r.payment_method ?? "", status: r.status, project_id: r.project_id ?? "",
      invoice_no: r.invoice_no ?? "", description: r.description ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast.error("請輸入金額"); return; }
    const payload = {
      category_id: form.category_id || null, payee: form.payee || null, amount: Number(form.amount),
      tax: form.tax ? Number(form.tax) : 0, expense_date: form.expense_date, applicant_id: form.applicant_id || null,
      payment_method: form.payment_method || null, status: form.status, project_id: form.project_id || null,
      invoice_no: form.invoice_no || null, description: form.description || null,
    };
    const { error } = editId
      ? await supabase.from("expenses").update(payload).eq("id", editId)
      : await supabase.from("expenses").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? "已更新" : "已新增"); setOpen(false); load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><ReceiptText className="h-5 w-5" /> 費用支出</h1>
          <p className="text-sm text-muted-foreground">未駁回支出合計：<b>{money(total)}</b></p>
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> 新增支出</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">支出明細（{rows.length}）</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 載入中…</div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">尚無支出，點右上「新增支出」建立第一筆。</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>日期</TableHead><TableHead>科目</TableHead><TableHead>支出對象</TableHead>
                <TableHead className="text-right">金額</TableHead><TableHead>申請人</TableHead>
                <TableHead>關聯專案</TableHead><TableHead>狀態</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{r.expense_date}</TableCell>
                    <TableCell>{catName[r.category_id ?? ""] ?? "—"}</TableCell>
                    <TableCell>{r.payee ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{money(Number(r.amount))}</TableCell>
                    <TableCell className="text-sm">{profName[r.applicant_id ?? ""] ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">{r.project_id ? projName[r.project_id] : "—"}</TableCell>
                    <TableCell><Badge className={statusColor[r.status] ?? ""} variant="secondary">{r.status}</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(r)}>編輯</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "編輯支出" : "新增支出"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>科目</Label>
              <Select value={form.category_id || "__none"} onValueChange={(v) => setForm({ ...form, category_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="選擇科目" /></SelectTrigger>
                <SelectContent><SelectItem value="__none">—</SelectItem>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>支出對象</Label><Input value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} placeholder="廠商/對象名稱" /></div>
            <div className="space-y-1"><Label>金額 *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1"><Label>稅額（選填）</Label><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></div>
            <div className="space-y-1"><Label>支出日期</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>申請人</Label>
              <Select value={form.applicant_id || "__none"} onValueChange={(v) => setForm({ ...form, applicant_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="選擇申請人" /></SelectTrigger>
                <SelectContent><SelectItem value="__none">—</SelectItem>{profs.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>付款方式</Label>
              <Select value={form.payment_method || "__none"} onValueChange={(v) => setForm({ ...form, payment_method: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                <SelectContent><SelectItem value="__none">—</SelectItem>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>狀態</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1 col-span-2"><Label>關聯專案（成本歸屬，選填）</Label>
              <Select value={form.project_id || "__none"} onValueChange={(v) => setForm({ ...form, project_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="選擇專案" /></SelectTrigger>
                <SelectContent><SelectItem value="__none">— 不關聯 —</SelectItem>{projs.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} {p.title}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1 col-span-2"><Label>憑證/發票號（選填）</Label><Input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} /></div>
            <div className="space-y-1 col-span-2"><Label>說明</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={save}>{editId ? "儲存" : "新增"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
