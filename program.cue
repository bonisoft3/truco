// The machine rung of apps/truco: a pronto.#App compiled from ir.html
// (pinned below). Nobody reviews this; it must merely be checkable —
// cue vet, the ir bijection, and the emitted surface are the contract.
//
// Every entity takes the `tab` path (ir decision-01), so this program emits
// no migration, no policy, no publication and no pipeline: the whole data
// plane is the terminal's local collections.
@extern(embed)

package truco

import (
	"list"

	pronto "github.com/bonisoft3/pronto"
)

_designMd: _ @embed(file="DESIGN.md", type=text)

// Read here, not in the plugin: @embed resolves against the directory it is
// written in, and the catalogues are the app's own. The emitter resolves each
// localized route's slug against them and keeps only the resolved paths.
_catalogues: _ @embed(glob="messages/*.json")

code: pronto.#App & {
	state: {
		rawMigrations: [
			{name: "012_lobby.sql", src: "services/database/sql/012_lobby.sql"},
			{name: "013_networked_shouts.sql", src: "services/database/sql/013_networked_shouts.sql"},
		]
		entities: {
			Match: {
				table: "match"
				durability: "device"
				uniques: [
					{name: "uq_match_playing", cols: ["status"], where: "status=eq.playing"},
					{name: "uq_match_current", cols: ["current"], where: "current=eq.yes"},
				]
				fields: [
					{name: "id", type: "text", pk: true, cel: "this.size() <= 64"},
					{name: "variant", type: "text", cel: "this in ['paulista', 'mineiro', 'gaucho', 'truc', 'douradinha', 'douradao', 'argentino', 'uruguayo', 'paraguayo']"},
					{name: "seats", type: "text", cel: "this in ['1v1', '2v2', '2v2v2']"},
					{name: "theme", type: "text", cel: "this in ['xadrez', 'formica', 'neon', 'madeira']"},
					{name: "us_score", type: "int", cel: "this >= 0 && this <= 30"},
					{name: "them_score", type: "int", cel: "this >= 0 && this <= 30"},
					// A third pair's score. Empty at a table that seats two sides,
					// which is every table but the dourado pair.
					{name: "others_score", type: "int", required: false, cel: "this >= 0 && this <= 30"},
					{name: "stake", type: "int", cel: "this in [1, 2, 3, 4, 6, 8, 9, 10, 12]"},
					{name: "hand_no", type: "int", cel: "this >= 1"},
					{name: "status", type: "text", cel: "this in ['playing', 'over']"},
					{name: "winner", type: "text", required: false, cel: "this in ['', 'us', 'them', 'others']"},
					{name: "opponent", type: "text", cel: "this in ['nezinho', 'cida', 'tiao', 'ze', 'xiru', 'osvaldo', 'tiao_queijo', 'tabare', 'jordi', 'online']"},
					{name: "opponent_name", type: "text", cel: "this.size() > 0"},
					{name: "partner_name", type: "text", cel: "this.size() > 0"},
					// The sitting's one draw, kept. Every shuffle after it is derived
					// from this and the hand's number, so a match replays out of its
					// own rows and the table needs no randomness of its own.
					{name: "seed", type: "text", cel: "this.size() <= 12"},
					{name: "my_seat", type: "text", required: false, cel: "this in ['', 'you', 'eles1', 'parca', 'eles2']"},
					{name: "current", type: "text", cel: "this in ['yes', 'no']"},
					{name: "locale", type: "text", required: false, cel: "this in ['', 'pt-BR', 'es-AR', 'es-UY', 'es-PY', 'ca-ES']"},
					{name: "created_at", type: "timestamptz", required: false},
				]
			}
			Round: {
				table: "round"
				durability: "tab"
				uniques: [{name: "uq_round_current", cols: ["current"], where: "current=eq.yes"}]
				fields: [
					{name: "id", type: "text", pk: true, cel: "this.size() <= 64"},
					{name: "match_id", type: "text", cel: "this.size() <= 64"},
					{name: "hand_no", type: "int", cel: "this >= 1"},
					{name: "vira", type: "text", required: false, cel: "this.size() <= 4"},
					{name: "manilha", type: "text", cel: "this.size() > 0"},
					{name: "phase", type: "text", cel: "this in ['dealt', 'v1', 'v2', 'v3', 'result']"},
					{name: "truco_state", type: "text", required: false, cel: "this in ['', 'none', 'truco_called', 'retruco_called', 'vale4_called', 'truco_accepted', 'retruco_accepted', 'vale4_accepted', 'truco_folded']"},
					{name: "envido_state", type: "text", required: false, cel: "this in ['', 'none', 'called', 'real_called', 'falta_called', 'accepted', 'folded', 'flor']"},
					{name: "trick_state", type: "text", required: false, cel: "this in ['', 'dealt', 'v1_in_progress', 'v1_us', 'v1_them', 'v1_tie', 'v2_tie', 'result']"},
					{name: "ran", type: "text", required: false, cel: "this in ['', 'us', 'them', 'others']"},
					{name: "v1", type: "text", required: false, cel: "this in ['', 'us', 'them', 'others', 'tie']"},
					{name: "v2", type: "text", required: false, cel: "this in ['', 'us', 'them', 'others', 'tie']"},
					{name: "v3", type: "text", required: false, cel: "this in ['', 'us', 'them', 'others', 'tie']"},
					{name: "stake", type: "int", cel: "this in [1, 2, 3, 4, 6, 8, 9, 10, 12]"},
					{name: "result", type: "text", required: false, cel: "this in ['', 'us', 'them', 'others', 'draw', 'settled']"},
					// Who led the first rodada. Every later lead follows from the cards
					// laid, but the first is a fact about the deal and nothing in the
					// log states it.
					{name: "leader", type: "text", cel: "this in ['you', 'parca', 'eles1', 'eles2', 'eles3', 'eles4']"},
					{name: "asked", type: "text", required: false, cel: "this in ['', 'you', 'parca', 'eles1', 'eles2', 'eles3', 'eles4']"},
					{name: "raised", type: "text", required: false, cel: "this in ['', 'us', 'them', 'others']"},
					{name: "rung", type: "int", required: false, cel: "this >= 0 && this <= 12"},
					// The side one hand short of the goal, which decides whether the
					// hand is played at all — or both, and the hand is played face
					// down. Written at the deal: the score it is read off moves when
					// the hand is paid, and the felt still has to draw the hand.
					{name: "brink", type: "text", required: false, cel: "this in ['', 'us', 'them', 'both']"},
					// The second wager's slot. It is the truco slot's shape again —
					// who asked, what it is worth, how it ended — kept apart so a
					// hand can hold both at once, which is what a truco answered
					// with envido needs and a single slot cannot say.
					{name: "envido", type: "text", required: false, cel: "this in ['', 'called', 'scored', 'ran', 'flor']"},
					{name: "envido_asked", type: "text", required: false, cel: "this in ['', 'you', 'parca', 'eles1', 'eles2', 'eles3', 'eles4']"},
					{name: "envido_rung", type: "int", required: false, cel: "this >= 0 && this <= 30"},
					// What this seat may say about the second wager, as the dealer
					// reads the rules — so the felt offers exactly that and holds no
					// list of its own about which tables deal what.
					{name: "envido_calls", type: "text", required: false, cel: "this.size() <= 40"},
					{name: "envido_us", type: "int", required: false, cel: "this >= 0 && this <= 33"},
					{name: "envido_them", type: "int", required: false, cel: "this >= 0 && this <= 33"},
					{name: "envido_result", type: "text", required: false, cel: "this in ['', 'us', 'them', 'others']"},
					{name: "said", type: "text", required: false, cel: "this.size() <= 60"},
					{name: "shout_state", type: "text", required: false, cel: "this in ['', 'live', 'gone']"},
					{name: "shout_word", type: "text", required: false, cel: "this.size() <= 60"},
					{name: "shout_from", type: "text", required: false, cel: "this.size() <= 16"},
					{name: "shout_kind", type: "text", required: false, cel: "this in ['', 'call', 'accept', 'run', 'win', 'close', 'quick']"},
					{name: "shout_t", type: "text", required: false, cel: "this.size() <= 16"},
					{name: "shout_done", type: "text", required: false, cel: "this in ['', 'yes', 'no']"},
					{name: "last_remote_shout", type: "text", required: false, cel: "this.size() <= 64"},
					{name: "oculta", type: "text", required: false, cel: "this in ['', 'yes', 'no']"},
					{name: "turn_seat", type: "text", required: false, cel: "this in ['', 'you', 'parca', 'eles1', 'eles2', 'eles3', 'eles4']"},
					{name: "shout_seat", type: "text", required: false, cel: "this in ['', 'you', 'parca', 'eles1', 'eles2', 'eles3', 'eles4']"},
					{name: "ui_deadline", type: "timestamptz", required: false},
					{name: "backend_deadline", type: "timestamptz", required: false},
					{name: "current", type: "text", cel: "this in ['yes', 'no']"},
					{name: "created_at", type: "timestamptz", required: false},
				]
				// A table turns a card up, or names its trumps in the rules, or
				// has none at all; no table does two of those. The two columns are
				// the same fact twice, and the round is where they can be held to
				// it — the variant that decides which lives on the match. A named
				// or empty set is a turn-up nobody lays, so the vira stays blank
				// for both and the manilha column says which of the two it was.
				// An envido owes an answer exactly while it is called, and names a
				// side exactly once it is over, however it ended.
				invariant: {cel: "(this.vira == '') == (this.manilha == 'fixas' || this.manilha == 'nenhuma') && (this.envido == 'called') == (this.envido_asked != '') && (this.envido == 'scored' || this.envido == 'ran' || this.envido == 'flor') == (this.envido_result != '')"}
			}
			Play: {
				table:      "play"
				durability: "tab"
				fields: [
					{name: "id", type: "text", pk: true, cel: "this.size() <= 64"},
					{name: "round_id", type: "text", cel: "this.size() <= 64"},
					{name: "vaza", type: "int", cel: "this >= 1 && this <= 3"},
					{name: "seat", type: "text", cel: "this in ['you', 'parca', 'eles1', 'eles2', 'eles3', 'eles4']"},
					{name: "kind", type: "text", cel: "this in ['card', 'truco', 'accept', 'run', 'envido', 'envido_real', 'envido_falta', 'envido_take', 'envido_run', 'envido_count', 'envido_good', 'flor', 'brink_play']"},
					// The number a seat says out loud. The envido is played by
					// announcing it and not by showing cards, so the log carries the
					// word said and this carries the figure.
					{name: "count", type: "text", required: false, cel: "this.size() <= 2"},
					{name: "card", type: "text", required: false, cel: "this.size() <= 4"},
					{name: "power", type: "int", cel: "this >= 0 && this <= 100"},
					{name: "said", type: "text", required: false, cel: "this.size() <= 24"},
					{name: "from_slot", type: "int", required: false, cel: "this >= 0 && this <= 2"},
					// What the card on the felt renders with, for the same reason a
					// held card carries it: a template binds fields and cannot
					// compute one from another. A row that is not a card carries none
					// of it.
					{name: "rank", type: "text", required: false, cel: "this.size() <= 2"},
					{name: "suit", type: "text", required: false, cel: "this in ['', '♠', '♥', '♦', '♣']"},
					{name: "face", type: "text", required: false, cel: "this.size() <= 2"},
					{name: "manilha", type: "text", required: false, cel: "this in ['', 'yes', 'no']"},
					{name: "lie", type: "int", required: false, cel: "this >= -7 && this <= 7"},
					{name: "win", type: "text", required: false, cel: "this in ['', 'yes']"},
					{name: "display_seat", type: "text", required: false, cel: "this in ['', 'you', 'parca', 'eles1', 'eles2', 'eles3', 'eles4']"},
					// Its place in the round's log. The table writes rows from a
					// compartment, which has no clock to stamp them with, and an
					// order the app derives replays identically besides.
					{name: "seq", type: "text", cel: "this.size() == 2"},
				]
			}
			Held: {
				table: "held"
				durability: "tab"
				fields: [
					{name: "id", type: "text", pk: true, cel: "this.size() <= 64"},
					{name: "round_id", type: "text", cel: "this.size() <= 64"},
					{name: "seat", type: "text", cel: "this in ['you', 'parca', 'eles1', 'eles2', 'eles3', 'eles4']"},
					{name: "card", type: "text", cel: "this.size() <= 4 || this == 'back'"},
					{name: "rank", type: "text", required: false, cel: "this.size() <= 2"},
					{name: "suit", type: "text", required: false, cel: "this in ['', '♠', '♥', '♦', '♣']"},
					{name: "face", type: "text", required: false, cel: "this.size() <= 2"},
					{name: "power", type: "int", required: false, cel: "this >= 0 && this <= 100"},
					{name: "manilha", type: "text", required: false, cel: "this in ['', 'yes', 'no']"},
					{name: "slot", type: "int", cel: "this >= 0 && this <= 2"},
					{name: "blocked", type: "text", required: false, cel: "this in ['', 'disabled']"},
					{name: "display_seat", type: "text", required: false, cel: "this in ['', 'you', 'eles1', 'parca', 'eles2']"},
					{name: "current", type: "text", cel: "this in ['yes', 'no']"},
					{name: "created_at", type: "timestamptz"},
				]
			}
			AppUser: {
				table:      "app_user"
				durability: "live"
				writers:    "pipeline"
				access: {scope: "internal"}
				fields: [
					{name: "id", type: "uuid", pk: true},
					{name: "handle", type: "text", unique: true},
				]
			}
			Lobby: {
				table:      "lobby"
				durability: "live"
				access: {scope: "public"}
				fields: [
					{name: "id", type: "text", pk: true, cel: "this.size() <= 64"},
					{name: "handle", type: "text", cel: "this.size() > 0 && this.size() <= 40"},
					{name: "room_seed", type: "text", cel: "this.size() <= 64"},
					{name: "variant", type: "text", required: false, cel: "this in ['paulista', 'mineiro', 'gaucho', 'truc', 'douradinha', 'douradao', 'argentino', 'uruguayo', 'paraguayo']"},
					{name: "seats", type: "text", required: false, cel: "this in ['1v1', '2v2', '2v2v2']"},
					{name: "status", type: "text", cel: "this in ['waiting', 'playing']"},
					{name: "updated_at", type: "timestamptz", required: false},
				]
			}
			Challenge: {
				table:      "challenge"
				durability: "live"
				access: {scope: "public"}
				fields: [
					{name: "id", type: "text", pk: true, cel: "this.size() <= 64"},
					{name: "challenger_id", type: "text", cel: "this.size() <= 64"},
					{name: "challenger_name", type: "text", cel: "this.size() > 0 && this.size() <= 40"},
					{name: "target_id", type: "text", cel: "this.size() <= 64"},
					{name: "seed", type: "text", cel: "this.size() <= 64"},
					{name: "variant", type: "text", cel: "this in ['paulista', 'mineiro', 'gaucho', 'truc', 'douradinha', 'douradao', 'argentino', 'uruguayo', 'paraguayo']"},
					{name: "status", type: "text", cel: "this in ['pending', 'accepted', 'declined', 'expired']"},
					{name: "created_at", type: "timestamptz", required: false},
				]
			}
			RoomAction: {
				table:      "room_action"
				durability: "live"
				access: {scope: "public"}
				fields: [
					{name: "id", type: "text", pk: true, cel: "this.size() <= 64"},
					{name: "room_seed", type: "text", cel: "this.size() <= 64"},
					{name: "player_id", type: "text", cel: "this.size() <= 64"},
					{name: "action", type: "text", cel: "this in ['play_card', 'truco', 'accept', 'run', 'touch_card', 'resign', 'shout']"},
					{name: "card", type: "text", required: false, cel: "this.size() <= 4"},
					{name: "slot", type: "int", required: false, cel: "this >= 0 && this <= 12"},
					{name: "created_at", type: "timestamptz", required: false},
				]
			}
		}
		// No pipeline: a tab entity has no table to publish (ir decision-04).
		pipelines: {}
	}

	capabilities: {
		auth: {
			required: false
			service:  "/auth"
		}
		blobs: false
		hatches: {}
		vendored: {}
	}

	surface: {
		screens: {
			arena: {
				title: "Mesa"
				route: "/"
				label:  "nav_table"
				strip:  false
				markup: _arenaMarkup
				forms: [
				]
				states: ["loading", "empty", "populated", "raised", "resolved", "match-over", "picking", "populated-dark", "raised-dark", "network-error"]
				// The table is dealt on arrival, so a held instance would show a
				// hand that no longer exists (ir decision-12).
				keep: 0
				files: {
					shared: ["shell/shared/table.css"]
				}
			}
			regras: {
				title: "Regras"
				route: "/regras"
				// The one page of content beside a game in progress: addressable
				// in every locale, and written as a document per locale at build
				// so a crawler reads the rules rather than an empty shell.
				slug:      "route_rules"
				prerender: true
				// Reached from the table, not from a strip above it: with one
				// place to start, a nav bar is chrome the room does not need.
				strip: false
				forms: []
				states: ["populated", "populated-dark"]
				files: {
					shared: ["shell/shared/table.css"]
				}
			}
		}

		// The app's Jessie is closevaza, declared with the screen that wakes it
		// (ir decision-30). This map registers a handler against an ir object
		// of its own, which the fold does not have: it is the rodada rule the
		// table already states, not a decision in its own right.
		handlers: {}

		design: (pronto.#DesignMd & {text: _designMd}).design

		flows: {
			"new-match": {of: "arena", entity: "Match", action: "create"}
			"deal-hand": {of: "arena", entity: "Round", action: "create"}
			"deal-held": {of: "arena", entity: "Held", action: "create"}
			"block-held": {of: "arena", entity: "Held", action: "update"}
			"spend-held": {of: "arena", entity: "Held", action: "update"}
			"play-card": {of: "arena", entity: "Play", action: "create"}
			"call-truco": {of: "arena", entity: "Play", action: "create"}
			"answer-accept": {of: "arena", entity: "Play", action: "create"}
			"answer-run": {of: "arena", entity: "Play", action: "create"}
			"score-hand": {of: "arena", entity: "Match", action: "update"}
			"pick-variant": {of: "arena", entity: "Match", action: "update"}
			"pick-seats": {of: "arena", entity: "Match", action: "update"}
			"pick-theme": {of: "arena", entity: "Match", action: "update"}
		}
	}

	meta: {
		name:        "truco"
		domain:      "truco.bonisoft3.com"
		description: "Uma arena de truco — placar, mãos, viras e apostas, rodada a rodada."
		ir: {sha256: "d81fc153d7eda05d50c9f82eadcfb0ccb9ba4a3e39e7e150c9a6c7072ffadac7"}
		targets: ["pages", "cloudflare"]
		i18n: {
			default: "pt-BR"
			// One truco-playing country each, not a language list: an Argentine,
			// a Uruguayan and a Paraguayan reader share a base language but not
			// a country, and the picker (arena.cue, .country-picker) carries the
			// country, never the language alone. No country plays truco in
			// English, so none is offered.
			//
			// Declaration order is a decision, not housekeeping: a reader whose
			// Accept-Language is the bare "es" negotiates (fragment.js
			// negotiateLocale) to the FIRST declared tag sharing that base
			// language, and the country carrying that answer wants to be the
			// most defensible one — Argentina, truco's other home country
			// besides Brazil.
			locales: {
				"pt-BR": path: "pt-br"
				"es-AR": path: "ar"
				"es-UY": path: "uy"
				"es-PY": path: "py"
				// Truc is Catalonia's and Valencia's game, so the country that
				// plays it reads it in Catalan; were a Spanish-language variant
				// dealt there too, the language would follow the variant.
				"ca-ES": path: "ca"
			}
			catalogues: _catalogues
		}
		decisions: {
			"decision-01": {}
			"decision-02": {}
			"decision-03": {}
			"decision-04": {}
			"decision-05": {}
			"decision-06": {}
			"decision-07": {}
			"decision-08": {}
			"decision-09": {}
			"decision-10": {}
			"decision-11": {}
			"decision-12": {}
			"decision-13": {}
			"decision-14": {}
			"decision-15": {}
			"decision-16": {}
			"decision-18": {}
			"decision-19": {}
			"decision-20": {}
			"decision-21": {}
			"decision-22": {}
			"decision-23": {}
			"decision-24": {}
			"decision-25": {}
			"decision-26": {}
			"decision-27": {}
			"decision-28": {}
			"decision-29": {}
			"decision-32": {}
			"decision-31": {}
			"decision-30": {}
			"decision-17": {}
			"decision-33": {}
			"decision-34": {}
			"decision-35": {}
		}
		tests: {
			"test-deal-shuffle": {
				of: "Round"
				says:  "a deal takes forty distinct cards, three to each seat and one vira, and two deals differ"
				given: {deck: 40, seats: 2, hand: 3}
				when:  "deal"
				then:  "output.deck == 40 && output.hands.all(h, h == input.hand) && output.dealtDistinct && output.first != output.second"
			}
			"test-paulista-manilha": {
				of: "Round"
				says:  "the paulista manilha is the rank after the vira, and the order wraps from 3 to 4"
				given: {vira: "7", wrapVira: "3"}
				when:  "resolve manilha"
				then:  "output.manilha == \"Q\" && output.wrapManilha == \"4\""
			}
			"test-mineiro-manilha": {
				of: "Round"
				says:  "the mineiro manilhas are fixed whatever the vira shows"
				given: {vira: "7♦", variant: "mineiro"}
				when:  "resolve manilha"
				then:  "output.manilhas == [\"4♣\", \"7♥\", \"A♠\", \"7♦\"] && output.manilha == \"fixas\""
			}
			"test-gaucho-river": {
				of: "Match"
				says:  "gaucho deals the river's game in Portuguese: no turn-up, fixed manilhas, truco/retruco/vale quatro, envido and flor, and a race of two voltas"
				given: {variant: "gaucho"}
				when:  "price the table"
				then:  "output.vira == \"\" && output.manilha == \"fixas\" && output.rungs == [1, 2, 3, 4] && output.envido == true && output.flor == true && output.goal == [18, 24]"
			}
			"test-envido-count": {
				of: "Round"
				says:  "the envido counts two cards of one suit as twenty and both their pips, otherwise the best single card, and a tie goes to the mano"
				given: {suited: ["7♠", "6♠", "K♦"], unsuited: ["7♦", "5♥", "4♣"], faces: ["K♠", "J♥", "Q♦"]}
				when:  "count envido"
				then:  "output.suited == 33 && output.unsuited == 7 && output.faces == 0 && output.tieGoesTo == \"mano\""
			}
			"test-envido-ladder": {
				of: "Round"
				says:  "the envido ladder adds two and then three, a falta is what the leading side still has to run, and refusing pays what the chain was worth before the call refused"
				given: {envido: 2, real: 3, goal: 30, leading: 0}
				when:  "price the chain"
				then:  "output.envido == 2 && output.envidoThenReal == 5 && output.falta == 30 && output.refuseFirst == 1 && output.refuseReal == 2"
			}
			"test-flor-cancels": {
				of: "Round"
				says:  "a flor is three cards of one suit, pays three where the table deals it, and takes the envido off the hand asked for or not"
				given: {suited: 3, pays: 3}
				when:  "declare flor"
				then:  "output.pays == input.pays && output.envidoGone == true && output.dealtWhere == [\"uruguayo\", \"paraguayo\"]"
			}
			"test-mao-de-dez": {
				of: "Round"
				says:  "a side one hand short of the goal plays the hand for the brink's worth or runs for the first rung, calls no truco in it, and both sides there play it face down"
				given: {mineiro: [10, 4, 2], paulista: [11, 3, 1]}
				when:  "deal at the brink"
				then:  "output.mineiro == input.mineiro && output.paulista == input.paulista && output.trucoInBrink == false && output.ferroWorth == output.firstRung && output.online == false"
			}
			"test-envido-pays-now": {
				of: "Round"
				says:  "the envido is settled inside the first rodada and pays at once, whoever goes on to win the hand"
				given: {vaza: 1, taken: 2, refused: 1}
				when:  "settle envido"
				then:  "output.paidBeforeHandEnds == true && output.taken == input.taken && output.refused == input.refused && output.showsCountsOnlyWhenTaken == true"
			}
			"test-manilha-order": {
				of: "Play"
				says:  "the manilhas run in the order their table names them, in one strictly descending run above every plain card"
				given: {zap: "4♣", copas: "7♥", espadilha: "A♠", ouros: "7♦", plain: "3♣"}
				when:  "compare power"
				then:  "output.zap > output.copas && output.copas > output.espadilha && output.espadilha > output.ouros && output.ouros > output.highestPlain"
			}
			"test-shared-suit-order": {
				of: "Play"
				says:  "two manilhas of one suit are ordered by the table's list, not by the suit they share"
				given: {variant: "argentino", espadilha: "A♠", bastilha: "A♣", sete: "7♠", ouros: "7♦"}
				when:  "compare power"
				then:  "output.espadilha > output.bastilha && output.bastilha > output.sete && output.sete > output.ouros"
			}
			"test-no-manilha": {
				of: "Round"
				says:  "a table naming no manilhas turns nothing up and ranks every card on the rank it shows"
				given: {manilhas: []}
				when:  "resolve manilha"
				then:  "output.vira == \"\" && output.manilha == \"nenhuma\" && output.powers == output.ranks"
			}
			"test-card-order": {
				of: "Play"
				says:  "outside the manilhas power follows the rank order and ignores the suit"
				given: {ranks: ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"]}
				when:  "compare power"
				then:  "output.powers == input.ranks && output.sameRankDifferentSuits.all(p, p == output.sameRankDifferentSuits[0])"
			}
			"test-house-answers": {
				of: "arena"
				says:  "the house plays its lowest winning card when it can win, and its lowest card when it cannot"
				given: {led: {power: 5}, hand: [{power: 3}, {power: 7}, {power: 9}], hopeless: [{power: 1}, {power: 2}]}
				when:  "answer"
				then:  "output.winning.power == 7 && output.losing.power == 1"
			}
			"test-vaza-winner": {
				of: "Round"
				says:  "the strongest card on the mat takes the vaza, and the card played leaves the hand"
				given: {mat: [{side: "us", power: 8}, {side: "them", power: 12}], handSize: 3}
				when:  "resolve vaza"
				then:  "output.winner == \"them\" && output.handSize == input.handSize - 1"
			}
			"test-vaza-tie": {
				of: "Round"
				says:  "equal power ties the vaza, and the three tie branches decide the hand as the table states"
				given: {v1: "tie", v2: "them", firstThenTie: {v1: "us", v2: "tie"}, allTied: true}
				when:  "resolve hand"
				then:  "output.tiedFirst == \"them\" && output.tiedSecond == \"us\" && output.allTied == \"draw\" && output.points == 0"
			}
			"test-hand-winner": {
				of: "Round"
				says:  "the first side with two vazas takes the hand at the stake standing, and the third is not played"
				given: {v1: "us", v2: "us", stake: 3}
				when:  "resolve hand"
				then:  "output.result == \"us\" && output.points == input.stake && output.vazasPlayed == 2"
			}
			"test-phase-spine": {
				of: "Round"
				says:  "the phase advances with the play and never skips a node"
				given: {phase: "v2"}
				when:  "render the spine"
				then:  "output.phases == [\"dealt\", \"v1\", \"v2\", \"v3\", \"result\"] && output.lit == input.phase"
			}
			"test-truco-ladder": {
				of: "Match"
				says:  "the ladder is the variant's: two Brazilian variants and the Catalan one stop at twelve, the Rio de la Plata family plays to thirty on a four-rung ladder, and gaucho climbs that ladder to a race of two voltas"
				given: {paulista: "paulista", mineiro: "mineiro", gaucho: "gaucho", truc: "truc", argentino: "argentino", uruguayo: "uruguayo", paraguayo: "paraguayo"}
				when:  "climb"
				then:  "output.paulista == [1, 3, 6, 9, 12] && output.mineiro == [2, 4, 8, 10, 12] && output.gaucho == output.argentino && output.truc == [1, 2, 3] && output.argentino == [1, 2, 3, 4] && output.uruguayo == output.argentino && output.paraguayo == output.argentino && output.callableAtTwelve == false && output.gameLengthBrazilian == 12 && output.gameLengthRioplatense == 30 && output.gameLengthGaucho == [18, 24]"
			}
			"test-run-scores": {
				of: "Match"
				says:  "running pays what the hand was worth before the refused raise, and the hand ends at once"
				given: {them_score: 4, stakeBeforeRaise: 1, raisedTo: 3}
				when:  "run"
				then:  "output.them_score == input.them_score + input.stakeBeforeRaise && output.result == \"them\""
			}
			"test-stake-badge": {
				of: "arena"
				says:  "the badge reads the stake in force and is hot exactly while the hand is raised"
				given: {match: {stake: 3}, quiet: {stake: 1}}
				when:  "render"
				then:  "output.badge == input.match.stake && output.pulsing == (input.match.stake > 1) && output.quietPulsing == false"
			}
			"test-match-to-twelve": {
				of: "Match"
				says:  "a hand's points land on the winning side, the match closes at twelve, and no score passes it"
				given: {us_score: 9, stake: 3}
				when:  "score"
				then:  "output.us_score == input.us_score + input.stake && output.status == \"over\" && output.winner == \"us\" && output.us_score <= 12 && output.them_score <= 12"
			}
			"test-next-hand": {
				of: "Round"
				says:  "a resolved hand is followed by a fresh one, stake back at one"
				given: {hand_no: 3, stake: 6}
				when:  "deal the next"
				then:  "output.hand_no == input.hand_no + 1 && output.stake == 1 && output.phase == \"dealt\""
			}
			"test-seat-modes": {
				of: "Match"
				says:  "1v1 seats two and 2v2 seats four, and a vaza the partner takes is your side's"
				given: {strongest: {seat: "parca"}}
				when:  "reseat and resolve"
				then:  "output.seats1v1 == [\"you\", \"eles1\"] && output.seats2v2 == [\"you\", \"eles1\", \"parca\", \"eles2\"] && output.winnerSide == \"us\""
			}
			"test-variant-switch": {
				of: "Match"
				says:  "switching variant restarts the match rather than changing the rules mid-hand"
				given: {variant: "paulista", us_score: 6, them_score: 4}
				when:  "pick mineiro"
				then:  "output.variant == \"mineiro\" && output.us_score == 0 && output.them_score == 0 && output.hand_no == 1"
			}
			"test-theme-persists": {
				of: "Match"
				says:  "the felt is a stored field, so it survives leaving the table and coming back"
				given: {theme: "xadrez"}
				when:  "pick madeira, visit regras, return"
				then:  "output.theme == \"madeira\" && output.themeAfterNavigation == output.theme && output.theme in [\"xadrez\", \"formica\", \"neon\", \"madeira\"]"
			}
			"test-play-log": {
				of: "Play"
				says:  "every card and every word lands in the log in order, and nothing is ever rewritten"
				given: {cards: 4, words: 2}
				when:  "play a hand"
				then:  "output.rows == input.cards + input.words && output.ordered && output.updates == 0 && output.deletes == 0"
			}
			"test-offline": {
				of: "arena"
				says:  "after the statics load the app issues no request, and a match plays out with the network cut"
				given: {network: "cut after load"}
				when:  "play a match"
				then:  "output.requestsDuringMatch == 0 && output.handsCompleted > 0"
			}
			"test-no-self-raise": {
				of: "Match"
				says:  "the right to climb belongs to the side that accepted, so no side calls twice in a row"
				given: {calledBy: "us", answer: "accept", rung: 3}
				when:  "the raise is accepted"
				then:  "output.callableBySameSide == false && output.callableByOtherSide == true && output.stake == input.rung"
			}
			"test-same-table": {
				of: "arena"
				says:  "the match outlives the tab, so a reload sits back down at the table it left rather than opening a second one"
				given: {matchId: "m1", handNo: 3}
				when:  "the page is reloaded"
				then:  "output.matchId == input.matchId && output.handNo == input.handNo && output.playingMatches == 1"
			}
			"test-table-memory": {
				of: "Round"
				says:  "nothing is collected until the hand ends: closed tricks keep their cards and their winner"
				given: {playsSoFar: 4}
				when:  "two tricks close"
				then:  "output.tricksOnTable == 2 && output.cardsOnTable == input.playsSoFar && output.closedTricksWithOneWinner == 2"
			}
			"test-variant-words": {
				of: "arena"
				says:  "the vocabulary is the variant's, on the table and on the rules screen alike — gaucho speaks paulista's words, and the three Rio de la Plata variants speak one Spanish vocabulary of their own"
				given: {variants: ["paulista", "mineiro", "gaucho", "argentino", "uruguayo", "paraguayo"]}
				when:  "render"
				then:  "output.paulista == [\"vaza\", \"partida\"] && output.mineiro == [\"rodada\", \"jogo\"] && output.gaucho == output.paulista && output.argentino == [\"baza\", \"partida\"] && output.uruguayo == output.argentino && output.paraguayo == output.argentino && output.rulesScreenWords == output.tableWords && !output.anyWords.exists(w, w == \"queda\")"
			}
			"test-mao-and-pe": {
				of: "Round"
				says:  "the mão passes one seat per hand and the pé is the seat before it in the order"
				given: {seats: "1v1", hands: 4}
				when:  "deal four hands"
				then:  "output.leaders == [\"you\", \"eles1\", \"you\", \"eles1\"] && output.leaders4 == [\"you\", \"eles1\", \"parca\", \"eles2\"]"
			}
			"test-nos-eles": {
				of: "Match"
				says:  "the scoreboard is a truco scoreboard: nós and whoever is across the table, counted in markers the table has to hand, with no house anywhere"
				given: {score: 7, opponent_name: "Dona Cida"}
				when:  "render"
				then:  "output.left == \"Nós\" && output.right == input.opponent_name && !output.words.exists(w, w.contains(\"casa\")) && output.markers == input.score"
			}
			"test-persona-tell": {
				of: "arena"
				says:  "every opponent tells you a beat before they call, in their own words"
				given: {opponent: "cida"}
				when:  "the house decides to call"
				then:  "output.tellPrecedesCall == true && output.tell.size() > 0"
			}
			"test-touch-and-motion": {
				of: "arena"
				says:  "every target is at least a thumb wide and only the stake loops, collapsing under reduced motion"
				given: {minSize: 24}
				when:  "render"
				then:  "output.smallestTarget >= input.minSize && output.loopingAnimations == 1 && output.reducedMotionLoops == 0"
			}
			"test-custom-dropdown": {
				of: "arena"
				says:  "pickers render custom in-page menus rather than OS native popups"
				given: {picker: "theme"}
				when:  "open"
				then:  "output.isNativeSelect == false"
			}
			"test-profile-bar": {
				of: "arena"
				says:  "profile bar displays the player's seat name and guest status"
				given: {guest: true, seat: "you"}
				when:  "render"
				then:  "output.seat == \"you\" && output.guest == true"
			}
			"test-rules-screen": {
				of: "regras"
				says:  "rules screen explains all six variants and their ladders, and shows envido and flor only for the three that carry them"
				given: {screen: "regras", brazilian: ["paulista", "mineiro", "gaucho"], rioplatense: ["argentino", "uruguayo", "paraguayo"]}
				when:  "render"
				then:  "output.hasPaulista && output.hasMineiro && output.hasGaucho && output.hasArgentino && output.hasUruguayo && output.hasParaguayo && input.brazilian.all(v, !output.hasEnvidoFlor[v]) && input.rioplatense.all(v, output.hasEnvidoFlor[v])"
			}
			"test-dark-twin": {
				of: "arena"
				says:  "every screen renders with theme support for dark and light appearance"
				given: {theme: "neon"}
				when:  "render"
				then:  "output.hasContrast == true"
			}
			"test-multiplayer-room": {
				of: "Match"
				says:  "a multiplayer match has a room code, supports online sync, and pairs two remote seats"
				given: {code: "TRUCO-8821", seats: 2}
				when:  "create room"
				then:  "output.code == input.code && output.seats == 2"
			}
			"test-fog-of-war": {
				of: "Held"
				says:  "replicated cards held by opponents are masked with card back tokens until played"
				given: {seat: "them", card: "back"}
				when:  "replicate"
				then:  "output.card == \"back\" && output.rank == null && output.suit == null"
			}
			"test-slot-tracking": {
				of: "Play"
				says:  "cards are played from a specific physical hand slot index preserving opponent tells"
				given: {slot: 1, card: "4♣"}
				when:  "play card"
				then:  "output.from_slot == 1 && output.card == \"4♣\""
			}
			"test-turn-clock": {
				of: "Round"
				says:  "turns carry an authoritative deadline with grace buffer for network latency"
				given: {seat: "us", ui_deadline: "2026-09-09T12:00:15Z", backend_deadline: "2026-09-09T12:00:20Z"}
				when:  "start turn"
				then:  "output.backend_deadline > output.ui_deadline"
			}
		}
	}
}

// The terminal's statics ride the cluster's caddy image; without this
// wiring the image bakes only the ladder docs and every route 404s. The
// opponents' portraits are named by shell/shared/table.css, which pronto does
// not read, so they are listed here.
_portraits: [for p in ["bigode", "cida", "jordi", "nezinho", "osvaldo", "tabare", "tiao", "tiao_queijo", "xiru"] {
	file:   "shell/assets/\(p).png"
	target: "/srv/shell/assets/\(p).png"
}]
cluster: (pronto.#DefaultCluster & {"code": code, statics: list.Concat([terminal.surface.statics, _portraits]), local: loop.surface.sources.pronto != ""}).out
terminal: (pronto.#DefaultTerminal & {"code": code}).out
loop: (pronto.#DefaultLoop & {"code": code, "cluster": cluster, "terminal": terminal}).out

// The only tier below the cluster where a fact about the table AS A WHOLE
// holds still: the engine, the pickers and the fold run together, so a claim
// about the sitting is not a claim about one region.
loop: surface: checks: "arena": {
	verb: "test"
	cmds: [
		"deno test --config tests/deno.json --no-lock --no-check --allow-env --allow-read tests/arena.test.ts",
	]
	note: "the whole screen mounted against a stepped clock: one sitting, conserved score, a fresh epoch"
}

loop: surface: checks: "fuel_mutations": {
	verb: "test"
	cmds: [
		"deno test --config tests/deno.json --no-lock --no-check --allow-env --allow-read tests/fuel_mutations_storybook.test.ts",
	]
	note: "deterministic fuel budget, outbox mutation lifecycle, and read-only storybook state injection"
}

loop: surface: checks: "lobby_presence": {
	verb: "test"
	cmds: [
		"deno test --config tests/deno.json --no-lock --no-check --allow-env --allow-read tests/lobby_presence.test.ts",
	]
	note: "demand-driven online lobby lifecycle, player deduplication, and challenge handshake"
}

build: (pronto.#DefaultBuild & {"code": code, "loop": loop, "cluster": cluster, "terminal": terminal}).out

// The brief asks for an automated driver over the acceptance checklist, and a
// check no verb reaches does not exist: it needs the cluster up, so it lands
// at integrate beside the visual battery. This is the build seat's declared
// override seam — the app adds a check, it does not invent a verb.
build: checks: "acceptance": {
	browser: true
	cmds: [
		"deno run --config tests/deno.json --no-lock --allow-read --allow-write --allow-net --allow-env --allow-run --allow-sys --unsafely-ignore-certificate-errors=caddy tests/acceptance.ts .",
	]
	note: "walks the brief's acceptance checklist against the running table: deal, play, raise, score, pickers, both screens"
}

// The platform's battery runs its contrast and clipping checks at the theme
// the table boots in, at two window shapes. A cloth changes the ink and a
// window shape changes what fits, so the app runs the same two checks across
// every window shape and every cloth.
build: checks: "fit": {
	browser: true
	cmds: [
		"deno run --config tests/deno.json --no-lock --unstable-sloppy-imports --allow-read --allow-write --allow-net --allow-env --allow-run --allow-sys --unsafely-ignore-certificate-errors=caddy tests/fit.ts .",
	]
	note: "the terminal's contrast and clipping checks across five window shapes and all four cloths"
}

// Spatial geometry, trick card alignment, and window layout invariants across viewports.
build: checks: "window": {
	browser: true
	cmds: [
		"deno run --config tests/deno.json --no-lock --allow-read --allow-write --allow-net --allow-env --allow-run --allow-sys --unsafely-ignore-certificate-errors=caddy tests/window.test.ts",
	]
	note: "spatial geometry, trick card alignment, and window layout invariants across desktop and mobile viewports"
}

out: pronto.#emit & {"code": code, "cluster": cluster, "terminal": terminal, "loop": loop, "build": build}
