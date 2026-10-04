// truco--round_machine: declarative wager statechart for a Truco hand.
package truco

import (
	terminal "bonisoft.org/plugins/omnishell:terminal"
)

#WagerMachine: terminal.#Machine & {
	field:   "truco_state"
	initial: "none"
	states: {
		none: {
			on: {
				"click@btn-truco": {
					target: "truco_called"
					actions: [{
						assign: {
							asked: "you"
							rung:  1
						}
					}]
				}
			}
		}
		truco_called: {
			entry: [{
				assign: {
					said: "truco"
				}
			}]
			exit: [{
				assign: {
					said: ""
				}
			}]
			after: {
				"15000": "truco_folded"
			}
			on: {
				"click@btn-accept": {
					target: "truco_accepted"
					actions: [{
						assign: {
							raised: "them"
						}
					}]
				}
				"click@btn-raise": {
					target: "retruco_called"
					actions: [{
						assign: {
							asked: "them"
							rung:  2
						}
					}]
				}
				"click@btn-run": {
					target: "truco_folded"
				}
			}
		}
		retruco_called: {
			entry: [{
				assign: {
					said: "retruco"
				}
			}]
			exit: [{
				assign: {
					said: ""
				}
			}]
			after: {
				"15000": "truco_folded"
			}
			on: {
				"click@btn-accept": {
					target: "retruco_accepted"
				}
				"click@btn-raise": {
					target: "vale4_called"
				}
				"click@btn-run": {
					target: "truco_folded"
				}
			}
		}
		vale4_called: {
			entry: [{
				assign: {
					said: "vale4"
				}
			}]
			exit: [{
				assign: {
					said: ""
				}
			}]
			after: {
				"15000": "truco_folded"
			}
			on: {
				"click@btn-accept": {
					target: "vale4_accepted"
				}
				"click@btn-run": {
					target: "truco_folded"
				}
			}
		}
		truco_accepted: {
			on: {
				"click@btn-raise": {
					target: "retruco_called"
					actions: [{
						assign: {
							asked: "them"
							rung:  2
						}
					}]
				}
				fold: "truco_folded"
			}
		}
		retruco_accepted: {
			on: {
				"click@btn-raise": {
					target: "vale4_called"
					actions: [{
						assign: {
							asked: "them"
							rung:  3
						}
					}]
				}
				fold: "truco_folded"
			}
		}
		vale4_accepted: {
			on: {
				fold: "truco_folded"
			}
		}
		truco_folded: {
			type: "final"
			entry: [{
				assign: {
					ran:  "us"
					said: "ran"
				}
				raise: "fold"
			}]
			exit: [{
				assign: {
					ran:  ""
					said: ""
				}
			}]
		}
	}
	onDone: {
		target: ".none"
	}
}

#EnvidoMachine: terminal.#Machine & {
	field:   "envido_state"
	initial: "none"
	states: {
		none: {
			entry: [{
				assign: {
					envido_calls: ""
					envido_rung:  0
				}
			}]
			on: {
				"click@btn-envido": {
					target: "called"
				}
				"click@btn-envido-real": {
					target: "real_called"
				}
				"click@btn-envido-falta": {
					target: "falta_called"
				}
				"click@btn-flor": {
					target: "flor"
				}
			}
		}
		called: {
			entry: [{
				assign: {
					envido_calls: "real falta answer"
					envido_rung:  2
				}
			}]
			exit: [{
				assign: {
					envido_calls: ""
					envido_rung:  0
				}
			}]
			on: {
				"click@btn-envido-take": {
					target: "accepted"
				}
				"click@btn-envido-run": {
					target: "folded"
				}
				"click@btn-envido-real": {
					target: "real_called"
				}
				"click@btn-envido-falta": {
					target: "falta_called"
				}
			}
		}
		real_called: {
			entry: [{
				assign: {
					envido_calls: "falta answer"
					envido_rung:  4
				}
			}]
			exit: [{
				assign: {
					envido_calls: ""
					envido_rung:  0
				}
			}]
			on: {
				"click@btn-envido-take": {
					target: "accepted"
				}
				"click@btn-envido-run": {
					target: "folded"
				}
				"click@btn-envido-falta": {
					target: "falta_called"
				}
			}
		}
		falta_called: {
			entry: [{
				assign: {
					envido_calls: "answer"
					envido_rung:  6
				}
			}]
			exit: [{
				assign: {
					envido_calls: ""
					envido_rung:  0
				}
			}]
			on: {
				"click@btn-envido-take": {
					target: "accepted"
				}
				"click@btn-envido-run": {
					target: "folded"
				}
			}
		}
		accepted: {
			type: "final"
			entry: [{
				assign: {
					envido_calls: ""
					envido_rung:  0
				}
			}]
		}
		folded: {
			type: "final"
			entry: [{
				assign: {
					envido_calls: ""
					envido_rung:  0
				}
			}]
		}
		flor: {
			type: "final"
			entry: [{
				assign: {
					envido_calls: ""
					envido_rung:  0
				}
			}]
		}
	}
	onDone: {
		target: ".none"
	}
}

#TrickMachine: terminal.#Machine & {
	field:   "trick_state"
	initial: "dealt"
	states: {
		dealt: {
			entry: [{
				assign: {
					phase: "dealt"
					v1:    ""
					v2:    ""
					v3:    ""
				}
			}]
			on: {
				"play@card": {
					target: "v1_in_progress"
				}
			}
		}
		v1_in_progress: {
			entry: [{
				assign: {
					phase: "v1"
					v1:    ""
					v2:    ""
					v3:    ""
				}
			}]
			on: {
				"trick@win": {
					target: "v1_us"
				}
				"trick@loss": {
					target: "v1_them"
				}
				"trick@tie": {
					target: "v1_tie"
				}
			}
		}
		v1_tie: {
			entry: [{
				assign: {
					phase: "v2"
					v1:    "tie"
					v2:    ""
					v3:    ""
				}
			}]
			on: {
				"trick@win": {
					target: "v1_us"
				}
				"trick@tie": {
					target: "v2_tie"
				}
			}
		}
		v1_us: {
			entry: [{
				assign: {
					phase: "v2"
					v1:    "us"
					v2:    ""
					v3:    ""
				}
			}]
			on: {
				"trick@win": {
					target: "result"
				}
			}
		}
		v1_them: {
			entry: [{
				assign: {
					phase: "v2"
					v1:    "them"
					v2:    ""
					v3:    ""
				}
			}]
			on: {
				"trick@win": {
					target: "result"
				}
			}
		}
		v2_tie: {
			entry: [{
				assign: {
					phase: "v3"
					v1:    "tie"
					v2:    "tie"
					v3:    ""
				}
			}]
			on: {
				"trick@win": {
					target: "result"
				}
			}
		}
		result: {
			type: "final"
			entry: [{
				assign: {
					phase:  "result"
					result: "us"
				}
			}]
		}
	}
	onDone: {
		target: ".dealt"
	}
}
