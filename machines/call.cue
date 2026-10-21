package trucomatch

import pronto "github.com/bonisoft3/pronto"

#Call: {
	caller: #Identity
	target: #Identity
	caller_name: {type: "string", maxLength: 32}
	target_name: {type: "string", maxLength: 32}
	room:    #Identity
	chair:   #Seat
	variant: #Variant
	seating: #Seating
	deadline: #Number
}
// A player at a table still waiting, calling someone from the roda to one of
// its free chairs. Answering sits them there: the answer and the join are
// the target's two writes, so a chair taken meanwhile refuses the join and
// nothing else.
call: pronto.#Machine & {
	config: {
		id:      "truco_call"
		initial: "offered"
		states: {
			offered: on: {
				accept: {guard: "mayAnswer", target: "accepted"}
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
		version: 1
		types: {
			context: {type: "object", fields: #Call}
			view: {type: "object", fields: {#Call, phase: {type: "string", maxLength: 9, values: ["offered", "accepted", "declined", "cancelled", "expired"]}}}
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
	}
}
