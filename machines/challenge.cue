package trucomatch

import pronto "github.com/bonisoft3/pronto"

#Challenge: {
	inviter: #Identity
	target:  #Identity
	inviter_name: {type: "string", maxLength: 32}
	target_name: {type: "string", maxLength: 32}
	variant: #Variant
	seating: #Seating
	deadline: #Number
	room:     #Identity
	// The talk of the table it deals: the inviter's draw, sent with the offer.
	talk: {type: "string", maxLength: 36}
}
challenge: pronto.#Machine & {
	config: {
		id:      "truco_challenge"
		initial: "offered"
		states: {
			offered: on: {
				accept: {guard: "mayAccept", target: "accepted", actions: "openRoom"}
				decline: {guard: "mayAnswer", target: "declined"}
				cancel: {guard: "mayCancel", target: "cancelled"}
				expire: {guard: "isDue", target: "expired"}
			}
			for phase in ["accepted", "declined", "cancelled", "expired"] {
				(phase): type: "final"
			}
		}
	}
	setup: {
		version: 2
		locks: [{when: "tier = 'omnishell'", schema: "hybrid_truco_presence", table: "instance", key: "id", values: [
			{raw: "(game.state->>'inviter')::uuid"}, {raw: "(game.state->>'target')::uuid"},
		]}]
		types: {
			context: {type: "object", fields: #Challenge}
			view: {type: "object", fields: {#Challenge, phase: {type: "string", maxLength: 9, values: ["offered", "accepted", "declined", "cancelled", "expired"]}}}
			events: {
				for event in ["accept", "decline", "cancel"] {
					(event): {tier: "omnishell", payload: {type: "object", fields: {}}}
				}
				expire: {tier: "mecha", payload: {type: "object", fields: {}}}
			}
		}
		guards: {
			mayAnswer: reads: ["actor", "now"]
			mayCancel: reads: ["actor", "now"]
			isDue: reads: ["now"]
		}
		// The target's answer, and both players still free when it is given.
		guards: mayAccept: {
			rules:  "mayAnswer"
			reads: ["actor", "now"]
			sql:    "hybrid_truco_presence.available((game.state->>'inviter')::uuid) AND hybrid_truco_presence.available((game.state->>'target')::uuid)"
			reason: "player_unavailable"
		}
		// The match the accepted challenge deals, with its two players seated.
		actions: openRoom: [
			{spawn: {machine: "truco_match", id: {raw: "(game.state->>'room')::uuid"},
				input: {variant: {raw: "game.state->>'variant'"}, seating: {raw: "game.state->>'seating'"}, turn_ms: 20000, reserved: false, talk: {raw: "game.state->>'talk'"}},
				members: {a: {raw: "game.state->>'inviter'"}, b: {raw: "game.state->>'target'"}}}},
			{send: {machine: "truco_match", id: {raw: "(game.state->>'room')::uuid"}, event: "start", payload: seats: ["a", "b"]}},
		]
	}
}
