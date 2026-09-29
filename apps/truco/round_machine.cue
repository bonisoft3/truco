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
