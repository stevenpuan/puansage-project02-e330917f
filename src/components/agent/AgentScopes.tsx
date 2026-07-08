// src/components/agent/AgentScopes.tsx
// AI Agent 角色 Scope 勾選頁（TanStack Start，相對路徑匯入）
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { Loader2, ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";

const AGENT_ROLE_CODE = "agent";

type Scope = {
  scope: string;
  category: string;
  description: string;
  sensitivity: "low" | "medium" | "high";
  sort_order: number;
};

const sensitivityColor: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export default function AgentScopes() {
  const [roleId, setRoleId] = useState<string | null>(null);
  const [allScopes, setAllScopes] = useState<Scope[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingHigh, setPendingHigh] = useState<Scope | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: role }, { data: scopes }] = await Promise.all([
        supabase.from("roles").select("id").eq("code", AGENT_ROLE_CODE).single(),
        supabase.from("agent_scopes")
          .select("scope, category, description, sensitivity, sort_order")
          .order("sort_order", { ascending: true }),
      ]);
      if (role?.id) {
        setRoleId(role.id);
        const { data: ras } = await supabase
          .from("role_agent_scopes").select("scope").eq("role_id", role.id);
        const cur = new Set((ras ?? []).map((r: { scope: string }) => r.scope));
        setSelected(new Set(cur));
        setInitial(new Set(cur));
      }
      setAllScopes((scopes as Scope[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, Scope[]> = {};
    for (const s of allScopes) (g[s.category] ??= []).push(s);
    return g;
  }, [allScopes]);

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const s of selected) if (!initial.has(s)) return true;
    return false;
  }, [selected, initial]);

  const applyToggle = (scope: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(scope); else next.delete(scope);
      return next;
    });
  };

  const onToggle = (s: Scope, on: boolean) => {
    if (on && s.sensitivity === "high") { setPendingHigh(s); return; }
    applyToggle(s.scope, on);
  };

  const save = async () => {
    if (!roleId) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_role_scopes", {
      p_role: roleId,
      p_scopes: Array.from(selected),
    });
    setSaving(false);
    if (error) { toast.error("儲存失敗：" + error.message); return; }
    setInitial(new Set(selected));
    toast.success("已更新 AI Agent 角色權限");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 載入中…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5" /> AI Agent 權限
          </h1>
          <p className="text-sm text-muted-foreground">
            勾選此角色允許的 scope。Agent 實際權限 = token ∩ 此處設定。
          </p>
        </div>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          儲存
        </Button>
      </div>

      {Object.entries(grouped).map(([category, scopes]) => (
        <Card key={category}>
          <CardHeader><CardTitle className="text-base">{category}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {scopes.map((s) => (
              <div key={s.scope} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-medium">{s.scope}</code>
                    <Badge className={sensitivityColor[s.sensitivity]} variant="secondary">
                      {s.sensitivity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </div>
                <Switch
                  checked={selected.has(s.scope)}
                  onCheckedChange={(on) => onToggle(s, on)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!pendingHigh} onOpenChange={(o) => !o && setPendingHigh(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>開啟高敏感權限？</AlertDialogTitle>
            <AlertDialogDescription>
              <code>{pendingHigh?.scope}</code> 屬於高敏感（{pendingHigh?.description}）。
              確定要讓 AI Agent 角色取得此權限嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingHigh) applyToggle(pendingHigh.scope, true);
              setPendingHigh(null);
            }}>確定開啟</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
