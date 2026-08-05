CREATE OR REPLACE FUNCTION public.public_calendar()
RETURNS TABLE (
  id uuid,
  title text,
  location text,
  starts_at timestamptz,
  mayor_present boolean,
  participants jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.location, e.starts_at, e.mayor_present,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('name', el.full_name, 'status', i.status)
        ORDER BY el.full_name
      ) FILTER (WHERE el.id IS NOT NULL),
      '[]'::jsonb
    ) AS participants
  FROM public.events e
  LEFT JOIN public.invitations i ON i.event_id = e.id
  LEFT JOIN public.elus el ON el.id = i.elu_id
  GROUP BY e.id, e.title, e.location, e.starts_at, e.mayor_present
  ORDER BY e.starts_at;
$$;

REVOKE ALL ON FUNCTION public.public_calendar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_calendar() TO anon, authenticated;