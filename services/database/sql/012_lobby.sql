-- Migration 012: Lobby, Challenge, and Room Action policies and replication

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

ALTER TABLE lobby ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE lobby ALTER COLUMN status SET DEFAULT 'waiting';
ALTER TABLE challenge ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE challenge ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE room_action ALTER COLUMN created_at SET DEFAULT now();

GRANT SELECT, INSERT, UPDATE, DELETE ON lobby TO anon, app_user;
GRANT SELECT, INSERT, UPDATE ON challenge TO anon, app_user;
GRANT SELECT, INSERT ON room_action TO anon, app_user;
GRANT ALL ON lobby, challenge, room_action TO service;

ALTER TABLE lobby ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_action ENABLE ROW LEVEL SECURITY;

-- Lobby RLS
DROP POLICY IF EXISTS lobby_anon_all ON lobby;
DROP POLICY IF EXISTS lobby_app_user_all ON lobby;
DROP POLICY IF EXISTS lobby_app_user_select ON lobby;
DROP POLICY IF EXISTS lobby_select ON lobby;
DROP POLICY IF EXISTS lobby_insert ON lobby;
DROP POLICY IF EXISTS lobby_update ON lobby;
DROP POLICY IF EXISTS lobby_delete ON lobby;
DROP POLICY IF EXISTS lobby_service_all ON lobby;

CREATE POLICY lobby_select ON lobby FOR SELECT TO anon, app_user USING (true);
CREATE POLICY lobby_insert ON lobby FOR INSERT TO anon, app_user WITH CHECK (char_length(handle) > 0 AND status IN ('waiting', 'playing'));
CREATE POLICY lobby_update ON lobby FOR UPDATE TO anon, app_user USING (true) WITH CHECK (char_length(handle) > 0 AND status IN ('waiting', 'playing'));
CREATE POLICY lobby_delete ON lobby FOR DELETE TO anon, app_user USING (true);
CREATE POLICY lobby_service_all ON lobby FOR ALL TO service USING (true) WITH CHECK (true);

-- Challenge RLS: immutable history, no delete
DROP POLICY IF EXISTS challenge_anon_all ON challenge;
DROP POLICY IF EXISTS challenge_app_user_all ON challenge;
DROP POLICY IF EXISTS challenge_app_user_select ON challenge;
DROP POLICY IF EXISTS challenge_select ON challenge;
DROP POLICY IF EXISTS challenge_insert ON challenge;
DROP POLICY IF EXISTS challenge_update ON challenge;
DROP POLICY IF EXISTS challenge_service_all ON challenge;

CREATE POLICY challenge_select ON challenge FOR SELECT TO anon, app_user USING (true);
CREATE POLICY challenge_insert ON challenge FOR INSERT TO anon, app_user WITH CHECK (status = 'pending');
CREATE POLICY challenge_update ON challenge FOR UPDATE TO anon, app_user USING (true) WITH CHECK (true);
CREATE POLICY challenge_service_all ON challenge FOR ALL TO service USING (true) WITH CHECK (true);

-- Room Action RLS: append-only immutable game events, no client update/delete
DROP POLICY IF EXISTS room_action_anon_all ON room_action;
DROP POLICY IF EXISTS room_action_app_user_all ON room_action;
DROP POLICY IF EXISTS room_action_app_user_select ON room_action;
DROP POLICY IF EXISTS room_action_select ON room_action;
DROP POLICY IF EXISTS room_action_insert ON room_action;
DROP POLICY IF EXISTS room_action_service_all ON room_action;

CREATE POLICY room_action_select ON room_action FOR SELECT TO anon, app_user USING (true);
CREATE POLICY room_action_insert ON room_action FOR INSERT TO anon, app_user WITH CHECK (action IN ('play_card', 'truco', 'accept', 'run', 'touch_card', 'resign'));
CREATE POLICY room_action_service_all ON room_action FOR ALL TO service USING (true) WITH CHECK (true);

-- NOT VALID: binds every write from here on without scanning stored rows,
-- which is free on the empty table initdb applies this to.
ALTER TABLE room_action DROP CONSTRAINT IF EXISTS room_action_action_check;
ALTER TABLE room_action ADD CONSTRAINT room_action_action_check CHECK (action IN ('play_card', 'truco', 'accept', 'run', 'touch_card', 'resign')) NOT VALID;

-- tier: container
ALTER TABLE lobby REPLICA IDENTITY FULL;
ALTER TABLE challenge REPLICA IDENTITY FULL;
ALTER TABLE room_action REPLICA IDENTITY FULL;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['lobby','challenge','room_action'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'electric_publication_default' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION electric_publication_default ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;
-- tier: any

NOTIFY pgrst, 'reload schema';

COMMIT;
