import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/fund")({ component: Page });

interface Summary { balance: number; total_in: number; total_out: number }
interface Ledger {
  id: string; direction: string; amount: number; reason: string | null;
  entry_date: string; note: string | null; editable: boolean;
  payee_id: string | null; case_code: string | null; case_title: string | null;
}
interface ByPerson { payee_id: string | null; full_name: string | null; email: string; total_company: number; entries: number }

const money = (n: number | null | undefined) => `NT$ ${Number(n ?? 0).toLocaleString("zh-TW")}`;
const today = () => new Date().toISOString().slice(0, 10);

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  if (!can("finance", "view")) return <div className="p-6 text-muted-foreground">您沒有檢視基金的權限。</div>;
  const canEdit = can("finance", "edit");

  const { data: sum } = useQuery({
    queryKey: ["fund-summary"],
    queryFn: async () => {
      const { data } = await supabase.from("v_fund_summary" as any).select("*").maybeSingle();
      return (data ?? { balance: 0, total_in: 0, total_out: 0 }) as unknown as Summary;
    },
  });
  const { data: ledger = [] } = useQuery({
    queryKey: ["fund-ledger"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_fund_ledger" as any).select("*").order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Ledger[];
    },
  });
  const { data: byPerson = [] } = useQuery({
    queryKey: ["fund-by-person"],
    queryFn: async () => {
      const { data } = await supabase.from("v_fund_by_person" as any).select("*").order("total_company", { ascending: false });
      return (data ?? []) as unknown as ByPerson[];
    },
  });
  const reload = () => {
    qc.invalidateQueries({ queryKey: ["fund-summary"] });
    qc.invalidateQueries({ queryKey: ["fund-ledger"] });
  };

  const [form, setForm] = useState<{ direction: string; amount: string; reason: string; entry_date: string } | null>(null);
  const openNew = () => setForm({ direction: "in", amount: "", reason: "", entry_date: today() });
  const save = async () => {
    if (!form) return;
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("請輸入金額"); return; }
    const { error } = await supabase.from("fund_ledger" as any).insert({
      direction: form.direction, amount: amt, reason: form.reason || null, entry_date: form.entry_date || today(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("已記錄"); setForm(null); reload();
  };
  const del = async (r: Ledger) => {
    if (!r.editable) return;
    if (!confirm("刪除此筆流水？")) return;
    const realId = r.id.replace(/^fund:/, "");
    const { error } = await supabase.from("fund_ledger" as any).delete().eq("id", realId);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="基金總覽" description="公司基本基金：業務獎金提撥自動存入 + 手動存入／支出"
        actions={canEdit ? <Button onClick={openNew}>＋ 手動存入／支出</Button> : null} />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">目前餘額</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{money(sum?.balance)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">累計存入</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold text-emerald-600">{money(sum?.total_in)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">累計支出</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold text-red-600">{money(sum?.total_out)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">基金流水</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>日期</TableHead><TableHead>方向</TableHead><TableHead className="text-right">金額</TableHead>
              <TableHead>來源／事由</TableHead><TableHead>關聯案件</TableHead><TableHead className="text-right">操作</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ledger.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">尚無流水</TableCell></TableRow>}
              {ledger.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{r.entry_date}</TableCell>
                  <TableCell><Badge variant={r.direction === "in" ? "default" : "destructive"}>{r.direction === "in" ? "存入" : "支出"}</Badge></TableCell>
                  <TableCell className={"text-right font-medium " + (r.direction === "in" ? "text-emerald-600" : "text-red-600")}>
                    {r.direction === "in" ? "+" : "−"}{money(r.amount)}</TableCell>
                  <TableCell>{r.reason ?? "—"}{!r.editable && <Badge variant="outline" className="ml-2 text-[10px]">自動</Badge>}</TableCell>
                  <TableCell>{r.case_code ? `${r.case_code} ${r.case_title ?? ""}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.editable && canEdit && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">各員工貢獻（給公司金額累計）</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>員工</TableHead><TableHead className="text-right">累計貢獻</TableHead><TableHead className="text-right">筆數</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {byPerson.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">尚無貢獻紀錄</TableCell></TableRow>}
              {byPerson.map((p) => (
                <TableRow key={p.payee_id ?? Math.random()}>
                  <TableCell className="font-medium">{p.full_name || p.email || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{money(p.total_company)}</TableCell>
                  <TableCell className="text-right">{p.entries}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>手動存入／支出</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>方向</Label>
                  <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="in">存入</SelectItem><SelectItem value="out">支出／提領</SelectItem></SelectContent>
                  </Select></div>
                <div className="space-y-1"><Label>日期</Label>
                  <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label>金額</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="space-y-1"><Label>事由</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="例：年度分紅提撥 / 設備採購" /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
