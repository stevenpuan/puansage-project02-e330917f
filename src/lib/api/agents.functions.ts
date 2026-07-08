import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateAgentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  code: z.string().min(1),
  role_id: z.string().uuid().nullable().optional(),
  description: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  system_prompt: z.string().optional().nullable(),
  persona: z.record(z.unknown()).optional().nullable(),
});

export const createAgentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateAgentSchema.parse(d))
  .handler(async ({ data, context }) => {
    // 只有 admin 可以建立
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("permission denied");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 建立 auth user (kind=agent) — 觸發器會建立 profile
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, kind: "agent" },
    });
    if (createErr || !created?.user) throw new Error(createErr?.message ?? "建立帳號失敗");
    const uid = created.user.id;

    // 建立 ai_agents 記錄
    const { data: agent, error: agentErr } = await supabaseAdmin
      .from("ai_agents")
      .insert({
        code: data.code,
        name: data.full_name,
        email: data.email,
        user_id: uid,
        role_id: data.role_id ?? null,
        description: data.description ?? null,
        model: data.model ?? "google/gemini-2.5-flash",
        system_prompt: data.system_prompt ?? null,
        persona: (data.persona ?? {}) as never,
        status: "active",
      })
      .select("id")
      .single();
    if (agentErr || !agent) {
      // 回滾:刪掉剛建的 auth user
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(agentErr?.message ?? "建立 Agent 記錄失敗");
    }

    // 指派角色
    if (data.role_id) {
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role_id: data.role_id });
    }

    return { agent_id: agent.id, user_id: uid };
  });

export const deleteAgentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ agent_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("permission denied");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin.from("ai_agents").select("user_id").eq("id", data.agent_id).maybeSingle();
    await supabaseAdmin.from("ai_agents").delete().eq("id", data.agent_id);
    if (a?.user_id) await supabaseAdmin.auth.admin.deleteUser(a.user_id);
    return { ok: true };
  });
