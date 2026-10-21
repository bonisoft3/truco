package trucomatch

#VariantInput: #Variant
match: setup: {
 initialize: "initial"
 types: input: {type: "object", fields: {variant: #VariantInput, seating: #Seating, turn_ms: #TurnMs, reserved: {type: "boolean"}, talk: {type: "string", maxLength: 36}}}
 ports: {
  admission: {
   name: "truco_create"
   params: [{name: "instance_id", type: "uuid"}, {name: "variant", type: "text"}, {name: "talk", type: "text"}, {name: "seating", type: "text", default: "1v1"}, {name: "reserved", type: "text", default: "false"}]
   id: "instance_id"
   input: {variant: {raw: "variant"}, seating: {raw: "seating"}, turn_ms: 20000, reserved: {raw: "reserved = 'true'"}, talk: {raw: "talk"}}
   // The table's talk is the opener's draw, recorded with the request: 64 bits,
   // as hex, enough to tell the tables at once apart; the room is not drawn from it.
   checks: [
    {sql: "talk ~ '^[0-9a-f]{16}$'", reason: "invalid table talk", mode: "error"},
    // A talk names one table: one reused would speak into another's felt.
    {sql: "NOT EXISTS (SELECT FROM hybrid_truco_match.instance g WHERE g.state->>'talk' = talk) AND NOT EXISTS (SELECT FROM hybrid_truco_challenge.instance c WHERE c.state->>'talk' = talk)", reason: "talk_taken", mode: "error"},
    // A chair at a waiting table is held at one table at a time (match.cue's seatedOnce).
    {sql: "NOT EXISTS (SELECT FROM hybrid_truco_match.member m JOIN hybrid_truco_match.instance g ON g.id = m.instance_id WHERE m.actor = current_actor AND g.state->>'phase' = 'waiting')", reason: "seated_elsewhere"},
   ]
   members: a: {raw: "current_actor"}
  }
  join: {seats: "seats", membersPayload: "seats", phases: ["waiting"], event: "start"}
  wake: {phases: ["playing", "wager", "brink", "envido"], deadline: "deadline", event: "timeout"}
 }
}
challenge: setup: {
 initialize: "initial"
 types: input: {type: "object", fields: {
  inviter: #Identity, target: #Identity, room: #Identity, variant: #VariantInput, seating: #Seating
  talk: {type: "string", maxLength: 36}
  inviter_name: {type: "string", maxLength: 32}, target_name: {type: "string", maxLength: 32}
 }}
 ports: {
  admission: {
   name: "truco_challenge_offer"
   params: [{name: "challenge_id", type: "uuid"}, {name: "target", type: "uuid"}, {name: "variant", type: "text"}, {name: "talk", type: "text"}, {name: "seating", type: "text", default: "1v1"}]
   id: "challenge_id"
   locks: [{schema: "hybrid_truco_presence", table: "instance", key: "id", values: [{raw: "current_actor"}, {raw: "target"}]}]
   checks: [
    {sql: "target IS NOT NULL AND current_actor <> target", reason: "invalid challenge participants", mode: "error"},
    {sql: "talk ~ '^[0-9a-f]{16}$'", reason: "invalid table talk", mode: "error"},
    {sql: "NOT EXISTS (SELECT FROM hybrid_truco_match.instance g WHERE g.state->>'talk' = talk) AND NOT EXISTS (SELECT FROM hybrid_truco_challenge.instance c WHERE c.state->>'talk' = talk)", reason: "talk_taken", mode: "error"},
    {sql: "variant IN ('mineiro', 'paulista', 'gaucho', 'truc', 'argentino', 'uruguayo', 'paraguayo', 'douradinha', 'douradao') AND seating IN ('1v1', '2v2', '2v2v2') AND ((seating = '2v2v2') = (variant IN ('douradinha', 'douradao')))", reason: "unsupported online variant", mode: "error"},
    {sql: "NOT EXISTS (SELECT FROM hybrid_truco_challenge.instance c WHERE c.state->>'phase' = 'offered' AND (c.state->>'deadline')::bigint > hybrid_truco_challenge.clock() AND c.state->>'inviter' = current_actor::text)", reason: "outgoing_challenge_pending"},
    {sql: "hybrid_truco_presence.available(current_actor) AND hybrid_truco_presence.available(target)", reason: "player_unavailable"},
   ]
   input: {
    inviter: {raw: "current_actor"}, target: {raw: "target"}, variant: {raw: "variant"}, seating: {raw: "seating"}, talk: {raw: "talk"}, room: {raw: "md5('truco_match/' || challenge_id::text)::uuid"}
    inviter_name: {raw: "(SELECT state->>'name' FROM hybrid_truco_presence.instance WHERE id = current_actor)"}
    target_name: {raw: "(SELECT state->>'name' FROM hybrid_truco_presence.instance WHERE id = target)"}
   }
   members: {inviter: {raw: "current_actor"}, target: {raw: "target"}}
  }
  wake: {phases: ["offered"], deadline: "deadline", event: "expire"}
 }
}
presence: setup: {
 initialize: "initial"
 types: input: {type: "object", fields: {}}
 ports: {
  admission: {name: "admit", params: [], id: "current_actor", input: {}, members: owner: {raw: "current_actor"}}
  // A lapsed lease is dropped by the ticker, so the lobby stops listing a
  // player whose tabs all went away without leaving.
  wake: {phases: ["visible"], deadline: "until", event: "expire"}
  lease: {touch: "touch", leave: "leave", held: "leases"}
  reads: available: {
   params: [{name: "player", type: "uuid"}]
   returns: "boolean"
   sql: """
    SELECT EXISTS (SELECT FROM hybrid_truco_presence.instance p
      WHERE p.id = player AND p.state->>'phase' = 'visible'
      AND EXISTS (SELECT FROM jsonb_array_elements(p.state->'leases') l
        WHERE (l->>'until')::bigint > hybrid_truco_presence.clock()))
      AND NOT EXISTS (SELECT FROM hybrid_truco_match.member m JOIN hybrid_truco_match.instance g ON g.id = m.instance_id
        WHERE m.actor = player AND g.state->>'phase' <> 'finished');
    """
  }
 }
}
voice: setup: {
 initialize: "initial"
 types: input: {type: "object", fields: {}}
 ports: admission: {
  name: "truco_voice_open"
  params: [{name: "instance_id", type: "uuid"}]
  id: "instance_id"
  checks: [{sql: "instance_id = current_actor", reason: "a voice is its player's own", mode: "error"}]
  input: {}
  members: owner: {raw: "current_actor"}
 }
}
call: setup: {
 initialize: "initial"
 types: input: {type: "object", fields: {
  caller: #Identity, target: #Identity, room: #Identity, chair: #Seat, variant: #VariantInput, seating: #Seating
  caller_name: {type: "string", maxLength: 32}, target_name: {type: "string", maxLength: 32}
 }}
 ports: {
  admission: {
   name: "truco_call_offer"
   params: [{name: "call_id", type: "uuid"}, {name: "target", type: "uuid"}, {name: "room", type: "uuid"}, {name: "chair", type: "text"}]
   id: "call_id"
   locks: [{schema: "hybrid_truco_match", table: "instance", key: "id", values: [{raw: "room"}]}]
   checks: [
    {sql: "target IS NOT NULL AND current_actor <> target", reason: "invalid call participants", mode: "error"},
    {sql: "EXISTS (SELECT FROM hybrid_truco_match.member m WHERE m.instance_id = room AND m.actor = current_actor)", reason: "not_seated"},
    // The name the call carries is the one the caller's voice gives at the table.
    {sql: "EXISTS (SELECT FROM hybrid_truco_voice.instance v WHERE v.id = current_actor AND v.state->>'room' = room::text)", reason: "not_seated"},
    {sql: "EXISTS (SELECT FROM hybrid_truco_match.instance g WHERE g.id = room AND g.state->>'phase' = 'waiting' AND g.state->'seats' ? chair) AND NOT EXISTS (SELECT FROM hybrid_truco_match.member m WHERE m.instance_id = room AND m.seat = chair)", reason: "chair_taken"},
    {sql: "NOT EXISTS (SELECT FROM hybrid_truco_call.instance c WHERE c.state->>'phase' = 'offered' AND (c.state->>'deadline')::bigint > hybrid_truco_call.clock() AND c.state->>'room' = room::text AND c.state->>'chair' = chair)", reason: "chair_called"},
    {sql: "hybrid_truco_presence.available(target)", reason: "player_unavailable"},
   ]
   input: {
    caller: {raw: "current_actor"}, target: {raw: "target"}, room: {raw: "room"}, chair: {raw: "chair"}
    variant: {raw: "(SELECT state->>'variant' FROM hybrid_truco_match.instance WHERE id = room)"}
    seating: {raw: "(SELECT state->>'seating' FROM hybrid_truco_match.instance WHERE id = room)"}
    // The caller goes by the name their voice gives at this table; the
    // roda knows the target by theirs.
    caller_name: {raw: "(SELECT state->>'name' FROM hybrid_truco_voice.instance WHERE id = current_actor AND state->>'room' = room::text)"}
    target_name: {raw: "(SELECT state->>'name' FROM hybrid_truco_presence.instance WHERE id = target)"}
   }
   members: {caller: {raw: "current_actor"}, target: {raw: "target"}}
  }
  wake: {phases: ["offered"], deadline: "deadline", event: "expire"}
 }
}
