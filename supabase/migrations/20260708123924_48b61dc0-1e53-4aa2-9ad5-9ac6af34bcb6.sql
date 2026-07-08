
-- 1. profiles.kind
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'human';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_kind_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_kind_check CHECK (kind IN ('human','agent'));
  END IF;
END $$;

-- 2. ai_agents.user_id 對應 auth.users
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ai_agents_user_id_key ON public.ai_agents(user_id) WHERE user_id IS NOT NULL;

-- 3. handle_new_user 支援 kind='agent'
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_kind text;
  v_first boolean;
  v_admin uuid;
begin
  v_kind := coalesce(new.raw_user_meta_data->>'kind', 'human');
  if v_kind = 'agent' then
    insert into public.profiles (id, email, full_name, status, kind)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'active', 'agent');
    return new;
  end if;

  v_first := (select count(*) from public.profiles where kind = 'human') = 0;
  insert into public.profiles (id, email, full_name, status, kind)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name',
          case when v_first then 'active' else 'pending' end, 'human');
  if v_first then
    select id into v_admin from public.roles where code = 'admin' limit 1;
    if v_admin is not null then
      insert into public.user_roles (user_id, role_id) values (new.id, v_admin) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$function$;

-- 4. 綁定 Agent 到 auth user 並指派角色
CREATE OR REPLACE FUNCTION public.link_agent_profile(p_agent uuid, p_user uuid, p_role uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'permission denied'; end if;
  update public.ai_agents set user_id = p_user, role_id = coalesce(p_role, role_id) where id = p_agent;
  update public.profiles set kind = 'agent', status = 'active' where id = p_user;
  if p_role is not null then
    delete from public.user_roles where user_id = p_user;
    insert into public.user_roles(user_id, role_id) values (p_user, p_role) on conflict do nothing;
  end if;
end $function$;

GRANT EXECUTE ON FUNCTION public.link_agent_profile(uuid,uuid,uuid) TO authenticated;
