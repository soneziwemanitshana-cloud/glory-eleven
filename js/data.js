/* Glory Eleven — club, league and save data. All clubs and players are fictional. */
(function () {
  'use strict';
  var GE = window.GE = window.GE || {};
  var KEY = 'glory-eleven-v1';

  GE.mulberry = function (a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  GE.hash = hash;
  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  GE.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  GE.cdist = function (a, b) { var x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  GE.lum = function (a) { var x = rgb(a); return x[0] * .299 + x[1] * .587 + x[2] * .114; };
  GE.textOn = function (c) { return GE.lum(c) > 150 ? '#10131c' : '#ffffff'; };

  var FIRST = ['Thabo', 'Luca', 'Mateo', 'Kofi', 'Jonas', 'Andile', 'Rafael', 'Emeka', 'Hugo', 'Sipho', 'Dario', 'Noah', 'Kwame', 'Milan', 'Tariq', 'Enzo', 'Lwazi', 'Felix', 'Omar', 'Yuto', 'Bongani', 'Ivan', 'Diego', 'Sami', 'Themba', 'Nico', 'Aiden', 'Pablo', 'Musa', 'Leon', 'Zane', 'Mandla', 'Oscar', 'Idris', 'Kai', 'Tiago', 'Sizwe', 'Elias', 'Marco', 'Jabu'];
  var LAST = ['Dlamini', 'Moretti', 'Okafor', 'Santos', 'Lindqvist', 'Mokoena', 'Varga', 'Mensah', 'Castillo', 'Nkosi', 'Petrov', 'Hartmann', 'Diallo', 'Fontaine', 'Khumalo', 'Ibarra', 'Novak', 'Zulu', 'Ferreira', 'Tanaka', 'Mahlangu', 'Reyes', 'Keita', 'Bergstrom', 'Ndlovu', 'Costa', 'Adeyemi', 'Laurent', 'Sithole', 'Romero', 'Haddad', 'Molefe', 'Vidal', 'Osei', 'Kruger', 'Marin', 'Cele', 'Duarte', 'Banda', 'Wolff'];
  var SKINS = ['#f3cfae', '#e3b085', '#c98d5a', '#96603a', '#6b4226', '#4f2f1b'];
  var HAIRS = ['#15100b', '#2a1b10', '#5a3d22', '#b98f45', '#0c0c0c', '#8a8a8a'];

  var CLUBS = [
    ['Harbour City', 'HBC', '#1e88e5', '#ffffff', 'plain'], ['Ironvale United', 'IRV', '#c62828', '#111111', 'stripe'],
    ['Redcliff Rovers', 'RCR', '#e53935', '#ffffff', 'hoops'], ['Santa Vera', 'SVR', '#f9a825', '#1a237e', 'plain'],
    ['Kestrel Athletic', 'KES', '#6a1b9a', '#ffffff', 'sash'], ['Northgate FC', 'NGT', '#00897b', '#ffffff', 'plain'],
    ['Marlow Town', 'MRL', '#ef6c00', '#111111', 'stripe'], ['Ebony Coast', 'EBC', '#20242e', '#ffd600', 'sash'],
    ['Vale do Sol', 'VDS', '#fdd835', '#2e7d32', 'plain'], ['Lakeshore Dynamo', 'LKD', '#0277bd', '#ffeb3b', 'hoops'],
    ['Stonebridge', 'STB', '#607d8b', '#ffffff', 'plain'], ['Port Amber', 'PAM', '#ff8f00', '#4e342e', 'sash'],
    ['Monte Azul', 'MAZ', '#283593', '#90caf9', 'stripe'], ['Greyfield Wanderers', 'GFW', '#b0b6bf', '#b71c1c', 'plain'],
    ['Solaris FC', 'SOL', '#ff5722', '#fff3e0', 'plain'], ['Kingsmead', 'KGM', '#4a148c', '#ffc107', 'hoops'],
    ['Tide Bay', 'TDB', '#00acc1', '#ffffff', 'stripe'], ['Zamani Lions', 'ZAM', '#2e7d32', '#ffeb3b', 'plain'],
    ['Baobab United', 'BAO', '#795548', '#ffe0b2', 'sash'], ['Indlovu FC', 'IND', '#37474f', '#ff7043', 'plain'],
    ['Copper Hills', 'CPH', '#bf360c', '#ffffff', 'stripe'], ['Savanna Rangers', 'SVN', '#9e9d24', '#ffffff', 'plain'],
    ['Cape Meridian', 'CPM', '#0d47a1', '#e53935', 'sash'], ['Aurora Sporting', 'AUR', '#00c853', '#111111', 'hoops'],
    ['Rio Verde', 'RVD', '#1b5e20', '#ffffff', 'stripe'], ['Blackwater Albion', 'BWA', '#263238', '#80deea', 'plain'],
    ['Sunfield Olympic', 'SFO', '#fbc02d', '#d32f2f', 'sash'], ['Granite Peak', 'GRP', '#455a64', '#cddc39', 'plain']
  ];
  function kitOf(c) { return { shirt: c[2], trim: c[3], shorts: c[3], socks: c[2], style: c[4] }; }

  GE.USER_KITS = [
    { shirt: '#c8ff3e', trim: '#10131c', shorts: '#10131c', socks: '#c8ff3e', style: 'plain' },
    { shirt: '#e53935', trim: '#ffffff', shorts: '#ffffff', socks: '#e53935', style: 'stripe' },
    { shirt: '#1e66f5', trim: '#ffffff', shorts: '#1e66f5', socks: '#ffffff', style: 'sash' },
    { shirt: '#ffffff', trim: '#10131c', shorts: '#10131c', socks: '#ffffff', style: 'plain' },
    { shirt: '#10131c', trim: '#ffc83d', shorts: '#10131c', socks: '#ffc83d', style: 'hoops' },
    { shirt: '#ffc83d', trim: '#0b5d1e', shorts: '#0b5d1e', socks: '#ffc83d', style: 'sash' },
    { shirt: '#7b2ff7', trim: '#ffffff', shorts: '#ffffff', socks: '#7b2ff7', style: 'stripe' },
    { shirt: '#ff7a1a', trim: '#10131c', shorts: '#10131c', socks: '#ff7a1a', style: 'hoops' }
  ];

  GE.DIVS = [
    { name: 'Division 3', base: 59, prize: 600 },
    { name: 'Division 2', base: 66, prize: 1000 },
    { name: 'Division 1', base: 73, prize: 1600 },
    { name: 'Elite Division', base: 80, prize: 3000 }
  ];
  GE.SLOTS = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'];
  GE.SLOT_LABEL = ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'DM', 'CM', 'LW', 'ST', 'RW'];

  function clampOvr(v) { return Math.max(40, Math.min(99, Math.round(v))); }
  function makePlayer(rng, pos, ovr, id) {
    return {
      id: id, name: FIRST[Math.floor(rng() * FIRST.length)].charAt(0) + '. ' + LAST[Math.floor(rng() * LAST.length)],
      pos: pos, ovr: clampOvr(ovr), age: 17 + Math.floor(rng() * 16),
      skin: SKINS[Math.floor(rng() * SKINS.length)], hair: HAIRS[Math.floor(rng() * HAIRS.length)],
      num: 1 + Math.floor(rng() * 98)
    };
  }
  GE.abbr = function (name) {
    var a = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3);
    return a || 'FC';
  };

  GE.newSave = function (clubName, kitIdx) {
    var seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    var rng = GE.mulberry(seed);
    var s = {
      v: 1, seed: seed, nextId: 1, coins: 500, division: 0, season: 1,
      club: { name: clubName, abbr: GE.abbr(clubName), kit: kitIdx },
      squad: [], lineup: [], market: [],
      settings: { half: 120, diff: 0, sound: true }, tips: 0
    };
    var plan = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW', 'FW'];
    plan.forEach(function (pos, i) {
      var ovr = 57 + Math.floor(rng() * 9);
      if (i === 13) ovr = 72; if (i === 8) ovr = 70;
      s.squad.push(makePlayer(rng, pos, ovr, 'p' + (s.nextId++)));
    });
    GE.autoLineup(s);
    GE.buildLeague(s);
    GE.genMarket(s);
    return s;
  };

  GE.byId = function (s, id) { for (var i = 0; i < s.squad.length; i++) if (s.squad[i].id === id) return s.squad[i]; return null; };
  GE.effOvr = function (p, slot) {
    var want = GE.SLOTS[slot];
    if (p.pos === want) return p.ovr;
    return Math.max(30, p.ovr - ((p.pos === 'GK' || want === 'GK') ? 25 : 8));
  };
  GE.autoLineup = function (s) {
    var used = {}, lineup = [];
    GE.SLOTS.forEach(function (pos) {
      var best = null;
      s.squad.forEach(function (p) { if (!used[p.id] && p.pos === pos && (!best || p.ovr > best.ovr)) best = p; });
      if (!best) s.squad.forEach(function (p) { if (!used[p.id] && (!best || p.ovr > best.ovr)) best = p; });
      used[best.id] = 1; lineup.push(best.id);
    });
    s.lineup = lineup;
  };
  GE.teamRating = function (s) {
    var t = 0;
    s.lineup.forEach(function (id, i) { t += GE.effOvr(GE.byId(s, id), i); });
    return Math.round(t / 11);
  };

  GE.upgradeCost = function (ovr) { return Math.round((40 + Math.pow(Math.max(0, ovr - 52), 2) * 1.15) / 10) * 10; };
  GE.value = function (ovr) { return Math.max(40, Math.round(Math.pow(Math.max(1, ovr - 50), 2.2) * 1.1 / 10) * 10); };

  GE.genMarket = function (s) {
    var rng = GE.mulberry(hash('M' + s.seed + '-' + s.season + '-' + (s.league ? s.league.round : 0) + '-' + s.nextId));
    var base = GE.DIVS[s.division].base, pos = ['GK', 'DF', 'DF', 'MF', 'MF', 'FW', 'FW'];
    shuffle(pos, rng);
    s.market = [];
    for (var i = 0; i < 6; i++) {
      var p = makePlayer(rng, pos[i], base + 2 + Math.floor(rng() * 10), 'p' + (s.nextId++));
      p.price = GE.value(p.ovr); p.heat = rng();
      s.market.push(p);
    }
  };

  function blankRow(o) { o.P = 0; o.W = 0; o.D = 0; o.L = 0; o.GF = 0; o.GA = 0; o.Pts = 0; return o; }
  GE.buildLeague = function (s) {
    var d = GE.DIVS[s.division];
    var rng = GE.mulberry(hash('L' + s.seed + '-' + s.season + '-' + s.division));
    var pool = shuffle(CLUBS.slice(), rng);
    var teams = pool.slice(0, 7).map(function (c) {
      return blankRow({ name: c[0], abbr: c[1], kit: kitOf(c), rating: Math.round(d.base + rng() * 8 - 1) });
    });
    teams.push(blankRow({ user: true, name: s.club.name, abbr: s.club.abbr, kit: GE.USER_KITS[s.club.kit], rating: 0 }));
    shuffle(teams, rng);
    var arr = [0, 1, 2, 3, 4, 5, 6, 7], rounds = [];
    for (var r = 0; r < 7; r++) {
      var rd = [];
      for (var i = 0; i < 4; i++) { var a = arr[i], b = arr[7 - i]; rd.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(rd);
      arr.splice(1, 0, arr.pop());
    }
    s.league = { teams: teams, rounds: rounds, round: 0, scorers: {} };
  };
  GE.userIdx = function (s) { for (var i = 0; i < 8; i++) if (s.league.teams[i].user) return i; return 0; };
  GE.nextFixture = function (s) {
    var L = s.league; if (L.round >= L.rounds.length) return null;
    var u = GE.userIdx(s), rd = L.rounds[L.round];
    for (var i = 0; i < rd.length; i++) {
      if (rd[i][0] === u) return { home: true, opp: L.teams[rd[i][1]] };
      if (rd[i][1] === u) return { home: false, opp: L.teams[rd[i][0]] };
    }
    return null;
  };
  function poisson(l, rng) { var L = Math.exp(-l), k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
  function apply(a, b, ga, gb) {
    a.P++; b.P++; a.GF += ga; a.GA += gb; b.GF += gb; b.GA += ga;
    if (ga > gb) { a.W++; b.L++; a.Pts += 3; } else if (ga < gb) { b.W++; a.L++; b.Pts += 3; } else { a.D++; b.D++; a.Pts++; b.Pts++; }
  }
  GE.playRound = function (s, gf, ga) {
    var L = s.league, u = GE.userIdx(s), rd = L.rounds[L.round];
    var rng = GE.mulberry(hash('R' + s.seed + s.season + '-' + L.round + '-' + gf + ga));
    rd.forEach(function (m) {
      var a = L.teams[m[0]], b = L.teams[m[1]];
      if (m[0] === u) apply(a, b, gf, ga);
      else if (m[1] === u) apply(a, b, ga, gf);
      else {
        var x = poisson(1.35 * Math.exp((a.rating - b.rating + 2) / 16), rng), y = poisson(1.35 * Math.exp((b.rating - a.rating) / 16), rng);
        apply(a, b, x, y); simScorers(s, a, x, rng); simScorers(s, b, y, rng);
      }
    });
    L.round++;
  };
  var SCORE_SLOTS = [9, 9, 9, 9, 8, 8, 10, 10, 5, 6, 7, 3];
  function simScorers(s, t, n, rng) {
    if (!n) return;
    var pl = GE.cpuTeam(t).players;
    for (var i = 0; i < n; i++) GE.addScorer(s, pl[SCORE_SLOTS[Math.floor(rng() * SCORE_SLOTS.length)]].name, t.abbr);
  }
  GE.addScorer = function (s, name, abbr) {
    var L = s.league; L.scorers = L.scorers || {};
    var k = name + '|' + abbr; L.scorers[k] = (L.scorers[k] || 0) + 1;
  };
  GE.topScorers = function (s, n) {
    var sc = s.league.scorers || {};
    return Object.keys(sc).map(function (k) { var a = k.split('|'); return { name: a[0], abbr: a[1], goals: sc[k] }; })
      .sort(function (a, b) { return b.goals - a.goals || (a.name < b.name ? -1 : 1); }).slice(0, n);
  };
  GE.stars = function (ovr) {
    var n = Math.max(1, Math.min(5, Math.round((ovr - 48) / 8)));
    return '\u2605\u2605\u2605\u2605\u2605'.slice(0, n) + '\u2606\u2606\u2606\u2606\u2606'.slice(n);
  };
  GE.table = function (s) {
    return s.league.teams.slice().sort(function (a, b) {
      return b.Pts - a.Pts || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF || (a.name < b.name ? -1 : 1);
    });
  };
  GE.endSeason = function (s) {
    var tb = GE.table(s), pos = 1;
    tb.forEach(function (t, i) { if (t.user) pos = i + 1; });
    var d = GE.DIVS[s.division];
    var out = { pos: pos, division: d.name, promoted: pos <= 2 && s.division < 3, relegated: pos >= 7 && s.division > 0, champion: pos === 1 };
    out.prize = pos === 1 ? d.prize : pos === 2 ? Math.round(d.prize * .6) : pos <= 4 ? Math.round(d.prize * .3) : 100;
    s.coins += out.prize;
    if (out.promoted) s.division++; else if (out.relegated) s.division--;
    s.season++;
    out.next = GE.DIVS[s.division].name;
    GE.buildLeague(s); GE.genMarket(s);
    return out;
  };

  /* Match-ready team objects */
  GE.userTeam = function (s) {
    return {
      name: s.club.name, abbr: s.club.abbr, kit: GE.USER_KITS[s.club.kit], isUser: true,
      players: s.lineup.map(function (id, i) { var p = GE.byId(s, id); return { name: p.name, num: p.num, ovr: GE.effOvr(p, i), skin: p.skin, hair: p.hair }; })
    };
  };
  GE.cpuTeam = function (t) {
    var rng = GE.mulberry(hash('T' + t.name));
    return {
      name: t.name, abbr: t.abbr, kit: t.kit, isUser: false,
      players: GE.SLOTS.map(function (pos) { return makePlayer(rng, pos, t.rating + rng() * 8 - 4, 'x'); })
    };
  };
  GE.randomClub = function (rating, skip) {
    var c;
    do { c = CLUBS[Math.floor(Math.random() * CLUBS.length)]; } while (skip && c[0] === skip);
    return { name: c[0], abbr: c[1], kit: kitOf(c), rating: rating };
  };
  GE.altKit = function (home, away) {
    if (GE.cdist(home.kit.shirt, away.kit.shirt) >= 150) return away.kit;
    var light = GE.lum(home.kit.shirt) < 140;
    return { shirt: light ? '#f4f6fa' : '#1a1e2b', trim: away.kit.shirt, shorts: light ? '#f4f6fa' : '#1a1e2b', socks: away.kit.shirt, style: 'plain' };
  };

  GE.crest = function (t, size) {
    var k = t.kit;
    return '<svg class="crest" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M24 3 42 9v14c0 11-7.5 18-18 22C13.5 41 6 34 6 23V9z" fill="' + k.shirt + '" stroke="' + k.trim + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M8 19h32" stroke="' + k.trim + '" stroke-width="2" opacity=".55"/>' +
      '<text x="24" y="33" text-anchor="middle" font-size="10.5" font-weight="800" fill="' + GE.textOn(k.shirt) + '" font-family="Bahnschrift,Arial,sans-serif">' + GE.esc(t.abbr) + '</text></svg>';
  };

  GE.load = function () {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && s.league && s.squad) return s; } catch (e) { }
    return null;
  };
  GE.store = function (s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } };
  GE.wipe = function () { try { localStorage.removeItem(KEY); } catch (e) { } };
})();
