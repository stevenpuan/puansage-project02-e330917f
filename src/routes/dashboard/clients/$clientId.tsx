import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/clients/$clientId")({ component: Page });

interface Client {
  id: string; code: string; name: string; tax_id: string | null;
  contact_name: string | null; phone: string | null; email: string | null; note: string | null;
}
interface Overview {
  system_count: number; open_cases: number; open_opps: number;
  contract_count: number; contract_total: number | null;
  contact_count: number; last_contact_date: string | null; next_maintenance_due: string | null;
}
interface Contact {
  id: string; client_id: string; name: string; title: string | null;
  phone: string | null; email: string | null; is_primary: boolean; note: string | null;
}
interface Note {
  id: string; client_id: string; type: string | null; content: string;
  contact_date: string | null; created_by: string | null; created_at: string;
}

const today = () => new Date().toISOString().slice(0, 10);

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
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const canEdit = can("ledger", "edit"), canCreate = can("ledger", "create"), canDelete = can("ledger", "delete");

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });
  const { data: overview } = useQuery({
    queryKey: ["client-overview", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("v_client_overview").select("*").eq("id", clientId).maybeSingle();
      return (data ?? null) as Overview | null;
    },
  });

  const [form, setForm] = useState<Partial<Client> | null>(null);
  const current = form ?? client ?? null;
  const set = (k: keyof Client, v: string) => setForm({ ...(current ?? {}), [k]: v });
  const saveClient = async () => {
    if (!current) return;
    const payload = {
      code: current.code, name: current.name, tax_id: current.tax_id || null,
      contact_name: current.contact_name || null, phone: current.phone || null,
      email: current.email || null, note: current.note || null,
    };
    const { error } = await supabase.from("clients").update(payload as any).eq("id", clientId);
    if (error) { toast.error(error.message); return; }
    toast.success("已更新"); setForm(null);
    qc.invalidateQueries({ queryKey: ["client", clientId] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  if (!client && !form) {
    return <div className="p-6 text-muted-foreground">載入中…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`客戶詳情 · ${client?.code ?? ""}`} description={client?.name ?? ""} actions={
        <Button variant="outline" asChild><Link to="/dashboard/ledger/clients">返回列表</Link></Button>
      } />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="系統數" value={overview?.system_count ?? 0} to="/dashboard/ledger/systems" />
        <Stat title="進行中專案" value={overview?.open_cases ?? 0} to="/dashboard/cases" />
        <Stat title="進行中任務" value={overview?.open_opps ?? 0} to="/dashboard/opportunities" />
        <Stat title="合約總額" value={overview?.contract_total ?? 0} to="/dashboard/ledger/contracts" money />
      </div>

      <Card>
        <CardHeader><CardTitle>基本資料</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="代號"><Input disabled={!canEdit} value={current?.code ?? ""} onChange={(e) => set("code", e.target.value)} /></F>
            <F label="名稱"><Input disabled={!canEdit} value={current?.name ?? ""} onChange={(e) => set("name", e.target.value)} /></F>
            <F label="統一編號"><Input disabled={!canEdit} value={current?.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} /></F>
            <F label="主要聯絡人"><Input disabled={!canEdit} value={current?.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} /></F>
            <F label="電話"><Input disabled={!canEdit} value={current?.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></F>
            <F label="Email"><Input disabled={!canEdit} value={current?.email ?? ""} onChange={(e) => set("email", e.target.value)} /></F>
            <F label="備註" full><Textarea rows={2} disabled={!canEdit} value={current?.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
          </div>
          {canEdit && (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" disabled={!form} onClick={() => setForm(null)}>取消</Button>
              <Button disabled={!form} onClick={saveClient}>儲存變更</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ContactsSection clientId={clientId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
      <NotesSection clientId={clientId} canCreate={canCreate} />
      <RelatedSection clientId={clientId} />
    </div>
  );
}

function Stat({ title, value, to, money }: { title: string; value: number | string; to: string; money?: boolean }) {
  const display = money ? `NT$ ${Number(value ?? 0).toLocaleString()}` : String(value);
  return (
    <Link to={to as any} className="block">
      <Card className="hover:bg-accent transition-colors">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">{title}</div>
          <div className="text-2xl font-semibold mt-1">{display}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------- Contacts ----------
function ContactsSection({ clientId, canCreate, canEdit, canDelete }: {
  clientId: string; canCreate: boolean; canEdit: boolean; canDelete: boolean;
}) {
  const qc = useQueryClient();
  const key = ["client-contacts", clientId];
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("client_contacts").select("*")
        .eq("client_id", clientId).order("is_primary", { ascending: false }).order("name");
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: key });
  const [form, setForm] = useState<Partial<Contact> | null>(null);
  const isNew = form && !form.id;

  const save = async () => {
    if (!form?.name) { toast.error("請填寫姓名"); return; }
    const payload = {
      client_id: clientId, name: form.name, title: form.title || null,
      phone: form.phone || null, email: form.email || null,
      is_primary: !!form.is_primary, note: form.note || null,
    };
    const { error } = isNew
      ? await supabase.from("client_contacts").insert(payload as any)
      : await supabase.from("client_contacts").update(payload as any).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增" : "已更新"); setForm(null); reload();
  };
  const del = async (c: Contact) => {
    if (!confirm(`刪除聯絡人「${c.name}」？`)) return;
    const { error } = await supabase.from("client_contacts").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>聯絡人 <span className="ml-2 text-sm font-normal text-muted-foreground">{rows.length}</span></CardTitle>
        {canCreate && (
          <Dialog open={!!isNew} onOpenChange={(o) => !o && setForm(null)}>
            <DialogTrigger asChild><Button size="sm" onClick={() => setForm({ is_primary: false })}>新增聯絡人</Button></DialogTrigger>
            <ContactForm form={form} setForm={setForm} save={save} isNew />
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead><TableHead>職稱</TableHead>
              <TableHead>電話</TableHead><TableHead>Email</TableHead>
              <TableHead>備註</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.name}
                  {c.is_primary && <Badge className="ml-2" variant="secondary">主要</Badge>}
                </TableCell>
                <TableCell>{c.title ?? "—"}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{c.note ?? "—"}</TableCell>
                <TableCell className="text-right space-x-2">
                  {canEdit && <Button size="sm" variant="outline" onClick={() => setForm({ ...c })}>編輯</Button>}
                  {canDelete && <Button size="sm" variant="outline" onClick={() => del(c)}>刪除</Button>}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">尚無聯絡人</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <ContactForm form={form} setForm={setForm} save={save} isNew={false} />
      </Dialog>
    </Card>
  );
}
function ContactForm({ form, setForm, save, isNew }: {
  form: Partial<Contact> | null; setForm: (f: Partial<Contact> | null) => void; save: () => void; isNew: boolean;
}) {
  if (!form) return null;
  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isNew ? "新增聯絡人" : "編輯聯絡人"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="姓名"><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></F>
        <F label="職稱"><Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} /></F>
        <F label="電話"><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></F>
        <F label="Email"><Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></F>
        <F label="備註" full><Textarea rows={2} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></F>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox id="is_primary" checked={!!form.is_primary} onCheckedChange={(v) => set("is_primary", !!v)} />
          <Label htmlFor="is_primary">設為主要聯絡人</Label>
        </div>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}

// ---------- Notes ----------
function NotesSection({ clientId, canCreate }: { clientId: string; canCreate: boolean }) {
  const qc = useQueryClient();
  const key = ["client-notes", clientId];
  const { data: typeOpts = [] } = useLookups("contact_type");
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("client_notes").select("*")
        .eq("client_id", clientId).order("contact_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });
  const [form, setForm] = useState<Partial<Note> | null>(null);
  const save = async () => {
    if (!form?.content) { toast.error("請填寫內容"); return; }
    const { error } = await supabase.from("client_notes").insert({
      client_id: clientId, type: form.type || null,
      content: form.content, contact_date: form.contact_date || today(),
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("已新增"); setForm(null); qc.invalidateQueries({ queryKey: key });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>往來紀錄 <span className="ml-2 text-sm font-normal text-muted-foreground">{rows.length}</span></CardTitle>
        {canCreate && (
          <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
            <DialogTrigger asChild><Button size="sm" onClick={() => setForm({ contact_date: today(), type: typeOpts[0]?.code ?? "" })}>新增紀錄</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>新增往來紀錄</DialogTitle></DialogHeader>
              {form && (
                <div className="grid gap-3">
                  <F label="類型">
                    <Select value={form.type ?? ""} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                      <SelectContent>{typeOpts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </F>
                  <F label="接觸日期"><Input type="date" value={form.contact_date ?? ""} onChange={(e) => setForm({ ...form, contact_date: e.target.value })} /></F>
                  <F label="內容"><Textarea rows={4} value={form.content ?? ""} onChange={(e) => setForm({ ...form, content: e.target.value })} /></F>
                </div>
              )}
              <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">尚無紀錄</div>
        ) : (
          <ol className="relative border-l pl-6 space-y-4">
            {rows.map((n) => (
              <li key={n.id} className="relative">
                <span className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full bg-primary" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{n.contact_date ?? n.created_at.slice(0, 10)}</span>
                  {n.type && <Badge variant="outline">{n.type}</Badge>}
                </div>
                <div className={cn("mt-1 whitespace-pre-wrap text-sm")}>{n.content}</div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Related ----------
interface OppRow { id: string; code: string; title: string; status: string | null; est_amount: number | null; }
interface CaseRow { id: string; code: string; title: string; status: string | null; due_date: string | null; }
interface SysRow { id: string; code: string; name: string; status: string | null; }
interface ContractRow {
  id: string; system_id: string; billing_type: string | null;
  contract_amount: number | null; payment_status: string | null; next_payment_date: string | null;
  systems: { code: string; name: string } | null;
}
function RelatedSection({ clientId }: { clientId: string }) {
  const { data: opps = [] } = useQuery({
    queryKey: ["client-related-opps", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("opportunities").select("id,code,title,status,est_amount").eq("client_id", clientId).order("code");
      return (data ?? []) as OppRow[];
    },
  });
  const { data: cases = [] } = useQuery({
    queryKey: ["client-related-cases", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("id,code,title,status,due_date").eq("client_id", clientId).order("code");
      return (data ?? []) as CaseRow[];
    },
  });
  const { data: systems = [] } = useQuery({
    queryKey: ["client-related-systems", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("systems").select("id,code,name,status").eq("client_id", clientId).order("code");
      return (data ?? []) as SysRow[];
    },
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["client-related-contracts", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("contracts")
        .select("id,system_id,billing_type,contract_amount,payment_status,next_payment_date, systems!inner(client_id,code,name)")
        .eq("systems.client_id", clientId);
      return (data ?? []) as unknown as ContractRow[];
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>關聯資訊</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <RelBlock title="任務" count={opps.length} to="/dashboard/opportunities">
          <Table>
            <TableHeader><TableRow>
              <TableHead>代號</TableHead><TableHead>標題</TableHead><TableHead>狀態</TableHead><TableHead>預估金額</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {opps.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono">
                    <Link to="/dashboard/opportunities" className="underline underline-offset-4">{o.code}</Link>
                  </TableCell>
                  <TableCell>{o.title}</TableCell>
                  <TableCell><Badge variant="outline">{o.status ?? "—"}</Badge></TableCell>
                  <TableCell>{o.est_amount ?? "—"}</TableCell>
                </TableRow>
              ))}
              {opps.length === 0 && <EmptyRow cols={4} />}
            </TableBody>
          </Table>
        </RelBlock>

        <RelBlock title="專案" count={cases.length} to="/dashboard/cases">
          <Table>
            <TableHeader><TableRow>
              <TableHead>代號</TableHead><TableHead>標題</TableHead><TableHead>狀態</TableHead><TableHead>到期日</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">
                    <Link to="/dashboard/cases/$caseId" params={{ caseId: c.id }} className="underline underline-offset-4">{c.code}</Link>
                  </TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell><Badge variant="outline">{c.status ?? "—"}</Badge></TableCell>
                  <TableCell>{c.due_date ?? "—"}</TableCell>
                </TableRow>
              ))}
              {cases.length === 0 && <EmptyRow cols={4} />}
            </TableBody>
          </Table>
        </RelBlock>

        <RelBlock title="系統" count={systems.length} to="/dashboard/ledger/systems">
          <Table>
            <TableHeader><TableRow>
              <TableHead>代號</TableHead><TableHead>名稱</TableHead><TableHead>狀態</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {systems.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">
                    <Link to="/dashboard/ledger/systems" className="underline underline-offset-4">{s.code}</Link>
                  </TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell><Badge variant="outline">{s.status ?? "—"}</Badge></TableCell>
                </TableRow>
              ))}
              {systems.length === 0 && <EmptyRow cols={3} />}
            </TableBody>
          </Table>
        </RelBlock>

        <RelBlock title="合約" count={contracts.length} to="/dashboard/ledger/contracts">
          <Table>
            <TableHeader><TableRow>
              <TableHead>系統</TableHead><TableHead>類型</TableHead><TableHead>金額</TableHead>
              <TableHead>付款狀態</TableHead><TableHead>下次付款日</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">
                    <Link to="/dashboard/ledger/contracts" className="underline underline-offset-4">{c.systems?.code ?? "—"}</Link>
                  </TableCell>
                  <TableCell>{c.billing_type ?? "—"}</TableCell>
                  <TableCell>{c.contract_amount ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{c.payment_status ?? "—"}</Badge></TableCell>
                  <TableCell>{c.next_payment_date ?? "—"}</TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && <EmptyRow cols={5} />}
            </TableBody>
          </Table>
        </RelBlock>
      </CardContent>
    </Card>
  );
}

function RelBlock({ title, count, to, children }: { title: string; count: number; to: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{title} <span className="text-muted-foreground">({count})</span></div>
        <Link to={to as any} className="text-xs text-muted-foreground hover:underline">前往 →</Link>
      </div>
      {children}
    </div>
  );
}
function EmptyRow({ cols }: { cols: number }) {
  return <TableRow><TableCell colSpan={cols} className="text-center text-muted-foreground py-6">尚無資料</TableCell></TableRow>;
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}
