import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/renewals")({ component: Page });

interface Row {
  type: string; ref_id: string; title: string | null;
  client_name: string | null; due_date: string | null; days_left: number | null;
}

const TYPES = ["維護合約", "系統維護", "保固到期"];

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canCreate = can("maintenance", "create");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: rows = [] } = useQuery({
    queryKey: ["v_renewal_center"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_renewal_center").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const filtered = rows
    .filter((r) => typeFilter === "all" || r.type === typeFilter)
    .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0));

  const renew = async (r: Row) => {
    if (!confirm(`確定為「${r.title}」建立續約草稿？`)) return;
    const { data, error } = await supabase.rpc("gen_renewal_contract", { p_contract: r.ref_id });
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("續約失敗"); return; }
    toast.success("已建立續約草稿", {
      action: { label: "前往合約", onClick: () => { window.location.href = "/dashboard/contracts"; } },
    });
    qc.invalidateQueries({ queryKey: ["v_renewal_center"] });
  };

  const typeBadge = (t: string) => {
    if (t === "維護合約") return "default";
    if (t === "系統維護") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="維護到期" description="90 天內即將到期:維護合約、系統維護、保固" actions={
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類型</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      } />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>類型</TableHead>
                <TableHead>項目</TableHead>
                <TableHead>客戶</TableHead>
                <TableHead>到期日</TableHead>
                <TableHead className="text-right">剩餘天數</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const dl = r.days_left ?? 0;
                const overdue = dl < 0;
                const warn = dl >= 0 && dl <= 30;
                return (
                  <TableRow key={`${r.type}-${r.ref_id}`} className={cn(warn && "bg-yellow-50 dark:bg-yellow-950/30")}>
                    <TableCell><Badge variant={typeBadge(r.type)}>{r.type}</Badge></TableCell>
                    <TableCell className="font-medium">{r.title ?? "—"}</TableCell>
                    <TableCell>{r.client_name ?? "—"}</TableCell>
                    <TableCell>{r.due_date ?? "—"}</TableCell>
                    <TableCell className={cn("text-right font-mono", overdue && "text-destructive font-semibold")}>
                      {overdue ? `逾期 ${Math.abs(dl)} 天` : `${dl} 天`}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.type === "維護合約" && canCreate ? (
                        <Button size="sm" variant="outline" onClick={() => renew(r)}>一鍵續約</Button>
                      ) : (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/dashboard/contracts">前往</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">近 90 天無到期項目</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
