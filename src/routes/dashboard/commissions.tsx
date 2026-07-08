import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/commissions")({ component: Page });

const money = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("zh-TW"));
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

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

interface EntryRow {
  id: string;
  payee_id: string;
  contract_id: string | null; project_id: string | null; payment_id: string | null;
  deal_role: string | null; plan_id: string | null;
  base_amount: number | null; rate: number | null; commission_amount: number | null;
  company_amount: number | null;
  payout_period: string | null; payout_status: string;
  realized: boolean; realized_on: string | null;
  note: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  cases: { code: string | null; title: string | null } | null;
  contracts: { contract_no: string | null; title: string | null } | null;
}
interface EntryForm {
  id?: string;
  payee_id: string;
  contract_id: string | null; project_id: string | null; payment_id: string | null;
  deal_role: string | null; plan_id: string | null;
  base_amount: string | number; rate: string | number; commission_amount: string | number;
  company_amount: string | number;
  payout_period: string; payout_status: string;
  note: string;
}
const emptyEntry: EntryForm = {
  payee_id: "", contract_id: null, project_id: null, payment_id: null,
  deal_role: null, plan_id: null,
  base_amount: "", rate: "", commission_amount: "", company_amount: "",
  payout_period: "", payout_status: "pending", note: "",
};

interface PlanRow {
  id: string; name: string; base: string; rate: number | null; is_active: boolean; note: string | null;
}
interface PlanForm {
  id?: string; name: string; base: string; rate: string | number; is_active: boolean; note: string;
}
const emptyPlan: PlanForm = { name: "", base: "contract_amount", rate: "", is_active: true, note: "" };

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canView = can("commission", "view");
  const canCreate = can("commission", "create");
  const canEdit = can("commission", "edit");
  const canDelete = can("commission", "delete");

  const { data: currentRate } = useQuery({
    queryKey: ["commission_rate"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_commission_rate");
      if (error) throw error;
      return (data ?? 0) as number;
    },
    enabled: canEdit,
  });
  const [rateInput, setRateInput] = useState("");
  useEffect(() => {
    if (currentRate != null) setRateInput(String(Number(currentRate) * 100));
  }, [currentRate]);

  const saveRate = async () => {
    const val = Number(rateInput);
    if (Number.isNaN(val) || val < 0 || val > 100) {
      toast.error("請輸入 0～100 的數字");
      return;
    }
    const { error } = await supabase.rpc("set_commission_rate", { p_rate: val / 100 });
    if (error) { toast.error(error.message); return; }
    toast.success("分潤費率已更新為 " + val + "%");
    qc.invalidateQueries({ queryKey: ["commission_rate"] });
  };

  const { data: roleOpts = [] } = useLookups("deal_role");
  const { data: statusOpts = [] } = useLookups("commission_payout_status");
  const { data: baseOpts = [] } = useLookups("commission_base");

  const { data: summary = [] } = useQuery({
    queryKey: ["v_commission_by_person"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_commission_by_person")
        .select("*").order("payout_period", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["commission_entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_entries")
        .select("*, profiles!commission_entries_payee_id_fkey(full_name,email), cases(code,title), contracts(contract_no,title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EntryRow[];
    },
    enabled: canView,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["commission_plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_plans")
        .select("id,name,base,rate,is_active,note").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
    enabled: canView,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email").order("full_name", { nullsFirst: false });
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });
  const { data: contractsList = [] } = useQuery({
    queryKey: ["contracts-mini-comm"],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("id,title,contract_no").order("created_at", { ascending: false });
      return (data ?? []) as { id: string; title: string | null; contract_no: string | null }[];
    },
  });
  const { data: casesList = [] } = useQuery({
    queryKey: ["cases-mini-comm"],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("id,code,title").order("created_at", { ascending: false });
      return (data ?? []) as { id: string; code: string | null; title: string | null }[];
    },
  });
  const { data: paymentsList = [] } = useQuery({
    queryKey: ["payments-mini-comm"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("id,title,amount,contract_id").order("due_date", { nullsFirst: false });
      return (data ?? []) as { id: string; title: string | null; amount: number | null; contract_id: string | null }[];
    },
  });

  const [entryForm, setEntryForm] = useState<EntryForm | null>(null);
  const isNewEntry = entryForm && !entryForm.id;
  const [planForm, setPlanForm] = useState<PlanForm | null>(null);
  const isNewPlan = planForm && !planForm.id;

  const reloadEntries = () => qc.invalidateQueries({ queryKey: ["commission_entries"] });
  const reloadSummary = () => qc.invalidateQueries({ queryKey: ["v_commission_by_person"] });
  const reloadPlans = () => qc.invalidateQueries({ queryKey: ["commission_plans"] });

  const openEditEntry = (r: EntryRow) => setEntryForm({
    id: r.id, payee_id: r.payee_id,
    contract_id: r.contract_id, project_id: r.project_id, payment_id: r.payment_id,
    deal_role: r.deal_role, plan_id: r.plan_id,
    base_amount: r.base_amount ?? "", rate: r.rate ?? "", commission_amount: r.commission_amount ?? "", company_amount: r.company_amount ?? "",
    payout_period: r.payout_period ?? "", payout_status: r.payout_status ?? "pending",
    note: r.note ?? "",
  });

  const saveEntry = async () => {
    if (!entryForm) return;
    if (!entryForm.payee_id) { toast.error("請選擇受款人"); return; }
    const payload: any = {
      payee_id: entryForm.payee_id,
      contract_id: entryForm.contract_id || null,
      project_id: entryForm.project_id || null,
      payment_id: entryForm.payment_id || null,
      deal_role: entryForm.deal_role || null,
      plan_id: entryForm.plan_id || null,
      base_amount: numOrNull(entryForm.base_amount),
      rate: numOrNull(entryForm.rate),
      commission_amount: numOrNull(entryForm.commission_amount),
      company_amount: Number(entryForm.company_amount) || 0,
      payout_period: entryForm.payout_period || null,
      payout_status: entryForm.payout_status || "pending",
      note: entryForm.note || null,
    };
    const { error } = entryForm.id
      ? await supabase.from("commission_entries").update(payload).eq("id", entryForm.id)
      : await supabase.from("commission_entries").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(entryForm.id ? "已更新" : "已新增");
    setEntryForm(null); reloadEntries(); reloadSummary();
  };
  const delEntry = async (r: EntryRow) => {
    if (!confirm("確定刪除此獎金明細？")) return;
    const { error } = await supabase.from("commission_entries").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reloadEntries(); reloadSummary();
  };

  const openEditPlan = (r: PlanRow) => setPlanForm({
    id: r.id, name: r.name, base: r.base, rate: r.rate ?? "", is_active: r.is_active, note: r.note ?? "",
  });
  const savePlan = async () => {
    if (!planForm) return;
    if (!planForm.name) { toast.error("請填寫名稱"); return; }
    const payload: any = {
      name: planForm.name, base: planForm.base || "contract_amount",
      rate: numOrNull(planForm.rate), is_active: planForm.is_active, note: planForm.note || null,
    };
    const { error } = planForm.id
      ? await supabase.from("commission_plans").update(payload).eq("id", planForm.id)
      : await supabase.from("commission_plans").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(planForm.id ? "已更新" : "已新增");
    setPlanForm(null); reloadPlans();
  };
  const delPlan = async (r: PlanRow) => {
    if (!confirm(`確定刪除規則「${r.name}」？`)) return;
    const { error } = await supabase.from("commission_plans").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reloadPlans();
  };

  const roleLabel = (c: string | null) => roleOpts.find((o) => o.code === c)?.label ?? c ?? "—";
  const statusLabel = (c: string) => statusOpts.find((o) => o.code === c)?.label ?? c;
  const baseLabel = (c: string) => baseOpts.find((o) => o.code === c)?.label ?? c;
  const payeeName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "—";
  };

  if (!canView) {
    return <div className="p-6 text-muted-foreground">無檢視權限</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="業務獎金" description="規則、明細與每人獎金彙總" />

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">每人獎金彙總</TabsTrigger>
          <TabsTrigger value="entries">獎金明細</TabsTrigger>
          <TabsTrigger value="plans">獎金規則</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.map((s, i) => (
              <Card key={`${s.payee_id}-${s.payout_period}-${i}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{s.payee_name ?? "—"}</span>
                    <Badge variant="outline">{s.payout_period ?? "未指定期別"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">已實現</span><span className="font-medium text-green-600">{money(s.realized_amount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">待實現</span><span className="font-medium">{money(s.pending_amount)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span>合計</span><span className="font-semibold">{money(s.total_amount)}</span></div>
                </CardContent>
              </Card>
            ))}
            {summary.length === 0 && (
              <div className="text-muted-foreground col-span-full text-center py-8">尚無獎金資料</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          <div className="flex justify-end">
            {canCreate && (
              <Dialog open={!!isNewEntry} onOpenChange={(o) => !o && setEntryForm(null)}>
                <DialogTrigger asChild><Button onClick={() => setEntryForm({ ...emptyEntry })}>新增獎金明細</Button></DialogTrigger>
                <EntryDialog form={entryForm} setForm={setEntryForm} save={saveEntry} isNew
                  roleOpts={roleOpts} statusOpts={statusOpts}
                  profiles={profiles} contracts={contractsList} cases={casesList} payments={paymentsList} plans={plans} />
              </Dialog>
            )}
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>受款人</TableHead>
                    <TableHead>專案 / 合約</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead className="text-right">基數</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">獎金金額</TableHead>
                    <TableHead>實現</TableHead>
                    <TableHead>實現日</TableHead>
                    <TableHead>期別</TableHead>
                    <TableHead>發放狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.profiles?.full_name ?? r.profiles?.email ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.cases ? <div>{r.cases.code} · {r.cases.title}</div> : null}
                        {r.contracts ? <div className="text-muted-foreground">{r.contracts.contract_no} · {r.contracts.title}</div> : null}
                        {!r.cases && !r.contracts && "—"}
                      </TableCell>
                      <TableCell><Badge variant="outline">{roleLabel(r.deal_role)}</Badge></TableCell>
                      <TableCell className="text-right">{money(r.base_amount)}</TableCell>
                      <TableCell className="text-right">{r.rate ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{money(r.commission_amount)}</TableCell>
                      <TableCell>
                        <Badge className={cn(r.realized ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600 hover:bg-gray-100")} variant="secondary">
                          {r.realized ? "已實現" : "待實現"}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.realized_on ?? "—"}</TableCell>
                      <TableCell>{r.payout_period ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{statusLabel(r.payout_status)}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                        {canEdit && <Button size="sm" variant="outline" onClick={() => openEditEntry(r)}>編輯</Button>}
                        {canDelete && <Button size="sm" variant="outline" onClick={() => delEntry(r)}>刪除</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {entries.length === 0 && (
                    <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">尚無獎金明細</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={!!entryForm && !isNewEntry} onOpenChange={(o) => !o && setEntryForm(null)}>
            <EntryDialog form={entryForm} setForm={setEntryForm} save={saveEntry} isNew={false}
              roleOpts={roleOpts} statusOpts={statusOpts}
              profiles={profiles} contracts={contractsList} cases={casesList} payments={paymentsList} plans={plans} />
          </Dialog>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            {canCreate && (
              <Dialog open={!!isNewPlan} onOpenChange={(o) => !o && setPlanForm(null)}>
                <DialogTrigger asChild><Button onClick={() => setPlanForm({ ...emptyPlan })}>新增獎金規則</Button></DialogTrigger>
                <PlanDialog form={planForm} setForm={setPlanForm} save={savePlan} isNew baseOpts={baseOpts} />
              </Dialog>
            )}
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名稱</TableHead>
                    <TableHead>基數</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead>啟用</TableHead>
                    <TableHead>備註</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell><Badge variant="outline">{baseLabel(r.base)}</Badge></TableCell>
                      <TableCell className="text-right">{r.rate ?? "—"}</TableCell>
                      <TableCell>
                        {r.is_active ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100" variant="secondary">啟用</Badge>
                          : <Badge variant="secondary">停用</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.note ?? "—"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {canEdit && <Button size="sm" variant="outline" onClick={() => openEditPlan(r)}>編輯</Button>}
                        {canDelete && <Button size="sm" variant="outline" onClick={() => delPlan(r)}>刪除</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">尚無獎金規則</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={!!planForm && !isNewPlan} onOpenChange={(o) => !o && setPlanForm(null)}>
            <PlanDialog form={planForm} setForm={setPlanForm} save={savePlan} isNew={false} baseOpts={baseOpts} />
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}

type Opt = { code: string; label: string };

function EntryDialog({
  form, setForm, save, isNew, roleOpts, statusOpts, profiles, contracts, cases, payments, plans,
}: {
  form: EntryForm | null; setForm: (f: EntryForm | null) => void; save: () => void; isNew: boolean;
  roleOpts: Opt[]; statusOpts: Opt[];
  profiles: { id: string; full_name: string | null; email: string | null }[];
  contracts: { id: string; title: string | null; contract_no: string | null }[];
  cases: { id: string; code: string | null; title: string | null }[];
  payments: { id: string; title: string | null; amount: number | null; contract_id: string | null }[];
  plans: PlanRow[];
}) {
  if (!form) return null;
  const set = <K extends keyof EntryForm>(k: K, v: EntryForm[K]) => setForm({ ...form, [k]: v });
  const recompute = (base: unknown, rate: unknown) => {
    const b = base === "" || base == null ? null : Number(base);
    const r = rate === "" || rate == null ? null : Number(rate);
    if (b == null || r == null || isNaN(b) || isNaN(r)) return "";
    return Math.round(b * r) / 100;
  };
  const onBase = (v: string) => setForm({ ...form, base_amount: v, commission_amount: recompute(v, form.rate) });
  const onRate = (v: string) => setForm({ ...form, rate: v, commission_amount: recompute(form.base_amount, v) });
  const onPlan = (v: string) => {
    const id = v === "__none__" ? null : v;
    const p = plans.find((x) => x.id === id);
    if (p && p.rate != null) {
      setForm({ ...form, plan_id: id, rate: p.rate, commission_amount: recompute(form.base_amount, p.rate) });
    } else {
      setForm({ ...form, plan_id: id });
    }
  };
  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增獎金明細" : "編輯獎金明細"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="受款人">
          <Select value={form.payee_id} onValueChange={(v) => set("payee_id", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="角色">
          <Select value={form.deal_role ?? ""} onValueChange={(v) => set("deal_role", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{roleOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="合約(可空)">
          <Select value={form.contract_id ?? ""} onValueChange={(v) => set("contract_id", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.contract_no ?? "—"} · {c.title ?? ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="專案(可空)">
          <Select value={form.project_id ?? ""} onValueChange={(v) => set("project_id", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {cases.map((c) => <SelectItem key={c.id} value={c.id}>{c.code ?? "—"} · {c.title ?? ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="綁定收款(可空)" full>
          <Select value={form.payment_id ?? ""} onValueChange={(v) => set("payment_id", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
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
        <F label="套用規則(可空)" full>
          <Select value={form.plan_id ?? ""} onValueChange={onPlan}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— 不指定 —</SelectItem>
              {plans.filter((p) => p.is_active).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.rate != null ? ` · ${p.rate}%` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </F>
        <F label="基數金額"><Input type="number" value={form.base_amount} onChange={(e) => onBase(e.target.value)} /></F>
        <F label="百分比 (%)"><Input type="number" value={form.rate} onChange={(e) => onRate(e.target.value)} /></F>
        <F label="獎金金額"><Input type="number" value={form.commission_amount} onChange={(e) => set("commission_amount", e.target.value)} /></F>
        <F label="給公司金額（進基金）"><Input type="number" value={form.company_amount} onChange={(e) => set("company_amount", e.target.value)} /></F>
        <F label="期別 (例 2026-Q3)"><Input value={form.payout_period} onChange={(e) => set("payout_period", e.target.value)} /></F>
        <F label="發放狀態">
          <Select value={form.payout_status} onValueChange={(v) => set("payout_status", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{statusOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="備註" full><Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} /></F>
        {!isNew && (
          <div className="sm:col-span-2 text-xs text-muted-foreground">實現狀態與實現日由收款「已收」時自動更新,此處唯讀。</div>
        )}
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}

function PlanDialog({
  form, setForm, save, isNew, baseOpts,
}: {
  form: PlanForm | null; setForm: (f: PlanForm | null) => void; save: () => void; isNew: boolean; baseOpts: Opt[];
}) {
  if (!form) return null;
  const set = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{isNew ? "新增獎金規則" : "編輯獎金規則"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="名稱" full><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></F>
        <F label="基數">
          <Select value={form.base} onValueChange={(v) => set("base", v)}>
            <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
            <SelectContent>{baseOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="百分比 (%)"><Input type="number" value={form.rate} onChange={(e) => set("rate", e.target.value)} /></F>
        <div className="sm:col-span-2 flex items-center justify-between rounded border p-3">
          <Label>啟用</Label>
          <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
        </div>
        <F label="備註" full><Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} /></F>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
