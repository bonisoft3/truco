package trucomatch

import (
	"list"
	pronto "github.com/bonisoft3/pronto"
)

#Variant: {type: "string", maxLength: 10, values: ["mineiro", "paulista", "gaucho", "truc", "argentino", "uruguayo", "paraguayo", "douradinha", "douradao"]}
#Seating: {type: "string", maxLength: 6, values: ["1v1", "2v2", "2v2v2"]}
#Seat: {type: "string", maxLength: 1, values: ["a", "b", "c", "d", "e", "f"]}
#Seats: {type: "array", maxItems: 6, items: #Seat}
#Side: {type: "string", maxLength: 4, values: ["", "a", "b", "c", "tie", "draw", "both"]}
#Sides: {type: "array", maxItems: 3, items: #Side}
#Card: {type: "integer", min: -1, max: 40}
#Cards: {type: "array", maxItems: 3, items: #Card}
#Number: {type: "integer", min: 0, max: 9007199254740991}
#Score: {type: "integer", min: 0, max: 30}
// Milliseconds a seat has to act; 0 plays without a clock.
#TurnMs: {type: "integer", min: 0, max: 600000}
#Phase: {type: "string", maxLength: 12, values: ["waiting", "dealing", "brink", "playing", "wager", "envido", "resolving", "hand_over", "finished"]}
#Play: {type: "object", fields: {seat: #Seat, card: #Card, covered: {type: "boolean"}, trick: {type: "integer", min: 0, max: 2}, slot: {type: "integer", min: 0, max: 2}}}
#Plays: {type: "array", maxItems: 18, items: #Play}
#Said: {type: "string", maxLength: 12, values: ["raise", "accept", "fold", "envido", "envido_real", "envido_falta", "envido_take", "envido_run", "envido_count", "envido_good", "flor"]}
// What each seat said this hand, in order: the calls and answers a table hears.
// `at` is how many cards were on the table when it was said.
#Log: {type: "array", maxItems: 40, items: {type: "object", fields: {seat: #Seat, kind: #Said, count: {type: "integer", min: 0, max: 41}, at: {type: "integer", min: 0, max: 18}}}}
#Power: {type: "integer", min: -1, max: 103}
// The game every seat may know of: the context without the hands, and the
// state value, which a view carries as `phase`.
#Game: {
 variant: #Variant, seating: #Seating, seats: #Seats, joined: #Seats
 score_a: #Score, score_b: #Score, score_c: #Score, goal: #Score
 hand_no: #Number, leader: #Seat, turn: #Seat, stake: #Score, offer: #Score
 caller: #Side, right: #Side, brink: #Side, result: #Side, winner: #Side
 vira: #Card, deadline: #Number, turn_ms: #TurnMs, tricks: #Sides, plays: #Plays, log: #Log
 // A table its opener kept off the bar's list: only its code or a call seats you.
 reserved: {type: "boolean"}
 // What the table's voices go by in public, its opener's draw: it names the
 // table without naming its room, which is its code.
 talk: {type: "string", maxLength: 36}
 folded: #Sides, answers: #Sides
 envido_chain: {type: "array", maxItems: 3, items: {type: "string", maxLength: 12, values: ["envido", "envido_real", "envido_falta"]}}
 envido_caller: #Side
 envido_done: {type: "string", maxLength: 8, values: ["", "accepted", "refused", "flor"]}
 envido_scores: {type: "array", maxItems: 3, items: {type: "object", fields: {side: #Side, count: {type: "integer", min: 0, max: 33}}}}
}
match: pronto.#Machine & {
 config: {
  id: "truco_match"
  initial: "waiting"
  on: {
   resign: {guard: "mayResign", target: "finished", actions: "resign"}
  }
  states: {
   waiting: {
    on: {
     start: {guard: "seatedOnce", actions: "admit"}
     stand: {guard: "mayStand", actions: ["stand", "unseat"]}
    }
    always: {guard: "full", target: "dealing", actions: "deal"}
   }
   dealing: always: [{guard: "needsBrink", target: "brink"}, {target: "playing"}]
   playing: on: {
    play: {guard: "mayPlay", target: "resolving", actions: "play"}
    raise: {guard: "mayRaise", target: "wager", actions: "raise"}
    fold: {guard: "mayLeave", target: "resolving", actions: "fold"}
   }
   wager: on: {
    raise: {guard: "mayRaise", actions: "raise"}
    accept: {guard: "mayAnswer", target: "resolving", actions: "accept"}
    fold: {guard: "mayAnswer", target: "resolving", actions: "fold"}
   }
   brink: on: {
    accept: {guard: "mayAnswer", target: "playing", actions: "acceptBrink"}
    fold: {guard: "mayAnswer", target: "resolving", actions: "fold"}
   }
   envido: on: {
    envido_take: {guard: "mayEnvidoAnswer", target: "resolving", actions: "takeEnvido"}
    envido_run: {guard: "mayEnvidoAnswer", target: "resolving", actions: "runEnvido"}
   }
   for phase in ["playing", "wager", "envido"] {
    (phase): on: {
     for kind in ["envido", "envido_real", "envido_falta"] {(kind): {guard: "mayEnvido", target: "envido", actions: "callEnvido"}}
     flor: {guard: "mayFlor", target: "resolving", actions: "flor"}
    }
   }
   for phase in ["playing", "wager", "brink", "envido"] {
    (phase): on: timeout: {guard: "isDue", target: "resolving", actions: "timeout"}
   }
   resolving: always: [
    {guard: "matchOver", target: "finished"},
    {guard: "handOver", target: "hand_over"},
    {guard: "hasWager", target: "wager"},
    {target: "playing"},
   ]
   hand_over: on: next: {target: "dealing", actions: "deal"}
   finished: type: "final"
  }
 }
 setup: {
  version: 7
  fuel:    100000
  entropy: 128
  guards: {
   for g in ["full", "needsBrink", "handOver", "matchOver", "hasWager"] {(g): reads: []}
   for g in ["mayLeave", "mayAnswer", "mayRaise", "mayEnvido", "mayEnvidoAnswer", "mayFlor"] {(g): reads: ["actor", "now"]}
   mayPlay: reads: ["actor", "now", "payload.slot"]
   // A chair at a table still waiting is held at one table at a time, so no
   // one keeps chairs at several from the players who would fill them.
   mayStand: reads: ["actor"]
   mayResign: reads: ["actor"]
   seatedOnce: {
    sql: "NOT EXISTS (SELECT FROM hybrid_truco_match.member m JOIN hybrid_truco_match.member o ON o.actor = m.actor AND o.instance_id <> m.instance_id JOIN hybrid_truco_match.instance g ON g.id = o.instance_id WHERE m.instance_id = game.id AND g.state->>'phase' = 'waiting')"
    reason: "seated_elsewhere"
   }
   isDue: reads: ["now"]
  }
  // What a hand's end pays: the score, and the result that closes it.
  let _paid = ["score_a", "score_b", "score_c", "winner", "result", "deadline"]
  // A card laid, and the trick it may close.
  let _laid = list.Concat([_paid, ["a", "b", "c", "d", "e", "f", "plays", "tricks", "turn", "offer"]])
  let _bid = ["stake", "offer", "right", "caller", "answers"]
  let _envido = list.Concat([_paid, ["log", "envido_done", "envido_caller"]])
  actions: {
   admit: {reads: ["payload.seats"], writes: ["joined"]}
   stand: {reads: ["actor"], writes: ["joined"]}
   // The chair is given back: the member and its seat row go, so the guest
   // sits nowhere and another may take it.
   unseat: [{effect: [
    {op: "delete", schema: "hybrid_truco_match", table: "member", rawWhere: "member.instance_id = game.id AND member.actor = dispatch.actor"},
    {op: "delete", schema: "public", table: "truco_match_seat", rawWhere: "truco_match_seat.instance_id = game.id AND truco_match_seat.actor = dispatch.actor"},
   ]}]
   play: {reads: ["now", "payload.slot", "payload.covered"], writes: _laid}
   fold: {reads: ["actor", "now"], writes: list.Concat([_laid, _bid, ["folded", "log"]])}
   raise: {reads: ["actor", "now"], writes: ["stake", "offer", "caller", "answers", "deadline", "log"]}
   accept: {reads: ["actor", "now"], writes: list.Concat([_laid, _bid, ["log"]])}
   acceptBrink: {reads: ["actor", "now"], writes: ["stake", "deadline", "log"]}
   callEnvido: {reads: ["actor", "now"], writes: ["envido_chain", "envido_caller", "deadline", "log"]}
   takeEnvido: {reads: ["actor", "now"], writes: list.Concat([_envido, ["envido_scores"]])}
   runEnvido: {reads: ["actor", "now"], writes: _envido}
   flor: {reads: ["actor", "now"], writes: _envido}
   resign: {reads: ["actor"], writes: ["winner", "result", "deadline"]}
   // The wake carries no sender: the seat that owed the move is the state's.
   timeout: {reads: ["now"], writes: list.Concat([_laid, _bid, _envido, ["folded"]])}
   deal: {reads: ["now", "entropy"], writes: list.Concat([["a", "b", "c", "d", "e", "f", "vira", "leader", "turn", "brink", "hand_no", "result", "tricks", "plays", "folded", "envido_chain", "envido_scores", "log"], _bid, _envido])}
  }
  types: {
   context: {type: "object", fields: {#Game, a: #Cards, b: #Cards, c: #Cards, d: #Cards, e: #Cards, f: #Cards}}
   view: {type: "object", fields: {#Game
    phase: #Phase
    // A card's strength at this table, and whether it took its trick; -1 is a card nobody sees.
    plays: {type: "array", maxItems: 18, items: {type: "object", fields: {seat: #Seat, card: #Card, covered: {type: "boolean"}, trick: {type: "integer", min: 0, max: 2}, slot: {type: "integer", min: 0, max: 2}, power: #Power, win: {type: "boolean"}}}}
    powers: {type: "array", maxItems: 3, items: #Power}
    envido: {type: "integer", min: 0, max: 33}
    seat: #Seat, side: #Side, hand: #Cards
    available: {type: "array", maxItems: 3, items: {type: "integer", min: 0, max: 2}}
    opponent_count: {type: "integer", min: 0, max: 12}
    counts: {type: "array", maxItems: 6, items: {type: "object", fields: {seat: #Seat, count: {type: "integer", min: 0, max: 3}}}}
    partners: {type: "array", maxItems: 1, items: {type: "object", fields: {seat: #Seat, hand: #Cards}}}
    actions: {type: "array", maxItems: 14, items: {type: "string", maxLength: 12}}
   }}
   // A table still waiting for players, for the lobby to list.
   public: {type: "object", fields: {variant: #Variant, seating: #Seating, talk: {type: "string", maxLength: 36}, seated: {type: "integer", min: 0, max: 6}, places: {type: "integer", min: 2, max: 6}}}
   events: {
    play: {tier: "omnishell", payload: {type: "object", fields: {slot: {type: "integer", min: 0, max: 2}, covered: {type: "boolean"}}}}
    for event in ["raise", "accept", "fold", "next", "resign", "stand", "envido", "envido_real", "envido_falta", "envido_take", "envido_run", "flor"] {(event): {tier: "omnishell", payload: {type: "object", fields: {}}}}
    start: {tier: "mecha", payload: {type: "object", fields: seats: #Seats}}
    timeout: {tier: "mecha", payload: {type: "object", fields: {}}}
   }
  }
 }
}
