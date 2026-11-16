/* Glory Eleven — menus, input, audio and the main loop. */
(function () {
  'use strict';
  var GE = window.GE, esc = GE.esc;
  function $(s) { return document.querySelector(s); }
  var ui = $('#ui'), hud = $('#hud'), banner = $('#banner'), hint = $('#hint');
  var save = null, match = null, mode = 'menu', sel = null, last = 0, bannerT = 0, hintT = 0, onbKit = 0, seasonOut = null;
  var input = { mx: 0, my: 0, sprint: false, a: false, b: false, c: false };
  var keys = {}, stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, tb = { a: false, b: false, c: false };
  var qs = new URLSearchParams(location.search);
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || qs.has('touch');

  /* ---------- audio (synthesised, no files) ---------- */
  var AU = { ctx: null, crowd: null };
  function auInit() {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      var c = AU.ctx = new AC(), buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0), v = 0;
      for (var i = 0; i < d.length; i++) { v = v * .97 + (Math.random() * 2 - 1) * .03; d[i] = v * 6; }
      var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = .5;
      AU.crowd = c.createGain(); AU.crowd.gain.value = 0;
      src.connect(bp); bp.connect(AU.crowd); AU.crowd.connect(c.destination); src.start();
    } catch (e) { AU.ctx = null; }
  }
  function soundOn() { return AU.ctx && save && save.settings.sound; }
  function crowd(level, tc) { if (AU.crowd) AU.crowd.gain.setTargetAtTime(soundOn() ? level : 0, AU.ctx.currentTime, tc || .5); }
  function tone(type, f0, f1, dur, vol) {
    if (!soundOn()) return;
    var c = AU.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .02);
  }
  function sfx(n) {
    if (n === 'kick') tone('sine', 170, 55, .1, .3);
    else if (n === 'shot') tone('triangle', 240, 50, .16, .4);
    else if (n === 'post') tone('square', 900, 500, .12, .12);
    else if (n === 'whistle') tone('square', 2350, 2250, .32, .05);
    else if (n === 'final') { tone('square', 2350, 2250, .3, .05); setTimeout(function () { tone('square', 2350, 2200, .7, .05); }, 380); }
    else if (n === 'goal') { crowd(.5, .08); setTimeout(function () { crowd(.1, 1.2); }, 2600); }
    else if (n === 'save') { crowd(.25, .1); setTimeout(function () { crowd(.1, .8); }, 900); }
  }

  /* ---------- small helpers ---------- */
  function me() { return { name: save.club.name, abbr: save.club.abbr, kit: GE.USER_KITS[save.club.kit] }; }
  function ovrChip(v) { return '<span class="ovr' + (v >= 85 ? ' o85' : v >= 78 ? ' o78' : v >= 70 ? ' o70' : '') + '">' + v + '</span>'; }
  function coins(n) { return '<i class="coin"></i>' + n.toLocaleString('en'); }
  function ord(n) { return n + (['th', 'st', 'nd', 'rd'][n % 10 > 3 || (n > 10 && n < 14) ? 0 : n % 10]); }
  function head(title) {
    return '<header class="top">' + (title ? '<button class="back" data-act="hub">&#8592; Club</button>' : '<div class="brand">GLORY <b>ELEVEN</b></div>') +
      '<div class="wallet">' + coins(save.coins) + '</div></header>' + (title ? '<h2>' + title + '</h2>' : '');
  }
  function show(html) { ui.innerHTML = html; ui.scrollTop = 0; }
  function showBanner(big, small, ms) {
    banner.innerHTML = '<strong>' + esc(big) + '</strong>' + (small ? '<span>' + esc(small) + '</span>' : '');
    banner.hidden = false; banner.style.animation = 'none'; void banner.offsetWidth; banner.style.animation = ''; bannerT = ms / 1000;
  }

  /* ---------- screens ---------- */
  function onboarding() {
    var kits = GE.USER_KITS.map(function (k, i) {
      return '<button class="kit' + (i === onbKit ? ' on' : '') + '" data-act="kit" data-i="' + i + '" style="background:' + k.shirt + '" aria-label="Kit ' + (i + 1) + '"><i style="background:' + k.trim + ';opacity:' + (k.style === 'plain' ? 0 : 1) + '"></i></button>';
    }).join('');
    var cur = $('#clubName') ? $('#clubName').value : '';
    show('<div class="wrap"><header class="top"><div class="brand">GLORY <b>ELEVEN</b></div></header>' +
      '<div class="narrow"><div><span class="eyebrow">New career</span><h1>Build your club</h1><p class="mute">Start in Division 3 with a squad of hopefuls. Win matches, earn coins, sign better players and climb to the Elite Division.</p></div>' +
      '<div class="field"><label for="clubName">Club name</label><input type="text" id="clubName" maxlength="18" value="' + esc(cur || 'Umoja Stars') + '" autocomplete="off"></div>' +
      '<div class="field"><label>Home kit</label><div class="kits">' + kits + '</div></div>' +
      '<button class="cta" data-act="create">Start career</button></div></div>');
  }

  function hub() {
    sel = null;
    var fx = GE.nextFixture(save), d = GE.DIVS[save.division], pos = 1;
    GE.table(save).forEach(function (t, i) { if (t.user) pos = i + 1; });
    var m = me(), home = fx.home ? m : fx.opp, away = fx.home ? fx.opp : m, rt = GE.teamRating(save);
    function side(t) { return '<div class="side">' + GE.crest(t, 64) + '<span>' + esc(t.name) + '</span><small>Rating ' + (t === m ? rt : t.rating) + '</small></div>'; }
    show('<div class="wrap">' + head() +
      '<div><span class="eyebrow">' + d.name + ' &middot; Season ' + save.season + '</span><div class="club">' + GE.crest(m, 84) +
      '<div><h1>' + esc(m.name) + '</h1><p>Team rating <b>' + rt + '</b> &middot; League position <b>' + ord(pos) + '</b></p></div></div></div>' +
      '<section class="next"><span class="eyebrow">Matchday ' + (save.league.round + 1) + ' of 7 &middot; ' + (fx.home ? 'Home' : 'Away') + '</span>' +
      '<div class="vs">' + side(home) + '<em>VS</em>' + side(away) + '</div><button class="cta" data-act="play">Kick off</button></section>' +
      '<nav class="tabs"><button class="tab" data-act="squad">Squad</button><button class="tab" data-act="market">Auction</button><button class="tab" data-act="table">League</button><button class="tab" data-act="settings">Settings</button></nav>' +
      '<p class="keys">' + (isTouch ? 'Left thumb moves your player. <kbd>PASS</kbd> <kbd>SHOOT</kbd> (hold for power) <kbd>LOB</kbd>. Without the ball the buttons switch player and slide tackle.' :
        'Move <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows &middot; Pass / switch <kbd>J</kbd> &middot; Shoot / tackle <kbd>K</kbd> or <kbd>Space</kbd> (hold for power) &middot; Lob <kbd>L</kbd> &middot; Sprint <kbd>Shift</kbd> &middot; Pause <kbd>Esc</kbd>') + '</p></div>');
  }

  function playerRow(p, slot) {
    var eff = slot == null ? p.ovr : GE.effOvr(p, slot), bad = slot != null && p.pos !== GE.SLOTS[slot];
    return '<button class="row' + (sel === p.id ? ' sel' : '') + '" data-act="pick" data-id="' + p.id + '"><span class="slot">' + (slot == null ? p.pos : GE.SLOT_LABEL[slot]) +
      '</span><span class="nm">' + esc(p.name) + '</span><span class="ps' + (bad ? ' bad' : '') + '">' + (slot == null ? 'Age ' + p.age : p.pos) + '</span>' + ovrChip(eff) + '</button>';
  }
  function squad() {
    var xi = save.lineup.map(function (id, i) { return playerRow(GE.byId(save, id), i); }).join('');
    var order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    var bench = save.squad.filter(function (p) { return save.lineup.indexOf(p.id) < 0; })
      .sort(function (a, b) { return order[a.pos] - order[b.pos] || b.ovr - a.ovr; }).map(function (p) { return playerRow(p, null); }).join('');
    var bar = '<div class="bar"><div class="grow mute">Tap a player, then tap another to swap them. Players out of position lose rating.</div><button class="cta ghost" data-act="auto">Best XI</button></div>';
    if (sel) {
      var p = GE.byId(save, sel), cost = GE.upgradeCost(p.ovr), inXI = save.lineup.indexOf(p.id) >= 0, sell = Math.round(GE.value(p.ovr) * .4);
      bar = '<div class="bar"><div class="grow"><b>' + esc(p.name) + '</b> <span class="mute">&middot; ' + p.pos + ' &middot; ' + p.ovr + ' OVR &middot; age ' + p.age + ' &middot; <span class="stars">' + GE.stars(p.ovr) + '</span></span></div>' +
        '<button class="cta" data-act="train"' + (save.coins < cost || p.ovr >= 99 ? ' disabled' : '') + '>Train +1 &nbsp;' + coins(cost) + '</button>' +
        '<button class="cta danger" data-act="sell"' + (inXI || save.squad.length <= 14 ? ' disabled' : '') + '>Sell &nbsp;' + coins(sell) + '</button></div>';
    }
    show('<div class="wrap">' + head('Squad &middot; rating ' + GE.teamRating(save)) + '<div class="cols"><div class="card"><span class="eyebrow">Starting XI &middot; 4-3-3</span><div class="list" style="margin-top:10px">' + xi +
      '</div></div><div class="card"><span class="eyebrow">Bench</span><div class="list" style="margin-top:10px">' + (bench || '<span class="mute">No substitutes.</span>') + '</div></div></div>' + bar + '</div>');
  }

  var POSNAME = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };
  function openBid(p) { return Math.round(p.price * .55 / 10) * 10; }
  function market() {
    var full = save.squad.length >= 24;
    var cards = save.market.map(function (p, i) {
      var ob = openBid(p);
      return '<div class="card"><div class="hd"><b>' + esc(p.name) + '</b>' + ovrChip(p.ovr) + '</div><span class="mute">' + POSNAME[p.pos] + ' &middot; age ' + p.age +
        '</span><span class="stars">' + GE.stars(p.ovr) + '</span><button class="cta" data-act="auction" data-i="' + i + '"' + (save.coins < ob || full ? ' disabled' : '') + '>Bid from &nbsp;' + coins(ob) + '</button></div>';
    }).join('');
    show('<div class="wrap">' + head('Player auction') + '<p class="mute" style="margin:0">Rival clubs bid against you, so the final price depends on how badly they want the player. New players arrive after every match. ' + (full ? 'Your squad is full (24) — sell someone first.' : 'Squad ' + save.squad.length + ' / 24.') + '</p><div class="mk">' +
      (cards || '<span class="mute">Nobody left in the auction room right now.</span>') + '</div></div>');
  }

  /* ---------- live auction ---------- */
  var auc = null, aucTimer = null;
  function step(v) { return Math.max(10, Math.round(v * .08 / 10) * 10); }
  function ask() { return auc.leader === null ? auc.price : auc.price + step(auc.price); }
  function auction(i) {
    var p = save.market[i]; if (!p) { market(); return; }
    var heat = p.heat == null ? Math.random() : p.heat, val = GE.value(p.ovr);
    var clubs = save.league.teams.filter(function (t) { return !t.user; }).sort(function () { return Math.random() - .5; }).slice(0, 3);
    auc = {
      p: p, price: openBid(p), leader: null, t: 8, max: 8, done: false, next: 1.6 + Math.random() * 2, log: [],
      rivals: clubs.map(function (c, k) { return { c: c, max: val * (.65 + heat * .55) * [1, .9, .78][k] * (.95 + Math.random() * .1) }; })
    };
    show('<div class="wrap">' + head('Live auction') + '<div class="narrow" style="margin:0 auto;width:100%"><div class="card auc"><div class="hd"><div><b class="pname">' + esc(p.name) +
      '</b><div class="mute">' + POSNAME[p.pos] + ' &middot; age ' + p.age + ' &middot; <span class="stars">' + GE.stars(p.ovr) + '</span></div></div>' + ovrChip(p.ovr) + '</div>' +
      '<div class="aucp"><span class="eyebrow" id="aucPhase"></span><div class="price" id="aucPrice"></div><div class="mute" id="aucLead"></div></div>' +
      '<div class="tbar"><i id="aucBar"></i></div><button class="cta" id="aucBid" data-act="bid"></button><div class="mute" id="aucLog"></div></div>' +
      '<p class="mute" style="margin:0">In the room: ' + clubs.map(function (c) { return esc(c.name); }).join(', ') + '. Leaving while you hold the top bid still buys the player.</p></div></div>');
    aucPaint(); clearInterval(aucTimer); aucTimer = setInterval(aucTick, 100);
  }
  function aucPaint() {
    if (!auc || !$('#aucPrice')) return;
    var mine = auc.leader === 'you', a = ask();
    $('#aucPrice').innerHTML = coins(auc.price);
    $('#aucLead').textContent = auc.leader === null ? 'No bids yet' : mine ? 'You hold the top bid' : auc.leader.c.name + ' hold the top bid';
    $('#aucLead').style.color = mine ? 'var(--lime)' : '';
    $('#aucPhase').textContent = auc.leader === null ? 'Opening price' : auc.t < 1.6 ? 'Going twice…' : auc.t < 3.2 ? 'Going once…' : 'Current bid';
    $('#aucBar').style.width = Math.max(0, auc.t / auc.max * 100) + '%';
    var b = $('#aucBid'); b.disabled = mine || save.coins < a;
    b.innerHTML = mine ? 'Waiting for rivals' : save.coins < a ? 'Not enough coins' : 'Bid &nbsp;' + coins(a);
    $('#aucLog').innerHTML = auc.log.slice(-3).reverse().join('<br>');
  }
  function aucTick() {
    if (!auc || auc.done || !$('#aucPrice')) { clearInterval(aucTimer); return; }
    auc.t -= .1; auc.next -= .1;
    if (auc.next <= 0) {
      var a = ask(), can = auc.rivals.filter(function (r) { return r !== auc.leader && r.max >= a; });
      if (can.length) {
        var r = can[Math.floor(Math.random() * can.length)];
        auc.price = a; auc.leader = r; auc.t = auc.max = 6; auc.log.push(esc(r.c.name) + ' bid ' + a.toLocaleString('en')); tone('sine', 420, 380, .08, .1);
      }
      auc.next = .8 + Math.random() * 2.2;
    }
    if (auc.t <= 0) aucFinish(true); else aucPaint();
  }
  function aucFinish(showIt) {
    clearInterval(aucTimer);
    var a = auc, p = a.p, i = save.market.indexOf(p), title, line;
    a.done = true; auc = null;
    if (a.leader === 'you') {
      save.coins -= a.price; if (i >= 0) save.market.splice(i, 1); delete p.price; delete p.heat; save.squad.push(p);
      title = 'Sold to you!'; line = esc(p.name) + ' joins ' + esc(save.club.name) + ' for ' + a.price.toLocaleString('en') + ' coins.'; tone('sine', 500, 1000, .25, .15);
    } else if (a.leader) {
      if (i >= 0) save.market.splice(i, 1);
      title = 'Outbid'; line = esc(p.name) + ' goes to ' + esc(a.leader.c.name) + ' for ' + a.price.toLocaleString('en') + ' coins.';
    } else { title = 'Unsold'; line = 'Nobody bid for ' + esc(p.name) + '. He stays in the auction room.'; }
    GE.store(save);
    if (showIt) show('<div class="wrap">' + head('Live auction') + '<div class="narrow" style="margin:8vh auto 0;width:100%;text-align:center"><div><span class="eyebrow">Hammer down</span><h1>' + title + '</h1><p class="mute">' + line +
      '</p></div><button class="cta" data-act="market">Back to the auction room</button>' + (a.leader === 'you' ? '<button class="cta ghost" data-act="squad">Go to squad</button>' : '') + '</div></div>');
  }
  function aucLeave() { if (auc && !auc.done) aucFinish(false); }

  function scorersCard() {
    var top = GE.topScorers(save, 8);
    if (!top.length) return '';
    return '<div class="card"><span class="eyebrow">Top scorers</span><div class="list" style="margin-top:10px">' + top.map(function (t, i) {
      return '<div class="row' + (t.abbr === save.club.abbr ? ' sel' : '') + '"><span class="slot">' + (i + 1) + '</span><span class="nm">' + esc(t.name) + '</span><span class="ps">' + esc(t.abbr) + '</span><span class="ovr">' + t.goals + '</span></div>';
    }).join('') + '</div></div>';
  }

  function table() {
    var rows = GE.table(save).map(function (t, i) {
      var cls = (t.user ? 'me ' : '') + (i < 2 && save.division < 3 ? 'up' : i > 5 && save.division > 0 ? 'down' : '');
      return '<tr class="' + cls + '"><td>' + (i + 1) + '</td><td>' + GE.crest(t, 26) + esc(t.name) + '</td><td>' + t.P + '</td><td>' + t.W + '</td><td>' + t.D + '</td><td>' + t.L +
        '</td><td>' + (t.GF - t.GA > 0 ? '+' : '') + (t.GF - t.GA) + '</td><td class="pts">' + t.Pts + '</td></tr>';
    }).join('');
    show('<div class="wrap">' + head(GE.DIVS[save.division].name) + '<div class="card scroll"><table><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>' + rows +
      '</tbody></table></div><p class="mute" style="margin:0">' + (save.division < 3 ? 'Top two are promoted.' : 'Finish first to be champions.') + (save.division > 0 ? ' Bottom two are relegated.' : '') + '</p>' + scorersCard() + '</div>');
  }

  function settings() {
    var s = save.settings;
    function seg(key, opts) {
      return '<div class="seg">' + opts.map(function (o) { return '<button class="' + (s[key] === o[0] ? 'on' : '') + '" data-act="set" data-k="' + key + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
    }
    var kits = GE.USER_KITS.map(function (k, i) {
      return '<button class="kit' + (i === save.club.kit ? ' on' : '') + '" data-act="setkit" data-i="' + i + '" style="background:' + k.shirt + '" aria-label="Kit ' + (i + 1) + '"><i style="background:' + k.trim + ';opacity:' + (k.style === 'plain' ? 0 : 1) + '"></i></button>';
    }).join('');
    show('<div class="wrap">' + head('Settings') + '<div class="narrow">' +
      '<div class="field"><label>Match length</label>' + seg('half', [[60, '2 min'], [120, '4 min'], [180, '6 min']]) + '</div>' +
      '<div class="field"><label>Difficulty</label>' + seg('diff', [[-.2, 'Relaxed'], [0, 'Standard'], [.2, 'Tough']]) + '</div>' +
      '<div class="field"><label>Sound</label>' + seg('sound', [[true, 'On'], [false, 'Off']]) + '</div>' +
      '<div class="field"><label>Home kit</label><div class="kits">' + kits + '</div></div>' +
      '<button class="cta danger" data-act="reset">Delete career and start again</button></div></div>');
  }

  function pauseScreen() {
    show('<div class="wrap"><div class="narrow" style="margin-top:10vh"><div><span class="eyebrow">Paused</span><h1>' + match.teams[0].score + ' &ndash; ' + match.teams[1].score + '</h1></div>' +
      '<button class="cta" data-act="resume">Resume</button><button class="cta danger" data-act="forfeit">Forfeit match (0&ndash;3 loss)</button></div></div>');
  }

  function resultScreen(forfeit) {
    var u = match.user, o = u.opp, A = match.teams[0], B = match.teams[1];
    var gf = forfeit ? 0 : u.score, ga = forfeit ? Math.max(3, o.score) : o.score;
    var res = gf > ga ? 'Victory' : gf < ga ? 'Defeat' : 'Draw';
    var earn = forfeit ? 0 : (gf > ga ? 150 : gf === ga ? 60 : 30) + gf * 20;
    save.coins += earn;
    if (!forfeit) match.goals.forEach(function (g) { if (g.p) GE.addScorer(save, g.p.name, g.team.abbr); });
    GE.playRound(save, gf, ga); GE.genMarket(save); GE.store(save);
    var tp = A.stats.poss + B.stats.poss || 1, pa = Math.round(A.stats.poss / tp * 100);
    function sc(t) { return t === u ? gf : ga; }
    var goals = match.goals.map(function (g) { return esc(g.name) + ' ' + g.minute + "' (" + esc(g.team.abbr) + ')'; }).join(' &middot; ');
    function st(a, l, b) { return '<div class="stat"><b>' + a + '</b><span>' + l + '</span><b>' + b + '</b></div>'; }
    mode = 'menu'; hud.hidden = true; banner.hidden = true; crowd(0, .8);
    show('<div class="wrap"><div class="narrow" style="margin:4vh auto 0;width:100%"><div style="text-align:center"><span class="eyebrow">Full-time</span><h1>' + (forfeit ? 'Forfeit' : res) + '</h1></div>' +
      '<div class="card final"><div class="side">' + GE.crest(A, 60) + esc(A.name) + '</div><div class="big">' + sc(A) + '&ndash;' + sc(B) + '</div><div class="side">' + GE.crest(B, 60) + esc(B.name) + '</div></div>' +
      (goals && !forfeit ? '<div class="scorers">' + goals + '</div>' : '') +
      '<div class="card stats">' + st(pa + '%', 'Possession', (100 - pa) + '%') + st(A.stats.shots, 'Shots', B.stats.shots) + st(A.stats.target, 'On target', B.stats.target) + '</div>' +
      '<div class="reward">+ ' + coins(earn) + '</div><button class="cta" data-act="continue">Continue</button></div></div>');
  }

  function seasonScreen() {
    var o = seasonOut;
    var title = o.champion ? 'Champions!' : o.promoted ? 'Promoted!' : o.relegated ? 'Relegated' : 'Season over';
    var line = 'You finished ' + ord(o.pos) + ' in ' + o.division + '. ' + (o.promoted ? 'Next stop: ' + o.next + '.' : o.relegated ? 'You drop to ' + o.next + '.' : 'You stay in ' + o.next + '.');
    show('<div class="wrap"><div class="narrow" style="margin:10vh auto 0;width:100%;text-align:center"><div><span class="eyebrow">End of season</span><h1>' + title + '</h1><p class="mute">' + line + '</p></div>' +
      '<div class="reward">Prize money + ' + coins(o.prize) + '</div><button class="cta" data-act="hub">Start season ' + save.season + '</button></div></div>');
  }

  /* ---------- actions ---------- */
  var act = {
    kit: function (d) { onbKit = +d.i; onboarding(); },
    create: function () {
      var n = ($('#clubName').value || '').trim().slice(0, 18) || 'Umoja Stars';
      save = GE.newSave(n, onbKit); GE.store(save); hub();
    },
    hub: function () { aucLeave(); seasonOut = null; hub(); }, squad: squad, market: function () { aucLeave(); market(); }, table: table, settings: settings,
    play: startMatch,
    pick: function (d) {
      var id = d.id;
      if (!sel) sel = id; else if (sel === id) sel = null;
      else {
        var a = save.lineup.indexOf(sel), b = save.lineup.indexOf(id);
        if (a >= 0 && b >= 0) { save.lineup[a] = id; save.lineup[b] = sel; sel = null; }
        else if (a >= 0) { save.lineup[a] = id; sel = null; }
        else if (b >= 0) { save.lineup[b] = sel; sel = null; }
        else sel = id;
        GE.store(save);
      }
      squad();
    },
    auto: function () { GE.autoLineup(save); GE.store(save); squad(); },
    train: function () {
      var p = GE.byId(save, sel), c = GE.upgradeCost(p.ovr);
      if (save.coins >= c && p.ovr < 99) { save.coins -= c; p.ovr++; GE.store(save); tone('sine', 500, 900, .15, .15); }
      squad();
    },
    sell: function () {
      var p = GE.byId(save, sel);
      if (save.lineup.indexOf(p.id) < 0 && save.squad.length > 14) {
        save.coins += Math.round(GE.value(p.ovr) * .4); save.squad.splice(save.squad.indexOf(p), 1); sel = null; GE.store(save);
      }
      squad();
    },
    auction: function (d) { auction(+d.i); },
    bid: function () {
      if (!auc || auc.done || auc.leader === 'you') return;
      var a = ask(); if (save.coins < a) return;
      auc.price = a; auc.leader = 'you'; auc.t = auc.max = 6; auc.next = .7 + Math.random() * 2; auc.log.push('<b>You</b> bid ' + a.toLocaleString('en'));
      tone('sine', 620, 700, .08, .12); aucPaint();
    },
    set: function (d) {
      var v = d.v === 'true' ? true : d.v === 'false' ? false : +d.v;
      save.settings[d.k] = v; GE.store(save); settings();
    },
    setkit: function (d) {
      save.club.kit = +d.i; save.league.teams[GE.userIdx(save)].kit = GE.USER_KITS[+d.i]; GE.store(save); settings();
    },
    reset: function () {
      if (window.confirm('Delete this career? Your club, squad and coins will be lost.')) { GE.wipe(); save = null; onbKit = 0; onboarding(); }
    },
    resume: function () { ui.innerHTML = ''; mode = 'play'; last = 0; crowd(.1); },
    forfeit: function () { resultScreen(true); startDemo(); },
    'continue': function () {
      startDemo();
      if (save.league.round >= save.league.rounds.length) { seasonOut = GE.endSeason(save); GE.store(save); seasonScreen(); } else hub();
    }
  };
  ui.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    auInit();
    var f = act[el.dataset.act]; if (f) f(el.dataset);
  });
  ui.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'clubName') act.create(); });

  /* ---------- match lifecycle ---------- */
  function startDemo() {
    var a = GE.randomClub(72), b = GE.randomClub(72, a.name); b.kit = GE.altKit(a, b);
    match = GE.newMatch(GE.cpuTeam(a), GE.cpuTeam(b), { demo: true, halfLen: 150, diff: .6 });
    GE.render.setMatch(match);
  }
  function startMatch() {
    var fx = GE.nextFixture(save); if (!fx) return;
    var u = GE.userTeam(save), o = GE.cpuTeam(fx.opp), home = fx.home ? u : o, away = fx.home ? o : u;
    away.kit = GE.altKit(home, away);
    var diff = Math.max(.05, Math.min(1, [.2, .42, .64, .85][save.division] + save.settings.diff));
    match = GE.newMatch(home, away, { halfLen: save.settings.half, diff: diff });
    GE.render.setMatch(match);
    ui.innerHTML = ''; hud.hidden = false; mode = 'play'; last = 0;
    var A = match.teams[0], B = match.teams[1];
    $('#score').innerHTML = '<span><i style="background:' + A.kit.shirt + '"></i>' + esc(A.abbr) + '</span><b id="s0">0</b><b id="s1">0</b><span>' + esc(B.abbr) + '<i style="background:' + B.kit.shirt + '"></i></span><em id="clk">0\'</em>';
    $('#touch').hidden = !isTouch;
    if ((save.tips || 0) < 3) {
      hint.innerHTML = isTouch ? 'Hold <b>SHOOT</b> to charge power. Push the stick up or down to pick a corner.' : '<b>J</b> pass &middot; hold <b>K</b> to shoot &middot; <b>L</b> lob &middot; <b>Shift</b> sprint &middot; aim shots with up / down';
      hint.style.opacity = 1; hintT = 7; save.tips = (save.tips || 0) + 1;
    } else hint.innerHTML = '';
    auInit(); crowd(.1);
  }

  var hudCache = '';
  function updateHud() {
    var m = match, A = m.teams[0], B = m.teams[1];
    var has = m.ball.owner && m.ball.owner.team === m.user;
    var key = A.score + '|' + B.score + '|' + Math.floor(m.time / 60) + '|' + has + '|' + m.state;
    if (key === hudCache) return; hudCache = key;
    $('#s0').textContent = A.score; $('#s1').textContent = B.score;
    $('#clk').textContent = m.state === 'halftime' ? 'HT' : m.state === 'fulltime' ? 'FT' : Math.min(90, Math.floor(m.time / 60)) + "'";
    $('#btnA').textContent = has ? 'PASS' : 'SWITCH'; $('#btnB').textContent = has ? 'SHOOT' : 'TACKLE'; $('#btnC').textContent = has ? 'LOB' : '';
    $('#btnC').style.opacity = has ? 1 : .35;
  }

  function handleEvents() {
    var ev = match.events;
    if (!ev.length) return;
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (match.demo) { if (e.type === 'final') { startDemo(); return; } continue; }
      if (e.type === 'goal') {
        var g = match.lastGoal; sfx('goal');
        showBanner('GOAL!', g.name + '  ' + g.minute + "'  ·  " + match.teams[0].abbr + ' ' + match.teams[0].score + '–' + match.teams[1].score + ' ' + match.teams[1].abbr, 3200);
      } else if (e.type === 'half') { sfx('final'); showBanner('HALF-TIME', match.teams[0].score + ' – ' + match.teams[1].score, 3000); }
      else if (e.type === 'final') {
        sfx('final'); showBanner('FULL-TIME', '', 2200);
        setTimeout(function () { if (mode === 'play' || mode === 'paused') resultScreen(false); }, 2300);
      } else sfx(e.type);
    }
    ev.length = 0;
  }

  /* ---------- input ---------- */
  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    if (mode === 'play') {
      if (e.code === 'Escape' || e.code === 'KeyP') pause();
      if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
    } else if (mode === 'paused' && e.code === 'Escape') act.resume();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { keys = {}; if (mode === 'play') pause(); });
  function pause() { if (mode !== 'play' || match.state === 'fulltime') return; mode = 'paused'; crowd(0, .2); pauseScreen(); }
  $('#pauseBtn').addEventListener('click', pause);

  var zone = $('#stickZone'), base = $('#stickBase'), knob = $('#stickKnob');
  function stickSet(dx, dy) {
    var l = Math.hypot(dx, dy), mx = 56; if (l > mx) { dx *= mx / l; dy *= mx / l; }
    stick.x = dx / mx; stick.y = dy / mx; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  zone.addEventListener('pointerdown', function (e) {
    if (stick.id !== null) return;
    stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; zone.setPointerCapture(e.pointerId);
    var r = zone.getBoundingClientRect();
    base.style.left = (e.clientX - r.left - 62) + 'px'; base.style.bottom = 'auto'; base.style.top = (e.clientY - r.top - 62) + 'px';
    stickSet(0, 0); auInit(); e.preventDefault();
  });
  zone.addEventListener('pointermove', function (e) { if (e.pointerId === stick.id) stickSet(e.clientX - stick.ox, e.clientY - stick.oy); });
  function stickEnd(e) {
    if (e.pointerId !== stick.id) return;
    stick.id = null; stickSet(0, 0); base.style.left = ''; base.style.top = ''; base.style.bottom = '';
  }
  zone.addEventListener('pointerup', stickEnd); zone.addEventListener('pointercancel', stickEnd);
  [['#btnA', 'a'], ['#btnB', 'b'], ['#btnC', 'c']].forEach(function (d) {
    var el = $(d[0]);
    el.addEventListener('pointerdown', function (e) { tb[d[1]] = true; el.classList.add('down'); el.setPointerCapture(e.pointerId); e.preventDefault(); });
    function up() { tb[d[1]] = false; el.classList.remove('down'); }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  document.addEventListener('contextmenu', function (e) { if (mode === 'play') e.preventDefault(); });

  function readInput() {
    var mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
    var my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + stick.y;
    var l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    input.mx = mx; input.my = my;
    input.sprint = !!(keys.ShiftLeft || keys.ShiftRight) || Math.hypot(stick.x, stick.y) > .9;
    input.a = !!(keys.KeyJ || keys.KeyX) || tb.a; input.b = !!(keys.KeyK || keys.Space) || tb.b; input.c = !!(keys.KeyL || keys.KeyC) || tb.c;
  }

  /* ---------- main loop ---------- */
  function frame(ts) {
    var dt = last ? Math.min(.05, (ts - last) / 1000) : .016; last = ts;
    if (match) {
      if (mode !== 'paused') {
        readInput();
        var n = Math.max(1, Math.ceil(dt * 90));
        for (var i = 0; i < n; i++) GE.stepMatch(match, dt / n, mode === 'play' ? input : null);
        handleEvents();
      }
      GE.render.draw(match, mode === 'paused' ? 0 : dt);
      if (mode === 'play') updateHud();
    }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.hidden = true; }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) { hint.style.opacity = 0; setTimeout(function () { hint.innerHTML = ''; }, 700); } }
    requestAnimationFrame(frame);
  }

  /* ---------- headless test hooks ---------- */
  function runSim(n, user) {
    var out = [];
    try {
      for (var k = 0; k < n; k++) {
        var a = GE.randomClub(68), b = GE.randomClub(68, a.name), A = GE.cpuTeam(a), B = GE.cpuTeam(b);
        if (user) A.isUser = true;
        var m = GE.newMatch(A, B, { demo: !user, halfLen: 120, diff: .5 }), inp = { mx: 0, my: 0, sprint: true, a: false, b: false, c: false }, steps = 0, ev = {};
        while (m.state !== 'fulltime' && steps < 400000) {
          if (user && steps % 12 === 0) {
            var d = m.user.dir; inp.mx = Math.random() < .75 ? d : -d; inp.my = Math.random() * 2 - 1;
            inp.a = Math.random() < .12; inp.b = Math.random() < .12; inp.c = Math.random() < .04;
          }
          GE.stepMatch(m, 1 / 60, user ? inp : null); steps++;
          for (var i = 0; i < m.events.length; i++) { var t = m.events[i].restart || m.events[i].type; ev[t] = (ev[t] || 0) + 1; }
          m.events.length = 0;
          if (!isFinite(m.ball.x + m.ball.y + m.ball.z)) throw new Error('ball NaN at step ' + steps);
        }
        out.push({ score: m.teams[0].score + '-' + m.teams[1].score, shots: [m.teams[0].stats.shots, m.teams[1].stats.shots], target: [m.teams[0].stats.target, m.teams[1].stats.target], poss: Math.round(m.teams[0].stats.poss), steps: steps, ev: ev });
      }
    } catch (e) { out.push('ERROR ' + (e.stack || e)); }
    var el = $('#simout'); el.hidden = false; el.textContent = JSON.stringify(out, null, 1);
  }

  /* ---------- boot ---------- */
  window.addEventListener('error', function (e) { var el = $('#simout'); if (qs.has('sim') || qs.has('demo') || qs.has('shot')) { el.hidden = false; el.textContent += '\nJS ERROR ' + e.message + ' @' + e.filename + ':' + e.lineno; } });
  if (qs.has('sim')) { runSim(+qs.get('sim') || 3, qs.has('user')); return; }
  GE.render.init($('#game'), $('#radar'));
  if (qs.has('demo')) {
    save = GE.newSave('Umoja Stars', +qs.get('kit') || 0);
    if (qs.has('user')) { startMatch(); } else { startDemo(); hud.hidden = true; }
    var secs = +qs.get('demo') || 10, pin = { mx: match.user ? match.user.dir : 0, my: .2, sprint: true, a: false, b: false, c: false };
    for (var i = 0; i < secs * 60; i++) { pin.b = qs.has('charge') && i > secs * 60 - 20; GE.stepMatch(match, 1 / 60, match.user ? pin : null); }
    match.events.length = 0;
    if (qs.has('user')) { keys.KeyD = true; if (qs.has('charge')) keys.KeyK = true; window.addEventListener('blur', function () { }, true); }
    requestAnimationFrame(frame); return;
  }
  startDemo();
  if (qs.has('shot')) {
    save = GE.newSave('Umoja Stars', 0); save.coins = 1850; GE.store = function () { };
    var sc = qs.get('shot');
    if (sc === 'result') { startMatch(); for (var j = 0; j < 60 * 260 && match.state !== 'fulltime'; j++) GE.stepMatch(match, 1 / 60, null); match.events.length = 0; resultScreen(false); startDemo(); }
    else if (sc === 'squad') { sel = save.lineup[9]; squad(); }
    else if (sc === 'auction') { auction(0); }
    else if (sc === 'scorers') { for (var r = 0; r < 4; r++) GE.playRound(save, 2, 1); GE.addScorer(save, GE.byId(save, save.lineup[9]).name, save.club.abbr); table(); }
    else (act[sc] || hub)({});
  } else {
    save = GE.load();
    if (save) hub(); else onboarding();
  }
  requestAnimationFrame(frame);
})();
