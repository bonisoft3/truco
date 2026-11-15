package trucomatch

import pronto "github.com/bonisoft3/pronto"

#Identity: {type: "string", maxLength: 36}
#Presence: {
	name:   {type: "string", maxLength: 32}
	leases: {type: "array", maxItems: 16, items: {type: "object", fields: {id: #Identity, until: #Number}}}
	// When the earliest lease lapses, or 0 with none: the ticker's deadline.
	until: #Number
}
presence: pronto.#Machine & {
	config: {
		id:      "truco_presence"
		initial: "hidden"
		on: {
			show:   {guard: ["named", "connected"], target: "visible", actions: "show"}
			hide:   {target: "hidden"}
			touch:  {guard: "hasCapacity", actions: "touch"}
			leave:  {actions: "leave"}
			expire: {actions: "expire"}
		}
		states: {hidden: {}, visible: {}}
	}
	setup: {
		guards: {
			named:       {reads: ["name"], reason: "name_required"}
			connected:   {reads: ["_time"], reason: "disconnected"}
			hasCapacity: {reads: ["_time", "session"], reason: "too_many_tabs"}
		}
		actions: {
			show:   {reads: ["name"], writes: ["name"]}
			touch:  {reads: ["_time", "session"], writes: ["leases", "until"]}
			leave:  {reads: ["_time", "session"], writes: ["leases", "until"]}
			expire: {reads: ["_time"], writes: ["leases", "until"]}
		}
		version: 2
		types: {
			context: {type: "object", fields: #Presence}
			view:    {type: "object", fields: {#Presence..., phase: {type: "string", maxLength: 7, values: ["hidden", "visible"]}}}
			// Who the lobby lists: a visible player with a tab still open.
			public: {type: "object", fields: {name: {type: "string", maxLength: 32}}}
			events: {
				show:   {tier: "omnishell", payload: {type: "object", fields: {name: {type: "string", maxLength: 32}}}}
				hide:   {tier: "omnishell", payload: {type: "object", fields: {}}}
				touch:  {tier: "mecha", payload: {type: "object", fields: {session: #Identity}}}
				leave:  {tier: "mecha", payload: {type: "object", fields: {session: #Identity}}}
				expire: {tier: "mecha", payload: {type: "object", fields: {}}}
			}
		}
	}
}
