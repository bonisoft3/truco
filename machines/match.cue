package trucomatch

import (
	"list"
	pronto "github.com/bonisoft3/pronto"
)

#Variant: {type: "string", maxLength: 10, values: ["mineiro", "paulista", "gaucho", "truc", "argentino", "uruguayo", "paraguayo", "douradinha", "douradao"]}
#Seating: {type: "string", maxLength: 6, values: ["1v1", "2v2", "2v2v2"]}
#Seat:    {type: "string", maxLength: 1, values: ["a", "b", "c", "d", "e", "f"]}
#Seats:   {type: "array", maxItems: 6, items: #Seat}
#Side:    {type: "string", maxLength: 4, values: ["", "a", "b", "c", "tie", "draw", "both"]}
#Sides:   {type: "array", maxItems: 3, items: #Side}
#Card:    {type: "integer", min: -1, max: 40}
#Cards:   {type: "array", maxItems: 3, items: #Card}
#Number:  {type: "integer", min: 0, max: 9007199254740991}
#Score:   {type: "integer", min: 0, max: 30}
#Games:   {type: "integer", min: 0, max: 2}

// Milliseconds a seat has to act; 0 plays without a clock.
#TurnMs: {type: "integer", min: 0, max: 600000}
#Phase:  {type: "string", maxLength: 12, values: ["waiting", "dealing", "brink", "playing", "wager", "envido", "resolving", "hand_over", "finished"]}
#Play:   {type: "object", fields: {seat: #Seat, card: #Card, covered: {type: "boolean"}, trick: {type: "integer", min: 0, max: 2}, slot: {type: "integer", min: 0, max: 2}}}
#Plays:  {type: "array", maxItems: 18, items: #Play}
#Said:   {type: "string", maxLength: 12, values: ["raise", "accept", "fold", "envido", "envido_real", "envido_falta", "envido_take", "envido_run", "envido_count", "envido_good", "flor"]}

// What each seat said this hand, in order: the calls and answers a table hears.
// `at` is how many cards were on the table when it was said.
#Log:   {type: "array", maxItems: 40, items: {type: "object", fields: {seat: #Seat, kind: #Said, count: {type: "integer", min: 0, max: 41}, at: {type: "integer", min: 0, max: 18}}}}
#Power: {type: "integer", min: -1, max: 103}

// The game every seat may know of: the context without the hands, and the
// state value, which a view carries as `phase`.
#Game: {
	variant:  #Variant
	seating:  #Seating
	seats:    #Seats
	joined:   #Seats
	score_a:  #Score
	score_b:  #Score
	score_c:  #Score
	games_a:  #Games
	games_b:  #Games
	games_c:  #Games
	goal:     #Score
	hand_no:  #Number
	leader:   #Seat
	turn:     #Seat
	stake:    #Score
	offer:    #Score
	caller:   #Side
	right:    #Side
	brink:    #Side
	result:   #Side
	winner:   #Side
	vira:     #Card
	turn_ms:  #TurnMs
	tricks:   #Sides
	plays:    #Plays
	log:      #Log
	// A table its opener kept off the bar's list: only its code or a call seats you.
	reserved: {type: "boolean"}
	// What the table's voices go by in public, its opener's draw: it names the
	// table without naming its room, which is its code.
	talk:          {type: "string", maxLength: 36}
	folded:        #Sides
	answers:       #Sides
	envido_chain:  {type: "array", maxItems: 4, items: {type: "string", maxLength: 12, values: ["envido", "envido_real", "envido_falta"]}}
	envido_caller: #Side
	envido_done:   {type: "string", maxLength: 8, values: ["", "accepted", "refused", "flor"]}
	envido_scores: {type: "array", maxItems: 3, items: {type: "object", fields: {side: #Side, count: {type: "integer", min: 0, max: 33}}}}
}
// A move is a seated side's that has not folded; an answer is owed by its
// side; a raise is an answer while one stands. The clock is the turn's timer.
_acts:    ["isActive"]
_answers: list.Concat([_acts, ["owesAnswer"]])
_raises:  list.Concat([_acts, ["answersRaise", "noBrink", "raisesInTurn", "belowMaximum"]])
match: pronto.#Machine & {
	config: {
		id:      "truco_match"
		initial: "waiting"
		on: {
			resign: {guard: "isOpener", target: "finished", actions: "resign"}
		}
		states: {
			waiting: {
				on: {
					start: {guard: "seatedOnce", actions: "admit"}
					stand: {guard: "isGuest", actions: ["stand", "unseat"]}
				}
				always: {guard: "full", target: "dealing", actions: "deal"}
			}
			dealing: always: [{guard: "needsBrink", target: "brink"}, {target: "playing"}]
			playing: on: {
				play:  {guard: list.Concat([_acts, ["inTurn", "holdsCard"]]), target: "resolving", actions: "play"}
				raise: {guard: _raises, target: "wager", actions: "raise"}
				fold:  {guard: _acts, target: "resolving", actions: "fold"}
			}
			// A raise answering a raise starts the turn's clock again.
			wager: on: {
				raise:  {guard: _raises, target: "wager", reenter: true, actions: "raise"}
				accept: {guard: _answers, target: "resolving", actions: "accept"}
				fold:   {guard: _answers, target: "resolving", actions: "fold"}
			}
			brink: on: {
				accept: {guard: _answers, target: "playing", actions: "acceptBrink"}
				fold:   {guard: _answers, target: "resolving", actions: "fold"}
			}
			envido: on: {
				envido_take: {guard: list.Concat([_acts, ["answersEnvido"]]), target: "resolving", actions: "takeEnvido"}
				envido_run:  {guard: list.Concat([_acts, ["answersEnvido"]]), target: "resolving", actions: "runEnvido"}
			}
			for phase in ["playing", "wager", "envido"] {
				(phase): on: {
					for kind in ["envido", "envido_real", "envido_falta"] {(kind): {
						guard: list.Concat([_acts, ["envidoOpen", "mayCallEnvido", "envidoRises"]]), target: "envido", actions: "callEnvido"
						// Raising the envido starts its answer's clock again.
						if phase == "envido" {reenter: true}
					}}
					flor: {guard: list.Concat([_acts, ["florAvailable"]]), target: "resolving", actions: "flor"}
				}
			}
			// The seat that owes a move has the turn's time from when the state
			// was entered; a table without a clock waits for it.
			for phase in ["playing", "wager", "brink", "envido"] {
				(phase): after: turn: {guard: "clocked", target: "resolving", actions: "timeout"}
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
		version: 8
		fuel:    100000
		entropy: 128
		delays: turn: "turn_ms"
		guards: {
			for g in ["full", "needsBrink", "handOver", "matchOver", "hasWager", "clocked"] {(g): reads: []}
			// Each is a boolean, and its reason is what a refusal by it is called.
			isActive:      {reads: ["_origin"], reason: "not_active"}
			owesAnswer:    {reads: ["_origin"], reason: "not_your_answer"}
			answersRaise:  {reads: ["_origin"], reason: "not_your_answer"}
			answersEnvido: {reads: ["_origin"], reason: "not_your_answer"}
			envidoOpen:    {reads: [], reason: "envido_closed"}
			mayCallEnvido: {reads: ["_origin"], reason: "not_your_call"}
			envidoRises:   {reads: [], reason: "invalid_envido_raise"}
			florAvailable: {reads: ["_origin"], reason: "flor_unavailable"}
			noBrink:       {reads: [], reason: "brink_no_raise"}
			raisesInTurn:  {reads: ["_origin"], reason: "not_your_raise"}
			belowMaximum:  {reads: [], reason: "maximum_stake"}
			inTurn:        {reads: ["_origin"], reason: "not_your_turn"}
			holdsCard:     {reads: ["_origin", "slot"], reason: "card_already_played"}
			isGuest:       {reads: ["_origin"], reason: "not_a_guest"}
			isOpener:      {reads: ["_origin"], reason: "not_the_opener"}
			// A chair at a table still waiting is held at one table at a time, so no
			// one keeps chairs at several from the players who would fill them.
			seatedOnce: {
				sql:    "NOT EXISTS (SELECT FROM hybrid_truco_match.member m JOIN hybrid_truco_match.member o ON o.actor = m.actor AND o.instance_id <> m.instance_id JOIN hybrid_truco_match.instance g ON g.id = o.instance_id WHERE m.instance_id = game.id AND g.state->>'phase' = 'waiting')"
				reason: "seated_elsewhere"
			}
		}
		// What a hand's end pays: the score, and the result that closes it.
		let _paid = ["score_a", "score_b", "score_c", "games_a", "games_b", "games_c", "winner", "result"]

		// A card laid, and the trick it may close.
		let _laid = list.Concat([_paid, ["a", "b", "c", "d", "e", "f", "plays", "tricks", "turn", "offer"]])
		let _bid = ["stake", "offer", "right", "caller", "answers"]
		let _envido = list.Concat([_paid, ["log", "envido_done", "envido_caller"]])
		actions: {
			admit: {reads: ["seats"], writes: ["joined"]}
			stand: {reads: ["_origin"], writes: ["joined"]}
			// The chair is given back: the member and its seat row go, so the guest
			// sits nowhere and another may take it.
			unseat: [{
				effect: [
					{op: "delete", schema: "hybrid_truco_match", table: "member", rawWhere: "member.instance_id = game.id AND member.actor = dispatch.actor"},
					{op: "delete", schema: "public", table: "truco_match_seat", rawWhere: "truco_match_seat.instance_id = game.id AND truco_match_seat.actor = dispatch.actor"},
				]
			}]
			play:        {reads: ["slot", "covered"], writes: _laid}
			fold:        {reads: ["_origin"], writes: list.Concat([_laid, _bid, ["folded", "log"]])}
			raise:       {reads: ["_origin"], writes: ["stake", "offer", "caller", "answers", "log"]}
			accept:      {reads: ["_origin"], writes: list.Concat([_laid, _bid, ["log"]])}
			acceptBrink: {reads: ["_origin"], writes: ["stake", "log"]}
			callEnvido:  {reads: ["_origin"], writes: ["envido_chain", "envido_caller", "log"]}
			takeEnvido:  {reads: ["_origin"], writes: list.Concat([_envido, ["envido_scores"]])}
			runEnvido:   {reads: ["_origin"], writes: _envido}
			flor:        {reads: ["_origin"], writes: _envido}
			resign:      {reads: ["_origin"], writes: ["winner", "result"]}
			// A timer's event carries no sender: the seat that owed the move is the state's.
			timeout: {reads: [], writes: list.Concat([_laid, _bid, _envido, ["folded"]])}
			deal:    {reads: ["_entropy"], writes: list.Concat([["a", "b", "c", "d", "e", "f", "vira", "leader", "turn", "brink", "hand_no", "result", "tricks", "plays", "folded", "envido_chain", "envido_scores", "log"], _bid, _envido])}
		}
		types: {
			context: {type: "object", fields: {#Game..., a: #Cards, b: #Cards, c: #Cards, d: #Cards, e: #Cards, f: #Cards}}
			view: {type: "object", fields: {
				#Game...
				phase: #Phase
				// A card's strength at this table, and whether it took its trick; -1 is a card nobody sees.
				plays:          {type: "array", maxItems: 18, items: {type: "object", fields: {seat: #Seat, card: #Card, covered: {type: "boolean"}, trick: {type: "integer", min: 0, max: 2}, slot: {type: "integer", min: 0, max: 2}, power: #Power, win: {type: "boolean"}}}}
				powers:         {type: "array", maxItems: 3, items: #Power}
				envido:         {type: "integer", min: 0, max: 33}
				seat:           #Seat
				side:           #Side
				hand:           #Cards
				available:      {type: "array", maxItems: 3, items: {type: "integer", min: 0, max: 2}}
				opponent_count: {type: "integer", min: 0, max: 12}
				counts:         {type: "array", maxItems: 6, items: {type: "object", fields: {seat: #Seat, count: {type: "integer", min: 0, max: 3}}}}
				partners:       {type: "array", maxItems: 1, items: {type: "object", fields: {seat: #Seat, hand: #Cards}}}
				actions:        {type: "array", maxItems: 14, items: {type: "string", maxLength: 12}}
			}}
			// A table still waiting for players, for the lobby to list.
			public: {type: "object", fields: {variant: #Variant, seating: #Seating, talk: {type: "string", maxLength: 36}, seated: {type: "integer", min: 0, max: 6}, places: {type: "integer", min: 2, max: 6}}}
			events: {
				play: {tier: "omnishell", payload: {type: "object", fields: {slot: {type: "integer", min: 0, max: 2}, covered: {type: "boolean"}}}}
				for event in ["raise", "accept", "fold", "next", "resign", "stand", "envido", "envido_real", "envido_falta", "envido_take", "envido_run", "flor"] {(event): {tier: "omnishell", payload: {type: "object", fields: {}}}}
				start: {tier: "mecha", payload: {type: "object", fields: seats: #Seats}}
			}
		}
	}
}
