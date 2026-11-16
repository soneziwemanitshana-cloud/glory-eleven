/* Glory Eleven — match simulation. World units are metres: x along the pitch, y across, z up. */
(function () {
  'use strict';
  var GE = window.GE = window.GE || {};
  var PL = 52.5, PW = 34, GW = 3.66, GH = 2.44, G = 14;
  var hyp = Math.hypot, R = Math.random;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function gauss() { return (R() + R() + R() + R() - 2) * 1.2; }
  var NOINP = { mx: 0, my: 0, sprint: false, a: false, b: false, c: false };

  var FORM = [
    { line: 0, x: -1.3, y: 0 },
    { line: 1, x: -.62, y: -.74 }, { line: 1, x: -.72, y: -.26 }, { line: 1, x: -.72, y: .26 }, { line: 1, x: -.62, y: .74 },
    { line: 2, x: -.2, y: -.45 }, { line: 2, x: -.34, y: 0 }, { line: 2, x: -.2, y: .45 },
    { line: 3, x: .3, y: -.7 }, { line: 3, x: .42, y: 0, st: true }, { line: 3, x: .3, y: .7 }
  ];

  GE.newMatch = function (home, away, o) {
    o = o || {};
    var m = {
      teams: [], ball: { x: 0, y: 0, z: .11, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: null, lastP: null, roll: 0 },
      time: 0, half: 1, state: 'kickoff', stateT: 1.5, halfLen: o.halfLen || 120, diff: o.diff == null ? .5 : o.diff,
      demo: !!o.demo, ctrl: null, passTarget: null, events: [], poss: null, shot: null, lastGoal: null, restart: null,
      goals: [], switchT: 0, prev: { a: false, b: false, c: false }, pred: []
    };
    var gkCols = ['#f4d21f', '#ff5fa2', '#3ddc84', '#ff8a1f'];
    [home, away].forEach(function (td, ti) {
      var t = {
        name: td.name, abbr: td.abbr, kit: td.kit, isUser: !!td.isUser && !m.demo, dir: ti === 0 ? 1 : -1, score: 0,
        players: [], stats: { shots: 0, target: 0, poss: 0 }, idx: ti, chaser: null, chaseT: 99, p1: null, p2: null
      };
      var cpu = !t.isUser;
      td.players.forEach(function (pd, i) {
        var ovr = pd.ovr;
        t.players.push({
          team: t, slot: i, f: FORM[i], name: pd.name, num: pd.num, ovr: ovr, isGK: i === 0, skin: pd.skin, hair: pd.hair,
          maxSpd: (6.3 + (ovr - 60) * .035) * (cpu ? .87 + .13 * m.diff : 1),
          reactDelay: .12 + Math.max(0, 90 - ovr) * .004 + (cpu ? (1 - m.diff) * .08 : 0), diveSpd: 6.4 + (ovr - 60) * .06,
          x: 0, y: 0, vx: 0, vy: 0, fx: t.dir, fy: 0, phase: R() * 6, spd: 0, cool: 0, tackleCd: 0, stun: 0, protect: 0,
          slide: 0, think: 0, hold: 0, react: 0, charge: 0, charging: false, dribX: t.dir, dribY: 0, dive: 0, diveT: 0,
          cpx: 0, cpy: 0, restartKick: false
        });
      });
      m.teams.push(t);
    });
    var A = m.teams[0], B = m.teams[1];
    A.opp = B; B.opp = A;
    gkCols.sort(function (a, b) {
      return Math.min(GE.cdist(b, A.kit.shirt), GE.cdist(b, B.kit.shirt)) - Math.min(GE.cdist(a, A.kit.shirt), GE.cdist(a, B.kit.shirt));
    });
    A.gkCol = gkCols[0]; B.gkCol = gkCols[1];
    m.user = A.isUser ? A : B.isUser ? B : null;
    m.firstKick = A;
    kickoff(m, A);
    return m;
  };

  function kickoff(m, kt) {
    m.teams.forEach(function (t) {
      t.players.forEach(function (p) {
        var f = p.f;
        if (p.isGK) { p.x = -t.dir * (PL - 1.5); p.y = 0; }
        else {
          p.x = t.dir * ((f.x - .42) * 32 - 1.5 - (t !== kt && f.line === 3 ? 9 : 0));
          p.y = t.dir * f.y * PW * .8;
        }
        p.vx = p.vy = 0; p.fx = t.dir; p.fy = 0; p.slide = 0; p.stun = 0; p.cool = 0; p.protect = 0; p.charge = 0; p.charging = false;
        p.restartKick = false; p.react = 0;
      });
    });
    var st = kt.players[9], b = m.ball;
    st.x = -kt.dir * .6; st.y = 0; st.protect = 2.6; st.restartKick = !kt.isUser;
    b.x = 0; b.y = 0; b.z = .11; b.vx = b.vy = b.vz = 0; b.owner = st; b.lastTouch = kt; b.lastP = st;
    m.poss = kt; m.state = 'kickoff'; m.stateT = 1.4; m.passTarget = null; m.shot = null; m.restart = { type: 'kickoff', team: kt };
    if (m.user) m.ctrl = kt.isUser ? st : m.user.players[6];
    m.events.push({ type: 'whistle' });
  }

  function inBox(t, x, y) { return -t.dir * x > PL - 16.5 && Math.abs(y) < 20.16; }

  /* ---------- per-step planning: ball prediction, chasers, pressers ---------- */
  function plan(m, dt) {
    var b = m.ball, pr = m.pred, i, t, p;
    var x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz, h = .12;
    for (i = 0; i < 26; i++) {
      if (!pr[i]) pr[i] = { x: 0, y: 0, z: 0 };
      pr[i].x = x; pr[i].y = y; pr[i].z = z;
      vz -= G * h; x += vx * h; y += vy * h; z += vz * h;
      if (z < .11) { z = .11; if (vz < -1.5) { vz = -vz * .55; vx *= .8; vy *= .8; } else vz = 0; }
      var f = Math.exp(-(z <= .12 ? .6 : .12) * h); vx *= f; vy *= f;
    }
    for (var ti = 0; ti < 2; ti++) {
      t = m.teams[ti]; t.chaser = null; t.chaseT = 99; t.p1 = t.p2 = null;
      var d1 = 1e9, d2 = 1e9;
      for (var pi = 0; pi < 11; pi++) {
        p = t.players[pi];
        if (!b.owner) {
          for (i = 0; i < 26; i++) {
            if (pr[i].z > 1.5) continue;
            var d = hyp(pr[i].x - p.x, pr[i].y - p.y), tt = i * h;
            if (d <= p.maxSpd * tt + .9) {
              if (p.isGK && !inBox(t, pr[i].x, pr[i].y)) break;
              if (m.passTarget === p) tt -= 1;
              if (p.cool > 0) tt += 1;
              if (tt < t.chaseT) { t.chaseT = tt; t.chaser = p; p.cpx = pr[i].x; p.cpy = pr[i].y; }
              break;
            }
          }
        }
        if (!p.isGK && !(t.isUser && p === m.ctrl)) {
          var db = hyp(b.x - p.x, b.y - p.y);
          if (db < d1) { d2 = d1; t.p2 = t.p1; d1 = db; t.p1 = p; } else if (db < d2) { d2 = db; t.p2 = p; }
        }
      }
      if (!b.owner && !t.chaser) {
        var best = null, bd = 1e9, e = pr[25];
        for (pi = 1; pi < 11; pi++) { p = t.players[pi]; var dd = hyp(e.x - p.x, e.y - p.y); if (dd < bd) { bd = dd; best = p; } }
        t.chaser = best; best.cpx = clamp(e.x, -PL, PL); best.cpy = clamp(e.y, -PW, PW);
      }
    }
    // auto player switching for the user while out of possession
    var u = m.user;
    if (u && m.state === 'play') {
      m.switchT -= dt;
      if ((!b.owner || b.owner.team !== u) && m.ctrl && m.switchT <= 0 && m.passTarget !== m.ctrl) {
        var near = nearestOutfield(u, b.x, b.y, null);
        if (near !== m.ctrl && hyp(m.ctrl.x - b.x, m.ctrl.y - b.y) - hyp(near.x - b.x, near.y - b.y) > 8) { m.ctrl = near; m.switchT = 1; }
      }
    }
  }
  function nearestOutfield(t, x, y, skip) {
    var best = null, bd = 1e9;
    for (var i = 1; i < 11; i++) { var p = t.players[i]; if (p === skip) continue; var d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  /* ---------- movement ---------- */
  function integrate(p, tx, ty, spd, dt, arrive) {
    var dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy), wx = 0, wy = 0;
    if (d > .15 && spd > 0) { var s = arrive ? Math.min(spd, d * 3.5) : spd; wx = dx / d * s; wy = dy / d * s; }
    if (p.stun > 0) { wx *= .3; wy *= .3; }
    var acc = 24 * dt, ax = wx - p.vx, ay = wy - p.vy, a = hyp(ax, ay);
    if (a > acc) { ax *= acc / a; ay *= acc / a; }
    p.vx += ax; p.vy += ay; p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, -PL - 2, PL + 2); p.y = clamp(p.y, -PW - 2, PW + 2);
    var sp = hyp(p.vx, p.vy);
    if (sp > .6) {
      var k = Math.min(1, dt * 12);
      p.fx += (p.vx / sp - p.fx) * k; p.fy += (p.vy / sp - p.fy) * k;
      var fl = hyp(p.fx, p.fy) || 1; p.fx /= fl; p.fy /= fl;
    }
    p.phase += sp * dt * 1.9; p.spd = sp;
  }

  function shape(m, t, p) {
    var b = m.ball, f = p.f, has = m.poss === t, bx = b.x * t.dir;
    var ax = f.x * 36 + (has ? 7 : -3) + bx * .5;
    var ay = f.y * PW * (has ? .88 : .7) + b.y * t.dir * .3;
    if (has && f.line === 3) ax = Math.max(ax, Math.min(bx + (f.st ? 14 : 9), 44));
    if (has && f.line === 2) ax = Math.max(ax, bx - 7);
    if (!has && f.line === 1) ax = Math.min(ax, Math.max(bx - 5, -44));
    ax = clamp(ax, -47, 46); ay = clamp(ay, -PW + 2, PW - 2);
    return [t.dir * ax, t.dir * ay];
  }

  function stepPlayer(m, p, dt, inp) {
    p.cool = Math.max(0, p.cool - dt); p.tackleCd = Math.max(0, p.tackleCd - dt); p.stun = Math.max(0, p.stun - dt);
    p.protect = Math.max(0, p.protect - dt); p.diveT = Math.max(0, p.diveT - dt);
    var b = m.ball, t = p.team, live = m.state === 'play';
    if (p.slide > 0) {
      p.slide -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      var f = Math.exp(-2.4 * dt); p.vx *= f; p.vy *= f; p.spd = hyp(p.vx, p.vy);
      p.x = clamp(p.x, -PL - 2, PL + 2); p.y = clamp(p.y, -PW - 2, PW + 2);
      if (p.slide <= 0) p.stun = .4;
      return;
    }
    if (m.state === 'halftime' || m.state === 'fulltime') { integrate(p, p.x, p.y, 0, dt, true); return; }
    if (b.owner === p && !live) { integrate(p, p.x, p.y, 0, dt, true); return; }
    if (m.state === 'goal') {
      var sc = m.lastGoal && m.lastGoal.p;
      if (sc && p === sc) integrate(p, t.dir * (PL - 7), PW - 5, p.maxSpd * .85, dt, true);
      else if (sc && sc.team === t && !p.isGK) integrate(p, sc.x - t.dir * 1.5, sc.y, hyp(sc.x - p.x, sc.y - p.y) > 3 ? p.maxSpd * .8 : 0, dt, true);
      else integrate(p, p.x, p.y, 0, dt, true);
      return;
    }
    if (p.isGK) { keeper(m, p, dt); return; }
    if (t.isUser && p === m.ctrl) { userControl(m, p, dt, inp, live); return; }
    if (b.owner === p) { aiCarrier(m, p, dt); return; }

    var s = shape(m, t, p), tx = s[0], ty = s[1], spd = p.maxSpd * .8, arrive = true;
    if (live) {
      if (!b.owner) {
        if (t.chaser === p) { tx = p.cpx; ty = p.cpy; spd = p.maxSpd; arrive = false; }
      } else if (b.owner.team !== t && !b.owner.isGK) {
        var o = b.owner, gx = -t.dir * PL, dx = gx - o.x, dy = -o.y, d = hyp(dx, dy) || 1;
        if (p === t.p1) {
          tx = b.x + o.vx * .15; ty = b.y + o.vy * .15; spd = p.maxSpd * (t.isUser ? .96 : 1); arrive = false;
        } else if (p === t.p2) { tx = o.x + dx / d * 6.5; ty = o.y + dy / d * 6.5; spd = p.maxSpd * .95; }
      }
    }
    integrate(p, tx, ty, spd, dt, arrive);
  }

  /* ---------- kicking ---------- */
  function release(m, p) {
    var b = m.ball; b.owner = null; b.lastTouch = p.team; b.lastP = p; p.cool = .4; p.charge = 0; p.charging = false;
    m.events.push({ type: 'kick' });
  }
  function doPass(m, p, q, lob) {
    var b = m.ball, d = hyp(q.x - p.x, q.y - p.y), v = clamp(7 + d * .85, 10, 26), T = d / v;
    var tx = clamp(q.x + q.vx * T * .8, -PL + 1, PL - 1), ty = clamp(q.y + q.vy * T * .8, -PW + 1, PW - 1);
    var dx = tx - p.x, dy = ty - p.y; d = hyp(dx, dy) || 1;
    var an = Math.atan2(dy, dx) + gauss() * (.025 + Math.max(0, 80 - p.ovr) * .0012);
    var ux = Math.cos(an), uy = Math.sin(an);
    b.x = p.x + ux * .6; b.y = p.y + uy * .6; b.z = .11;
    if (lob) {
      T = clamp(d / 17, .8, 2); var vh = d / T * (1 + .06 * T);
      b.vx = ux * vh; b.vy = uy * vh; b.vz = G * T / 2;
    } else {
      T = d / v; var v0 = d * .6 / (1 - Math.exp(-.6 * T));
      b.vx = ux * v0; b.vy = uy * v0; b.vz = 0;
    }
    p.fx = ux; p.fy = uy;
    release(m, p);
    m.passTarget = q; m.shot = null;
    if (p.team.isUser && !q.isGK) { m.ctrl = q; m.switchT = 1; }
  }
  function kickFree(m, p, ux, uy, speed, vz) {
    var b = m.ball, l = hyp(ux, uy) || 1; ux /= l; uy /= l;
    b.x = p.x + ux * .6; b.y = p.y + uy * .6; b.z = .11; b.vx = ux * speed; b.vy = uy * speed; b.vz = vz;
    p.fx = ux; p.fy = uy; release(m, p); m.passTarget = null; m.shot = null;
  }
  function shoot(m, p, power, aimY, errMul) {
    var b = m.ball, t = p.team, gx = t.dir * PL;
    var d0 = hyp(gx - p.x, aimY - p.y), skill = clamp((p.ovr - 50) / 45, 0, 1);
    var err = (1.5 - skill) * (.5 + power * .7) * (d0 / 20) * errMul;
    var ty = aimY + gauss() * err * 1.1, dx = gx - p.x, dy = ty - p.y, d = hyp(dx, dy) || 1;
    var sp = 18 + 13 * power, T = d / sp, th = .4 + power * power * 2.3 + Math.abs(gauss()) * err * .7;
    var ux = dx / d, uy = dy / d;
    b.x = p.x + ux * .6; b.y = p.y + uy * .6; b.z = .11;
    b.vx = ux * sp * (1 + .06 * T); b.vy = uy * sp * (1 + .06 * T); b.vz = (th - .11) / T + .5 * G * T;
    p.fx = ux; p.fy = uy; release(m, p);
    m.passTarget = null; m.shot = { team: t }; t.stats.shots++;
    m.events.push({ type: 'shot' });
  }

  function bestPass(m, p, any) {
    var t = p.team, o = t.opp, dir = t.dir, best = null;
    for (var i = 0; i < 11; i++) {
      var q = t.players[i]; if (q === p || (q.isGK && !any)) continue;
      var dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy); if (d < 5 || d > 42) continue;
      var prog = dx * dir, lane = 9, qo = 9;
      for (var j = 0; j < 11; j++) {
        var e = o.players[j], ex = e.x - p.x, ey = e.y - p.y, tt = clamp((ex * dx + ey * dy) / (d * d), 0, 1);
        lane = Math.min(lane, hyp(ex - dx * tt, ey - dy * tt) - tt * d * .12);
        qo = Math.min(qo, hyp(e.x - q.x, e.y - q.y));
      }
      if (d <= 30 ? lane < 1.5 + m.diff * .5 : qo < 3) continue;
      var sc = prog * .8 + Math.min(qo, 8) * 1.3 + lane * .8 - d * .12; if (prog < -12) sc -= 8;
      if (!best || sc > best.score) best = { q: q, score: sc, d: d };
    }
    return best;
  }

  /* ---------- AI on the ball ---------- */
  function aiCarrier(m, p, dt) {
    var t = p.team, o = t.opp, dir = t.dir, gx = dir * PL, i, q, opt;
    if (p.restartKick) {
      p.restartKick = false;
      if (m.restart && m.restart.type === 'corner') {
        var tq = null, bd = 1e9;
        for (i = 1; i < 11; i++) { q = t.players[i]; if (q === p) continue; var dq = hyp(q.x - (gx - dir * 9), q.y); if (dq < bd) { bd = dq; tq = q; } }
        doPass(m, p, tq, true); return;
      }
      opt = bestPass(m, p, true);
      doPass(m, p, opt ? opt.q : nearestOutfield(t, p.x, p.y, p), false); return;
    }
    var dG = hyp(gx - p.x, p.y), dO = 99;
    for (i = 0; i < 11; i++) { q = o.players[i]; var dd = hyp(q.x - p.x, q.y - p.y); if (dd < dO) dO = dd; }
    var pressured = dO < 3.4, prog = p.x * dir;
    p.think -= dt;
    if (p.think <= 0) {
      p.think = (.16 + R() * .14) * (1.5 - .5 * m.diff);
      if (dG < 27 && Math.abs(p.y) < 16 && (dG < 16 || (pressured && dG < 23) || R() < .05)) {
        shoot(m, p, .45 + R() * .45, (R() < .5 ? -1 : 1) * (1.6 + R() * 1.7), 1.75 - .75 * m.diff); return;
      }
      opt = bestPass(m, p, false);
      if (prog > PL - 7 && opt) { doPass(m, p, opt.q, false); return; }
      if (opt && (pressured ? opt.score > -6 : (opt.score > 9 && R() < .3))) { doPass(m, p, opt.q, opt.d > 30); return; }
      if (pressured && !opt && prog < -18 && R() < .5) { kickFree(m, p, dir, (R() - .5) * .8, 24, 9); return; }
      var tx = gx - dir * 8 - p.x, ty = p.y * .4 - p.y, d = hyp(tx, ty) || 1; tx /= d; ty /= d;
      var bx = tx, by = ty;
      for (i = 0; i < 11; i++) {
        q = o.players[i]; var ax = q.x - p.x, ay = q.y - p.y, da = hyp(ax, ay);
        if (da < 6 && da > .01 && ax * bx + ay * by > 0) {
          var side = (bx * ay - by * ax) > 0 ? 1 : -1, w = (6 - da) / 6 * 1.4;
          tx += by * side * w; ty += -bx * side * w;
        }
      }
      if (Math.abs(p.y) > PW - 3) ty -= (p.y > 0 ? 1 : -1) * .9;
      if (prog > PL - 4) tx -= dir * .9;
      d = hyp(tx, ty) || 1; p.dribX = tx / d; p.dribY = ty / d;
    }
    integrate(p, p.x + p.dribX * 10, p.y + p.dribY * 10, p.maxSpd * .92, dt, false);
  }

  /* ---------- goalkeeper ---------- */
  function keeper(m, p, dt) {
    var t = p.team, b = m.ball, sg = -t.dir, gx = sg * PL;
    if (b.owner === p) {
      integrate(p, p.x, p.y, 0, dt, true); p.fx = t.dir; p.fy = 0;
      p.hold -= dt; if (p.hold <= 0) distribute(m, p);
      return;
    }
    var threat = false;
    if (!b.owner && b.vx * sg > 6) {
      var tt = (p.x - b.x) / b.vx;
      if (tt > 0 && tt < 1.5) {
        var ya = b.y + b.vy * tt;
        if (Math.abs(ya) < GW + 2) {
          threat = true; p.react += dt;
          if (p.react > p.reactDelay) {
            if (Math.abs(ya - p.y) > 1) { p.dive = ya > p.y ? 1 : -1; p.diveT = .35; }
            integrate(p, p.x, clamp(ya, -GW - .6, GW + .6), p.diveSpd, dt, false);
          } else integrate(p, p.x, p.y, 0, dt, true);
        }
      }
    }
    if (threat) return;
    p.react = 0;
    if (!b.owner && t.chaser === p) { integrate(p, p.cpx, p.cpy, p.maxSpd, dt, false); return; }
    var dx = b.x - gx, dy = b.y, d = hyp(dx, dy) || 1, r = clamp(1.4 + (34 - d) * .09, 1.3, 4.5);
    if (b.owner && b.owner.team !== t && d < 15) r = Math.min(d * .42, 6);
    var tx = gx + dx / d * r, ty = clamp(dy / d * r, -GW - .3, GW + .3);
    if (tx * sg > PL - .7) tx = sg * (PL - .7);
    integrate(p, tx, ty, p.maxSpd * .8, dt, true);
  }
  function distribute(m, p) {
    var t = p.team, opt = bestPass(m, p, false);
    if (opt && opt.d < 32) { doPass(m, p, opt.q, false); return; }
    var q = t.players[5 + Math.floor(R() * 6)];
    doPass(m, p, q, true);
  }

  /* ---------- user control ---------- */
  function userControl(m, p, dt, inp, live) {
    var b = m.ball, t = p.team, has = b.owner === p;
    var mx = inp.mx, my = inp.my, mag = hyp(mx, my), nx = p.fx, ny = p.fy;
    if (mag > .2) { nx = mx / mag; ny = my / mag; }
    var pa = inp.a && !m.prev.a, pb = inp.b && !m.prev.b, pc = inp.c && !m.prev.c;
    if (live) {
      if (has) {
        if (pa || pc) { userPass(m, p, nx, ny, pc); }
        else {
          if (pb) p.charging = true;
          if (p.charging) {
            p.charge = Math.min(1, p.charge + dt / .75);
            if (!inp.b || p.charge >= 1) {
              var gk = t.opp.players[0], aim;
              if (mag > .2 && Math.abs(ny) > .3) aim = (ny > 0 ? 1 : -1) * 3;
              else aim = (Math.abs(gk.y) < .3 ? (R() < .5 ? 1 : -1) : (gk.y > 0 ? -1 : 1)) * 2.6;
              shoot(m, p, Math.max(.22, p.charge), aim, 1);
            }
          }
        }
      } else {
        p.charging = false; p.charge = 0;
        if (pa) { var n = nearestOutfield(t, b.x, b.y, p); if (n) { m.ctrl = n; m.switchT = 1.2; } }
        else if (pb && p.stun <= 0) {
          p.slide = .42; p.vx = nx * 10; p.vy = ny * 10; p.fx = nx; p.fy = ny; m.events.push({ type: 'slide' }); return;
        }
      }
    }
    if (mag > .2) {
      var sp = p.maxSpd * (inp.sprint ? 1.05 : .82) * (b.owner === p ? .93 : 1);
      integrate(p, p.x + nx * 10, p.y + ny * 10, sp * Math.min(1, mag), dt, false);
    } else if (live && !b.owner && t.chaser === p) integrate(p, p.cpx, p.cpy, p.maxSpd, dt, false);
    else integrate(p, p.x, p.y, 0, dt, true);
  }
  function userPass(m, p, nx, ny, lob) {
    var t = p.team, best = null, bs = -1e9;
    for (var i = 0; i < 11; i++) {
      var q = t.players[i]; if (q === p) continue;
      var vx = q.x - p.x, vy = q.y - p.y, d = hyp(vx, vy); if (d < 3) continue;
      var cos = (vx * nx + vy * ny) / d; if (cos < (q.isGK ? .85 : .4)) continue;
      var sc = cos * 30 - Math.abs(d - (lob ? 28 : 13)) * .5;
      if (sc > bs) { bs = sc; best = q; }
    }
    if (best) doPass(m, p, best, lob); else kickFree(m, p, nx, ny, lob ? 17 : 16, lob ? 9 : 0);
  }

  /* ---------- ball ---------- */
  function own(m, p) {
    var b = m.ball; b.owner = p; b.lastTouch = p.team; b.lastP = p; m.poss = p.team; m.passTarget = null; m.shot = null;
    p.protect = .45; p.think = .12 + R() * .15; p.charge = 0; p.charging = false;
    if (p.isGK) { p.hold = .9; p.protect = 9; }
    else if (p.team.isUser) m.ctrl = p;
  }
  function setRestart(m, type, t, x, y) {
    var b = m.ball, tk, i, p;
    if (type === 'goalkick') {
      tk = t.players[0]; tk.x = -t.dir * (PL - 5.5); tk.y = clamp(y, -4, 4); tk.fx = t.dir; tk.fy = 0; tk.hold = .5;
    } else {
      var bd = 1e9;
      for (i = 1; i < 11; i++) { p = t.players[i]; var d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; tk = p; } }
      var sy = y > 0 ? 1 : -1; tk.x = x; tk.y = y + sy * .4;
      if (type === 'corner') { var sx = x > 0 ? 1 : -1; tk.fx = -sx * .45; tk.fy = -sy * .89; } else { tk.fx = 0; tk.fy = -sy; }
      tk.restartKick = !t.isUser;
    }
    tk.vx = tk.vy = 0; tk.slide = 0; tk.stun = 0; tk.cool = 0; tk.charge = 0; tk.charging = false;
    b.owner = tk; b.lastTouch = t; b.lastP = tk; b.vx = b.vy = b.vz = 0;
    b.x = tk.x + tk.fx * .6; b.y = tk.y + tk.fy * .6; b.z = .11;
    tk.protect = tk.isGK ? 9 : 2.6;
    m.poss = t; m.passTarget = null; m.shot = null; m.state = 'restart'; m.stateT = 1.2; m.restart = { type: type, team: t };
    if (t.isUser && !tk.isGK) m.ctrl = tk;
    m.events.push({ type: 'whistle', restart: type });
  }

  function stepBall(m, dt) {
    var b = m.ball, px = b.x, py = b.y, o = b.owner;
    if (o) {
      b.x = o.x + o.fx * .6; b.y = o.y + o.fy * .6; b.z = .11; b.vx = o.vx; b.vy = o.vy; b.vz = 0; b.roll += o.spd * dt;
    } else {
      b.vz -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.z < .11) { b.z = .11; if (b.vz < -1.5) { b.vz = -b.vz * .55; b.vx *= .8; b.vy *= .8; } else b.vz = 0; }
      var f = Math.exp(-(b.z <= .12 ? .6 : .12) * dt); b.vx *= f; b.vy *= f;
      b.roll += hyp(b.vx, b.vy) * dt;
    }
    if (m.state === 'goal') {
      if (Math.abs(b.x) > PL + 1.7) { b.x = (b.x > 0 ? 1 : -1) * (PL + 1.7); b.vx = 0; b.vy *= .5; }
      if (Math.abs(b.y) > GW - .2 && Math.abs(b.x) > PL) { b.y = (b.y > 0 ? 1 : -1) * (GW - .2); b.vy = 0; }
      return;
    }
    if (m.state !== 'play' || (o && o.isGK)) return;
    if (Math.abs(b.x) > PL) {
      var side = b.x > 0 ? 1 : -1, den = b.x - px, fr = den ? clamp((side * PL - px) / den, 0, 1) : 1;
      var yc = py + (b.y - py) * fr, ay = Math.abs(yc);
      if (!o && b.z < GH + .22 && ay < GW + .2 && (Math.abs(ay - GW) < .2 || b.z > GH - .12)) {
        b.x = side * (PL - .3); b.vx = -b.vx * .45; b.vy = b.vy * .6 + (R() - .5) * 5; b.vz = Math.abs(b.vz) * .5 + 1;
        m.events.push({ type: 'post' }); return;
      }
      var att = m.teams[0].dir === side ? m.teams[0] : m.teams[1], def = att.opp;
      if (ay < GW && b.z < GH) {
        att.score++;
        if (m.shot && m.shot.team === att) att.stats.target++;
        var sp = b.lastP && b.lastP.team === att ? b.lastP : null;
        m.lastGoal = { team: att, p: sp, name: sp ? sp.name : 'Own goal', minute: Math.min(90, Math.floor(m.time / 60) + 1) };
        m.goals.push(m.lastGoal);
        b.owner = null; if (o) { b.vx = side * 6; b.vy = 0; }
        m.state = 'goal'; m.stateT = 3.6; m.kickTeam = def; m.shot = null;
        m.events.push({ type: 'goal', team: att });
      } else if (b.lastTouch === def) {
        setRestart(m, 'corner', att, side * (PL - .5), (yc > 0 ? 1 : -1) * (PW - .5));
      } else setRestart(m, 'goalkick', def, 0, yc > 0 ? 1 : -1);
    } else if (Math.abs(b.y) > PW + .15) {
      var tt = (b.lastTouch || m.teams[0]).opp;
      setRestart(m, 'throw', tt, clamp(b.x, -PL + 1.5, PL - 1.5), (b.y > 0 ? 1 : -1) * PW);
    }
  }

  function contacts(m) {
    var b = m.ball, o = b.owner, ti, i, p, d;
    if (!o) {
      var best = null, bd = 1e9;
      for (ti = 0; ti < 2; ti++) for (i = 0; i < 11; i++) {
        p = m.teams[ti].players[i];
        if (p.cool > 0 || p.stun > 0) continue;
        var box = p.isGK && inBox(p.team, p.x, p.y);
        if (b.z > (box ? 2.55 : 1.3)) continue;
        var reach = box ? 1.2 - Math.max(0, b.z - 1.2) * .35 : (p.slide > 0 ? 1.3 : .9);
        d = hyp(p.x - b.x, p.y - b.y);
        if (d < reach && d < bd) { bd = d; best = p; }
      }
      if (!best) return;
      var sp = hyp(b.vx, b.vy, b.vz), keep = best.isGK && inBox(best.team, best.x, best.y);
      if (keep) {
        var shotOn = m.shot && m.shot.team !== best.team;
        if (shotOn) { m.shot.team.stats.target++; m.events.push({ type: 'save' }); }
        if (sp > 19 && R() < .42 + (sp - 19) * .03 - (best.ovr - 65) * .01) {
          var sg = best.team.dir;
          b.vx = sg * (5 + R() * 5); b.vy = (R() - .5) * 16; b.vz = 3 + R() * 3; b.lastTouch = best.team; b.lastP = best;
          best.cool = .5; m.shot = null; m.passTarget = null;
        } else own(m, best);
      } else if (sp > 21 && m.passTarget !== best) {
        b.vx *= -.3; b.vy = b.vy * .3 + (R() - .5) * 6; b.vz = 2 + R() * 2; b.lastTouch = best.team; b.lastP = best;
        best.cool = .35; m.shot = null; m.events.push({ type: 'kick' });
      } else own(m, best);
      return;
    }
    if (o.isGK || o.protect > 0) return;
    var dt = o.team.opp;
    for (i = 1; i < 11; i++) {
      p = dt.players[i];
      if (p.tackleCd > 0 || p.stun > 0) continue;
      d = hyp(p.x - b.x, p.y - b.y);
      if (d > (p.slide > 0 ? 1.5 : 1)) continue;
      var uc = dt.isUser && p === m.ctrl;
      var base = p.slide > 0 ? .78 : dt.isUser ? (uc ? .5 : .3) : .26 + .3 * m.diff;
      p.tackleCd = .6;
      if (R() < base + (p.ovr - o.ovr) * .012) { o.stun = .45; own(m, p); m.events.push({ type: 'tackle' }); return; }
      if (p.slide <= 0) p.stun = .3;
    }
  }

  function separate(m) {
    var all = m.all || (m.all = m.teams[0].players.concat(m.teams[1].players));
    for (var i = 0; i < 22; i++) for (var j = i + 1; j < 22; j++) {
      var a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
      if (d < .75 && d > .001) { var k = (.75 - d) / d * .5; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
    }
  }

  GE.stepMatch = function (m, dt, inp) {
    inp = inp || NOINP;
    if (m.state === 'fulltime') return;
    if (m.state !== 'play') {
      m.stateT -= dt;
      if (m.stateT <= 0) {
        if (m.state === 'goal') kickoff(m, m.kickTeam);
        else if (m.state === 'halftime') { m.teams[0].dir *= -1; m.teams[1].dir *= -1; m.half = 2; kickoff(m, m.firstKick.opp); }
        else m.state = 'play';
      }
    } else {
      m.time += dt * 2700 / m.halfLen;
      if (m.poss) m.poss.stats.poss += dt;
      if (m.half === 1 && m.time >= 2700) { m.time = 2700; m.state = 'halftime'; m.stateT = 3.5; m.events.push({ type: 'half' }); }
      else if (m.time >= 5400) { m.time = 5400; m.state = 'fulltime'; m.events.push({ type: 'final' }); return; }
    }
    plan(m, dt);
    for (var ti = 0; ti < 2; ti++) for (var i = 0; i < 11; i++) stepPlayer(m, m.teams[ti].players[i], dt, inp);
    separate(m);
    stepBall(m, dt);
    if (m.state === 'play') contacts(m);
    m.prev.a = inp.a; m.prev.b = inp.b; m.prev.c = inp.c;
  };
  GE.PITCH = { PL: PL, PW: PW, GW: GW, GH: GH };
})();
