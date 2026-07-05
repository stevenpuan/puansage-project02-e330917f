import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, User, Bot } from "lucide-react";

export const Route = createFileRoute("/dashboard/members")({ component: Page });

interface Member {
  id: string;
  name: string;
  kind: "human" | "agent";
  subtitle: string;   // 角色 or 模型
  status: string | null;
  created_at: string | null;
}

function Page() {
  const { can } = useAuth();
  const canView = can("users", "view") || can("ai_agents", "view");
  const [tab, setTab] = useState<"all" | "human" | "agent">("all");
  const [q, setQ] = useState("");

  const { data: humans = [] } = useQuery({
    queryKey: ["members_humans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, status, created_at, user_roles(roles(name))")
        .order("created_at", { ascending: false });
      return (data ?? []).map((p: Record<string, unknown>): Member => ({
        id: p.id as string,
        name: (p.full_name as string) || (p.email as string) || "—",
        kind: "human",
        subtitle: ((p.user_roles as Array<{ roles?: { name?: string } }> ?? [])
          .map((x) => x.roles?.name).filter(Boolean).join("、")) || "未指定角色",
        status: p.status as string,
        created_at: p.created_at as string,
      }));
    },
    enabled: canView,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["members_agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_agents")
        .select("id, name, model, status, created_at")
        .order("created_at", { ascending: false });
      return (data ?? []).map((a: Record<string, unknown>): Member => ({
        id: a.id as string,
        name: a.name as string,
        kind: "agent",
        subtitle: (a.model as string) || "AI Agent",
        status: a.status as string,
        created_at: a.created_at as string,
      }));
    },
    enabled: canView,
  });

  const all = useMemo(() => [...humans, ...agents], [humans, agents]);
  const shown = all.filter((m) => {
    if (tab !== "all" && m.kind !== tab) return false;
    if (q && !`${m.name} ${m.subtitle}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (!canView) return <div className="p-6 text-muted-foreground">您沒有權限檢視此頁</div>;

  const TabBtn = ({ v, label, count, icon: Icon }: { v: typeof tab; label: string; count: number; icon: typeof User }) => (
    <button onClick={() => setTab(v)}
      className={["inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        tab === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"].join(" ")}>
      <Icon className="w-4 h-4" /> {label} <span className="text-muted-foreground">{count}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="成員列表" description="人類成員與 AI Agent 一覽"
        actions={<Button asChild><Link to="/dashboard/ai-agents">新增 Agent</Link></Button>} />

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="搜尋名稱 / 角色 / 模型" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <TabBtn v="all" label="全部" count={all.length} icon={Users} />
        <TabBtn v="human" label="人類" count={humans.length} icon={User} />
        <TabBtn v="agent" label="Agent" count={agents.length} icon={Bot} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((m) => (
          <Card key={`${m.kind}-${m.id}`}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={["w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                m.kind === "agent" ? "bg-primary/15 text-primary" : "bg-muted"].join(" ")}>
                {m.kind === "agent" ? <Bot className="w-5 h-5" /> : (m.name?.[0] ?? "?")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{m.name}</div>
                  <Badge variant={m.kind === "agent" ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {m.kind === "agent" ? "Agent" : "人類"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.subtitle}</div>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{m.status ?? "—"}</Badge>
                  {m.created_at && <span>加入 {new Date(m.created_at).toLocaleDateString()}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {shown.length === 0 && <div className="text-center text-muted-foreground py-10 col-span-full">沒有符合的成員</div>}
      </div>
    </div>
  );
}
