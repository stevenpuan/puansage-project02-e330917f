import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/calendar")({ component: Page });

interface CalRow {
  id: string; kind: string; ref_id: string; title: string;
  start_at: string; end_at: string | null; all_day: boolean;
  color: string | null; editable: boolean; owner_id: string | null; visibility: string;
}
interface EForm {
  id?: string; title: string; date: string; all_day: boolean;
  start_time: string; end_time: string; visibility: string; color: string; description: string;
}
const WD = ["日", "一", "二", "三", "四", "五", "六"];
const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Page() {
  const qc = useQueryClient();
  const [view, setView] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [filter, setFilter] = useState<"all" | "private" | "public">("all");
  const [form, setForm] = useState<EForm | null>(null);
  const [detail, setDetail] = useState<CalRow | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["calendar"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_calendar" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as CalRow[];
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["calendar"] });

  const byDay = useMemo(() => {
    const map: Record<string, CalRow[]> = {};
    for (const r of rows) {
      if (filter === "private" && !(r.kind === "event" && r.visibility === "private")) continue;
      if (filter === "public" && r.visibility !== "public") continue;
      const k = dateKey(new Date(r.start_at));
      (map[k] ??= []).push(r);
    }
    return map;
  }, [rows, filter]);

  const weeks = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const out: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d++) { const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d); row.push(dt); }
      out.push(row);
    }
    return out;
  }, [view]);

  const todayKey = dateKey(new Date());
  const move = (delta: number) => setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const goToday = () => { const n = new Date(); setView({ y: n.getFullYear(), m: n.getMonth() }); };

  const openNew = (d?: Date) => setForm({
    title: "", date: d ? dateKey(d) : todayKey, all_day: true,
    start_time: "09:00", end_time: "10:00", visibility: "private", color: COLORS[0], description: "",
  });
  const openEdit = (r: CalRow) => {
    const dt = new Date(r.start_at); const et = r.end_at ? new Date(r.end_at) : null;
    setForm({
      id: r.ref_id, title: r.title, date: dateKey(dt), all_day: r.all_day,
      start_time: `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`,
      end_time: et ? `${String(et.getHours()).padStart(2, "0")}:${String(et.getMinutes()).padStart(2, "0")}` : "",
      visibility: r.visibility, color: r.color ?? COLORS[0], description: "",
    });
    setDetail(null);
  };

  const save = async () => {
    if (!form?.title) { toast.error("請填寫標題"); return; }
    const start = form.all_day ? new Date(`${form.date}T00:00:00`) : new Date(`${form.date}T${form.start_time || "00:00"}:00`);
    const end = form.all_day ? null : (form.end_time ? new Date(`${form.date}T${form.end_time}:00`) : null);
    const payload: any = {
      title: form.title, start_at: start.toISOString(), end_at: end ? end.toISOString() : null,
      all_day: form.all_day, visibility: form.visibility, color: form.color,
      description: form.description || null,
    };
    const { error } = form.id
      ? await supabase.from("calendar_events" as any).update(payload).eq("id", form.id)
      : await supabase.from("calendar_events" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "已更新" : "已新增"); setForm(null); reload();
  };
  const del = async () => {
    if (!form?.id) return;
    if (!confirm("刪除此事件？")) return;
    const { error } = await supabase.from("calendar_events" as any).delete().eq("id", form.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已刪除"); setForm(null); reload();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="行事曆" description="個人與公用事件；自動帶入案件／收款／維護到期（唯讀）"
        actions={<Button onClick={() => openNew()}>＋ 新增事件</Button>} />

      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => move(-1)}>‹</Button>
            <Button size="sm" variant="outline" onClick={goToday}>今天</Button>
            <Button size="sm" variant="outline" onClick={() => move(1)}>›</Button>
          </div>
          <div className="text-lg font-semibold">{view.y} 年 {view.m + 1} 月</div>
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">顯示</Label>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="private">個人</SelectItem>
                <SelectItem value="public">公用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b pb-1">
            {WD.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {weeks.flat().map((d, i) => {
              const inMonth = d.getMonth() === view.m;
              const k = dateKey(d);
              const evs = byDay[k] ?? [];
              const isToday = k === todayKey;
              return (
                <div key={i} onClick={() => openNew(d)}
                  className={cn("min-h-[92px] border-b border-r p-1 cursor-pointer hover:bg-muted/40",
                    i % 7 === 0 && "border-l", !inMonth && "bg-muted/20 text-muted-foreground")}>
                  <div className={cn("text-xs mb-0.5 w-5 h-5 flex items-center justify-center rounded-full",
                    isToday && "bg-primary text-primary-foreground font-semibold")}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map((r) => (
                      <div key={r.id}
                        onClick={(e) => { e.stopPropagation(); r.editable ? openEdit(r) : setDetail(r); }}
                        className="text-[11px] leading-tight truncate rounded px-1 text-white cursor-pointer"
                        style={{ backgroundColor: r.color ?? "#6366f1" }}
                        title={r.title}>
                        {r.title}
                      </div>
                    ))}
                    {evs.length > 3 && <div className="text-[10px] text-muted-foreground px-1">還有 {evs.length - 3} 件…</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 唯讀事件詳情 */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>日期：{detail ? dateKey(new Date(detail.start_at)) : ""}</div>
            <div>類型：{detail?.kind === "case" ? "案件到期" : detail?.kind === "payment" ? "收款到期" : detail?.kind === "maintenance" ? "維護到期" : "事件"}（自動帶入，唯讀）</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDetail(null)}>關閉</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增/編輯事件 */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "編輯事件" : "新增事件"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>標題</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>日期</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div className="space-y-1"><Label>可見範圍</Label>
                  <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="private">個人</SelectItem><SelectItem value="public">公用</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.all_day} onChange={(e) => setForm({ ...form, all_day: e.target.checked })} /> 整天
              </label>
              {!form.all_day && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>開始</Label>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                  <div className="space-y-1"><Label>結束</Label>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>
              )}
              <div className="space-y-1"><Label>顏色</Label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={cn("w-6 h-6 rounded-full border-2", form.color === c ? "border-foreground" : "border-transparent")}
                      style={{ backgroundColor: c }} />
                  ))}
                </div></div>
              <div className="space-y-1"><Label>說明</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter className="justify-between">
            {form?.id ? <Button variant="outline" onClick={del}>刪除</Button> : <span />}
            <Button onClick={save}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
