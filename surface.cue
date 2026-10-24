package truco

import (
	"list"

	pronto "github.com/bonisoft3/pronto"
	game "github.com/bonisoft3/truco/machines:trucomatch"
)

// What a reader reaches each Mecha machine through (pronto's mecha-surface.ts):
// seats and the public projection the machine writes, commands, admissions
// and leases the reader writes, each checked against its machine as the
// migration is written. A seat's columns past the protocol's are its view's
// fields of the same name, and a public row's are its projection's.

// Ordinals are stated here rather than minted: the lists are shared, so a
// field's ordinal is its place in the list it comes from, and _reader's is
// the place each list gives it. A seat's view and a command's request hold
// the machine's own values, so each list takes the machine and renders the
// column's cel from it (pronto's #ShapeCel, #RequestCel).
_reader: {name: "actor", type: "uuid", default: "auth_uid()"}
_outcome: [
	{ordinal: 6, name: "outcome", type: "text", required: false, cel: "this in ['', 'accepted', 'rejected']"},
	{ordinal: 7, name: "reason", type: "text", required: false, cel: "this.size() <= 64"},
]
_seat: {
	machine: _
	fields: [
		{ordinal: 1, name: "id", type: "text", pk: true, cel: "this.size() <= 64"},
		{ordinal: 2, name: "instance_id", type: "uuid"},
		{ordinal: 3, name: "actor", type: "uuid"},
		{ordinal: 4, name: "seat", type: "text", cel: "this.size() <= 16"},
		{ordinal: 5, name: "revision", type: "bigint"},
		{ordinal: 6, name: "phase", type: "text", cel: "this.size() <= 16"},
		{ordinal: 7, name: "view", type: "json", cel: (pronto.#ShapeCel & {shape: machine.setup.types.view}).out},
	]
}
_command: {
	machine: _
	fields: list.Concat([[
		// Derived by the reader from what it says: the instance, the revision it
		// was made at, the seat and the gesture, so the same gesture twice is one row.
		{ordinal: 1, name: "id", type: "text", pk: true, cel: "this.size() <= 128"},
		{ordinal: 2, name: "instance_id", type: "uuid"},
		_reader & {ordinal: 3},
		{ordinal: 4, name: "request", type: "json", cel: (pronto.#RequestCel & {events: [for ev, e in machine.setup.types.events if e.tier == "omnishell" {ev}]}).out},
		{ordinal: 5, name: "revision", type: "bigint", required: false},
	], _outcome])
}
_open: list.Concat([[
	{ordinal: 1, name: "id", type: "text", pk: true, cel: "this.size() <= 128"},
	{ordinal: 2, name: "instance_id", type: "uuid"},
	_reader & {ordinal: 3},
	{ordinal: 4, name: "kind", type: "text", cel: "this in ['create', 'join']"},
	// Its shape is the open's kind's, which no one cel states: a create's is the
	// machine's input, a join's its seat.
	{ordinal: 5, name: "input", type: "json"},
], _outcome])
_private: {durability: "live", access: {scope: "private", owner: "actor"}}

code: state: entities: {
	TrucoMatchSeat: _private & {
		id:    "0xdd3ab423a96611ad"
		table: "truco_match_seat"
		fields: list.Concat([(_seat & {machine: game.match}).fields, [
			{ordinal: 8, name: "variant", type: "text", required: false, cel: "this.size() <= 10"},
			{ordinal: 9, name: "seating", type: "text", required: false, cel: "this.size() <= 6"},
		]])
	}
	TrucoMatchCommand: _private & {id: "0xc2f365219663ff96", table: "truco_match_command", fields: (_command & {machine: game.match}).fields}
	TrucoMatchOpen: _private & {id: "0xb9f0ce0b5f6d366a", table: "truco_match_open", fields: _open}
	TrucoMatchPublic: {
		id:         "0x84994355cbadc403"
		table:      "truco_match_public"
		durability: "live"
		access: scope: "public"
		fields: [
			{ordinal: 1, name: "id", type: "text", pk: true, cel: "this.size() <= 36"},
			{ordinal: 2, name: "variant", type: "text", cel: "this.size() <= 10"},
			{ordinal: 3, name: "seating", type: "text", cel: "this.size() <= 6"},
			{ordinal: 4, name: "seated", type: "int", cel: "this >= 0 && this <= 6"},
			{ordinal: 5, name: "places", type: "int", cel: "this >= 2 && this <= 6"},
			{ordinal: 6, name: "talk", type: "text", cel: "this.size() <= 36"},
		]
	}
	TrucoPresenceSeat: _private & {
		id:    "0xd43827101fd40e58"
		table: "truco_presence_seat"
		fields: list.Concat([(_seat & {machine: game.presence}).fields, [{ordinal: 8, name: "name", type: "text", required: false, cel: "this.size() <= 32"}]])
	}
	TrucoPresenceCommand: _private & {id: "0xbc2d854330fd1375", table: "truco_presence_command", fields: (_command & {machine: game.presence}).fields}
	TrucoPresencePublic: {
		id:         "0xe7296ad47e7148de"
		table:      "truco_presence_public"
		durability: "live"
		access: scope: "public"
		fields: [
			{ordinal: 1, name: "id", type: "text", pk: true, cel: "this.size() <= 36"},
			{ordinal: 2, name: "name", type: "text", cel: "this.size() <= 32"},
		]
	}
	TrucoPresenceLease: _private & {
		id:    "0xa54af1a27a6dcb29"
		table: "truco_presence_lease"
		fields: [
			// One per tab, from the terminal's draw.
			{ordinal: 1, name: "id", type: "text", pk: true, cel: "this.size() == 36"},
			_reader & {ordinal: 2},
			// Bumped on the terminal's clock, which is what renews the lease.
			{ordinal: 3, name: "beat", type: "int", cel: "this >= 0"},
		]
	}
	TrucoChallengeSeat: _private & {
		id:    "0x9e9e70618bb84472"
		table: "truco_challenge_seat"
		fields: list.Concat([(_seat & {machine: game.challenge}).fields, [
			{ordinal: 8, name: "inviter_name", type: "text", required: false, cel: "this.size() <= 32"},
			{ordinal: 9, name: "target_name", type: "text", required: false, cel: "this.size() <= 32"},
			{ordinal: 10, name: "variant", type: "text", required: false, cel: "this.size() <= 10"},
			{ordinal: 11, name: "seating", type: "text", required: false, cel: "this.size() <= 6"},
			{ordinal: 12, name: "room", type: "text", required: false, cel: "this.size() <= 36"},
		]])
	}
	TrucoChallengeCommand: _private & {id: "0xbda53dd590cd2c52", table: "truco_challenge_command", fields: (_command & {machine: game.challenge}).fields}
	TrucoCallSeat: _private & {
		id:    "0xe38c09fb70857d4b"
		table: "truco_call_seat"
		fields: list.Concat([(_seat & {machine: game.call}).fields, [
			{ordinal: 8, name: "caller_name", type: "text", required: false, cel: "this.size() <= 32"},
			{ordinal: 9, name: "room", type: "text", required: false, cel: "this.size() <= 36"},
			{ordinal: 10, name: "chair", type: "text", required: false, cel: "this.size() <= 1"},
			{ordinal: 11, name: "variant", type: "text", required: false, cel: "this.size() <= 10"},
			{ordinal: 12, name: "seating", type: "text", required: false, cel: "this.size() <= 6"},
		]])
	}
	TrucoCallCommand: _private & {id: "0xae74254574267c30", table: "truco_call_command", fields: (_command & {machine: game.call}).fields}
	TrucoCallOpen: _private & {id: "0xc0af59b67adbc842", table: "truco_call_open", fields: _open}
	TrucoVoiceSeat: _private & {id: "0x9c520d97bad055f1", table: "truco_voice_seat", fields: (_seat & {machine: game.voice}).fields}
	TrucoVoiceCommand: _private & {id: "0xec4776be6e7b1aa0", table: "truco_voice_command", fields: (_command & {machine: game.voice}).fields}
	TrucoVoiceOpen: _private & {id: "0xb29a44d03d2325fb", table: "truco_voice_open", fields: _open}
	TrucoVoicePublic: {
		id:         "0xd1c2085f6b491920"
		table:      "truco_voice_public"
		durability: "live"
		access: scope: "public"
		fields: [
			{ordinal: 1, name: "id", type: "text", pk: true, cel: "this.size() <= 36"},
			{ordinal: 2, name: "talk", type: "text", cel: "this.size() <= 36"},
			{ordinal: 3, name: "seat", type: "text", cel: "this.size() <= 1"},
			{ordinal: 4, name: "name", type: "text", cel: "this.size() <= 32"},
			{ordinal: 5, name: "word", type: "text", cel: "this.size() <= 12"},
			{ordinal: 6, name: "n", type: "bigint", cel: "this >= 0"},
		]
	}
	TrucoChallengeOpen: _private & {id: "0xedb2c41c1aa9d5d1", table: "truco_challenge_open", fields: _open}
}
