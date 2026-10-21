package trucomatch

import pronto "github.com/bonisoft3/pronto"

// The app's screens over its Mecha machines, each a fold the terminal runs:
// the arena plays truco_match against the house on the machine's own rules
// (machines/arena.js), and its modal is the bar, which holds your presence
// leased while the arena is open (machines/lobby.js). An online match is
// seated at the same table: the arena's fold reads your seat in it and
// commands it.
root: pronto.#CortexMachine & {
	config: {
		id:      "root"
		initial: "local"
		states: {
			// The arena's game and, in its modal, the bar.
			local: {meta: screen: "arena", invoke: [{src: "arena"}, {src: "lobby"}]}
		}
	}
	setup: actors: {
		arena: {machine: "truco_match", via: "local", handler: "machines/arena.js"}
		lobby: {machine: "truco_presence", via: "session", handler: "machines/lobby.js"}
	}
}
