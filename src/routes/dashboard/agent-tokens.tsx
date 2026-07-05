import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/agent-tokens")({ component: Page });

interface TokenRow {
  id: string;
  name: string | null;
  token_prefix: string | null;
  scopes: string[] | null;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
  agent_id: string | null;
  ai_agents?: { name: string | null } | null;
}

type Status = "revoked" | "expired" | "active";
function statusOf(t: TokenRow): Status {
  if (t.revoked_at) return "revoked";
  if (t.expires_at && new Date(t.expires_at) <= new Date()) return "expired";
  return "active";
}
const STATUS_LABEL: Record<Status, string> = { revoked: "已撤銷", expired: "已到期", active: "有效" };

function Page() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canView = can("ai_agents", "view");
  const canEdit = can("ai_agents", "edit");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["all_agent_tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agent_tokens")
        .select("id,name,token_prefix,scopes,expires_at,last_used_at,revoked_at,created_at,agent_id,ai_agents(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TokenRow[];
    },
    enabled: canView,
  });

  const revoke = async (t: TokenRow) => {
    if (!confirm(`撤銷 Token「${t.name || t.token_prefix}」？`)) return;
    const { error } = await supabase.from("ai_agent_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已撤銷");
    qc.invalidateQueries({ queryKey: ["all_agent_tokens"] });
  };

  if (!canView) return <div className="p-6 text-muted-foreground">您沒有權限檢視此頁</div>;

  const activeCount = rows.filter((t) => statusOf(t) === "active").length;
  const revokedCount = rows.filter((t) => statusOf(t) === "revoked").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Token 管理" description="所有 AI Agent 的 API Token：Scope、到期、狀態與撤銷" />

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">有效 Token</div><div className="text-2xl font-bold text-primary">{activeCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">已撤銷</div><div className="text-2xl font-bold">{revokedCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">總數</div><div className="text-2xl font-bold">{rows.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>名稱 / 前綴</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>到期</TableHead>
                <TableHead>最後使用</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">載入中…</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">尚無 Token</TableCell></TableRow>}
              {rows.map((t) => {
                const st = statusOf(t);
                const scopes = Array.isArray(t.scopes) ? t.scopes : [];
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.ai_agents?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{t.name || "-"}</div>
                      <code className="text-[11px] text-muted-foreground">{t.token_prefix}…</code>
                    </TableCell>
                    <TableCell>
                      <span title={scopes.join(", ")} className="text-xs">
                        {scopes.length} 個{scopes.length > 0 ? `：${scopes.slice(0, 3).join(", ")}${scopes.length > 3 ? "…" : ""}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{t.expires_at ? new Date(t.expires_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "—"}</TableCell>
                    <TableCell><Badge variant={st === "active" ? "default" : st === "revoked" ? "destructive" : "secondary"}>{STATUS_LABEL[st]}</Badge></TableCell>
                    <TableCell className="text-right">
                      {canEdit && st !== "revoked" && <Button size="sm" variant="outline" className="text-destructive" onClick={() => revoke(t)}>撤銷</Button>}
                    </TableCell>
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
