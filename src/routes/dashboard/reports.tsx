import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { downloadCsv, todayStamp } from "@/lib/csv";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Printer, Download } from "lucide-react";

export const Route = createFileRoute("/dashboard/reports")({ component: Page });

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 199 89% 48%))",
  "hsl(var(--chart-3, 142 71% 45%))",
  "hsl(var(--chart-4, 32 95% 55%))",
  "hsl(var(--chart-5, 340 82% 60%))",
  "hsl(var(--muted-foreground))",
];

interface Monthly { month: string; received: number | null }
interface Cashflow { month: string; expected_in: number | null; items: number | null }
interface ARClient { client_id: string; code: string | null; name: string | null; outstanding: number | null; received: number | null; overdue_amount: number | null }
interface Funnel { status: string; count: number | null; amount: number | null }
interface CaseSum { id: string | null; status: string | null; amount: number | null }
interface Comm { payee_name: string | null; payout_period: string | null; realized_amount: number | null; pending_amount: number | null; total_amount: number | null; entries: number | null }
interface Payment { status: string | null; amount: number | null; paid_date: string | null }
interface Task { status: string | null; overdue: boolean | null }

function Page() {
  const { can } = useAuth();
  if (!can("reports", "view")) {
    return <div className="p-6 text-muted-foreground">您沒有檢視營運報表的權限。</div>;
  }

  const { data: monthly = [] } = useQuery({
    queryKey: ["v_monthly_receipts"],
    queryFn: async () => {
      const { data } = await supabase.from("v_monthly_receipts").select("*").order("month");
      return (data ?? []) as unknown as Monthly[];
    },
  });
  const { data: cashflow = [] } = useQuery({
    queryKey: ["v_cashflow_forecast"],
    queryFn: async () => {
      const { data } = await supabase.from("v_cashflow_forecast").select("*").order("month");
      return (data ?? []) as unknown as Cashflow[];
    },
  });
  const { data: ar = [] } = useQuery({
    queryKey: ["v_receivables_by_client"],
    queryFn: async () => {
      const { data } = await supabase.from("v_receivables_by_client").select("*");
      return ((data ?? []) as unknown as ARClient[])
        .slice().sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0));
    },
  });
  const { data: funnel = [] } = useQuery({
    queryKey: ["v_sales_funnel"],
    queryFn: async () => {
      const { data } = await supabase.from("v_sales_funnel").select("*");
      return (data ?? []) as unknown as Funnel[];
    },
  });
  const { data: cases = [] } = useQuery({
    queryKey: ["v_case_summary-reports"],
    queryFn: async () => {
      const { data } = await supabase.from("v_case_summary").select("id,status,amount");
      return (data ?? []) as unknown as CaseSum[];
    },
  });
  const { data: comm = [] } = useQuery({
    queryKey: ["v_commission_by_person"],
    queryFn: async () => {
      const { data } = await supabase.from("v_commission_by_person").select("*")
        .order("payout_period", { ascending: false });
      return (data ?? []) as unknown as Comm[];
    },
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments-kpi"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("status,amount,paid_date");
      return (data ?? []) as unknown as Payment[];
    },
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["v-project-tasks-kpi"],
    queryFn: async () => {
      const { data } = await supabase.from("v_project_tasks" as any).select("status,overdue");
      return (data ?? []) as unknown as Task[];
    },
  });

  const kpis = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const mtdReceived = payments
      .filter((p) => p.status === "已收" && p.paid_date?.startsWith(ym))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const outstanding = ar.reduce((s, r) => s + (Number(r.outstanding) || 0), 0);
    const activeProjects = cases.filter((c) => c.status === "進行中").length;
    const overdueTasks = tasks.filter((t) => t.overdue && t.status !== "完成").length;
    return { mtdReceived, outstanding, activeProjects, overdueTasks };
  }, [payments, ar, cases, tasks]);

  const casePie = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cases) { const k = c.status ?? "未定"; m[k] = (m[k] ?? 0) + 1; }
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [cases]);

  const exportCsv = () => {
    downloadCsv(`營運報表_${todayStamp()}.csv`,
      ["區塊", "欄1", "欄2", "欄3"],
      [
        ["近12月收款", "月份", "已收金額", ""],
        ...monthly.map((m) => ["", m.month, m.received ?? 0, ""] as (string | number)[]),
        ["未來現金流", "月份", "預估收入", "筆數"],
        ...cashflow.map((c) => ["", c.month, c.expected_in ?? 0, c.items ?? 0] as (string | number)[]),
        ["應收帳款(依客戶)", "客戶", "未收", "逾期"],
        ...ar.map((r) => ["", `${r.code ?? ""} ${r.name ?? ""}`, r.outstanding ?? 0, r.overdue_amount ?? 0] as (string | number)[]),
        ["業務漏斗", "狀態", "件數", "金額"],
        ...funnel.map((f) => ["", f.status, f.count ?? 0, f.amount ?? 0] as (string | number)[]),
      ]);
  };

  const fmt = (n: number | null | undefined) => (Number(n) || 0).toLocaleString();

  return (
    <div className="space-y-6 print:space-y-3">
      <PageHeader title="營運報表" description="整體營運數字與圖表彙整" actions={
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />列印</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </div>
      } />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="本月已收" value={fmt(kpis.mtdReceived)} />
        <Kpi title="未收應收總額" value={fmt(kpis.outstanding)} />
        <Kpi title="進行中專案" value={String(kpis.activeProjects)} />
        <Kpi title="逾期任務" value={String(kpis.overdueTasks)} tone={kpis.overdueTasks > 0 ? "warn" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="近 12 月收款">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="received" fill={COLORS[0]} name="已收" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="未來現金流預測">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cashflow}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="expected_in" fill={COLORS[1]} name="預估收入" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="應收帳款(依客戶)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ar.slice(0, 10)} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={12} width={80} />
              <Tooltip />
              <Bar dataKey="outstanding" fill={COLORS[3]} name="未收" />
              <Bar dataKey="overdue_amount" fill={COLORS[4]} name="逾期" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="業務漏斗">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" fontSize={12} />
              <YAxis yAxisId="l" fontSize={12} />
              <YAxis yAxisId="r" orientation="right" fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="l" dataKey="count" fill={COLORS[2]} name="件數" />
              <Bar yAxisId="r" dataKey="amount" fill={COLORS[0]} name="金額" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="專案狀態分佈">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={casePie} dataKey="value" nameKey="name" outerRadius={90} label>
                {casePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>業務獎金彙總</CardTitle>
            <div className="text-xs text-muted-foreground">敏感資料，僅本人與管理員可見</div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>業務</TableHead>
                  <TableHead>期別</TableHead>
                  <TableHead className="text-right">已實現</TableHead>
                  <TableHead className="text-right">待實現</TableHead>
                  <TableHead className="text-right">合計</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comm.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{c.payee_name ?? "—"}</TableCell>
                    <TableCell>{c.payout_period ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{fmt(c.realized_amount)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{fmt(c.pending_amount)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{fmt(c.total_amount)}</TableCell>
                  </TableRow>
                ))}
                {comm.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">無資料</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value, tone }: { title: string; value: string; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className={"text-2xl font-bold mt-1 " + (tone === "warn" ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
