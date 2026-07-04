import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#ec4899"];

export const Route = createFileRoute("/dashboard/")({ component: DashboardHome });

interface MaintAlert {
  id: string; code: string | null; name: string | null; client_name: string | null;
  maintenance_due: string | null; days_left: number | null; maintenance_state: string | null;
}
interface OpenTaskRow {
  id: string; title: string; status: string | null; priority: string | null;
  due_date: string | null; assignee_id: string | null; days_left: number | null;
  case_code: string | null; case_title: string | null; client_name: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function DashboardHome() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-kpis", user?.id],
    queryFn: async () => {
      const [systems, cases, tasks, maint, pay] = await Promise.all([
        supabase.from("systems").select("*", { count: "exact", head: true }),
        supabase.from("cases").select("*", { count: "exact", head: true }).not("status", "in", "(已結案,取消)"),
        supabase.from("case_tasks").select("*", { count: "exact", head: true }).eq("assignee_id", user!.id).neq("status", "完成"),
        supabase.from("v_maintenance_alerts").select("*").lte("days_left", 30),
        supabase.from("v_payment_alerts").select("*").lte("days_left", 30),
      ]);
      return {
        systems: systems.count ?? 0,
        cases: cases.count ?? 0,
        tasks: tasks.count ?? 0,
        alerts: (maint.data?.length ?? 0) + (pay.data?.length ?? 0),
      };
    },
    enabled: !!user?.id,
  });

  const { data: maintAlerts = [] } = useQuery({
    queryKey: ["dashboard-maint-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_maintenance_alerts").select("*").order("days_left").limit(5);
      if (error) throw error;
      return data as unknown as MaintAlert[];
    },
  });

  const { data: myTasks = [] } = useQuery({
    queryKey: ["dashboard-my-tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_open_tasks")
        .select("*")
        .eq("assignee_id", user!.id)
        .order("due_date", { nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return data as unknown as OpenTaskRow[];
    },
    enabled: !!user?.id,
  });

  const { data: monthly = [] } = useQuery({
    queryKey: ["dashboard-monthly-receipts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_monthly_receipts").select("*").order("month");
      if (error) throw error;
      return (data ?? []) as { month: string; received: number }[];
    },
  });

  const { data: caseStatus = [] } = useQuery({
    queryKey: ["dashboard-case-status"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_case_summary").select("status");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as { status: string | null }[]) {
        const k = r.status ?? "未設定";
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return Array.from(map, ([status, count]) => ({ status, count }));
    },
  });

  const doneTask = async (task: OpenTaskRow) => {
    const { error } = await supabase
      .from("case_tasks")
      .update({ status: "完成", done_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已標記完成");
    qc.invalidateQueries({ queryKey: ["dashboard-kpis", user?.id] });
    qc.invalidateQueries({ queryKey: ["dashboard-my-tasks", user?.id] });
    qc.invalidateQueries({ queryKey: ["open-tasks"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          歡迎回來，{profile?.full_name ?? profile?.email}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          這裡是你今天的業務儀表板
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="系統總數" value={stats?.systems} to="/dashboard/ledger/systems" />
        <KpiCard title="進行中案件" value={stats?.cases} to="/dashboard/cases" />
        <KpiCard title="我的未完成待辦" value={stats?.tasks} to="/dashboard/tasks" />
        <KpiCard title="30 天內到期" value={stats?.alerts} to="/dashboard/ledger" warn={(stats?.alerts ?? 0) > 0} />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">近 12 個月收款</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => Number(v).toLocaleString("zh-TW")} />
                  <Tooltip formatter={(v: number) => `NT$ ${Number(v).toLocaleString("zh-TW")}`} />
                  <Bar dataKey="received" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">專案狀態分佈</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={caseStatus} dataKey="count" nameKey="status" outerRadius={90} label>
                    {caseStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            <Link to="/dashboard/ledger" className="hover:underline">即將到期的維護</Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>系統</TableHead>
                <TableHead>客戶</TableHead>
                <TableHead>維護到期日</TableHead>
                <TableHead>剩餘天數</TableHead>
                <TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintAlerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">目前沒有即將到期的維護</TableCell>
                </TableRow>
              )}
              {maintAlerts.map((r) => (
                <TableRow key={r.id} className={rowTint(r.days_left)}>
                  <TableCell className="font-medium">{r.code} · {r.name}</TableCell>
                  <TableCell>{r.client_name ?? "—"}</TableCell>
                  <TableCell>{r.maintenance_due}</TableCell>
                  <TableCell>{r.days_left} 天</TableCell>
                  <TableCell>
                    <Badge variant={stateVariant(r.maintenance_state)}>{r.maintenance_state}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            <Link to="/dashboard/tasks" className="hover:underline">我的待辦</Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>案件</TableHead>
                <TableHead>客戶</TableHead>
                <TableHead>待辦</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>優先</TableHead>
                <TableHead>到期日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">目前沒有待辦</TableCell>
                </TableRow>
              )}
              {myTasks.map((t) => {
                const overdue = !!t.due_date && t.due_date < todayStr();
                return (
                  <TableRow key={t.id} className={cn(overdue && "bg-red-50 dark:bg-red-950/30")}>
                    <TableCell>
                      <Checkbox onCheckedChange={(v) => v && doneTask(t)} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{t.case_code ?? "—"}</span>
                      <span className="ml-2">{t.case_title ?? ""}</span>
                    </TableCell>
                    <TableCell>{t.client_name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell><Badge variant="outline">{t.status ?? "—"}</Badge></TableCell>
                    <TableCell>{t.priority ?? "—"}</TableCell>
                    <TableCell className={cn(overdue && "text-red-600 font-medium")}>{t.due_date ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value, to, warn }: { title: string; value?: number; to?: string; warn?: boolean }) {
  const body = (
    <Card className={cn(warn && "border-amber-400")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold", warn && "text-amber-600")}>{value ?? "—"}</div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to as any}>{body}</Link> : body;
}

function rowTint(days: number | null) {
  if (days === null) return "";
  if (days < 0) return "bg-red-50 dark:bg-red-950/30";
  if (days <= 30) return "bg-amber-50 dark:bg-amber-950/30";
  return "";
}

function stateVariant(s: string | null): "default" | "destructive" | "secondary" {
  if (s === "已過期") return "destructive";
  if (s === "即將到期") return "secondary";
  return "default";
}
