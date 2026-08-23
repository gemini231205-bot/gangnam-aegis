/*
# Enable realtime delivery for police reports

1. Realtime
- Add `public.police_reports` to the Supabase realtime publication so new 112 submissions and police actions are delivered immediately to both screens.

2. Security
- No RLS policy changes. Existing anon/authenticated policies remain unchanged.

3. Important Notes
- This is an additive configuration change and does not alter or remove report data.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'police_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.police_reports;
  END IF;
END $$;
