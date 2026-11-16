/* Glory Eleven — broadcast-camera renderer (perspective projection onto a 2D canvas). */
(function () {
  'use strict';
  var GE = window.GE = window.GE || {};
  var PL = 52.5, PW = 34, GW = 3.66, GH = 2.44;
  var cv, ctx, W = 0, H = 0, DPR = 1, F = 1000, clock = 0;
  var CAMD = 50, CAMH = 22, TILT = Math.atan(CAMH / CAMD);
  var cam = { x: 0, y: CAMD, z: CAMH, ly: 0, sin: Math.sin(TILT), cos: Math.cos(TILT), shake: 0 };
  var ROWS = 18, RH = 20, TEXW = 2048, WX = 75, PPM = TEXW / (2 * WX);
  var crowdTex, adTex, vig, endCols = [], flashes = [];
  var radar, rctx;

  function P(x, y, z) {
    var dx = x - cam.x, dy = cam.y - y, dz = cam.z - z, dp = dy * cam.cos + dz * cam.sin;
    if (dp < 1.2) dp = 1.2;
    var s = F / dp;
    return { x: W / 2 + dx * s, y: H * .5 - (dy * cam.sin - dz * cam.cos) * s, s: s };
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    F = 1.05 * Math.max(W, H * 1.35);
    vig = document.createElement('canvas'); vig.width = 256; vig.height = 144;
    var g = vig.getContext('2d'), gr = g.createRadialGradient(128, 70, 30, 128, 72, 170);
    gr.addColorStop(0, 'rgba(4,8,20,0)'); gr.addColorStop(.6, 'rgba(4,8,20,.08)'); gr.addColorStop(1, 'rgba(4,8,20,.62)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 144);
    var lg = g.createLinearGradient(0, 0, 0, 144);
    lg.addColorStop(0, 'rgba(190,220,255,.10)'); lg.addColorStop(.45, 'rgba(190,220,255,0)');
    g.fillStyle = lg; g.fillRect(0, 0, 256, 144);
  }

  GE.render = {
    init: function (canvas, radarCanvas) {
      cv = canvas; ctx = cv.getContext('2d'); radar = radarCanvas; rctx = radar.getContext('2d');
      resize(); window.addEventListener('resize', resize);
      buildAds();
    },
    setMatch: function (m) { buildCrowd(m); cam.x = 0; cam.ly = 0; flashes.length = 0; },
    draw: draw
  };

  /* ---------- textures ---------- */
  function buildCrowd(m) {
    var rng = GE.mulberry(GE.hash(m.teams[0].name + m.teams[1].name));
    crowdTex = document.createElement('canvas'); crowdTex.width = TEXW; crowdTex.height = ROWS * RH;
    var g = crowdTex.getContext('2d');
    var hc = m.teams[0].kit.shirt, ac = m.teams[1].kit.shirt;
    var mute = ['#3b4a6b', '#56607a', '#7a4a4a', '#4a6a5a', '#8a8f9c', '#2d3550', '#6b5a7a', '#a8a39a'];
    var skins = ['#e9c4a0', '#c99468', '#8a5a36', '#5d3b22'];
    for (var r = 0; r < ROWS; r++) {
      var y0 = r * RH;
      g.fillStyle = r % 2 ? '#141c33' : '#111830'; g.fillRect(0, y0, TEXW, RH);
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, y0 + RH - 2, TEXW, 2);
      for (var x = 3 + rng() * 5; x < TEXW; x += 8 + rng() * 3) {
        if (rng() < .07) continue;
        var away = x > TEXW * .82, k = rng();
        var c = k < .55 ? (away ? ac : hc) : k < .62 ? '#f1f3f8' : mute[Math.floor(rng() * mute.length)];
        var up = rng() < .12 ? 3 : 0;
        g.fillStyle = c; g.fillRect(x - 3, y0 + 9 - up, 7, 11 + up);
        g.fillStyle = skins[Math.floor(rng() * 4)]; g.beginPath(); g.arc(x + .5, y0 + 6 - up, 3, 0, 7); g.fill();
      }
    }
    var sh = g.createLinearGradient(0, 0, 0, ROWS * RH);
    sh.addColorStop(0, 'rgba(5,8,18,.55)'); sh.addColorStop(1, 'rgba(5,8,18,.05)');
    g.fillStyle = sh; g.fillRect(0, 0, TEXW, ROWS * RH);
    endCols = [];
    for (var i = 0; i < 900; i++) { var q = rng(); endCols.push(q < .5 ? hc : q < .6 ? '#f1f3f8' : mute[Math.floor(rng() * mute.length)]); }
  }
  function buildAds() {
    adTex = document.createElement('canvas'); adTex.width = TEXW; adTex.height = 40;
    var g = adTex.getContext('2d');
    var ads = [['GLORY ELEVEN', '#0d1326', '#c8ff3e'], ['VOLTA ENERGY', '#c8ff3e', '#10131c'], ['SKYLINE AIR', '#12306b', '#ffffff'],
    ['KASI COLA', '#b3161f', '#ffffff'], ['NOVA BANK', '#f4f6fa', '#0d1326'], ['ZULA MOBILE', '#3a0d6b', '#3ee0ff']];
    var pw = 12 * PPM, n = Math.ceil(TEXW / pw);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 23px Bahnschrift, "Arial Narrow", Arial, sans-serif';
    for (var i = 0; i < n; i++) {
      var a = ads[i % ads.length];
      g.fillStyle = a[1]; g.fillRect(i * pw, 0, pw + 1, 40);
      g.fillStyle = a[2]; g.fillText(a[0], i * pw + pw / 2, 21, pw - 16);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(i * pw, 0, 2, 40);
    }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, TEXW, 3);
  }

  /* ---------- helpers ---------- */
  function quad(a, b, c, d, fill) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  }
  function seg(x1, y1, z1, x2, y2, z2) { var a = P(x1, y1, z1), b = P(x2, y2, z2); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  function arc(cx, cy, r, a0, a1) {
    var n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * 8));
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * i / n, p = P(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0);
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
  }
  function strip(tex, sy, sh, y0, z0, y1, z1) {
    var a = P(cam.x, y0, z0), b = P(cam.x, y1, z1), s = a.s;
    var xl = cam.x - (W / 2) / s, xr = cam.x + (W / 2) / s;
    var sx = (xl + WX) * PPM, sw = (xr - xl) * PPM, dx = 0, dw = W;
    if (sx < 0) { dx = -sx / PPM * s; dw -= dx; sw += sx; sx = 0; }
    if (sx + sw > TEXW) { var ex = sx + sw - TEXW; dw -= ex / PPM * s; sw -= ex; }
    var top = Math.min(a.y, b.y), h = Math.abs(a.y - b.y) + 1;
    if (sw <= 0 || dw <= 0 || top > H || top + h < 0) return;
    ctx.drawImage(tex, sx, sy, sw, sh, dx, top, dw, h);
  }

  /* ---------- scene ---------- */
  function drawStands() {
    var i, yb = -PW - 6;
    // far stand: wall, then rows
    var w0 = P(cam.x, yb, 0), w1 = P(cam.x, yb, 1.3);
    ctx.fillStyle = '#0c1226'; ctx.fillRect(0, w1.y - 1, W, w0.y - w1.y + 2);
    if (crowdTex) for (i = 0; i < ROWS; i++) strip(crowdTex, (ROWS - 1 - i) * RH, RH, yb - i, 1.3 + i * .75, yb - i - 1, 1.3 + (i + 1) * .75);
    var top = P(cam.x, yb - ROWS, 1.3 + ROWS * .75);
    if (top.y > 0) {
      var g = ctx.createLinearGradient(0, top.y - 60, 0, top.y);
      g.addColorStop(0, '#05080f'); g.addColorStop(1, '#0d1428');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, top.y + 1);
      ctx.fillStyle = 'rgba(200,225,255,.5)'; ctx.fillRect(0, top.y - 3, W, 2);
    }
    strip(adTex, 0, 40, -PW - 3.5, 0, -PW - 3.5, 1.1);
    // end stands
    for (var sd = -1; sd <= 1; sd += 2) {
      var edge = P(sd * (PL + 9), 0, 0);
      if ((sd < 0 && edge.x < -40) || (sd > 0 && edge.x > W + 40)) continue;
      var y0 = -PW - 6, y1 = PW + 8;
      for (i = 13; i >= 0; i--) {
        var xa = sd * (PL + 9 + i), xb = sd * (PL + 10 + i), za = 1.3 + i * .75, zb = za + .75;
        quad(P(xa, y0, za), P(xa, y1, za), P(xb, y1, zb), P(xb, y0, zb), i % 2 ? '#131b32' : '#10172c');
        for (var j = 0; j < 56; j++) {
          var p = P(xa + sd * .5, y0 + 1 + j * 1.4, za + .6);
          if (p.x < -10 || p.x > W + 10 || p.y > H + 10) continue;
          var z = Math.max(2, p.s * .55);
          ctx.fillStyle = endCols[(i * 56 + j) % endCols.length];
          ctx.fillRect(p.x - z / 2, p.y - z / 2, z, z * 1.2);
        }
      }
      quad(P(sd * (PL + 9), y0, 0), P(sd * (PL + 9), y1, 0), P(sd * (PL + 9), y1, 1.3), P(sd * (PL + 9), y0, 1.3), '#0c1226');
      var bx = sd * (PL + 4.5), cols = ['#c8ff3e', '#12306b', '#b3161f', '#f4f6fa', '#3a0d6b'];
      for (j = 0; j < 6; j++) quad(P(bx, -30 + j * 10, 0), P(bx, -20 + j * 10, 0), P(bx, -20 + j * 10, 1.1), P(bx, -30 + j * 10, 1.1), cols[j % 5]);
    }
  }

  function drawPitch() {
    quad(P(-PL - 9, -PW - 6, 0), P(PL + 9, -PW - 6, 0), P(PL + 9, PW + 8, 0), P(-PL - 9, PW + 8, 0), '#16562b');
    var n = 14, w = 2 * PL / n;
    for (var i = 0; i < n; i++) {
      var x0 = -PL + i * w, x1 = x0 + w;
      quad(P(x0, -PW, 0), P(x1, -PW, 0), P(x1, PW, 0), P(x0, PW, 0), i % 2 ? '#2c9442' : '#37a54c');
    }
    // soft light pooling in the centre of the pitch
    var c = P(cam.x, cam.ly, 0), rg = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, W * .65);
    rg.addColorStop(0, 'rgba(220,255,200,.13)'); rg.addColorStop(1, 'rgba(220,255,200,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,.86)'; ctx.lineWidth = Math.max(1.5, Math.min(3.2, W / 520)); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    seg(-PL, -PW, 0, PL, -PW, 0); seg(PL, -PW, 0, PL, PW, 0); seg(PL, PW, 0, -PL, PW, 0); seg(-PL, PW, 0, -PL, -PW, 0);
    seg(0, -PW, 0, 0, PW, 0);
    arc(0, 0, 9.15, 0, Math.PI * 2);
    for (var s = -1; s <= 1; s += 2) {
      var gx = s * PL;
      seg(gx, -20.16, 0, gx - s * 16.5, -20.16, 0); seg(gx - s * 16.5, -20.16, 0, gx - s * 16.5, 20.16, 0); seg(gx - s * 16.5, 20.16, 0, gx, 20.16, 0);
      seg(gx, -9.16, 0, gx - s * 5.5, -9.16, 0); seg(gx - s * 5.5, -9.16, 0, gx - s * 5.5, 9.16, 0); seg(gx - s * 5.5, 9.16, 0, gx, 9.16, 0);
      var a = Math.acos(5.5 / 9.15), mid = s > 0 ? Math.PI : 0;
      arc(gx - s * 11, 0, 9.15, mid - a, mid + a);
      arc(gx, -PW, 1, s > 0 ? Math.PI / 2 : 0, s > 0 ? Math.PI : Math.PI / 2);
      arc(gx, PW, 1, s > 0 ? Math.PI : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : 0);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    [[0, 0], [PL - 11, 0], [-PL + 11, 0]].forEach(function (q) { var p = P(q[0], q[1], 0); ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * .22, p.s * .1, 0, 0, 7); ctx.fill(); });
  }

  function drawGoal(s, near) {
    var gx = s * PL, bx = s * (PL + 1.9), i;
    ctx.lineCap = 'round';
    if (!near) {
      ctx.strokeStyle = 'rgba(235,240,255,.28)'; ctx.lineWidth = 1; ctx.beginPath();
      for (i = 0; i <= 8; i++) { var y = -GW + i * GW / 4; seg(bx, y, 0, bx, y, GH * .85); seg(bx, y, GH * .85, gx, y, GH); }
      for (i = 0; i <= 4; i++) { var z = i * GH * .85 / 4; seg(bx, -GW, z, bx, GW, z); seg(gx, -GW, z * 1.17, bx, -GW, z); }
      seg(gx + s * .95, -GW, GH * .93, gx + s * .95, GW, GH * .93);
      ctx.stroke();
      post(gx, -GW, 0, gx, -GW, GH); post(gx, -GW, GH, gx, GW, GH);
    } else {
      ctx.strokeStyle = 'rgba(235,240,255,.28)'; ctx.lineWidth = 1; ctx.beginPath();
      for (i = 0; i <= 4; i++) { var z2 = i * GH * .85 / 4; seg(gx, GW, z2 * 1.17, bx, GW, z2); }
      for (i = 0; i <= 3; i++) { var x = gx + s * 1.9 * i / 3; seg(x, GW, 0, x, GW, GH - (GH * .15) * i / 3); }
      ctx.stroke();
      post(gx, GW, 0, gx, GW, GH);
    }
  }
  function post(x1, y1, z1, x2, y2, z2) {
    var a = P(x1, y1, z1), b = P(x2, y2, z2);
    ctx.strokeStyle = '#f6f8ff'; ctx.lineWidth = Math.max(2, a.s * .13);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  function drawPlayer(m, p) {
    var q = P(p.x, p.y, 0), s = q.s;
    if (q.x < -80 || q.x > W + 80 || q.y > H + 120) return;
    var t = p.team, k = t.kit, shirt = p.isGK ? t.gkCol : k.shirt, trim = p.isGK ? '#10131c' : k.trim;
    var shorts = p.isGK ? '#10131c' : k.shorts, socks = p.isGK ? t.gkCol : k.socks;
    var ctrl = m.ctrl === p && m.user;

    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(q.x + .42 * s, q.y - .03 * s, .52 * s, .15 * s, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(q.x - .42 * s, q.y - .03 * s, .52 * s, .15 * s, 0, 0, 7); ctx.fill();
    if (ctrl) {
      ctx.strokeStyle = '#c8ff3e'; ctx.lineWidth = Math.max(2, s * .07);
      ctx.beginPath(); ctx.ellipse(q.x, q.y, .72 * s, .27 * s, 0, 0, 7); ctx.stroke();
    }
    var sp = p.spd, run = Math.min(1, sp / 5);
    var mvx = sp > .3 ? p.vx / sp : p.fx, mvy = sp > .3 ? p.vy / sp : p.fy;
    var sdx = mvx, sdy = mvy * .42, sw = Math.sin(p.phase) * .34 * run * s, cs = Math.cos(p.phase);
    var bob = Math.abs(cs) * .05 * run * s;

    ctx.save(); ctx.translate(q.x, q.y);
    if (p.slide > 0) ctx.rotate(-(p.fx >= 0 ? 1 : -1) * 1.15);
    else if (p.diveT > 0) ctx.rotate(p.dive * (p.team.dir > 0 ? -1 : 1) * Math.min(1, p.diveT / .2) * .95);
    else ctx.rotate(mvx * run * .1);
    ctx.lineCap = 'round';
    var hipY = -.84 * s - bob;
    var f1x = sdx * sw, f1y = sdy * sw - Math.max(0, cs) * .14 * run * s;
    var f2x = -sdx * sw, f2y = -sdy * sw - Math.max(0, -cs) * .14 * run * s;
    leg(-.09 * s, hipY, f1x - .07 * s, f1y, s, p.skin, socks);
    leg(.09 * s, hipY, f2x + .07 * s, f2y, s, p.skin, socks);
    // arms
    var ay = -1.4 * s - bob, hy = -1.0 * s - bob, asw = sw * .55;
    ctx.lineWidth = .11 * s;
    ctx.strokeStyle = p.skin; ctx.beginPath();
    ctx.moveTo(-.25 * s, ay); ctx.lineTo(-.3 * s - sdx * asw, hy - Math.abs(asw) * .3);
    ctx.moveTo(.25 * s, ay); ctx.lineTo(.3 * s + sdx * asw, hy - Math.abs(asw) * .3); ctx.stroke();
    ctx.strokeStyle = shirt; ctx.beginPath();
    ctx.moveTo(-.25 * s, ay); ctx.lineTo(-.275 * s - sdx * asw * .5, ay + .2 * s);
    ctx.moveTo(.25 * s, ay); ctx.lineTo(.275 * s + sdx * asw * .5, ay + .2 * s); ctx.stroke();
    // shorts + shirt
    ctx.fillStyle = shorts; rr(-.21 * s, -1.02 * s - bob, .42 * s, .3 * s, .06 * s);
    ctx.fillStyle = shirt; rr(-.23 * s, -1.52 * s - bob, .46 * s, .56 * s, .09 * s);
    ctx.fillStyle = trim;
    var st = p.isGK ? 'plain' : k.style, ty = -1.52 * s - bob;
    if (st === 'stripe') { ctx.fillRect(-.055 * s, ty + .03 * s, .11 * s, .52 * s); }
    else if (st === 'hoops') { ctx.fillRect(-.23 * s, ty + .16 * s, .46 * s, .09 * s); ctx.fillRect(-.23 * s, ty + .36 * s, .46 * s, .09 * s); }
    else if (st === 'sash') { ctx.beginPath(); ctx.moveTo(-.23 * s, ty + .05 * s); ctx.lineTo(-.12 * s, ty); ctx.lineTo(.23 * s, ty + .46 * s); ctx.lineTo(.23 * s, ty + .56 * s); ctx.lineTo(.12 * s, ty + .56 * s); ctx.lineTo(-.23 * s, ty + .16 * s); ctx.fill(); }
    else { ctx.fillRect(-.1 * s, ty, .2 * s, .05 * s); }
    var hg = ctx.createLinearGradient(-.23 * s, 0, .23 * s, 0);
    hg.addColorStop(0, 'rgba(255,255,255,.16)'); hg.addColorStop(.5, 'rgba(255,255,255,0)'); hg.addColorStop(1, 'rgba(0,0,0,.2)');
    ctx.fillStyle = hg; rr(-.23 * s, ty, .46 * s, .56 * s, .09 * s);
    // head
    var hy2 = -1.68 * s - bob;
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(0, hy2, .14 * s, 0, 7); ctx.fill();
    ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(0, hy2 - .015 * s, .145 * s, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.restore();

    if (ctrl) {
      var ty2 = q.y - 2.08 * s;
      ctx.fillStyle = '#c8ff3e'; ctx.beginPath(); ctx.moveTo(q.x - .2 * s, ty2 - .26 * s); ctx.lineTo(q.x + .2 * s, ty2 - .26 * s); ctx.lineTo(q.x, ty2); ctx.fill();
      ctx.font = '700 ' + Math.max(10, Math.min(14, s * .5)) + 'px Bahnschrift, Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(5,8,18,.6)'; ctx.fillText(p.name, q.x + 1, ty2 - .4 * s + 1);
      ctx.fillStyle = '#fff'; ctx.fillText(p.name, q.x, ty2 - .4 * s);
      if (p.charging) {
        var bw = 1.5 * s, by = ty2 - .95 * s;
        ctx.fillStyle = 'rgba(5,8,18,.7)'; rr(q.x - bw / 2 - 2, by - 2, bw + 4, .22 * s + 4, 4);
        ctx.fillStyle = p.charge > .8 ? '#ff5468' : p.charge > .5 ? '#ffc83d' : '#c8ff3e';
        ctx.fillRect(q.x - bw / 2, by, bw * p.charge, .22 * s);
      }
    }
  }
  function leg(hx, hy, fx, fy, s, skin, sock) {
    var mx = hx + (fx - hx) * .55, my = hy + (fy - hy) * .55;
    ctx.lineWidth = .15 * s; ctx.strokeStyle = skin; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mx, my); ctx.stroke();
    ctx.strokeStyle = sock; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(fx, fy - .05 * s); ctx.stroke();
    ctx.fillStyle = '#0c0e14'; ctx.beginPath(); ctx.ellipse(fx, fy - .03 * s, .11 * s, .06 * s, 0, 0, 7); ctx.fill();
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }

  function drawBall(m) {
    var b = m.ball, g = P(b.x, b.y, 0), q = P(b.x, b.y, b.z), r = Math.max(2.4, .17 * q.s), k = 1 / (1 + b.z * .25);
    ctx.fillStyle = 'rgba(0,0,0,' + (.38 * k) + ')';
    ctx.beginPath(); ctx.ellipse(g.x + r * .3, g.y + r * .2, r * 1.15 * (.6 + .4 * k), r * .5 * (.6 + .4 * k), 0, 0, 7); ctx.fill();
    var gr = ctx.createRadialGradient(q.x - r * .35, q.y - r * .4, r * .1, q.x, q.y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.7, '#e4e9f2'); gr.addColorStop(1, '#9aa4b8');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.fill();
    if (r > 3) {
      ctx.fillStyle = '#1c2030';
      for (var i = 0; i < 3; i++) { var a = b.roll * 2.6 + i * 2.094; ctx.beginPath(); ctx.arc(q.x + Math.cos(a) * r * .5, q.y + Math.sin(a) * r * .5, r * .2, 0, 7); ctx.fill(); }
    }
  }

  function drawFlags() {
    [[-PL, -PW], [PL, -PW], [-PL, PW], [PL, PW]].forEach(function (c) {
      var a = P(c[0], c[1], 0), b = P(c[0], c[1], 1.5);
      ctx.strokeStyle = '#e8ecf5'; ctx.lineWidth = Math.max(1, a.s * .05); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#ffc83d'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + a.s * .45, b.y + a.s * .14); ctx.lineTo(b.x, b.y + a.s * .3); ctx.fill();
    });
  }

  var list = [];
  function draw(m, dt) {
    clock += dt;
    var b = m.ball, k = 1 - Math.exp(-dt * 4);
    cam.x += (Math.max(-40, Math.min(40, b.x)) - cam.x) * k;
    cam.ly += (b.y * .5 - cam.ly) * k;
    cam.y = cam.ly + CAMD;
    if (m.state === 'goal' && m.stateT > 3.2) cam.shake = 1;
    cam.shake = Math.max(0, cam.shake - dt * 1.6);

    ctx.setTransform(DPR, 0, 0, DPR, (Math.random() - .5) * cam.shake * 8 * DPR, (Math.random() - .5) * cam.shake * 8 * DPR);
    ctx.fillStyle = '#080c18'; ctx.fillRect(-10, -10, W + 20, H + 20);
    drawPitch();
    drawStands();
    drawFlags();

    list.length = 0;
    for (var ti = 0; ti < 2; ti++) for (var i = 0; i < 11; i++) { var p = m.teams[ti].players[i]; list.push({ y: p.y, p: p }); }
    list.push({ y: b.y + .01, ball: true });
    list.push({ y: -GW - .5, goal: -1, near: false }, { y: -GW - .5, goal: 1, near: false });
    list.push({ y: GW, goal: -1, near: true }, { y: GW, goal: 1, near: true });
    list.sort(function (a, c) { return a.y - c.y; });
    for (i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.p) drawPlayer(m, e.p); else if (e.ball) drawBall(m); else drawGoal(e.goal, e.near);
    }

    // camera flashes in the crowd after a goal
    if (m.state === 'goal' && Math.random() < .6) flashes.push({ x: cam.x + (Math.random() - .5) * 90, r: Math.floor(Math.random() * 9), t: .18 });
    for (i = flashes.length - 1; i >= 0; i--) {
      var fl = flashes[i]; fl.t -= dt; if (fl.t <= 0) { flashes.splice(i, 1); continue; }
      var fp = P(fl.x, -PW - 6 - fl.r, 1.8 + fl.r * .75), rad = 3 + fl.t * 40;
      var fg = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, rad);
      fg.addColorStop(0, 'rgba(255,255,255,.95)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = fg; ctx.fillRect(fp.x - rad, fp.y - rad, rad * 2, rad * 2);
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(vig, 0, 0, W, H);
    drawRadar(m);
  }

  function drawRadar(m) {
    if (!radar || radar.offsetParent === null) return;
    var w = radar.width, h = radar.height, g = rctx, pad = 10, sx = (w - pad * 2) / (2 * PL), sy = (h - pad * 2) / (2 * PW);
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(10,40,22,.72)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2;
    g.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    g.beginPath(); g.moveTo(w / 2, pad); g.lineTo(w / 2, h - pad); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 9.15 * sx, 0, 7); g.stroke();
    for (var ti = 0; ti < 2; ti++) {
      var t = m.teams[ti];
      for (var i = 0; i < 11; i++) {
        var p = t.players[i], x = w / 2 + p.x * sx, y = h / 2 + p.y * sy;
        g.fillStyle = p.isGK ? t.gkCol : t.kit.shirt; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
        g.lineWidth = 1.5; g.strokeStyle = m.ctrl === p && m.user ? '#c8ff3e' : 'rgba(0,0,0,.55)';
        if (m.ctrl === p && m.user) g.lineWidth = 3;
        g.stroke();
      }
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 + m.ball.x * sx, h / 2 + m.ball.y * sy, 4.5, 0, 7); g.fill();
  }
})();
