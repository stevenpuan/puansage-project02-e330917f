import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/tasks")({ component: Page });

interface OpenTaskRow {
  id: string; case_id: string | null;
  case_code?: string | null; case_title?: string | null; client_name?: string | null;
  title: string; status: string | null; priority: string | null;
  assignee_id: string | null; due_date: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

function Page() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("cases", "edit");
  const [allUsers, setAllUsers] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["open-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_open_tasks").select("*").order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as OpenTaskRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["open-tasks"] });

  const filtered = allUsers ? rows : rows.filter((r) => r.assignee_id === user?.id);

  const done = async (t: OpenTaskRow) => {
    const { error } = await supabase.from("case_tasks").update({ status: "完成", done_at: new Date().toISOString() }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已標記完成"); reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="我的待辦" description="尚未完成的案件待辦" actions={
        <div className="flex items-center gap-2">
          <Switch id="all-users" checked={allUsers} onCheckedChange={setAllUsers} />
          <Label htmlFor="all-users" className="text-sm">看全部</Label>
        </div>
      } />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>案件</TableHead><TableHead>客戶</TableHead>
                <TableHead>待辦</TableHead><TableHead>狀態</TableHead>
                <TableHead>優先</TableHead><TableHead>到期日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const overdue = !!t.due_date && t.due_date < today();
                return (
                  <TableRow key={t.id} className={cn(overdue && "bg-red-50 dark:bg-red-950/30")}>
                    <TableCell><Checkbox onCheckedChange={(v) => v && done(t)} disabled={!canEdit} /></TableCell>
                    <TableCell>
                      {t.case_id ? (
                        <Link to="/dashboard/cases/$caseId" params={{ caseId: t.case_id }} className="text-primary underline">
                          <span className="font-mono text-xs">{t.case_code ?? "—"}</span>
                          <span className="ml-2">{t.case_title ?? ""}</span>
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{t.client_name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell><Badge variant="outline">{t.status ?? "—"}</Badge></TableCell>
                    <TableCell>{t.priority ?? "—"}</TableCell>
                    <TableCell className={cn(overdue && "text-red-600 font-medium")}>{t.due_date ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">目前沒有待辦</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
