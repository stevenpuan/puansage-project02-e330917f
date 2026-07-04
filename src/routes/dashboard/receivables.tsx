import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { downloadCsv, todayStamp } from "@/lib/csv";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/dashboard/receivables")({ component: Page });

interface Row {
  client_id: string; code: string; name: string;
  outstanding: number | null; received: number | null; overdue_amount: number | null;
}
interface CashRow { month: string; expected_in: number | null; items: number | null }
const money = (n: number | null | undefined) => `NT$ ${Number(n ?? 0).toLocaleString("zh-TW")}`;

function Page() {
  const { can } = useAuth();
  const canExport = can("finance", "view");
  const { data: rows = [] } = useQuery({
    queryKey: ["receivables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_receivables_by_client").select("*").order("outstanding", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const { data: cash = [] } = useQuery({
    queryKey: ["cashflow-forecast"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_cashflow_forecast" as any).select("*").order("month");
      if (error) throw error;
      return (data ?? []) as unknown as CashRow[];
    },
  });
  const chartData = cash.map((c) => ({ month: c.month, expected_in: Number(c.expected_in ?? 0), items: c.items ?? 0 }));
  const totalOut = rows.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
  const totalOverdue = rows.reduce((s, r) => s + Number(r.overdue_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="應收彙整" description="依客戶彙總的應收、已收與逾期金額" actions={
        canExport && (
          <Button variant="outline" onClick={() => downloadCsv(
            `receivables_${todayStamp()}.csv`,
            ["代號", "客戶", "應收", "已收", "逾期"],
            rows.map((r) => [r.code, r.name, r.outstanding ?? 0, r.received ?? 0, r.overdue_amount ?? 0]),
          )}>匯出 CSV</Button>
        )
      } />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">總應收</div>
            <div className="text-2xl font-semibold mt-1">{money(totalOut)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">總逾期</div>
            <div className={cn("text-2xl font-semibold mt-1", totalOverdue > 0 && "text-red-600 dark:text-red-400")}>{money(totalOverdue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代號</TableHead><TableHead>客戶</TableHead>
                <TableHead className="text-right">應收</TableHead>
                <TableHead className="text-right">已收</TableHead>
                <TableHead className="text-right">逾期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.client_id} className={cn(Number(r.overdue_amount ?? 0) > 0 && "bg-red-50 dark:bg-red-950/30")}>
                  <TableCell className="font-mono text-sm">
                    <Link to="/dashboard/clients/$clientId" params={{ clientId: r.client_id }} className="underline underline-offset-4">{r.code}</Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to="/dashboard/clients/$clientId" params={{ clientId: r.client_id }} className="hover:underline">{r.name}</Link>
                  </TableCell>
                  <TableCell className="text-right">{money(r.outstanding)}</TableCell>
                  <TableCell className="text-right">{money(r.received)}</TableCell>
                  <TableCell className={cn("text-right", Number(r.overdue_amount ?? 0) > 0 && "text-red-600 dark:text-red-400 font-medium")}>{money(r.overdue_amount)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">尚無資料</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
