-- Migration 013: Networked shouts and challenge variant

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

ALTER TABLE challenge ADD COLUMN IF NOT EXISTS "variant" TEXT;
UPDATE challenge SET "variant" = 'mineiro' WHERE "variant" IS NULL;
ALTER TABLE challenge DROP CONSTRAINT IF EXISTS challenge_variant_check;
ALTER TABLE challenge ADD CONSTRAINT challenge_variant_check CHECK (variant IS NOT NULL AND variant IN ('paulista', 'mineiro', 'gaucho', 'truc', 'douradinha', 'douradao', 'argentino', 'uruguayo', 'paraguayo')) NOT VALID;

DROP POLICY IF EXISTS room_action_insert ON room_action;
CREATE POLICY room_action_insert ON room_action FOR INSERT TO anon, app_user WITH CHECK (action IN ('play_card', 'truco', 'accept', 'run', 'touch_card', 'resign', 'shout'));

ALTER TABLE room_action DROP CONSTRAINT IF EXISTS room_action_action_check;
ALTER TABLE room_action ADD CONSTRAINT room_action_action_check CHECK (action IN ('play_card', 'truco', 'accept', 'run', 'touch_card', 'resign', 'shout')) NOT VALID;

ALTER TABLE lobby ADD COLUMN IF NOT EXISTS "variant" TEXT;
ALTER TABLE lobby DROP CONSTRAINT IF EXISTS lobby_variant_check;
ALTER TABLE lobby ADD CONSTRAINT lobby_variant_check CHECK (variant IN ('paulista', 'mineiro', 'gaucho', 'truc', 'douradinha', 'douradao', 'argentino', 'uruguayo', 'paraguayo')) NOT VALID;

ALTER TABLE lobby ADD COLUMN IF NOT EXISTS "seats" TEXT;
ALTER TABLE lobby DROP CONSTRAINT IF EXISTS lobby_seats_check;
ALTER TABLE lobby ADD CONSTRAINT lobby_seats_check CHECK (seats IN ('1v1', '2v2', '2v2v2')) NOT VALID;

NOTIFY pgrst, 'reload schema';

COMMIT;
