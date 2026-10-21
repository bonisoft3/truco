-- What the bar's admissions look up on every table, challenge and call opened,
-- over instances that are never removed: a talk names one table (and is
-- unique here, so no two opened at once can share one), a chair has one call
-- out to it, and a player's waiting chairs are found by the player.
SET lock_timeout = '5s';
SET statement_timeout = '1min';
BEGIN;

-- initdb runs this file once, on a fresh volume, where the machines' tables
-- are still empty; its own transaction is what CREATE INDEX CONCURRENTLY
-- cannot run in.
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS truco_match_talk ON hybrid_truco_match.instance ((state->>'talk'));
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS truco_challenge_talk ON hybrid_truco_challenge.instance ((state->>'talk'));
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS truco_call_chair ON hybrid_truco_call.instance ((state->>'room'), (state->>'chair')) WHERE state->>'phase' = 'offered';
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS truco_match_member_actor ON hybrid_truco_match.member (actor);

COMMIT;
