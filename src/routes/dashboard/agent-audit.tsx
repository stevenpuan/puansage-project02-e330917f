import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

export const Route = createFileRoute("/dashboard/agent-audit")({ component: Page });

interface AuditRow {
  id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
}

function parseAction(action: string): { op: string; agentId: string | null } {
  const m = action.match(/^agent_write:(create|update):(.+)$/);
  if (m) return { op: m[1], agentId: m[2] };
  return { op: action.replace(/^agent_write:?/, "") || "-", agentId: null };
}

function Page() {
  const { can } = useAuth();
  const canView = can("ai_agents", "view");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["agent_audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .like("action", "agent_write:%")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    enabled: canView,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["ai_agents_brief"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_agents").select("id,name");
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: canView,
  });
  const agentName = (id: string | null) =>
    agents.find((a) => a.id === id)?.name ?? (id ? id.slice(0, 8) : "—");

  const shown = useMemo(
    () => rows.filter((r) => agentFilter === "all" || parseAction(r.action).agentId === agentFilter),
    [rows, agentFilter],
  );

  const exportCsv = () => {
    const esc = (v: unknown) => {
      const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = ["時間", "agent", "op", "target_table", "target_id", "before", "after"];
    const lines = shown.map((r) => {
      const { op, agentId } = parseAction(r.action);
      return [
        new Date(r.created_at).toLocaleString(),
        agentName(agentId),
        op,
        r.target_table ?? "",
        r.target_id ?? "",
        r.before ?? "",
        r.after ?? "",
      ].map(esc).join(",");
    });
    const csv = "\uFEFF" + [header.map(esc).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) return <div className="p-6 text-muted-foreground">您沒有權限檢視此頁</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="代理稽核" description="AI Agent 透過通道的寫入紀錄（create / update，含前後值）" />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Agent</span>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" disabled={shown.length === 0} onClick={exportCsv}>
          <Download className="w-4 h-4" /> 匯出 CSV（{shown.length}）
        </Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>時間</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>目標表</TableHead>
              <TableHead>目標 ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">載入中…</TableCell></TableRow>
            )}
            {!isLoading && shown.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">尚無代理寫入紀錄</TableCell></TableRow>
            )}
            {shown.map((r) => {
              const { op, agentId } = parseAction(r.action);
              const isOpen = !!expanded[r.id];
              return (
                <Fragment key={r.id}>
                  <TableRow>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}>
                        {isOpen ? <ChevronDown /> : <ChevronRight />}
                      </Button>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>{agentName(agentId)}</TableCell>
                    <TableCell><Badge variant={op === "create" ? "default" : "secondary"}>{op}</Badge></TableCell>
                    <TableCell>{r.target_table ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.target_id ?? "—"}</TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <div className="grid grid-cols-2 gap-3 p-2">
                          <div>
                            <div className="text-xs font-medium mb-1">before</div>
                            <pre className="max-h-64 overflow-auto rounded bg-background p-2 text-[11px] whitespace-pre-wrap break-all">{r.before ? JSON.stringify(r.before, null, 2) : "—（新增）"}</pre>
                          </div>
                          <div>
                            <div className="text-xs font-medium mb-1">after</div>
                            <pre className="max-h-64 overflow-auto rounded bg-background p-2 text-[11px] whitespace-pre-wrap break-all">{r.after ? JSON.stringify(r.after, null, 2) : "—"}</pre>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
