// The arena's markup, CUE-composed so the four settings pickers are instances
// of the graduated omnishell--picker; everything else rides verbatim in the raw
// string below (only \#(...) interpolates there). Emitted to
// shell/screens/arena.html by write.ts, do-not-edit header included.
package truco

import (
	"encoding/json"
	"strings"
	term "github.com/bonisoft3/omnishell:terminal"
	omni "github.com/bonisoft3/omnishell/components"
)

// A rules pick resets the score before the hybrid fold deals its first view.
_reset: {
	us_score:     "0"
	them_score:   "0"
	others_score: "0"
	hand_no:      "1"
	winner:       ""
	status:       "playing"
}

// The table's row before any game is on it: one row, "table", is the arena's
// whatever is played, so a pick before the first deal writes the row the
// arena then deals on.
_table: #"{"id":"table","variant":"mineiro","seats":"1v1","theme":"xadrez","us_score":"0","them_score":"0","others_score":"0","stake":"2","hand_no":"1","status":"playing","winner":"","opponent":"nezinho","opponent_name":"opponent_nezinho","opponent_handle":"","filled":"","partner_name":"Bigode","seed":"1","current":"yes","my_seat":"you","locale":"pt-BR","game":"","wake":""}"#

// What a variant costs to win is part of its name in the menu — "até 12
// pontos", "a 30 puntos" — so the goal reads as words in the reader's
// language rather than a bare number beside the name. The authority is the
// rules' own goal (truco_match, machines/match.js); tests/arena.test.ts plays
// it and reads every catalogue's menu label, and fails if they disagree.
_pickerVariant: omni.#Picker & {
	collection: "match"
	key:        "variant"
	field:      "variant"
	label:      "Variante"
	msgLabel:   "msg.picker_variant"
	filter:     "current=eq.yes"
	emptyRow: _table
	initial:    "mineiro"
	readout:    "text"
	// Each row is tagged with the country that plays it: the screen's own
	// locale lifts its country's group to the top, and picking a country
	// deals that country's truco. What each table
	// costs to win rides inside its label, in the reader's language.
	options: [
		{name: "paulista", label: "Paulista", item: "Truco Paulista · até 12 pontos", msg: "msg.variant_paulista_item", msgLabel: "msg.variant_paulista_short", group: "br", assign: _reset & {stake: "1", seats: {type: "seats2"}, theme: "xadrez", opponent: "nezinho", opponent_name: "opponent_nezinho"}},
		{name: "mineiro", label: "Mineiro", item: "Truco Mineiro · até 12 pontos", msg: "msg.variant_mineiro_item", msgLabel: "msg.variant_mineiro_short", group: "br", assign: _reset & {stake: "2", seats: {type: "seats2"}, theme: "madeira", opponent: "tiao_queijo", opponent_name: "opponent_tiao_queijo"}},
		{name: "gaucho", label: "Gaúcho", item: "Truco Gaúcho · 18 pontos, 24 em dupla", msg: "msg.variant_gaucho_item", msgLabel: "msg.variant_gaucho_short", group: "br", assign: _reset & {stake: "1", seats: {type: "seats2"}, theme: "madeira", opponent: "xiru", opponent_name: "opponent_xiru"}},
		{name: "argentino", label: "Argentino", item: "Truco Argentino · até 30 pontos", msg: "msg.variant_argentino_item", msgLabel: "msg.variant_argentino_short", group: "ar", assign: _reset & {stake: "1", seats: {type: "seats2"}, theme: "formica", opponent: "osvaldo", opponent_name: "opponent_osvaldo"}},
		{name: "uruguayo", label: "Uruguayo", item: "Truco Uruguaio · até 30 pontos", msg: "msg.variant_uruguayo_item", msgLabel: "msg.variant_uruguayo_short", group: "uy", assign: _reset & {stake: "1", seats: {type: "seats2"}, theme: "formica", opponent: "tabare", opponent_name: "opponent_tabare"}},
		{name: "paraguayo", label: "Paraguayo", item: "Truco Paraguaio · até 30 pontos", msg: "msg.variant_paraguayo_item", msgLabel: "msg.variant_paraguayo_short", group: "py", assign: _reset & {stake: "1", seats: {type: "seats2"}, theme: "madeira", opponent: "osvaldo", opponent_name: "opponent_osvaldo"}},
		{name: "truc", label: "Truc", item: "Truc Catalão · até 12 pontos", msg: "msg.variant_truc_item", msgLabel: "msg.variant_truc_short", group: "es", assign: _reset & {stake: "1", seats: {type: "seats2"}, theme: "neon", opponent: "jordi", opponent_name: "opponent_jordi"}},
		{name: "douradinha", label: "Douradinha", item: "Douradinha · até 12 pontos", msg: "msg.variant_douradinha_item", msgLabel: "msg.variant_douradinha_short", group: "br", assign: _reset & {stake: "2", seats: "2v2v2", theme: "madeira", opponent: "tiao_queijo", opponent_name: "opponent_tiao_queijo"}},
		{name: "douradao", label: "Dourad\u00e3o", item: "Douradão · até 12 pontos", msg: "msg.variant_douradao_item", msgLabel: "msg.variant_douradao_short", group: "br", assign: _reset & {stake: "2", seats: "2v2v2", theme: "madeira", opponent: "tiao_queijo", opponent_name: "opponent_tiao_queijo"}},
	]
	// The country headings are the endonyms the country picker already reads —
	// a country's name is the same literal in every catalogue. Only the
	// second heading is new copy. "Elsewhere" leads the markup and is ordered
	// under the home group by CSS, so a reader who never opens a stylesheet
	// still gets every variant in one list.
	heads: [
		{name: "rest", label: "Outros países", msgLabel: "msg.variants_elsewhere"},
		{name: "br", label: "Brasil", msgLabel: "msg.country_br", at: "paulista"},
		{name: "ar", label: "Argentina", msgLabel: "msg.country_ar", at: "argentino"},
		{name: "uy", label: "Uruguay", msgLabel: "msg.country_uy", at: "uruguayo"},
		{name: "py", label: "Paraguay", msgLabel: "msg.country_py", at: "paraguayo"},
		{name: "es", label: "Espa\u00f1a", msgLabel: "msg.country_es", at: "truc"},
	]
}

_pickerSeats: omni.#Picker & {
	collection: "match"
	key:        "seats"
	field:      "seats"
	label:      "Mesa"
	msgLabel:   "msg.picker_seats"
	filter:     "current=eq.yes"
	emptyRow: _table
	initial:    "1v1"
	readout:    "text"
	// The stake resets to the ladder's base of the variant STANDING, which no
	// literal can say. Three pairs is the dourado tables' seating and theirs
	// alone, so the variant can move with the seats: six seats deal a dourado
	// table, and fewer turn one back into mineiro (shell/handlers/variant2.js,
	// variant3.js). The variant menu makes the same promise from its side
	// (seats2.js).
	options: [
		{name: "1v1", label: "1v1", item: "1v1 · você e um deles", msg: "msg.seats_1v1_item", msgLabel: "msg.seats_1v1_short", assign: _reset & {variant: {type: "variant2"}}},
		{name: "2v2", label: "2v2", item: "2v2 · com o parça", msg: "msg.seats_2v2_item", msgLabel: "msg.seats_2v2_short", assign: _reset & {variant: {type: "variant2"}}},
		{name: "2v2v2", label: "2v2v2", item: "2v2v2 · três duplas", msg: "msg.seats_2v2v2_item", msgLabel: "msg.seats_2v2v2_short", assign: _reset & {stake: "2", variant: {type: "variant3"}}},
	]
}

_pickerOpponent: omni.#Picker & {
	collection: "match"
	key:        "opponent"
	field:      "opponent"
	label:      "Oponente"
	msgLabel:   "msg.picker_opponent"
	filter:     "current=eq.yes"
	emptyRow: _table
	initial:    "nezinho"
	readout:    "text"
	// opponent_name is written as a message KEY, not a name: a bot is the app's
	// own copy and each country reads one its players would use, while an online
	// opponent's handle goes through the same {msg[opponent_name]} binding
	// unmatched and renders as itself.
	options: [
		{name: "nezinho", label: "Robôs", item: "Seu Nezinho · Paulista", msg: "msg.opponent_nezinho_item", msgLabel: "msg.bots", assign: _reset & {opponent: "nezinho", opponent_name: "opponent_nezinho"}},
		{name: "tiao_queijo", label: "Robôs", item: "Tião do Queijo · Mineiro", msg: "msg.opponent_tiao_queijo_item", msgLabel: "msg.bots", assign: _reset & {opponent: "tiao_queijo", opponent_name: "opponent_tiao_queijo"}},
		{name: "xiru", label: "Robôs", item: "Xirú Velho · Gaúcho", msg: "msg.opponent_xiru_item", msgLabel: "msg.bots", assign: _reset & {opponent: "xiru", opponent_name: "opponent_xiru"}},
		{name: "osvaldo", label: "Robôs", item: "Don Osvaldo · Argentino", msg: "msg.opponent_osvaldo_item", msgLabel: "msg.bots", assign: _reset & {opponent: "osvaldo", opponent_name: "opponent_osvaldo"}},
		{name: "tabare", label: "Robôs", item: "Don Tabaré · Uruguaio", msg: "msg.opponent_tabare_item", msgLabel: "msg.bots", assign: _reset & {opponent: "tabare", opponent_name: "opponent_tabare"}},
		{name: "jordi", label: "Robôs", item: "L'Oncle Jordi · Truc", msg: "msg.opponent_jordi_item", msgLabel: "msg.bots", assign: _reset & {opponent: "jordi", opponent_name: "opponent_jordi"}},
		{name: "cida", label: "Robôs", item: "Dona Cida · Bar", msg: "msg.opponent_cida_item", msgLabel: "msg.bots", assign: _reset & {opponent: "cida", opponent_name: "opponent_cida"}},
		{name: "tiao", label: "Robôs", item: "Tião Pandeiro · Bar", msg: "msg.opponent_tiao_item", msgLabel: "msg.bots", assign: _reset & {opponent: "tiao", opponent_name: "opponent_tiao"}},
		{name: "ze", label: "Robôs", item: "Zé da Bicicleta · Bar", msg: "msg.opponent_ze_item", msgLabel: "msg.bots", assign: _reset & {opponent: "ze", opponent_name: "opponent_ze"}},
	]
	readouts: [
	]
}


_pickerTheme: omni.#Picker & {
	collection: "match"
	key:        "theme"
	field:      "theme"
	// The caption rides the bar in plain sight, so the literal the component
	// ships has to be the word the catalogue binds over it, not a placeholder.
	label:    "Feltro"
	msgLabel: "msg.picker_theme"
	filter:   "current=eq.yes"
	emptyRow: _table
	initial:  "xadrez"
	readout:  "text"
	options: [
		{name: "xadrez", label: "Xadrez", item: "Toalha xadrez", msg: "msg.theme_xadrez_item", msgLabel: "msg.theme_xadrez_short"},
		{name: "formica", label: "Fórmica", item: "Fórmica azul", msg: "msg.theme_formica_item", msgLabel: "msg.theme_formica_short"},
		{name: "neon", label: "Neon", item: "Neon do bar", msg: "msg.theme_neon_item", msgLabel: "msg.theme_neon_short"},
		{name: "madeira", label: "Madeira", item: "Madeira crua", msg: "msg.theme_madeira_item", msgLabel: "msg.theme_madeira_short"},
	]
}

// Country links share the variant picker's consequences; revisiting an
// address changes no rule. A country already playing the rule keeps it.
_countryChoices: [
    {locale: "pt-BR", group: "br", variant: "mineiro"},
    {locale: "es-AR", group: "ar", variant: "argentino"},
    {locale: "es-UY", group: "uy", variant: "uruguayo"},
    {locale: "es-PY", group: "py", variant: "paraguayo"},
    {locale: "ca-ES", group: "es", variant: "truc"},
]
_countryMachine: term.#Machine & {
    field: "locale"
    initial: "pt-BR"
    states: {for country in _countryChoices {(country.locale): {}}}
    on: {for country in _countryChoices {
        let permitted = strings.Join([for option in _pickerVariant.options if option.group == country.group {option.name}], ",")
        ("click@country-\(country.locale)"): {
            target: country.locale
            assign: {
                variant: {type: "country", params: {variants: permitted, field: "variant", value: country.variant}}
                seats: {type: "country", params: {variants: permitted, field: "seats", value: "2v2"}}
                for option in _pickerVariant.options if option.name == country.variant {
                    for key, assignedValue in option.assign if key != "seats" {
                        (key): {type: "country", params: {variants: permitted, field: key, value: assignedValue}}
                    }
                }
            }
        }
    }}
}
_countryMachineAttr: strings.Replace(json.Marshal(_countryMachine), "'", "&#39;", -1)

_pickerCountry: #"""
	<div class="picker" data-live="match" data-filter="id=eq.table" data-machine='\#(_countryMachineAttr)' data-empty-row='\#(_table)' data-picker="country">
	  <style>
	    [data-picker="country"] .pick-label i { display: none; }
	    .screen[data-locale="pt-BR"] [data-picker="country"] .pick-label i[data-t="br"],
	    .screen[data-locale="es-AR"] [data-picker="country"] .pick-label i[data-t="ar"],
	    .screen[data-locale="es-UY"] [data-picker="country"] .pick-label i[data-t="uy"],
	    .screen[data-locale="es-PY"] [data-picker="country"] .pick-label i[data-t="py"],
	    .screen[data-locale="ca-ES"] [data-picker="country"] .pick-label i[data-t="es"] { display: inline; }
	    #picker-open-country { anchor-name: --picker-country; }
	    #picker-pop-country { position-anchor: --picker-country; }
	    [data-picker="country"] .picker-list a {
	      display: flex;
	      align-items: baseline;
	      gap: 8px;
	      inline-size: 100%;
	      min-block-size: 32px;
	      padding: 6px 8px;
	      border-radius: var(--r-sm);
	      color: var(--lamp);
	      font: inherit;
	      font-size: 0.8125rem;
	      text-align: start;
	      text-decoration: none;
	      cursor: pointer;
	    }
	    [data-picker="country"] .picker-list a:hover,
	    [data-picker="country"] .picker-list a:focus-visible {
	      background: color-mix(in oklch, var(--rim) 22%, transparent);
	      outline: none;
	    }
	    [data-picker="country"] .picker-list a[aria-current="page"] {
	      background: color-mix(in oklch, var(--rim) 14%, transparent);
	    }
	    [data-picker="country"] .picker-list a[aria-current="page"]::after { content: "✓"; margin-inline-start: auto; }
	  </style>
	  <button type="button" id="picker-open-country" commandfor="picker-pop-country" command="toggle-popover" aria-haspopup="menu">
	    <span class="sr" data-text="{msg.picker_country}">País</span>
	    <span class="pick-label" aria-hidden="true"><i data-t="br">🇧🇷 <span data-text="{msg.country_br}">Brasil</span></i><i data-t="ar">🇦🇷 <span data-text="{msg.country_ar}">Argentina</span></i><i data-t="uy">🇺🇾 <span data-text="{msg.country_uy}">Uruguay</span></i><i data-t="py">🇵🇾 <span data-text="{msg.country_py}">Paraguay</span></i><i data-t="es">🇪🇸 <span data-text="{msg.country_es}">Espanya</span></i></span>
	  </button>
	  <ul id="picker-pop-country" class="picker-list" popover aria-label="{msg.picker_country}">
	    <li><a id="country-pt-BR" data-route="arena" data-locale="pt-BR" data-locale-current="page"><b aria-hidden="true">🇧🇷</b> <span data-text="{msg.country_br}">Brasil</span></a></li>
	    <li><a id="country-es-AR" data-route="arena" data-locale="es-AR" data-locale-current="page"><b aria-hidden="true">🇦🇷</b> <span data-text="{msg.country_ar}">Argentina</span></a></li>
	    <li><a id="country-es-UY" data-route="arena" data-locale="es-UY" data-locale-current="page"><b aria-hidden="true">🇺🇾</b> <span data-text="{msg.country_uy}">Uruguay</span></a></li>
	    <li><a id="country-es-PY" data-route="arena" data-locale="es-PY" data-locale-current="page"><b aria-hidden="true">🇵🇾</b> <span data-text="{msg.country_py}">Paraguay</span></a></li>
	    <li><a id="country-ca-ES" data-route="arena" data-locale="ca-ES" data-locale-current="page"><b aria-hidden="true">🇪🇸</b> <span data-text="{msg.country_es}">Espanya</span></a></li>
	  </ul>
	</div>
	"""#

// The bar's tab row before its lease is drawn: what the bar's regions bind
// while it has none.
_tab: #"{"id":"the","lease":"","me":"","note":"","shown":"","code":"","format":"1v1","reserved":"false","chair":"","call":""}"#
// What the arena's fold reads from every region it is seated on: the local
// game's rows, and the match rows an online table is played from.
_arenaReads: #"data-reads="match,round,play,held,intent,truco_match_seat,truco_match_command,truco_match_open,truco_voice_seat,truco_voice_command,truco_voice_open,truco_voice_public,player,lobby_tab""#
// The bar's regions read the same world, so no two runs of the lobby fold
// see different ones.
_lobbyReads: #"data-reads="truco_voice_seat,truco_call_open,truco_match_open,truco_match_command,lobby_tab,truco_presence_lease,truco_presence_seat,truco_presence_command,truco_challenge_seat,player,match,truco_match_seat,truco_match_public,truco_voice_public,truco_call_seat,chair,listed_table""#

_round: #"{"id":"","hand_no":1,"vira":"","manilha":"","phase":"dealt","ran":"","v1":"","v2":"","v3":"","stake":2,"result":"","said":"","leader":"you","asked":"","raised":"","rung":0,"brink":"","envido":"","envido_asked":"","envido_rung":0,"envido_calls":"","envido_us":0,"envido_them":0,"envido_result":"","current":"yes","created_at":"","felt_phase":"idle","truco_label":"call_truco","truco_title":"felt_title_raise","truco_blocked":"disabled","raise_label":"raise","raise_blocked":"disabled","next_rung":"0","name_key":"opponent_nezinho","name_handle":"","worth":"2","opponent_name":"opponent_nezinho","opponent_handle":"","opponent":"nezinho","dialogue_key":"","dialogue_state":"","player_shout_state":"","over_key":"","tell":"","said_t":"","shout_word":"","shout_from":"","shout_kind":"","shout_state":"","shout_t":"","shout_seat":"","raise_hint":"felt_raise_to","shout_anim":"1"}"#

_arenaMarkup: #"""
<section class="screen" data-screen="arena">

  <div class="board table-frame">
    <div class="mat">
      <div class="beer-ring beer-ring-1" aria-hidden="true"></div>
      <div class="beer-ring beer-ring-2" aria-hidden="true"></div>
      <div class="ash-speck-1" aria-hidden="true"></div>
      <div class="ash-speck-2" aria-hidden="true"></div>

      <header class="seatbar pad">
        <div class="tavern-header-title">
          <span class="live-dot" aria-hidden="true"></span>
          <h1 class="tavern-name" data-live="match" data-filter="id=eq.table" data-empty-row='{"id":"table","tavern_key":"tavern_mineiro"}' data-text="{msg[tavern_key]}">Boteco do Seu Nezinho · Mesa 1</h1>
          <span id="tavern-room-badge" class="tavern-room-badge" style="display: none;"></span>
        </div>
        <span class="avatar" id="seatbar-avatar" aria-hidden="true" data-live="player" data-filter="id=eq.you" data-empty-row='{"id":"you","handle":""}' data-text="{handle}&#10;{msg.you}" data-text-format="initial">V</span>
        <span class="who">
          <span class="who-title-wrap">
            <span id="seatbar-player-name" data-live="player" data-filter="id=eq.you&amp;handle=neq." data-empty="{msg.you}"><template data-item><b data-text="{handle}"></b></template></span>
            <button type="button" class="btn-edit-handle" id="btn-edit-seatbar-handle" popovertarget="modal-online" popovertargetaction="show" title="{msg.edit_name}" aria-label="{msg.edit_name}">✎</button>
          </span>
          <span class="who-sub">
            <span class="sect" data-text="{msg.player_subtitle}">Truqueiro nato · convidado</span>
            <span class="seat-role" title="{msg.lead_title}"><i data-r="mao" data-text="{msg.hand_role_mao}">mão</i><i data-r="pe" data-text="{msg.hand_role_pe}">pé</i></span>
          </span>
        </span>
        <!-- Every setting the table has, in the bar: the cloth is the playing
             surface and nothing floats on it. They sit here rather than inside
             .matchbox because a slot hydrates no nested region, and the seatbar
             carries no data-live of its own to swallow them. Each choice takes
             its declared consequences with it as assigns on the match row; what
             leaves the row — the standing hand — is the fold's.
          -->
        <div class="seatbar-links">
\#(_pickerCountry)
\#(_pickerVariant.markup)
\#(_pickerSeats.markup)
\#(_pickerOpponent.markup)
\#(_pickerTheme.markup)
          <button type="button" class="btn-online-status" id="btn-open-online" popovertarget="modal-online" popovertargetaction="show" title="{msg.online_bar_title}">
            <span class="online-pulse" aria-hidden="true"></span>
            <span class="online-label-full" data-text="{msg.truco_online}">Truco online</span>
            <span class="online-label-short" data-text="{msg.online_short}">Online</span>
          </button>
          <a class="rules-link" data-route="regras" data-text="{msg.rules}">Regras</a>
        </div>
      </header>

      <!-- The match singleton: scoreboard, stake, and the felt the
           whole screen resolves from. Pinned on the match on the table, so
           a won one stays bound here until another is asked for.
           data-empty-row keeps the table drawn for the beat before the
           first match lands. -->
      <!-- The arena's fold is seated here: every write wakes it, and it plays
           the game on from the rows (machines/arena.js). -->
      <div class="matchbox"
           data-live="match"
           data-filter="current=eq.yes"
           data-on-mutation="arena" \#(_arenaReads)
           data-empty-row='\#(_table)'
           data-theme="{theme}"
           data-match-id="{id}"
           data-variant="{variant}"
           data-seats="{seats}"
           data-us="{us_score}"
           data-them="{them_score}"
           data-others="{others_score}"
           data-stake="{stake}"
           data-hand="{hand_no}"
           data-status="{status}"
           data-winner="{winner}"
           data-opponent="{opponent}"
           data-filled="{filled}"
           data-seed="{seed}"
           data-my-seat="{my_seat}">

        <p class="table-filled" role="status" data-text="{msg.table_complete}">Mesa completa!</p>

        <div class="scores pad">
          <div class="score us">
            <p class="sect" data-text="{msg.us}">Nós</p>
            <p class="figure" data-text="{us_score}"></p>
            <span class="tentos" aria-hidden="true" data-n="{us_score}"><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento" data-last></i></span>
          </div>
          <div class="stakebox">
            <span class="stake brass" data-stake="{stake}">
              <span aria-hidden="true">⚡</span>
              <span class="stake-word"><i data-w="base" data-text="{msg.stake_vale}">VALE</i><i data-w="up" data-text="{msg.stake_truco_times}">TRUCO ×</i></span>
              <b data-text="{stake}"></b>
            </span>
          </div>
          <div class="score them">
            <p class="sect eles-name"><span class="as-cast" data-text="{msg[opponent_name]}"></span><span class="as-handle" data-text="{opponent_handle}"></span></p>
            <p class="figure" data-text="{them_score}"></p>
            <span class="tentos" aria-hidden="true" data-n="{them_score}"><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento" data-last></i></span>
          </div>
          <!-- The third pair. Only a table of three deals one, and the
               felt shows a score for every pair it seats. -->
          <div class="score others">
            <p class="sect" data-text="{msg.them_others}">Os outros</p>
            <p class="figure" data-text="{others_score}"></p>
            <span class="tentos" aria-hidden="true" data-n="{others_score}"><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento"></i><i class="tento" data-last></i></span>
          </div>
        </div>

      </div>

      <!-- The hand on the table. A list of one (current=eq.yes) rather than a
           singleton: a singleton region hydrates no nested region and drives
           no screen state. -->
      <div class="hands" data-live="round" data-filter="current=eq.yes" data-order="created_at.desc" data-exit-motion="none"
           data-empty-row='\#(_round)'>
        <template data-item>
          <article class="hand" data-phase="{phase}" data-result="{result}" data-round-id="{id}"
                     data-v1="{v1}" data-v2="{v2}" data-v3="{v3}"
                     data-asked="{asked}" data-rung="{rung}" data-said="{said}" data-stake="{stake}"
                     data-shout-word="{shout_word}" data-shout-from="{shout_from}" data-shout-state="{shout_state}" data-shout-kind="{shout_kind}" data-shout-seat="{shout_seat}" data-shout-t="{shout_t}"
                     data-envido="{envido}" data-envido-asked="{envido_asked}" data-calls="{envido_calls}"
                     data-leader="{leader}" data-raised="{raised}" data-brink="{brink}" data-ran="{ran}"
                     data-turn-seat="{turn_seat}">

            <ol class="spine pad" data-phase="{phase}">
              <li data-node="dealt"><span data-text="{msg.spine_hand}">Mão</span></li>
              <li data-node="v1" data-v="{v1}"><span>1ª</span></li>
              <li data-node="v2" data-v="{v2}"><span>2ª</span></li>
              <li data-node="v3" data-v="{v3}"><span>3ª</span></li>
              <li data-node="result"><span data-text="{msg.spine_result}">Resultado</span></li>
            </ol>

            <div class="handline pad" data-vira="{vira}">
              <span class="vira-slot">
                <span class="sect" data-text="{msg.vira}">Vira</span>
                <span class="vira" data-text="{vira}"></span>
              </span>
              <span class="manilha-note"><span data-text="{msg.manilhas_label}">manilhas: </span><b data-text="{manilha}"></b></span>
            </div>

            <ul class="log pad" data-live="play" data-filter="round_id=eq.{id}" data-order="seq.asc"
                data-empty="{msg.empty_log}">
              <template data-item>
                <li data-seat="{seat}" data-kind="{kind}">
                  <span class="v" data-text="{vaza}"></span>
                  <span class="who"></span>
                  <span class="what" data-text="{card}{count}{msg[said]}"></span>
                </li>
              </template>
            </ul>

          </article>
        </template>
      </div>

      <div class="felt" data-live="round" data-filter="current=eq.yes&amp;limit=1" data-exit-motion="none" data-empty-row='\#(_round)' style="display: contents;">
        <template data-item>
      <div class="play" data-phase="{felt_phase}" data-ran="{ran}">
        <div class="bulb" aria-hidden="true"></div>
        <div class="shout" aria-hidden="true" data-from="{shout_from}" data-kind="{shout_kind}" data-state="{shout_state}" data-t="{shout_anim}" data-text="{msg[shout_word]}" data-text-format="uppercase"></div>
        <div class="turn-timer" id="turn-timer">
          <div class="rope-fill" id="rope-fill"></div>
          <span class="timer-label" id="timer-label"></span>
        </div>
        <div class="opponent-stage" id="opponent-stage">
          <div class="opponent-avatar-wrap">
            <div class="opponent-avatar-ring" id="opponent-avatar-ring">
              <div class="opponent-avatar-img" id="opponent-avatar-img"></div>
              <span class="opponent-avatar-initial" id="opponent-avatar-initial" aria-hidden="true" data-text="{opponent_handle}" data-text-format="initial"></span>
              <span class="opponent-online-dot" id="opponent-online-dot" aria-hidden="true"></span>
            </div>
            <span class="opponent-turn-badge" id="opponent-turn-badge" data-text="{msg.turn_badge_them}">Vez dele</span>
            <div class="opponent-nameplate" id="opponent-nameplate">
              <span class="opponent-name-line">
                <b class="opponent-display-name eles-name" id="opponent-display-name"><span class="as-cast" data-text="{msg[opponent_name]}"></span><span class="as-handle" data-text="{opponent_handle}"></span></b>
                <span class="opponent-online-badge" id="opponent-online-badge" data-text="{msg.online_short}">Online</span>
              </span>
              <span class="opponent-role-desc" id="opponent-role-desc"><span class="as-cast" data-text="{msg.role_bot}"></span><span class="as-handle" data-text="{msg.online_short}"></span></span>
            </div>
          </div>
          <div class="opponent-dialogue-wrap">
            <div class="speech-bubble" id="opponent-speech-bubble" data-state="{dialogue_state}">
              <div class="bubble-header">
                <span class="bubble-speaker eles-name"><span class="as-cast" data-text="{msg[opponent_name]}"></span><span class="as-handle" data-text="{opponent_handle}"></span></span>
              </div>
              <div class="opponent-talk" id="opponent-talk" data-text="{msg[dialogue_key]}&#10;{worth}&#10;{msg[name_key]}{name_handle}" data-text-format="speech"></div>
            </div>
          </div>
        </div>
        <!-- The seats across the table. Their cards are rows like yours; only
             the reading differs, so what they show is a back. Held rows are
             ordered by slot, which interleaves the seats, and a template
             cannot group what it binds. -->
        <div class="seats" id="seats" data-tell="{tell}">
          <div class="seat-row house" id="house-eles1" data-seat="eles1"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.eles1" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}"></div>
            </template>
          </div>
          <!-- Your partner's cards carry their faces, turned up only while a
               brink is yours to decide: the one moment the rules let a pair
               look at each other's hands. -->
          <div class="seat-row house" data-seat="parca"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.parca" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}"><span class="card face" data-card="{card}" data-suit="{suit}" data-manilha="{manilha}"><span class="corner tl"><b data-text="{rank}"></b><i data-text="{suit}"></i></span><span class="mark" data-text="{face}"></span><span class="corner br"><b data-text="{rank}"></b><i data-text="{suit}"></i></span></span></div>
            </template>
          </div>
          <div class="seat-row house" data-seat="eles2"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.eles2" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}"></div>
            </template>
          </div>
          <!-- The third pair. A table of two sides deals these no cards, so
               the rows stand empty and the felt shows nothing of them. -->
          <div class="seat-row house" data-seat="eles3"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.eles3" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}"></div>
            </template>
          </div>
          <div class="seat-row house" data-seat="eles4"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.eles4" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}"></div>
            </template>
          </div>
        </div>
        <!-- The felt. Three regions over the play log, one per rodada, so the
             terminal owns every card that lies here: a card already down is
             never replaced under the eye, and a rodada that closes keeps its
             own node and can therefore be transitioned. The wrapper is the
             round only so the rodadas can filter on it; it lays out nothing. -->
        <div class="matwrap" data-live="round" data-filter="current=eq.yes" data-order="created_at.desc">
          <template data-item>
            <div class="matcards" id="matcards" data-v1="{v1}" data-v2="{v2}" data-v3="{v3}">
              <div class="trick" data-t="1" data-live="play" data-order="seq.asc"
                   data-filter="round_id=eq.{id}&amp;vaza=eq.1&amp;kind=eq.card">
                <template data-item>
                  <div class="played" data-seat="{seat}" data-display-seat="{display_seat}" data-from-slot="{from_slot}" data-win="{win}" data-said="{said}" style="view-transition-name: card-{card}; --lie:{lie}"><span class="card" data-card="{card}" data-suit="{suit}" data-manilha="{manilha}"><span class="corner tl"><b data-text="{rank}"></b><i data-text="{suit}"></i></span><span class="mark" data-text="{face}"></span><span class="corner br"><b data-text="{rank}"></b><i data-text="{suit}"></i></span></span></div>
                </template>
              </div>
              <div class="trick" data-t="2" data-live="play" data-order="seq.asc"
                   data-filter="round_id=eq.{id}&amp;vaza=eq.2&amp;kind=eq.card">
                <template data-item>
                  <div class="played" data-seat="{seat}" data-display-seat="{display_seat}" data-from-slot="{from_slot}" data-win="{win}" data-said="{said}" style="view-transition-name: card-{card}; --lie:{lie}"><span class="card" data-card="{card}" data-suit="{suit}" data-manilha="{manilha}"><span class="corner tl"><b data-text="{rank}"></b><i data-text="{suit}"></i></span><span class="mark" data-text="{face}"></span><span class="corner br"><b data-text="{rank}"></b><i data-text="{suit}"></i></span></span></div>
                </template>
              </div>
              <div class="trick" data-t="3" data-live="play" data-order="seq.asc"
                   data-filter="round_id=eq.{id}&amp;vaza=eq.3&amp;kind=eq.card">
                <template data-item>
                  <div class="played" data-seat="{seat}" data-display-seat="{display_seat}" data-from-slot="{from_slot}" data-win="{win}" data-said="{said}" style="view-transition-name: card-{card}; --lie:{lie}"><span class="card" data-card="{card}" data-suit="{suit}" data-manilha="{manilha}"><span class="corner tl"><b data-text="{rank}"></b><i data-text="{suit}"></i></span><span class="mark" data-text="{face}"></span><span class="corner br"><b data-text="{rank}"></b><i data-text="{suit}"></i></span></span></div>
                </template>
              </div>
            </div>
          </template>
        </div>
        <div class="table-instruction-bar" id="table-instruction-bar">
          <div class="talk" data-t="{said_t}" data-text="{msg[said]}&#10;{worth}&#10;{msg[name_key]}{name_handle}" data-text-format="speech"></div>
          <p class="refusal" role="status" data-text="{msg.play_refusal}">A mesa não conseguiu registrar a jogada.</p>
        </div>
        <div class="player-dialogue-wrap" id="player-dialogue-wrap" data-active="{player_shout_state}" data-t="{shout_anim}" aria-live="polite">
          <div class="player-speech-bubble" id="player-speech-bubble">
            <span class="player-talk" id="player-talk" data-text="“{msg[shout_word]}”"></span>
          </div>
        </div>
        <div class="encobrir-bar" data-live="round" data-filter="current=eq.yes" \#(_arenaReads)
             data-empty-row='{"id":"","said":""}'>
          <button type="button" class="btn-encobrir" id="btn-encobrir" data-on-click="arena" title="{msg.encobrir_title_tip}">
            <span aria-hidden="true">🙈</span>
            <span data-text="{msg.encobrir_btn}">Encobrir</span>
          </button>
        </div>
        <!-- The hand the terminal renders. Item nodes persist across refreshes
             keyed by row id, so a card survives every unrelated redraw and can
             be animated out when it is spent (ir decision-29). -->
        <div class="seat-row mine" id="seat-you"
             data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.you" data-order="slot.asc"
             \#(_arenaReads)>
          <!-- The card carries no whitespace of its own: a text node between
               these spans lands in the card's own text, and what the card then
               reads as would depend on how the spans wrap. -->
          <template data-item>
            <button type="button" class="card" data-on-click="arena" data-row="{id}" data-round="{round_id}" data-card="{card}" data-slot="{slot}"
                    data-suit="{suit}" data-manilha="{manilha}"
                    style="view-transition-name: card-{card};"
                    disabled="{blocked}"><span class="sr-only" data-text="{msg.play_card}">Jogar </span><span class="corner tl"><b data-text="{rank}"></b><i data-text="{suit}"></i></span><span class="mark" data-text="{face}"></span><span class="corner br"><b data-text="{rank}"></b><i data-text="{suit}"></i></span></button>
          </template>
        </div>

        <!-- Game over verdict lands above actions in the flow -->
        <div class="over" id="over">
          <p class="over-line" id="over-line" data-text="{msg[over_key]}&#10;{worth}&#10;{msg[name_key]}{name_handle}" data-text-format="speech"></p>
          <p class="over-say" id="over-say" data-text="{msg[said]}&#10;{worth}&#10;{msg[name_key]}{name_handle}" data-text-format="speech"></p>
          <a class="act ghost" data-route="regras" data-text="{msg.view_rules}">Ver as regras</a>
        </div>

        <!-- The bet's affordances belong to the hand they are about, so they
             read it. Singleton regions rather than items: a list region sweeps
             away every child that is not one of its rows, and the fallback row
             keeps the buttons on the table before a hand exists. -->
        <div class="wager-controls" data-live="round" data-filter="current=eq.yes"
             \#(_arenaReads)
             data-empty-row='\#(_round)'
             style="display: contents;">
        <div class="actions" id="actions"
             data-leader="{leader}" \#(_arenaReads)>
          <button type="button" class="act" id="btn-truco" data-on-click="arena" disabled="{truco_blocked}" title="{msg[truco_title]}" data-text="{msg[truco_label]}" data-text-format="uppercase">TRUCO!</button>
          <!-- The second wager. One rail carries whichever call is live, and
               the truco standing underneath it is drawn rather than remembered
               (ir decision-33). Which wager the rail is asking about is said in
               its label and carried by colour, not by position. -->
          <div class="suspended" aria-live="polite">
            <b data-text="{msg.truco_waiting}">Truco espera</b>
            <span class="stood" data-text="{stake}"></span>
          </div>
          <div class="rail-label"><span data-text="{msg.rail_envido}">Responder o envido</span> <b class="wager-stood" data-text="{envido_rung}"></b></div>
          <button type="button" class="act wager hot" id="btn-envido-take" data-on-click="arena" data-text="{msg.envido_took}">Quero</button>
          <button type="button" class="act wager risk" id="btn-envido-run" data-on-click="arena" data-text="{msg.envido_ran}">Não quero</button>
          <button type="button" class="act wager" id="btn-envido" data-on-click="arena" data-text="{msg.call_envido}">ENVIDO!</button>
          <button type="button" class="act wager" id="btn-envido-real" data-on-click="arena" data-text="{msg.envido_real}">REAL ENVIDO!</button>
          <button type="button" class="act wager" id="btn-envido-falta" data-on-click="arena" data-text="{msg.envido_falta}">FALTA ENVIDO!</button>
          <button type="button" class="act bloom" id="btn-flor" data-on-click="arena" data-text="{msg.flor}">FLOR!</button>
          <!-- The brink's decision, offered only while it is this seat's. -->
          <button type="button" class="act" id="btn-brink-play" data-on-click="arena" data-text="{msg.brink_play}">Jogar a mão</button>
          <button type="button" class="act risk" id="btn-brink-run" data-on-click="arena" data-text="{msg.brink_run}">Correr</button>
          <button type="button" class="act ghost" id="btn-next" data-on-click="arena" data-text="{msg.next_hand}">Próxima mão</button>
          <button type="button" class="act ghost risk" id="btn-resign" data-on-click="arena" data-text="{msg.resign}">Abandonar</button>
          <!-- In with the other things the table can be asked for, because a
               control has to sit inside a region to be one. -->
          <button type="button" class="act" id="btn-again" data-on-click="arena" data-text="{msg.play_again}">Outra partida</button>
          <button type="button" class="act" id="btn-start" data-on-click="arena" data-text="{msg.start_match}">Começar partida</button>
        </div>

        <div class="answers" id="answers">
          <!-- A price is where a language wants a plural. -->
          <button type="button" class="act" id="btn-accept" data-on-click="arena"><b data-text="{msg.accept}">Aceito</b><small data-text="{msg.worth_points}"></small></button>
          <button type="button" class="act hot" id="btn-raise" data-on-click="arena" disabled="{raise_blocked}"><b data-text="{msg[raise_label]}" data-text-format="uppercase">Aumentar</b><small data-text="{msg[raise_hint]}&#10;{next_rung}&#10;" data-text-format="speech"></small></button>
          <button type="button" class="act risk" id="btn-run" data-on-click="arena"><b data-text="{msg.fold}">Corro</b><small data-text="{msg.felt_they_take}&#10;{stake}&#10;" data-text-format="speech"></small></button>
        </div>

        <div class="boteco-shouts">
          <button type="button" class="btn-quick-shout" id="shout-chama" data-on-click="arena" data-text="{msg.shout_chama}">Chama!</button>
          <button type="button" class="btn-quick-shout" id="shout-manda" data-on-click="arena" data-text="{msg.shout_manda}">Manda vir!</button>
          <button type="button" class="btn-quick-shout" id="shout-desce" data-on-click="arena" data-text="{msg.shout_desce}">Desce a madeira!</button>
          <button type="button" class="btn-quick-shout" id="shout-chorou" data-on-click="arena" data-text="{msg.shout_chorou}">Chorou, parou!</button>
        </div>


        <div class="nomatch" id="nomatch">
          <p class="over-line" data-text="{msg.empty_table}">Mesa vazia</p>
          <p data-text="{msg.empty_table_desc}">O baralho está cortado. Senta que já sai mão.</p>
        </div>
      </div>
        </template>
      </div>

    </div>
  </div>

  <!-- The bar: root.cue's `lobby`, the fold machines/lobby.js, which holds
       this tab's presence lease. Every list is a region over the machines'
       surface rows and every gesture is a row the fold writes. -->
  <!-- Whether the bar shows you in the round: the lobby fold's word for it,
       ahead of the seat while a switch is in flight, so every mark of it —
       the switch, the stamp, the pill, your row — moves on the click. The
       seat itself still wakes the fold. -->
  <span id="presence-shown" hidden data-live="lobby_tab" data-filter="id=eq.the" data-empty=""><template data-item><i data-shown="{shown}"></i></template></span>
  <span hidden data-live="truco_presence_seat" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_presence_command" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_match_seat" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_match_public" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_call_seat" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_call_open" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_voice_seat" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_match_open" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_match_command" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
  <!-- An online match seats you at this table: your seat's view, the receipts
       of your commands, a join's answer, what the table's voices say and a code
       typed in the bar each wake the arena's fold. -->
  <span hidden data-live="truco_match_seat" data-on-mutation="arena" \#(_arenaReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_match_command" data-on-mutation="arena" \#(_arenaReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_match_open" data-on-mutation="arena" \#(_arenaReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_voice_seat" data-on-mutation="arena" \#(_arenaReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_voice_command" data-on-mutation="arena" \#(_arenaReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_voice_open" data-on-mutation="arena" \#(_arenaReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="truco_voice_public" data-on-mutation="arena" \#(_arenaReads) data-empty=""><template data-item><i></i></template></span>
  <span hidden data-live="lobby_tab" data-filter="id=eq.the" data-on-mutation="arena" \#(_arenaReads) data-empty=""><template data-item><i></i></template></span>
  <div id="modal-online" popover class="boteco-modal">
    <div class="boteco-modal-frame pad">
      <header class="modal-header">
        <span class="avatar" aria-hidden="true">🌐</span>
        <div class="modal-title-wrap">
          <h3 data-text="{msg.online_bar_heading}">Bar Online · Boteco Truco</h3>
          <span class="modal-subtitle" data-text="{msg.online_bar_subtitle}">Jogue ao vivo com outros jogadores reais</span>
        </div>
        <button type="button" class="modal-close" popovertarget="modal-online" popovertargetaction="hide" aria-label="{msg.close}">✕</button>
      </header>

      <div class="modal-body">
        <section class="lobby-identity-bar">
          <!-- The comanda: the name the bar knows you by, written on the slip
               itself. The field is the writing — it shows the saved name and
               is edited in place; the form has no button, so a change saves on
               Enter or when the field is left, and clearing it leaves you
               unnamed. The stamp in its head says
               whether you are in the round (lobby.css, off #presence-shown). -->
          <div class="comanda" data-live="player" data-filter="id=eq.you" data-empty-row='{"id":"you","handle":""}'>
            <div class="comanda-head">
              <span class="comanda-title" data-text="{msg.comanda}">Comanda</span>
              <span class="comanda-editing">
                <span class="comanda-keys" aria-hidden="true"><kbd data-text="{msg.enter_key}">Enter</kbd> <span data-text="{msg.enter_saves}">salva</span></span>
              </span>
              <span class="stamp stamp-in" data-text="{msg.in_round}">Na roda</span>
              <span class="stamp stamp-out" data-text="{msg.out_of_round}">Fora da roda</span>
            </div>
            <form id="form-handle" class="comanda-line" data-form="handle" data-entity="player" data-action="upsert">
              <label for="my-handle-input" class="comanda-label" data-text="{msg.nickname}">Apelido</label>
              <input type="hidden" name="id" data-value="you" />
              <input type="text" id="my-handle-input" class="comanda-name" name="handle" data-value="{handle}" maxlength="20" placeholder="{msg.handle_placeholder}" autocomplete="nickname" spellcheck="false" />
              <label for="my-handle-input" class="comanda-pen" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></label>
            </form>
          </div>
          <div class="identity-toggle-wrap" data-live="lobby_tab" data-filter="id=eq.the&me=neq." data-on-mutation="lobby" \#(_lobbyReads) data-empty="">
            <template data-item data-when="shown=eq.show">
              <button type="button" class="btn-online-toggle" id="btn-toggle-online" role="switch" aria-checked="true" data-online="true" title="{msg.online_bar_title}" aria-label="{msg.in_round}" data-on-click="lobby">
                <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                <span class="toggle-label-off" data-text="{msg.enter_round}">Entrar na roda</span>
                <span class="toggle-label-on" data-text="{msg.in_round}">Na roda</span>
              </button>
            </template>
            <template data-item>
              <button type="button" class="btn-online-toggle" id="btn-toggle-online" role="switch" aria-checked="false" data-online="false" title="{msg.online_bar_title}" aria-label="{msg.in_round}" data-on-click="lobby">
                <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
                <span class="toggle-label-off" data-text="{msg.enter_round}">Entrar na roda</span>
                <span class="toggle-label-on" data-text="{msg.in_round}">Na roda</span>
              </button>
            </template>
          </div>
        </section>

        <div class="lobby-note" data-live="lobby_tab" data-filter="id=eq.the" data-empty="">
          <template data-item><p class="join-err" role="alert" data-text="{msg[note]}"></p></template>
        </div>

        <section class="modal-sec">
          <div class="sec-header-row">
            <label data-text="{msg.players_in_bar}">Quem está na roda</label>
          </div>
          <div class="lobby-players-list" role="region" aria-live="polite">
            <!-- While you are offline the list holds no row of yours; this one
                 says so, and lobby.css drops it once you are visible. -->
            <p class="lobby-player-row self-offline" data-text="{msg.identity_offline_row}">Você está offline — fique online para aparecer aqui.</p>
            <!-- Your own row keeps the list from ever being empty, so the empty
                 slot's word is said here while you are the only one in it. -->
            <!-- You, first, drawn from your own name the moment you are shown,
                 rather than waiting on the listing to bring you back. -->
            <div data-live="player" data-filter="id=eq.you" data-empty="">
              <template data-item><div class="lobby-player-row self"><span class="player-avatar-mini" aria-hidden="true">👤</span><div class="player-info-wrap"><b class="player-handle" data-text="{handle}"></b></div><span class="you-tag" data-text="{msg.you}">Você</span></div></template>
            </div>
            <p class="lobby-alone" data-text="{msg.lobby_empty}">Ninguém mais na roda agora.</p>
            <div data-live="lobby_tab" data-filter="id=eq.the" data-empty-row='\#(_tab)' data-on-mutation="lobby" \#(_lobbyReads)>
              <template data-item>
                <div class="lobby-tab-row">
                  <span hidden data-live="truco_presence_lease" data-filter="id=eq.{lease}" data-on-mutation="lease" data-empty=""></span>
                  <div id="lobby-players-list" class="lobby-tab-row" data-live="truco_presence_public" data-order="name.asc" data-project='{"me":{"eq":["id","{me}"]}}' \#(_lobbyReads)
                       data-empty="">
                    <template data-item data-when="me=eq.false">
                      <div class="lobby-player-row">
                        <span class="player-avatar-mini" aria-hidden="true">👤</span>
                        <div class="player-info-wrap">
                          <b class="player-handle" data-text="{name}"></b>
                        </div>
                        <button type="button" id="challenge-{id}" class="btn-challenge" data-on-click="lobby">
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M9.5 6.5 13 3h3v3l-3.5 3.5"/><path d="M5 14l-2 2 3 3 2-2"/></svg>
                          <span data-text="{msg.challenge}">Desafiar!</span>
                        </button>
                        <button type="button" id="summon-{id}" class="btn-bar btn-summon" data-on-click="lobby" data-text="{msg.summon}">Chamar</button>
                      </div>
                    </template>
                    <template data-item><i class="listed-self" hidden></i></template>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </section>

        <!-- Your table while it waits (lobby_tab's chairs, machines/lobby.js).
             A free chair picked is the one the next call from the roda fills;
             a called one, tapped, takes the call back. -->
        <section class="modal-sec your-table">
          <label data-text="{msg.your_table}">Sua mesa</label>
          <div class="mesa-diagram">
            <div class="mesa-cloth" aria-hidden="true"><span class="mesa-ring"></span><span class="mesa-deck"><i></i><i></i><b>7♥</b></span></div>
            <div class="mesa-chairs" data-live="chair" data-order="id.asc" data-empty="" \#(_lobbyReads)>
              <template data-item data-when="state=eq.you">
                <div class="chair" data-seat="{id}" data-at="{at}" data-team="{team}" data-state="{state}"><span hidden data-live="truco_voice_public" data-filter="talk=eq.{talk}" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span><span class="chair-seat" aria-hidden="true"></span><b class="chair-name" data-text="{name}"></b><span class="chair-team"><span class="team-nos" data-text="{msg.team_nos}">Nós</span><span class="team-eles" data-text="{msg.team_eles}">Eles</span><span class="team-outros" data-text="{msg.team_outros}">Outros</span></span></div>
              </template>
              <template data-item data-when="state=eq.taken">
                <div class="chair" data-at="{at}" data-team="{team}" data-state="{state}"><span class="chair-seat" aria-hidden="true"></span><b class="chair-name" data-text="{name}"></b><span class="chair-team"><span class="team-nos" data-text="{msg.team_nos}">Nós</span><span class="team-eles" data-text="{msg.team_eles}">Eles</span><span class="team-outros" data-text="{msg.team_outros}">Outros</span></span></div>
              </template>
              <template data-item data-when="state=eq.called">
                <button type="button" id="chair-{id}" class="chair" data-at="{at}" data-team="{team}" data-state="{state}" data-on-click="lobby"><span class="chair-seat" aria-hidden="true"></span><b class="chair-name" data-text="{name}"></b><span class="chair-team" data-text="{msg.chair_called}">chamado</span></button>
              </template>
              <template data-item>
                <button type="button" id="chair-{id}" class="chair" data-at="{at}" data-team="{team}" data-state="{state}" data-picked="{picked}" data-callable="{callable}" data-on-click="lobby"><span class="chair-seat" aria-hidden="true">+</span><b class="chair-name" data-text="{msg.chair_free}">Lugar livre</b><span class="chair-team"><span class="team-nos" data-text="{msg.team_nos}">Nós</span><span class="team-eles" data-text="{msg.team_eles}">Eles</span><span class="team-outros" data-text="{msg.team_outros}">Outros</span></span></button>
              </template>
            </div>
          </div>
          <p class="modal-hint" data-text="{msg.your_table_hint}">Toque numa cadeira livre e chame alguém da roda pra ela, ou mande o código. A primeira mão sai quando todas as cadeiras tiverem gente.</p>
          <div class="table-code" data-live="lobby_tab" data-filter="id=eq.the" data-empty="">
            <template data-item data-when="code=eq."><i hidden></i></template>
            <template data-item><p class="table-code-line"><span data-text="{msg.table_code}">Código da sua mesa</span> <code id="table-code" data-text="{code}"></code></p></template>
          </div>
          <div class="your-table-actions" data-live="lobby_tab" data-filter="id=eq.the" data-empty-row='\#(_tab)' \#(_lobbyReads)>
            <template data-item><div class="your-table-buttons"><button type="button" id="close-table" class="btn-ghost" data-on-click="lobby" data-text="{msg.close_table}">Fechar mesa</button><button type="button" id="leave-table" class="btn-ghost" data-on-click="lobby" data-text="{msg.leave_table}">Sair da mesa</button></div></template>
          </div>
        </section>

        <!-- The tables waiting on the bar for a player, by who opened them. -->
        <section class="modal-sec bar-tables">
          <label data-text="{msg.tables_free_seats}">Mesas com lugar livre</label>
          <div class="listed-tables" data-live="listed_table" data-order="id.asc" data-empty="" \#(_arenaReads)>
            <template data-item>
              <div class="listed-table">
                <div class="listed-info">
                  <b><span data-text="{msg.table_of}">Mesa de</span> <span data-text="{host}"></span></b>
                  <span class="listed-rules"><span data-text="{msg[rules]}"></span> · <span data-text="{seating}"></span> · <span data-text="{msg.free_seats}">lugares livres:</span> <span data-text="{missing}"></span></span>
                </div>
                <button type="button" id="sit-{id}" class="btn-bar" data-on-click="arena" data-text="{msg.sit}">Sentar</button>
                <span hidden data-live="truco_voice_public" data-filter="talk=eq.{talk}" data-on-mutation="lobby" \#(_lobbyReads) data-empty=""><template data-item><i></i></template></span>
              </div>
            </template>
          </div>
        </section>

        <!-- A table of your own: its seating, and whether the bar lists it or
             only its code and your calls seat anyone at it. -->
        <section class="modal-sec open-table">
          <label data-text="{msg.open_table_heading}">Abrir uma mesa</label>
          <div class="bar-settings" data-live="lobby_tab" data-filter="id=eq.the" data-empty="" \#(_lobbyReads)>
            <template data-item>
              <div class="bar-settings-item">
              <div class="format-picker" role="group" aria-label="{msg.format_label}" data-format="{format}">
                <button type="button" id="format-1v1" class="seg" data-on-click="lobby">1v1</button>
                <button type="button" id="format-2v2" class="seg" data-on-click="lobby">2v2</button>
                <button type="button" id="format-2v2v2" class="seg" data-on-click="lobby">2v2v2</button>
              </div>
              <button type="button" id="reserved-toggle" class="reserve-switch" role="switch" aria-checked="{reserved}" data-on-click="lobby"><span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span><span data-text="{msg.reserved_label}">Reservada</span></button>
              <p class="modal-hint" data-text="{msg.reserved_hint}">Uma mesa reservada não aparece na lista do bar: só senta quem for chamado ou tiver o código.</p>
              </div>
            </template>
          </div>
          <div class="invite-box" data-live="lobby_tab" data-filter="id=eq.the" data-empty="" \#(_arenaReads)>
            <template data-item><button type="button" id="online-create-{msg.table_code_words}" class="btn-bar" data-on-click="arena" data-text="{msg.open_table}">Abrir mesa</button></template>
          </div>
        </section>

        <!-- A table a friend opened and sent the code of. -->
        <section class="modal-sec have-code">
          <label for="input-join-code" data-text="{msg.have_code}">Tem um código?</label>
          <form class="join-box" data-form="join-table" data-entity="lobby_tab" data-action="upsert">
            <input type="hidden" name="id" data-value="the" />
            <input type="text" id="input-join-code" name="join" class="boteco-input" placeholder="{msg.join_placeholder}" autocomplete="off" required pattern="\s*[A-Za-z]+-[A-Za-z]+-[A-Za-z]+-[A-Za-z0-9]{4}\s*" maxlength="40" aria-describedby="join-code-invalid" />
            <button type="submit" id="btn-submit-join" class="btn-bar" data-text="{msg.sit}">Sentar</button>
            <p class="invalid" id="join-code-invalid" hidden data-text="{msg.join_code_invalid}">Um código de mesa são três palavras e quatro letras ou números.</p>
          </form>
        </section>

      </div>
    </div>
  </div>

  <!-- A call to a chair of a table waiting for you: answering it sits you there. -->
  <div class="challenges calls" data-live="truco_call_seat" data-filter="phase=eq.offered" data-on-mutation="lobby" \#(_lobbyReads) data-empty="">
    <template data-item data-when="seat=eq.target">
      <aside class="incoming-challenge-banner incoming-call" role="alert">
        <div class="challenge-alert-content">
          <div class="challenge-text">
            <strong data-text="{caller_name}"></strong>
            <span data-text="{msg.called_you}">te chamou pra mesa</span>
            <span class="call-rules" data-text="{seating}"></span>
          </div>
        </div>
        <div class="challenge-alert-actions">
          <button type="button" id="call-accept-{id}" class="btn-bar" data-on-click="lobby" data-text="{msg.sit}">Sentar</button>
          <button type="button" id="call-decline-{id}" class="btn-ghost" data-on-click="lobby" data-text="{msg.not_now}">Agora não</button>
        </div>
      </aside>
    </template>
    <template data-item><i hidden></i></template>
  </div>

  <!-- Fixed over the table, so the board's grid never sees it: offers stack
       in it, each answerable. -->
  <div class="challenges" data-live="truco_challenge_seat" data-filter="phase=eq.offered" data-on-mutation="lobby" \#(_lobbyReads) data-empty="">
    <template data-item data-when="seat=eq.target">
      <aside class="incoming-challenge-banner" role="alert">
        <div class="challenge-alert-content">
          <span class="challenge-icon">⚔️</span>
          <div class="challenge-text">
            <strong data-text="{inviter_name}"></strong>
            <span data-text="{msg.challenged_you}">te desafiou para uma partida de Truco!</span>
          </div>
        </div>
        <div class="challenge-alert-actions">
          <button type="button" id="accept-{id}" class="act brass btn-challenge-accept" data-on-click="lobby" data-text="{msg.accept_challenge}">✓ Aceitar</button>
          <button type="button" id="decline-{id}" class="act ghost" data-on-click="lobby" data-text="{msg.decline_challenge}">✕ Recusar</button>
        </div>
      </aside>
    </template>
    <template data-item>
      <div class="challenge-waiting-overlay">
        <div class="waiting-card">
          <div class="spinner-icon">⏳</div>
          <h4 data-text="{msg.challenging}">Desafiando...</h4>
          <p data-text="{msg.waiting_accept}">Aguardando o adversário aceitar a partida no bar.</p>
          <button type="button" id="cancel-{id}" class="act ghost" data-on-click="lobby" data-text="{msg.cancel_challenge}">Cancelar Desafio</button>
        </div>
      </div>
    </template>
  </div>

</section>
"""#
