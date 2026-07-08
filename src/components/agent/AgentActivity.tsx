// src/components/agent/AgentActivity.tsx
// AI Agent 活動紀錄頁（讀 v_agent_activity，TanStack Start，相對路徑匯入）
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Loader2, Activity, Eye } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  op: "create" | "update" | string;
  agent_id: string | null;
  agent_name: string | null;
  resource: string;
  target_id: string;
  title: string | null;
  before: unknown;
  after: unknown;
};

const opColor: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
};

export default function AgentActivity() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("v_agent_activity").select("*").limit(200);
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const agents = useMemo(
    () => Array.from(new Set(rows.map((r) => r.agent_name).filter(Boolean))) as string[],
    [rows]
  );
  const resources = useMemo(
    () => Array.from(new Set(rows.map((r) => r.resource))),
    [rows]
  );

  const filtered = useMemo(
    () => rows.filter((r) =>
      (agentFilter === "all" || r.agent_name === agentFilter) &&
      (resourceFilter === "all" || r.resource === resourceFilter)
    ),
    [rows, agentFilter, resourceFilter]
  );

  const fmt = (t: string) => new Date(t).toLocaleString("zh-TW", { hour12: false });

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Activity className="h-5 w-5" /> AI Agent 活動紀錄
        </h1>
        <div className="flex gap-2">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Agent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部 Agent</SelectItem>
              {agents.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={resourceFilter} onValueChange={setResourceFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="資源" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部資源</SelectItem>
              {resources.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">共 {filtered.length} 筆</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 載入中…
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">尚無紀錄</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>時間</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>動作</TableHead>
                  <TableHead>資源</TableHead>
                  <TableHead>標題</TableHead>
                  <TableHead className="text-right">明細</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{fmt(r.created_at)}</TableCell>
                    <TableCell>{r.agent_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={opColor[r.op] ?? ""} variant="secondary">{r.op}</Badge>
                    </TableCell>
                    <TableCell><code className="text-xs">{r.resource}</code></TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.title ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{r.op} · {r.resource}</DialogTitle>
                          </DialogHeader>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="mb-1 font-medium text-muted-foreground">Before</div>
                              <pre className="max-h-80 overflow-auto rounded bg-muted p-3">{JSON.stringify(r.before, null, 2)}</pre>
                            </div>
                            <div>
                              <div className="mb-1 font-medium text-muted-foreground">After</div>
                              <pre className="max-h-80 overflow-auto rounded bg-muted p-3">{JSON.stringify(r.after, null, 2)}</pre>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
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
