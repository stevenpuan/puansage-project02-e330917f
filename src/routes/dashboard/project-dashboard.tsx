import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useRemeasureKey } from "@/lib/use-remeasure-key";

export const Route = createFileRoute("/dashboard/project-dashboard")({ component: Page });

interface TaskRow {
  id: string; status: string | null; overdue: boolean | null;
  assignee_name: string | null;
}
interface CaseRow {
  id: string | null; code: string | null; title: string | null; status: string | null;
  open_tasks: number | null; overdue: boolean | null;
  milestone_done: number | null; milestone_total: number | null; member_count: number | null;
}

const COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#94a3b8"];

function Page() {
  const rk = useRemeasureKey();
  const { data: tasks = [] } = useQuery({
    queryKey: ["v-project-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_project_tasks" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as TaskRow[];
    },
  });
  const { data: cases = [] } = useQuery({
    queryKey: ["v-case-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_case_summary").select("*").order("code");
      if (error) throw error;
      return (data ?? []) as unknown as CaseRow[];
    },
  });

  const kpis = useMemo(() => {
    const activeProjects = cases.filter((c) => c.status === "進行中").length;
    const openTasks = tasks.filter((t) => t.status !== "完成").length;
    const overdueTasks = tasks.filter((t) => t.overdue && t.status !== "完成").length;
    const totalM = cases.reduce((s, c) => s + (c.milestone_total ?? 0), 0);
    const doneM = cases.reduce((s, c) => s + (c.milestone_done ?? 0), 0);
    const msRate = totalM > 0 ? Math.round((doneM / totalM) * 100) : 0;
    return { activeProjects, openTasks, overdueTasks, msRate };
  }, [tasks, cases]);

  const statusPie = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) {
      const k = t.status ?? "未定";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const caseProgress = useMemo(() => cases.map((c) => ({
    code: c.code ?? "",
    open_tasks: c.open_tasks ?? 0,
    milestone_done: c.milestone_done ?? 0,
    milestone_total: c.milestone_total ?? 0,
  })), [cases]);

  const memberLoad = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status === "完成") continue;
      const k = t.assignee_name ?? "未指派";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [tasks]);

  return (
    <div className="space-y-6">
      <PageHeader title="進度儀表板" description="全專案任務、里程碑與成員負載" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="進行中專案" value={kpis.activeProjects} />
        <Kpi label="未完成任務" value={kpis.openTasks} />
        <Kpi label="逾期任務" value={kpis.overdueTasks} accent={kpis.overdueTasks > 0 ? "danger" : undefined} />
        <Kpi label="里程碑完成率" value={`${kpis.msRate}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>任務狀態分佈</CardTitle></CardHeader>
          <CardContent>
            {statusPie.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">尚無任務</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer key={rk} width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={90} label>
                      {statusPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>成員任務負載(未完成)</CardTitle></CardHeader>
          <CardContent>
            {memberLoad.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">尚無資料</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer key={rk} width="100%" height="100%">
                  <BarChart data={memberLoad}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>各專案任務進度</CardTitle></CardHeader>
        <CardContent>
          {caseProgress.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">尚無專案</div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer key={rk} width="100%" height="100%">
                <BarChart data={caseProgress}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="code" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="milestone_done" name="里程碑完成" fill="#3b82f6" />
                  <Bar dataKey="milestone_total" name="里程碑總數" fill="#94a3b8" />
                  <Bar dataKey="open_tasks" name="未完成任務" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>各專案進度</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代號</TableHead><TableHead>專案</TableHead>
                <TableHead>狀態</TableHead><TableHead>未完成</TableHead>
                <TableHead>里程碑</TableHead><TableHead>成員</TableHead>
                <TableHead>逾期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id ?? c.code} className={cn(c.overdue && "bg-red-50 dark:bg-red-950/30")}>
                  <TableCell className="font-mono text-xs">
                    {c.id ? (
                      <Link to="/dashboard/cases/$caseId" params={{ caseId: c.id }} className="text-primary underline">{c.code}</Link>
                    ) : c.code}
                  </TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell><Badge variant="outline">{c.status ?? "—"}</Badge></TableCell>
                  <TableCell>{c.open_tasks ?? 0}</TableCell>
                  <TableCell>{c.milestone_done ?? 0} / {c.milestone_total ?? 0}</TableCell>
                  <TableCell>{c.member_count ?? 0}</TableCell>
                  <TableCell>{c.overdue ? <Badge variant="destructive">逾期</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
              {cases.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">尚無專案</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("text-2xl font-semibold mt-1", accent === "danger" && "text-red-600")}>{value}</div>
      </CardContent>
    </Card>
  );
}
