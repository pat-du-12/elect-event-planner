ALTER TABLE public.elus ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS elus_user_id_key ON public.elus (user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.current_elu_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.elus WHERE user_id = auth.uid() LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_elu_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_elu_id() TO authenticated;

DROP POLICY IF EXISTS "Elus read own profile" ON public.elus;
CREATE POLICY "Elus read own profile" ON public.elus
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Elus read own invitations" ON public.invitations;
CREATE POLICY "Elus read own invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (elu_id = public.current_elu_id());

DROP POLICY IF EXISTS "Elus respond to own invitations" ON public.invitations;
CREATE POLICY "Elus respond to own invitations" ON public.invitations
  FOR UPDATE TO authenticated
  USING (elu_id = public.current_elu_id())
  WITH CHECK (elu_id = public.current_elu_id());

DROP POLICY IF EXISTS "Elus read invited events" ON public.events;
CREATE POLICY "Elus read invited events" ON public.events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.event_id = events.id AND i.elu_id = public.current_elu_id()
  ));