// src/components/finance/MonthlyPnl.tsx
// 月度損益：收入 vs 支出 vs 淨額（讀 v_monthly_pnl）
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Loader2, TrendingUp } from "lucide-react";

type Row = { month: string; income: number; expense: number; net: number };
const money = (n: number) => "NT$ " + Math.round(n ?? 0).toLocaleString();

export default function MonthlyPnl() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("v_monthly_pnl").select("*").order("month");
      setRows(((data as Row[]) ?? []).map((r) => ({
        month: r.month, income: Number(r.income || 0), expense: Number(r.expense || 0), net: Number(r.net || 0),
      })));
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => rows.reduce(
    (a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense, net: a.net + r.net }),
    { income: 0, expense: 0, net: 0 }
  ), [rows]);
  const maxBar = useMemo(() => Math.max(1, ...rows.map((r) => Math.max(r.income, r.expense))), [rows]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><TrendingUp className="h-5 w-5" /> 月度損益</h1>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">總收入</div><div className="text-lg font-semibold text-emerald-600">{money(totals.income)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">總支出</div><div className="text-lg font-semibold text-red-600">{money(totals.expense)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">淨額</div><div className={"text-lg font-semibold " + (totals.net >= 0 ? "text-blue-600" : "text-red-600")}>{money(totals.net)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">逐月明細</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 載入中…</div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">尚無資料（需有已收款項或費用支出）。</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>月份</TableHead><TableHead>收支對比</TableHead>
                <TableHead className="text-right">收入</TableHead><TableHead className="text-right">支出</TableHead><TableHead className="text-right">淨額</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell className="w-[220px]">
                      <div className="space-y-1">
                        <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.max(2, (r.income / maxBar) * 100)}%` }} />
                        <div className="h-2 rounded bg-red-400" style={{ width: `${Math.max(2, (r.expense / maxBar) * 100)}%` }} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-emerald-600">{money(r.income)}</TableCell>
                    <TableCell className="text-right text-red-600">{money(r.expense)}</TableCell>
                    <TableCell className={"text-right font-medium " + (r.net >= 0 ? "text-blue-600" : "text-red-600")}>{money(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">收入 = 已收款項（payments）；支出 = 費用支出（未駁回）。綠=收入、紅=支出。</p>
        </CardContent>
      </Card>
    </div>
  );
}
