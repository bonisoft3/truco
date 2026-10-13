// The arena's markup, CUE-composed so the four settings pickers are instances
// of the graduated omnishell--picker; everything else rides verbatim in the raw
// string below (only \#(...) interpolates there). Emitted to
// shell/screens/arena.html by write.ts, do-not-edit header included.
package truco

import (
	omni "github.com/bonisoft3/omnishell/components"
)

_wagerMachineAttr: (omni.#attrJSON & {in: [#WagerMachine, #EnvidoMachine]}).out

// What a rules change does to the sitting, carried on every variant/seats
// arrow: the score goes back to nil and the seed respins, so the deal is new
// without anybody having to draw (ir decision-06). A finished match is played
// again under the new rule, so it is playing once more. The standing hand is
// the fold's to retire — a round is not the match row.
_reset: {
	us_score:     "0"
	them_score:   "0"
	others_score: "0"
	hand_no:      "1"
	winner:       ""
	status:       "playing"
	seed: {type: "spun"}
	my_seat: "you"
}

// Every arrow is guarded on a sitting existing: before the fold's first match
// lands, the slots bind their fallback rows, and a write on a fallback would
// mint a junk match.
_sitting: {type: "sitting"}

// What a variant costs to win is part of its name in the menu — "até 12
// pontos", "a 30 puntos" — so the goal reads as words in the reader's
// language rather than a bare number beside the name. The authority is the
// dealer's own PRICE (shell/handlers/table.js); tests/arena.test.ts reads it
// and every catalogue's menu label, and fails the moment they disagree.
_pickerVariant: omni.#Picker & {
	collection: "match"
	key:        "variant"
	field:      "variant"
	label:      "Variante"
	msgLabel:   "msg.picker_variant"
	filter:     "current=eq.yes"
	emptyRow:   #"{"id":"","variant":"mineiro"}"#
	initial:    "mineiro"
	readout:    "text"
	guard:      _sitting
	// Each row is tagged with the country that plays it: the screen's own
	// locale lifts its country's group to the top, and picking a country
	// deals that country's truco (the felt's followCountry, below). What each table
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
	emptyRow:   #"{"id":"","seats":"1v1"}"#
	initial:    "1v1"
	readout:    "text"
	guard:      _sitting
	// The stake resets to the ladder's base of the variant STANDING, which no
	// literal can say. Three pairs is the dourado tables' seating and theirs
	// alone, so the variant can move with the seats: six seats deal a dourado
	// table, and fewer turn one back into mineiro (shell/handlers/variant2.js,
	// variant3.js). The variant menu makes the same promise from its side
	// (seats2.js).
	options: [
		{name: "1v1", label: "1v1", item: "1v1 · você e um deles", msg: "msg.seats_1v1_item", msgLabel: "msg.seats_1v1_short", assign: _reset & {stake: {type: "stake0"}, variant: {type: "variant2"}}},
		{name: "2v2", label: "2v2", item: "2v2 · com o parça", msg: "msg.seats_2v2_item", msgLabel: "msg.seats_2v2_short", assign: _reset & {stake: {type: "stake0"}, variant: {type: "variant2"}}},
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
	emptyRow:   #"{"id":"","opponent":"nezinho"}"#
	initial:    "nezinho"
	readout:    "text"
	guard:      _sitting
	// opponent_name is written as a message KEY, not a name: a bot is the app's
	// own copy and each country reads one its players would use, while an online
	// opponent's handle goes through the same {msg[opponent_name]} binding
	// unmatched and renders as itself.
	options: [
		{name: "nezinho", label: "Robôs", item: "Seu Nezinho · Paulista", msg: "msg.opponent_nezinho_item", msgLabel: "msg.bots", assign: _reset & {opponent: "nezinho", opponent_name: "opponent_nezinho", stake: {type: "stake0"}}},
		{name: "tiao_queijo", label: "Robôs", item: "Tião do Queijo · Mineiro", msg: "msg.opponent_tiao_queijo_item", msgLabel: "msg.bots", assign: _reset & {opponent: "tiao_queijo", opponent_name: "opponent_tiao_queijo", stake: {type: "stake0"}}},
		{name: "xiru", label: "Robôs", item: "Xirú Velho · Gaúcho", msg: "msg.opponent_xiru_item", msgLabel: "msg.bots", assign: _reset & {opponent: "xiru", opponent_name: "opponent_xiru", stake: {type: "stake0"}}},
		{name: "osvaldo", label: "Robôs", item: "Don Osvaldo · Argentino", msg: "msg.opponent_osvaldo_item", msgLabel: "msg.bots", assign: _reset & {opponent: "osvaldo", opponent_name: "opponent_osvaldo", stake: {type: "stake0"}}},
		{name: "tabare", label: "Robôs", item: "Don Tabaré · Uruguaio", msg: "msg.opponent_tabare_item", msgLabel: "msg.bots", assign: _reset & {opponent: "tabare", opponent_name: "opponent_tabare", stake: {type: "stake0"}}},
		{name: "jordi", label: "Robôs", item: "L'Oncle Jordi · Truc", msg: "msg.opponent_jordi_item", msgLabel: "msg.bots", assign: _reset & {opponent: "jordi", opponent_name: "opponent_jordi", stake: {type: "stake0"}}},
		{name: "cida", label: "Robôs", item: "Dona Cida · Bar", msg: "msg.opponent_cida_item", msgLabel: "msg.bots", assign: _reset & {opponent: "cida", opponent_name: "opponent_cida", stake: {type: "stake0"}}},
		{name: "tiao", label: "Robôs", item: "Tião Pandeiro · Bar", msg: "msg.opponent_tiao_item", msgLabel: "msg.bots", assign: _reset & {opponent: "tiao", opponent_name: "opponent_tiao", stake: {type: "stake0"}}},
		{name: "ze", label: "Robôs", item: "Zé da Bicicleta · Bar", msg: "msg.opponent_ze_item", msgLabel: "msg.bots", assign: _reset & {opponent: "ze", opponent_name: "opponent_ze", stake: {type: "stake0"}}},
	]
	readouts: [
		{name: "online", label: "Online", msgLabel: "msg.online_short"},
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
	emptyRow: #"{"id":"","theme":"xadrez"}"#
	initial:  "xadrez"
	readout:  "text"
	guard:    _sitting
	options: [
		{name: "xadrez", label: "Xadrez", item: "Toalha xadrez", msg: "msg.theme_xadrez_item", msgLabel: "msg.theme_xadrez_short"},
		{name: "formica", label: "Fórmica", item: "Fórmica azul", msg: "msg.theme_formica_item", msgLabel: "msg.theme_formica_short"},
		{name: "neon", label: "Neon", item: "Neon do bar", msg: "msg.theme_neon_item", msgLabel: "msg.theme_neon_short"},
		{name: "madeira", label: "Madeira", item: "Madeira crua", msg: "msg.theme_madeira_item", msgLabel: "msg.theme_madeira_short"},
	]
}

// The country picker is not an omni.#Picker: it writes nothing to a row, it
// navigates. Picking a country is picking that country's own locale address
// for this same screen (data-route + data-locale, fragment.js routeHref) — a
// real link, crawlable and bookmarkable, not a machine over a match column.
// A country's own name and its flag are endonyms and never translate: every
// row reads its name from the catalogue like any other copy, and all four
// catalogues spell it identically on purpose (every messages/*.json agrees),
// which is what lets the flag glyph beside it live as plain markup rather
// than through a key of its own. The row does not name the country's truco —
// the variant picker beside it does — but picking the country deals it: the
// felt's script switches the table to a variant that country plays when the
// one on it is not.
//
// The trigger names the country of the screen's OWN locale, flag and name:
// four <i> spans ride the markup always, and [data-locale] on the screen
// (screen.js, applyLocale) plus this component's own <style> show exactly one
// — the same technique omnishell--picker's readout:"text" uses for a bound
// column, spent here on the document's own locale instead. The popover marks
// the same match with data-locale-current, which the interpreter fills beside
// the href on every locale switch.
_pickerCountry: #"""
	<div class="picker" data-picker="country">
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
	    <li><a data-route="arena" data-locale="pt-BR" data-locale-current="page"><b aria-hidden="true">🇧🇷</b> <span data-text="{msg.country_br}">Brasil</span></a></li>
	    <li><a data-route="arena" data-locale="es-AR" data-locale-current="page"><b aria-hidden="true">🇦🇷</b> <span data-text="{msg.country_ar}">Argentina</span></a></li>
	    <li><a data-route="arena" data-locale="es-UY" data-locale-current="page"><b aria-hidden="true">🇺🇾</b> <span data-text="{msg.country_uy}">Uruguay</span></a></li>
	    <li><a data-route="arena" data-locale="es-PY" data-locale-current="page"><b aria-hidden="true">🇵🇾</b> <span data-text="{msg.country_py}">Paraguay</span></a></li>
	    <li><a data-route="arena" data-locale="ca-ES" data-locale-current="page"><b aria-hidden="true">🇪🇸</b> <span data-text="{msg.country_es}">Espanya</span></a></li>
	  </ul>
	</div>
	"""#

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
          <h1 class="tavern-name" data-text="{msg.tavern_title}">Boteco do Seu Nezinho · Mesa 1</h1>
          <span id="tavern-room-badge" class="tavern-room-badge" style="display: none;"></span>
        </div>
        <span class="avatar" id="seatbar-avatar" aria-hidden="true">V</span>
        <span class="who">
          <span class="who-title-wrap">
            <b id="seatbar-player-name" data-text="{msg.you}">Você</b>
            <button type="button" class="btn-edit-handle" id="btn-edit-seatbar-handle" popovertarget="modal-online" popovertargetaction="show" title="{msg.edit_name}" aria-label="{msg.edit_name}">✎</button>
            <input type="text" id="seatbar-handle-input" class="boteco-input inline-name-input" maxlength="20" placeholder="{msg.handle_placeholder}" style="display: none;" autocomplete="off" />
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
             Mesa Online stays a button because it is the one door to
             #modal-online, but it is dressed as what it is: a state. -->
        <div class="seatbar-links">
\#(_pickerCountry)
\#(_pickerVariant.markup)
\#(_pickerSeats.markup)
\#(_pickerOpponent.markup)
\#(_pickerTheme.markup)
          <button type="button" class="btn-online-status" id="btn-open-online" popovertarget="modal-online" popovertargetaction="show" title="{msg.balcao_title}" data-online="false">
            <span class="online-pulse" aria-hidden="true"></span>
            <span class="online-label-full" data-text="{msg.balcao}">Balcão</span>
            <span class="online-label-short" data-text="{msg.balcao}">Balcão</span>
          </button>
          <a class="rules-link" data-route="regras" data-text="{msg.rules}">Regras</a>
        </div>
      </header>

      <!-- The match singleton: scoreboard, stake, and the felt the
           whole screen resolves from. Pinned on the match on the table, so
           a won one stays bound here until another is asked for.
           data-empty-row keeps the table drawn for the beat before the
           dealer's first match lands. -->
      <!-- The match wakes the table as well: a sitting that has just been
           opened has no hand yet, and nothing about a round or a play can say
           so. -->
      <div class="matchbox"
           data-live="match"
           data-filter="current=eq.yes"
           data-on-mutation="table" data-reads="match,round,play,held,room_action"
           data-empty-row='{"id":"","variant":"mineiro","seats":"1v1","theme":"xadrez","us_score":0,"them_score":0,"others_score":0,"stake":2,"hand_no":1,"status":"playing","winner":"","opponent":"nezinho","opponent_name":"opponent_nezinho","partner_name":"Bigode","seed":"1","current":"yes","my_seat":"you"}'
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
           data-seed="{seed}"
           data-my-seat="{my_seat}">

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
            <p class="sect eles-name" data-text="{msg[opponent_name]}"></p>
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
      <div class="hands" data-live="round" data-filter="current=eq.yes" data-order="created_at.desc"
           data-empty-row='{"id":"","hand_no":1,"vira":"","manilha":"","phase":"dealt","truco_state":"none","envido_state":"none","trick_state":"dealt","ran":"","v1":"","v2":"","v3":"","stake":2,"result":"","said":"","leader":"you","asked":"","raised":"","rung":0,"brink":"","envido":"","envido_asked":"","envido_rung":0,"envido_calls":"","envido_us":0,"envido_them":0,"envido_result":"","current":"yes","created_at":""}'
           data-on-mutation="table" data-reads="match,round,play,held,room_action">
        <template data-item>
          <article class="hand" data-phase="{phase}" data-result="{result}" data-round-id="{id}"
                     data-v1="{v1}" data-v2="{v2}" data-v3="{v3}"
                     data-asked="{asked}" data-rung="{rung}" data-said="{said}" data-stake="{stake}"
                     data-shout-word="{shout_word}" data-shout-from="{shout_from}" data-shout-state="{shout_state}" data-shout-kind="{shout_kind}" data-shout-seat="{shout_seat}" data-shout-t="{shout_t}"
                     data-envido="{envido}" data-envido-asked="{envido_asked}" data-calls="{envido_calls}"
                     data-leader="{leader}" data-raised="{raised}" data-brink="{brink}" data-ran="{ran}"
                     data-turn-seat="{turn_seat}" data-ui-deadline="{ui_deadline}" data-backend-deadline="{backend_deadline}">

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

            <!-- The rodada's verdicts are folded from these rows by a handler,
                 woken by the beat the felt animates when a rodada completes. -->
            <ul class="log pad" data-live="play" data-filter="round_id=eq.{id}" data-order="seq.asc"
                data-on-mutation="table" data-reads="match,round,play,held,room_action"
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

      <!-- Everything below is the dealer's: the seats it draws, the mat, your
           hand, and the one line the table says. -->
      <div class="play" data-phase="idle">
        <!-- Chrome the dealer fills: a call is a play row, and a play row has
             no element on the mat to be. -->
        <div class="bulb" aria-hidden="true"></div>
        <div class="shout" aria-hidden="true"></div>
        <div class="turn-timer" id="turn-timer">
          <div class="rope-fill" id="rope-fill"></div>
          <span class="timer-label" id="timer-label"></span>
        </div>
        <div class="opponent-stage" id="opponent-stage">
          <div class="opponent-avatar-wrap">
            <div class="opponent-avatar-ring" id="opponent-avatar-ring">
              <div class="opponent-avatar-img" id="opponent-avatar-img"></div>
              <span class="opponent-avatar-initial" id="opponent-avatar-initial" style="display:none" aria-hidden="true"></span>
              <span class="opponent-online-dot" id="opponent-online-dot" style="display:none" aria-hidden="true"></span>
            </div>
            <span class="opponent-turn-badge" id="opponent-turn-badge" data-text="{msg.turn_badge_them}">Vez dele</span>
            <div class="opponent-nameplate" id="opponent-nameplate">
              <span class="opponent-name-line">
                <b class="opponent-display-name eles-name" id="opponent-display-name" data-text="{msg[opponent_name]}"></b>
                <span class="opponent-online-badge" id="opponent-online-badge" style="display:none" data-text="{msg.online_short}">Online</span>
              </span>
              <span class="opponent-role-desc" id="opponent-role-desc" data-text="{msg.role_opponent}">Adversário</span>
            </div>
          </div>
          <div class="opponent-dialogue-wrap">
            <div class="speech-bubble" id="opponent-speech-bubble">
              <div class="bubble-header">
                <span class="bubble-speaker eles-name" data-text="{msg[opponent_name]}"></span>
              </div>
              <div class="opponent-talk" id="opponent-talk"></div>
            </div>
          </div>
        </div>
        <!-- The seats across the table. Their cards are rows like yours; only
             the reading differs, so what they show is a back. Held rows are
             ordered by slot, which interleaves the seats, and a template
             cannot group what it binds. -->
        <div class="seats" id="seats">
          <div class="seat-row house" id="house-eles1" data-seat="eles1"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.eles1" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}" data-on-click="table"></div>
            </template>
          </div>
          <!-- Your partner's cards carry their faces, turned up only while a
               brink is yours to decide: the one moment the rules let a pair
               look at each other's hands. -->
          <div class="seat-row house" data-seat="parca"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.parca" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}" data-on-click="table"><span class="card face" data-card="{card}" data-suit="{suit}" data-manilha="{manilha}"><span class="corner tl"><b data-text="{rank}"></b><i data-text="{suit}"></i></span><span class="mark" data-text="{face}"></span><span class="corner br"><b data-text="{rank}"></b><i data-text="{suit}"></i></span></span></div>
            </template>
          </div>
          <div class="seat-row house" data-seat="eles2"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.eles2" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}" data-on-click="table"></div>
            </template>
          </div>
          <!-- The third pair. A table of two sides deals these no cards, so
               the rows stand empty and the felt shows nothing of them. -->
          <div class="seat-row house" data-seat="eles3"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.eles3" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}" data-on-click="table"></div>
            </template>
          </div>
          <div class="seat-row house" data-seat="eles4"
               data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.eles4" data-order="slot.asc">
            <template data-item>
              <div class="card-back" data-seat="{seat}" data-slot="{slot}" data-row="{id}" data-on-click="table"></div>
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
          <div class="talk"></div>
          <p class="refusal" role="status" data-text="{msg.play_refusal}">A mesa não conseguiu registrar a jogada.</p>
        </div>
        <div class="player-dialogue-wrap" id="player-dialogue-wrap" aria-live="polite">
          <div class="player-speech-bubble" id="player-speech-bubble">
            <span class="player-talk" id="player-talk"></span>
          </div>
        </div>
        <div class="encobrir-bar" data-live="round" data-filter="current=eq.yes"
             data-reads="match,round,play,held,room_action"
             data-empty-row='{"id":"","said":""}'>
          <button type="button" class="btn-encobrir" id="btn-encobrir" data-on-click="table" title="{msg.encobrir_title_tip}">
            <span aria-hidden="true">🙈</span>
            <span data-text="{msg.encobrir_btn}">Encobrir</span>
          </button>
        </div>
        <!-- The hand the terminal renders. Item nodes persist across refreshes
             keyed by row id, so a card survives every unrelated redraw and can
             be animated out when it is spent (ir decision-29). -->
        <div class="seat-row mine" id="seat-you"
             data-live="held" data-filter="current=eq.yes&amp;display_seat=eq.you" data-order="slot.asc"
             data-reads="match,round,play,held,room_action">
          <!-- The card carries no whitespace of its own: a text node between
               these spans lands in the card's own text, and what the card then
               reads as would depend on how the spans wrap. -->
          <template data-item>
            <button type="button" class="card" data-on-click="table" data-row="{id}" data-round="{round_id}" data-card="{card}" data-slot="{slot}"
                    data-suit="{suit}" data-manilha="{manilha}"
                    style="view-transition-name: card-{card};"
                    disabled="{blocked}"><span class="sr-only" data-text="{msg.play_card}">Jogar </span><span class="corner tl"><b data-text="{rank}"></b><i data-text="{suit}"></i></span><span class="mark" data-text="{face}"></span><span class="corner br"><b data-text="{rank}"></b><i data-text="{suit}"></i></span></button>
          </template>
        </div>

        <!-- Game over verdict lands above actions in the flow -->
        <div class="over" id="over">
          <p class="over-line" id="over-line"></p>
          <p class="over-say" id="over-say"></p>
          <a class="act ghost" data-route="regras" data-text="{msg.view_rules}">Ver as regras</a>
        </div>

        <!-- The bet's affordances belong to the hand they are about, so they
             read it. Singleton regions rather than items: a list region sweeps
             away every child that is not one of its rows, and the fallback row
             keeps the buttons on the table before a hand exists. -->
        <div class="wager-controls" data-live="round" data-filter="current=eq.yes"
             data-reads="match,round,play,held,room_action"
             data-empty-row='{"id":"","hand_no":1,"vira":"","manilha":"","phase":"dealt","truco_state":"none","envido_state":"none","trick_state":"dealt","ran":"","v1":"","v2":"","v3":"","stake":2,"result":"","said":"","leader":"you","asked":"","raised":"","rung":0,"brink":"","envido":"","envido_asked":"","envido_rung":0,"envido_calls":"","envido_us":0,"envido_them":0,"envido_result":"","current":"yes","created_at":""}'
             data-machine='\#(_wagerMachineAttr)'
             style="display: contents;">
        <div class="actions" id="actions"
             data-leader="{leader}" data-reads="match,round,play,held,room_action">
          <button type="button" class="act" id="btn-truco" data-on-click="table" data-text="{msg.call_truco}">TRUCO!</button>
          <!-- The second wager. One rail carries whichever call is live, and
               the truco standing underneath it is drawn rather than remembered
               (ir decision-33). Which wager the rail is asking about is said in
               its label and carried by colour, not by position. -->
          <div class="suspended" aria-live="polite">
            <b data-text="{msg.truco_waiting}">Truco espera</b>
            <span class="stood" data-text="{stake}"></span>
          </div>
          <div class="rail-label"><span data-text="{msg.rail_envido}">Responder o envido</span> <b class="wager-stood" data-text="{envido_rung}"></b></div>
          <button type="button" class="act wager hot" id="btn-envido-take" data-on-click="table" data-text="{msg.envido_took}">Quero</button>
          <button type="button" class="act wager risk" id="btn-envido-run" data-on-click="table" data-text="{msg.envido_ran}">Não quero</button>
          <button type="button" class="act wager" id="btn-envido" data-on-click="table" data-text="{msg.call_envido}">ENVIDO!</button>
          <button type="button" class="act wager" id="btn-envido-real" data-on-click="table" data-text="{msg.envido_real}">REAL ENVIDO!</button>
          <button type="button" class="act wager" id="btn-envido-falta" data-on-click="table" data-text="{msg.envido_falta}">FALTA ENVIDO!</button>
          <button type="button" class="act bloom" id="btn-flor" data-on-click="table" data-text="{msg.flor}">FLOR!</button>
          <!-- The brink's decision, offered only while it is this seat's. -->
          <button type="button" class="act" id="btn-brink-play" data-on-click="table" data-text="{msg.brink_play}">Jogar a mão</button>
          <button type="button" class="act risk" id="btn-brink-run" data-on-click="table" data-text="{msg.brink_run}">Correr</button>
          <button type="button" class="act alt" id="btn-bot-play" data-on-click="table" style="display:none" data-text="{msg.bot_plays}">Robô joga</button>
          <!-- Empty by construction: the dealer writes their labels, so there
               is no text here for a locale to reach. -->
          <button type="button" id="btn-set-seat" data-on-click="table" style="display:none"></button>
          <button type="button" id="btn-bot-truco" data-on-click="table" style="display:none"></button>
          <button type="button" id="btn-bot-accept" data-on-click="table" style="display:none"></button>
          <button type="button" id="btn-bot-run" data-on-click="table" style="display:none"></button>
          <button type="button" class="act ghost" id="btn-next" data-on-click="table" data-text="{msg.next_hand}">Próxima mão</button>
          <button type="button" class="act ghost risk" id="btn-resign" data-on-click="table" data-text="{msg.resign}">Abandonar</button>
          <!-- In with the other things the table can be asked for, because a
               control has to sit inside a region to be one. -->
          <button type="button" class="act" id="btn-again" data-on-click="table" data-text="{msg.play_again}">Outra partida</button>
          <button type="button" class="act" id="btn-start" data-on-click="table" data-text="{msg.start_match}">Começar partida</button>
        </div>

        <div class="answers" id="answers"
             data-reads="match,round,play,held,room_action">
          <!-- The raise and the fold are arithmetic on two fields and stay the
               dealer's to write. What accepting costs is the round's own rung,
               so it binds — and a price is where a language wants a plural. -->
          <button type="button" class="act" id="btn-accept" data-on-click="table"><b data-text="{msg.accept}">Aceito</b><small data-text="{msg.worth_points}"></small></button>
          <button type="button" class="act hot" id="btn-raise" data-on-click="table"><b data-text="{msg.raise}">Aumentar</b><small></small></button>
          <button type="button" class="act risk" id="btn-run" data-on-click="table"><b data-text="{msg.fold}">Corro</b><small></small></button>
        </div>

        <div class="boteco-shouts">
          <button type="button" class="btn-quick-shout" id="shout-chama" data-on-click="table" data-text="{msg.shout_chama}">Chama!</button>
          <button type="button" class="btn-quick-shout" id="shout-manda" data-on-click="table" data-text="{msg.shout_manda}">Manda vir!</button>
          <button type="button" class="btn-quick-shout" id="shout-desce" data-on-click="table" data-text="{msg.shout_desce}">Desce a madeira!</button>
          <button type="button" class="btn-quick-shout" id="shout-chorou" data-on-click="table" data-text="{msg.shout_chorou}">Chorou, parou!</button>
        </div>


        <div class="nomatch" id="nomatch">
          <p class="over-line" data-text="{msg.empty_table}">Mesa vazia</p>
          <p data-text="{msg.empty_table_desc}">O baralho está cortado. Senta que já sai mão.</p>
        </div>
      </div>

    </div>
  </div>

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
        <div id="modal-match-active-banner" class="modal-match-active-banner" style="display:none">
          <span data-text="{msg.match_in_progress}">Partida online em andamento</span>
          <button type="button" id="btn-modal-resign" class="act risk btn-compact" popovertarget="modal-online" popovertargetaction="hide" data-text="{msg.resign_match}">Abandonar Partida</button>
        </div>

        <section class="lobby-identity-bar">
          <div class="identity-avatar">👤</div>
          <div class="identity-main">
            <label for="my-handle-input" data-text="{msg.your_handle}">Seu Apelido no Boteco</label>
            <div id="form-handle" class="identity-input-row">
              <input type="text" id="my-handle-input" class="boteco-input" maxlength="20" placeholder="{msg.handle_placeholder}" autocomplete="off" />
              <button type="button" id="btn-save-handle" class="act brass btn-compact" commandfor="copy-status" data-text="{msg.save}">Salvar</button>
            </div>
          </div>
          <div class="identity-toggle-wrap">
            <button type="button" class="btn-online-toggle" id="btn-toggle-online" role="switch" aria-checked="false" data-online="false" title="{msg.online_bar_title}" aria-label="{msg.online_bar_title}" commandfor="copy-status">
              <span class="toggle-track" aria-hidden="true">
                <span class="toggle-thumb"></span>
              </span>
              <span class="online-pulse" aria-hidden="true"></span>
              <span class="toggle-label-off" data-text="{msg.offline}">Offline</span>
              <span class="toggle-label-on" data-text="{msg.online_short}">Online</span>
            </button>
          </div>
        </section>

        <section class="modal-sec">
          <div class="sec-header-row">
            <label data-text="{msg.players_in_bar}">Jogadores no Bar (Desafie Agora)</label>
          </div>
          <div id="lobby-players-list" class="lobby-players-list" role="region" aria-live="polite"
               data-live="lobby" data-order="handle.asc"
               data-empty="{msg.lobby_empty}">
            <template data-item>
              <div class="lobby-player-row" data-id="{id}" data-handle="{handle}" data-updated-at="{updated_at}">
                <span class="player-avatar-mini" aria-hidden="true">👤</span>
                <div class="player-info-wrap">
                  <b class="player-handle" data-text="{handle}"></b>
                  <span class="player-status-tag" data-status="{status}"></span>
                </div>
                <button type="button" class="act brass btn-challenge" commandfor="copy-status">
                  <span data-text="{msg.challenge}">⚔️ Desafiar</span>
                </button>
              </div>
            </template>
          </div>
        </section>

        <div class="modal-sep" aria-hidden="true"></div>

        <section class="modal-sec">
          <label for="invite-url-field" data-text="{msg.invite_by_link}">Convidar Amigo por Link</label>
          <div class="invite-seat-picker" id="invite-seat-picker" role="group">
            <button type="button" class="btn-invite-seat" data-seat="you" commandfor="invite-url-field" data-text="{msg.you}">Você</button>
            <button type="button" class="btn-invite-seat active" data-seat="eles1" commandfor="invite-url-field" data-text="{msg.invite_opp1}">Adversário 1</button>
            <button type="button" class="btn-invite-seat" data-seat="parca" commandfor="invite-url-field" data-text="{msg.invite_partner}">Parça (Dupla)</button>
            <button type="button" class="btn-invite-seat" data-seat="eles2" commandfor="invite-url-field" data-text="{msg.invite_opp2}">Adversário 2</button>
          </div>
          <p class="modal-hint"><span data-text="{msg.invite_hint_before}">Envie este link para qualquer amigo entrar diretamente nesta mesa. Para testar no mesmo computador, abra o link em uma </span><b data-text="{msg.incognito_window}">janela anônima</b><span data-text="{msg.invite_hint_after}"> ou em outro navegador.</span></p>
          <div class="invite-box">
            <input type="text" id="invite-url-field" class="boteco-input" readonly value="" />
            <button type="button" id="btn-copy-invite" class="act brass" commandfor="copy-status" data-text="{msg.copy}">Copiar</button>
          </div>
          <span class="copy-status" id="copy-status" aria-live="polite"></span>
        </section>

        <div class="modal-sep" aria-hidden="true"></div>

        <section class="modal-sec">
          <label for="input-join-code" data-text="{msg.join_other_table}">Entrar em Outra Mesa</label>
          <p class="modal-hint" data-text="{msg.join_hint}">Cole o link ou código da mesa criada pelo seu amigo:</p>
          <div class="join-box">
            <input type="text" id="input-join-code" class="boteco-input" placeholder="{msg.join_placeholder}" />
            <button type="button" id="btn-submit-join" class="act" popovertarget="modal-online" popovertargetaction="hide" data-text="{msg.join}">Entrar</button>
          </div>
          <p class="join-err" id="join-err" role="alert"></p>
        </section>
      </div>
    </div>
  </div>

  <div id="mp-sync-challenge" class="sr-only" data-live="challenge" data-order="created_at.desc">
    <template data-item>
      <span data-id="{id}" data-status="{status}"></span>
    </template>
  </div>
  <div id="mp-sync-action" class="sr-only" data-live="room_action" data-order="created_at.asc"
       data-on-mutation="table" data-reads="match,round,play,held,room_action">
    <template data-item>
      <span data-id="{id}"></span>
    </template>
  </div>

  <aside id="incoming-challenge-banner" class="incoming-challenge-banner" role="alert" style="display:none">
    <div class="challenge-alert-content">
      <span class="challenge-icon">⚔️</span>
      <div class="challenge-text">
        <strong id="challenge-challenger-name" data-text="{msg.a_player}">Jogador</strong>
        <span data-text="{msg.challenged_you}">te desafiou para uma partida de Truco!</span>
      </div>
    </div>
    <div id="form-challenge-response" class="challenge-alert-actions">
      <button type="button" id="btn-challenge-accept" name="decision" value="accept" class="act brass" commandfor="copy-status" data-text="{msg.accept_challenge}">✓ Aceitar</button>
      <button type="button" id="btn-challenge-decline" name="decision" value="decline" class="act ghost" commandfor="copy-status" data-text="{msg.decline_challenge}">✕ Recusar</button>
    </div>
  </aside>

  <div id="challenge-waiting-overlay" class="challenge-waiting-overlay" style="display:none">
    <div class="waiting-card">
      <div class="spinner-icon">⏳</div>
      <h4 id="waiting-target-name" data-text="{msg.challenging}">Desafiando...</h4>
      <p data-text="{msg.waiting_accept}">Aguardando o adversário aceitar a partida no bar.</p>
      <div id="form-challenge-cancel">
        <button type="button" id="btn-cancel-challenge" class="act ghost" commandfor="copy-status" data-text="{msg.cancel_challenge}">Cancelar Desafio</button>
      </div>
    </div>
  </div>

  <!-- The write path. Every one of these is submitted by the dealer or by a
       control above; none is typed into. -->



</section>
"""#
