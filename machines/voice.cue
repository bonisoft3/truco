package trucomatch

import pronto "github.com/bonisoft3/pronto"

// A shout across the table: which, and how many this voice has shouted, so a
// reader tells a new one from the one it heard, even the same word twice.
#Word: {type: "string", maxLength: 12, values: ["", "chama", "manda", "desce", "chorou", "peek0", "peek1", "peek2"]}
#Voice: {
 room: {type: "string", maxLength: 36}
 // The table's public name for its voices (the match's talk), never its room.
 talk: {type: "string", maxLength: 36}
 seat: {type: "string", maxLength: 1, values: ["", "a", "b", "c", "d", "e", "f"]}
 name: {type: "string", maxLength: 32}
 word: #Word
 n: #Number
}
// What a player says at the table they sit at: the name the table knows them
// by, and their shouts. It is the player's, not the match's, so banter never
// moves the game's revision under a move, and a table joined by its code
// knows its players' names as well as one a challenge dealt.
voice: pronto.#Machine & {
 config: {
  id: "truco_voice"
  initial: "quiet"
  states: {
   quiet: on: sit: {guard: "maySit", target: "seated", actions: "sit"}
   seated: on: {
    sit: {guard: "maySit", actions: "sit"}
    shout: {guard: "mayShout", actions: "shout"}
    rise: {target: "quiet", actions: "rise"}
   }
  }
 }
 setup: {
  version: 2
  guards: {
   mayShout: reads: ["payload.word"]
   // Only a seat the match gave this player: the voice can claim no other table.
   maySit: {
    sql: "EXISTS (SELECT FROM hybrid_truco_match.member m JOIN hybrid_truco_match.instance g ON g.id = m.instance_id WHERE m.instance_id::text = request->'event'->'payload'->>'room' AND m.actor = dispatch.actor AND m.seat = request->'event'->'payload'->>'seat' AND g.state->>'talk' = request->'event'->'payload'->>'talk')"
    reason: "not_seated"
   }
  }
  actions: {
   sit: {reads: ["payload.room", "payload.seat", "payload.name", "payload.talk"], writes: ["room", "seat", "name", "talk"]}
   shout: {reads: ["payload.word"], writes: ["word", "n"]}
   rise: {reads: [], writes: ["room", "seat", "talk"]}
  }
  types: {
   context: {type: "object", fields: #Voice}
   view: {type: "object", fields: {#Voice, phase: {type: "string", maxLength: 6, values: ["quiet", "seated"]}}}
   // What the other seats hear: everyone may read it, so it names the table by
   // its talk and never by its room; a reader keeps the rows of its own table.
   public: {type: "object", fields: {talk: #Voice.talk, seat: #Voice.seat, name: #Voice.name, word: #Voice.word, n: #Voice.n}}
   events: {
    sit: {tier: "omnishell", payload: {type: "object", fields: {room: {type: "string", maxLength: 36}, talk: {type: "string", maxLength: 36}, seat: #Seat, name: {type: "string", maxLength: 32}}}}
    shout: {tier: "omnishell", payload: {type: "object", fields: word: #Word}}
    rise: {tier: "omnishell", payload: {type: "object", fields: {}}}
   }
  }
 }
}
