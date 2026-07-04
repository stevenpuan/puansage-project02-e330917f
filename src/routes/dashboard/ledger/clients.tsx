import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { downloadCsv, todayStamp } from "@/lib/csv";

export const Route = createFileRoute("/dashboard/ledger/clients")({ component: Page });

interface Client {
  id: string; code: string; name: string; tax_id: string | null;
  contact_name: string | null; phone: string | null; email: string | null; note: string | null;
}
const empty: Partial<Client> = { code: "", name: "", tax_id: "", contact_name: "", phone: "", email: "", note: "" };

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canCreate = can("ledger", "create");
  const canEdit = can("ledger", "edit");
  const canDelete = can("ledger", "delete");
  const canExport = can("ledger", "export");
  const [q, setQ] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("code");
      if (error) throw error;
      return data as Client[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["clients"] });

  const [form, setForm] = useState<Partial<Client> | null>(null);
  const isNew = form && !form.id;

  const save = async () => {
    if (!form?.code || !form?.name) { toast.error("請填寫代號與名稱"); return; }
    const payload = {
      code: form.code, name: form.name, tax_id: form.tax_id || null,
      contact_name: form.contact_name || null, phone: form.phone || null,
      email: form.email || null, note: form.note || null,
    };
    const { error } = isNew
      ? await supabase.from("clients").insert(payload)
      : await supabase.from("clients").update(payload).eq("id", form!.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "已新增客戶" : "已更新"); setForm(null); reload();
  };
  const del = async (r: Client) => {
    if (!confirm(`確定刪除客戶「${r.name}」？`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); reload();
  };

  const filtered = rows.filter((r) =>
    [r.code, r.name, r.tax_id, r.contact_name].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-6">
      <PageHeader title="客戶管理" description="客戶主檔與聯絡資訊" actions={
        <>
          {canExport && (
            <Button variant="outline" onClick={() => downloadCsv(
              `clients_${todayStamp()}.csv`,
              ["代號", "名稱", "統編", "聯絡人", "電話", "Email", "備註"],
              filtered.map((r) => [r.code, r.name, r.tax_id, r.contact_name, r.phone, r.email, r.note]),
            )}>匯出 CSV</Button>
          )}
          {canCreate && (
            <Dialog open={!!form && !!isNew} onOpenChange={(o) => !o && setForm(null)}>
              <DialogTrigger asChild><Button onClick={() => setForm({ ...empty })}>新增客戶</Button></DialogTrigger>
              <FormDialog form={form} setForm={setForm} save={save} isNew={!!isNew} />
            </Dialog>
          )}
        </>
      } />

      <Input placeholder="搜尋代號 / 名稱 / 統編 / 聯絡人" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代號</TableHead><TableHead>名稱</TableHead><TableHead>統編</TableHead>
                <TableHead>聯絡人</TableHead><TableHead>電話</TableHead><TableHead>Email</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">
                    <Link to="/dashboard/clients/$clientId" params={{ clientId: r.id }} className="underline underline-offset-4">{r.code}</Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to="/dashboard/clients/$clientId" params={{ clientId: r.id }} className="hover:underline">{r.name}</Link>
                  </TableCell>
                  <TableCell>{r.tax_id ?? "—"}</TableCell>
                  <TableCell>{r.contact_name ?? "—"}</TableCell>
                  <TableCell>{r.phone ?? "—"}</TableCell>
                  <TableCell>{r.email ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {canEdit && <Button size="sm" variant="outline" onClick={() => setForm({ ...r })}>編輯</Button>}
                    {canDelete && <Button size="sm" variant="outline" onClick={() => del(r)}>刪除</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">尚無客戶</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form && !isNew} onOpenChange={(o) => !o && setForm(null)}>
        <FormDialog form={form} setForm={setForm} save={save} isNew={false} />
      </Dialog>
    </div>
  );
}

function FormDialog({ form, setForm, save, isNew }: {
  form: Partial<Client> | null; setForm: (f: Partial<Client> | null) => void; save: () => void; isNew: boolean;
}) {
  if (!form) return null;
  const set = (k: keyof Client, v: string) => setForm({ ...form, [k]: v });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{isNew ? "新增客戶" : "編輯客戶"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="客戶代號"><Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} placeholder="C-001" /></Field>
        <Field label="名稱"><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="統一編號"><Input value={form.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} /></Field>
        <Field label="聯絡人"><Input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} /></Field>
        <Field label="電話"><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email"><Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="備註" full><Input value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></Field>
      </div>
      <DialogFooter><Button onClick={save}>儲存</Button></DialogFooter>
    </DialogContent>
  );
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={"space-y-1 " + (full ? "sm:col-span-2" : "")}><Label>{label}</Label>{children}</div>;
}
