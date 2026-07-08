// src/components/accounts/AccountsList.tsx
// 帳號總覽：人員 + AI 代理 同一視圖，可依類型篩選
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { Loader2, Users } from "lucide-react";

type Account = {
  id: string;
  account_type: "human" | "agent" | string;
  name: string | null;
  email: string | null;
  status: string | null;
  agent_id: string | null;
  agent_status: string | null;
  created_at: string;
};

const typeLabel: Record<string, string> = { human: "人員", agent: "AI 代理" };
const typeColor: Record<string, string> = {
  human: "bg-slate-100 text-slate-700",
  agent: "bg-violet-100 text-violet-700",
};

export default function AccountsList() {
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("v_accounts").select("*").order("account_type").order("name");
      setRows((data as Account[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const counts = useMemo(() => {
    const c = { human: 0, agent: 0 };
    for (const r of rows) {
      if (r.account_type === "human") c.human++;
      else if (r.account_type === "agent") c.agent++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => rows.filter((r) =>
      (typeFilter === "all" || r.account_type === typeFilter) &&
      (q === "" ||
        (r.name ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (r.email ?? "").toLowerCase().includes(q.toLowerCase()))
    ),
    [rows, typeFilter, q]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Users className="h-5 w-5" /> 帳號總覽
        </h1>
        <div className="flex gap-2">
          <Input placeholder="搜尋名稱 / Email" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="類型" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部類型</SelectItem>
              <SelectItem value="human">人員（{counts.human}）</SelectItem>
              <SelectItem value="agent">AI 代理（{counts.agent}）</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">
          共 {filtered.length} 筆（人員 {counts.human}、AI 代理 {counts.agent}）
        </CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 載入中…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名稱</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={typeColor[r.account_type] ?? ""} variant="secondary">
                        {typeLabel[r.account_type] ?? r.account_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.email ?? "—"}</TableCell>
                    <TableCell><span className="text-sm">{r.agent_status ?? r.status ?? "—"}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
