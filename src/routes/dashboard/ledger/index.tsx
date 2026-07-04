import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/ledger/")({ component: LedgerHome });

interface MaintAlert {
  id: string; code: string | null; name: string | null; client_name: string | null;
  maintenance_due: string | null; days_left: number | null; maintenance_state: string | null;
}
interface PayAlert {
  id: string; system_code: string | null; system_name: string | null; billing_type: string | null;
  next_payment_date: string | null; days_left: number | null; payment_status: string | null;
}

function LedgerHome() {
  const { data: stats } = useQuery({
    queryKey: ["ledger-stats"],
    queryFn: async () => {
      const [total, active, maint, pay] = await Promise.all([
        supabase.from("systems").select("*", { count: "exact", head: true }),
        supabase.from("systems").select("*", { count: "exact", head: true }).eq("status", "維護中"),
        supabase.from("v_maintenance_alerts").select("*").lte("days_left", 30),
        supabase.from("v_payment_alerts").select("*").lte("days_left", 30),
      ]);
      return {
        total: total.count ?? 0,
        active: active.count ?? 0,
        maint: maint.data?.length ?? 0,
        pay: pay.data?.length ?? 0,
      };
    },
  });

  const { data: maintAlerts = [] } = useQuery({
    queryKey: ["maint-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_maintenance_alerts").select("*").order("days_left");
      if (error) throw error;
      return data as MaintAlert[];
    },
  });

  const { data: payAlerts = [] } = useQuery({
    queryKey: ["pay-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_payment_alerts").select("*").order("days_left");
      if (error) throw error;
      return data as PayAlert[];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="交付總覽" description="所有系統的維護到期與收款狀態一覽" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="系統總數" value={stats?.total} to="/dashboard/ledger/systems" />
        <Stat title="維護中" value={stats?.active} />
        <Stat title="30 天內維護到期" value={stats?.maint} warn={(stats?.maint ?? 0) > 0} />
        <Stat title="30 天內待收款" value={stats?.pay} warn={(stats?.pay ?? 0) > 0} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">維護到期提醒</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>系統</TableHead><TableHead>客戶</TableHead>
                <TableHead>維護到期日</TableHead><TableHead>剩餘天數</TableHead><TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintAlerts.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">目前沒有維護中的系統</TableCell></TableRow>
              )}
              {maintAlerts.map((r) => (
                <TableRow key={r.id} className={rowTint(r.days_left)}>
                  <TableCell className="font-medium">{r.code} · {r.name}</TableCell>
                  <TableCell>{r.client_name ?? "—"}</TableCell>
                  <TableCell>{r.maintenance_due}</TableCell>
                  <TableCell>{r.days_left} 天</TableCell>
                  <TableCell><Badge variant={stateVariant(r.maintenance_state)}>{r.maintenance_state}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">收款提醒</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>系統</TableHead><TableHead>收費模式</TableHead>
                <TableHead>下次收款日</TableHead><TableHead>剩餘天數</TableHead><TableHead>收款狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payAlerts.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">沒有待收款項</TableCell></TableRow>
              )}
              {payAlerts.map((r) => (
                <TableRow key={r.id} className={rowTint(r.days_left)}>
                  <TableCell className="font-medium">{r.system_code} · {r.system_name}</TableCell>
                  <TableCell>{r.billing_type ?? "—"}</TableCell>
                  <TableCell>{r.next_payment_date}</TableCell>
                  <TableCell>{r.days_left} 天</TableCell>
                  <TableCell><Badge variant="outline">{r.payment_status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
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

function Stat({ title, value, warn, to }: { title: string; value?: number; warn?: boolean; to?: string }) {
  const body = (
    <Card className={cn(warn && "border-amber-400")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent><div className={cn("text-3xl font-bold", warn && "text-amber-600")}>{value ?? "—"}</div></CardContent>
    </Card>
  );
  return to ? <Link to={to as any}>{body}</Link> : body;
}
