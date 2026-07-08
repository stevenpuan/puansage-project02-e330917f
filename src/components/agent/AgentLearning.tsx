// src/components/agent/AgentLearning.tsx
// Agent 學習資源：每個 agent 的操作手冊 / 學習包連結 + 已指派知識篇數，集中一頁
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Loader2, GraduationCap, Copy, ExternalLink, BookOpen } from "lucide-react";
import { toast } from "sonner";

const FN = "https://oxtozbvbyjwokwisrghm.supabase.co/functions/v1";
const MANUAL_URL = `${FN}/agent-manual`;
const PACK_URL = `${FN}/agent-api?action=pack`;
// 手冊涵蓋的系統（供 agent 學習）
const SYSTEMS = "me,knowledge,project,task,opportunity,service_ticket,contract,client,quote,payment,invoice,commission";

type Agent = { id: string; name: string; status: string };

export default function AgentLearning() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [knCount, setKnCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: ag }, { data: kn }] = await Promise.all([
        supabase.from("ai_agents").select("id, name, status").order("created_at"),
        supabase.from("ai_agent_knowledge").select("agent_id"),
      ]);
      const counts: Record<string, number> = {};
      for (const r of (kn ?? []) as { agent_id: string }[]) {
        counts[r.agent_id] = (counts[r.agent_id] ?? 0) + 1;
      }
      setKnCount(counts);
      setAgents((ag as Agent[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const manualFull = useMemo(() => `${MANUAL_URL}?systems=${SYSTEMS}`, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`已複製${label}`),
      () => toast.error("複製失敗，請手動選取")
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <GraduationCap className="h-5 w-5" /> Agent 學習資源
        </h1>
        <p className="text-sm text-muted-foreground">
          把學習網址交給你的 AI Agent，它就能理解可用的資源、權限與 JSON 格式。
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">通用操作手冊（所有 Agent 共用）</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">操作手冊（agent-manual）</div>
              <code className="block truncate text-xs text-muted-foreground">{manualFull}</code>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(manualFull, "手冊網址")}>
                <Copy className="mr-1 h-3.5 w-3.5" /> 複製
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a href={manualFull} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            含名稱對照表（專案=project、任務=task…）、權限三級（讀取/新增/修改）與各資源 JSON 範例。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">各 Agent 專屬學習包</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 載入中…
            </div>
          ) : agents.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">尚無 Agent</p>
          ) : (
            agents.map((a) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium">{a.name}</span>
                  <Badge variant="secondary">{a.status}</Badge>
                  <Badge variant="outline" className="ml-auto">
                    <BookOpen className="mr-1 h-3 w-3" /> 知識 {knCount[a.id] ?? 0} 篇
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <code className="block truncate text-xs text-muted-foreground">{PACK_URL}</code>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => copy(PACK_URL, "學習包網址")}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> 複製學習包網址
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  學習包需帶該 Agent 的 Token（Authorization: Bearer psk_…）呼叫，回傳身分、權限、知識庫。
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
