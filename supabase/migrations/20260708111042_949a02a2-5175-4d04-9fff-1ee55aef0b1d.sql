ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS ai_agents_email_key ON public.ai_agents (lower(email)) WHERE email IS NOT NULL;