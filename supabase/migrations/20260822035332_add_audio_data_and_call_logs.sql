/*
# Add audio_data and call_logs columns to police_reports

1. Modified Tables
- `police_reports`: Added two missing columns that the frontend expects:
  - `audio_data` (text): Base64-encoded audio data URI for evidence playback
  - `call_logs` (jsonb, default '[]'): Array of call log entries {started_at, ended_at, duration_sec}

2. Security
- No RLS policy changes — existing anon/authenticated CRUD policies already cover these new columns
  since the grants are column-level "all" for both roles.
*/

ALTER TABLE police_reports
  ADD COLUMN IF NOT EXISTS audio_data text DEFAULT '',
  ADD COLUMN IF NOT EXISTS call_logs jsonb DEFAULT '[]'::jsonb;
