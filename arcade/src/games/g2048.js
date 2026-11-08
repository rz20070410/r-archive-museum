/* 游戏：2048 —— 合并数字，冲击 2048 */
(function () {
  'use strict';

  var N = 4;
  var MX = 36;
  var MY = 86;
  var SIDE = 528;
  var PAD = 12;
  var GAP = 12;
  var CELL = (SIDE - PAD * 2 - GAP * (N - 1)) / N; /* 117 */

  var MOVE_DUR = 0.13;
  var SPAWN_DUR = 0.18;
  var POP_DUR = 0.2;
  var WIN_BANNER = 2.8;
  var MAX_PARTICLES = 220;

  /* 每个数字层级：底色 / 高光层 / 字色 / 发光色 */
  var TILE_STYLE = {
    2: ['#232f52', '#2f3f6b', '#dbeafe', '#6366f1'],
    4: ['#1f3a5f', '#2b4d7d', '#bfdbfe', '#60a5fa'],
    8: ['#0c4a6e', '#0e6b9e', '#a5f3fc', '#22d3ee'],
    16: ['#0f5132', '#157a4a', '#a7f3d0', '#34d399'],
    32: ['#3f6212', '#4d7c0f', '#d9f99d', '#a3e635'],
    64: ['#713f12', '#94620f', '#fde68a', '#fbbf24'],
    128: ['#7c2d12', '#a83a12', '#fed7aa', '#fb923c'],
    256: ['#7f1d1d', '#a82626', '#fecaca', '#f87171'],
    512: ['#831843', '#a71d5a', '#fbcfe8', '#f472b6'],
    1024: ['#4c1d95', '#6d28d9', '#ddd6fe', '#a78bfa'],
    2048: ['#5b21b6', '#7c3aed', '#fef08a', '#fbbf24'],
    4096: ['#0e7490', '#22d3ee', '#ecfeff', '#67e8f9'],
    8192: ['#831843', '#db2777', '#fdf2f8', '#f472b6']
  };

  var FONT_S = '900 46px "Consolas", monospace';
  var FONT_M = '900 40px "Consolas", monospace';
  var FONT_L = '900 32px "Consolas", monospace';
  var FONT_XL = '900 26px "Consolas", monospace';

  function fontFor(v) {
    var n = ('' + v).length;
    if (n <= 2) return FONT_S;
    if (n === 3) return FONT_M;
    if (n === 4) return FONT_L;
    return FONT_XL;
  }

  function styleFor(v) {
    return TILE_STYLE[v] || TILE_STYLE[8192];
  }

  var KEY_DIR = {
    ArrowUp: 0, KeyW: 0,
    ArrowDown: 1, KeyS: 1,
    ArrowLeft: 2, KeyA: 2,
    ArrowRight: 3, KeyD: 3
  };

  /* 每个方向的四条线，按“先到达目标边”的顺序列出格子 */
  var LINES = (function () {
    var dirs = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 }
    ];
    var out = [];
    for (var d = 0; d < dirs.length; d++) {
      var dir = dirs[d];
      var lines = [];
      for (var k = 0; k < N; k++) {
        var cells = [];
        for (var s = 0; s < N; s++) {
          var r;
          var c;
          if (dir.dc === 0) {
            c = k;
            r = dir.dr === -1 ? s : (N - 1 - s);
          } else {
            r = k;
            c = dir.dc === -1 ? s : (N - 1 - s);
          }
          cells.push([r, c]);
        }
        lines.push(cells);
      }
      out.push({ dr: dir.dr, dc: dir.dc, lines: lines });
    }
    return out;
  })();

  function cellX(c) {
    return MX + PAD + c * (CELL + GAP);
  }

  function cellY(r) {
    return MY + PAD + r * (CELL + GAP);
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function easeOutCubic(t) {
    var u = 1 - t;
    return 1 - u * u * u;
  }

  function easeOutBack(t) {
    var c = 1.70158;
    var u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  }

  Arcade.register({
    id: 'g2048',
    title: '2048',
    subtitle: '合并数字，冲击 2048',
    description: '在 4×4 棋盘上滑动数字方块，相同的数字相遇就合成更大的数。步步为营，冲出你的 2048 方块！',
    icon: '🔢',
    accent: '#fbbf24',
    accent2: '#f97316',
    tags: ['益智'],
    difficulty: '简单',
    width: 600,
    height: 640,
    order: 30,
    tips: '把最大的方块固定在角落，按蛇形顺序排列更容易合成。走错一步可以按 Z 撤销。',
    controls: [
      { keys: '↑ ↓ ← → / WASD', action: '滑动合并' },
      { keys: '鼠标 / 触摸拖拽', action: '滑动合并' },
      { keys: 'Z', action: '撤销一步' }
    ],

    create: function (rt) {
      var ctx = null;

      var grid;
      var tiles;
      var score;
      var steps;
      var mergeCount;
      var maxTile;

      var animating;
      var animT;
      var animMovers;
      var animDead;
      var animMerges;
      var animEvents;

      var undoSnap;
      var wonShown;
      var winT;
      var over;
      var overT;
      var endCalled;
      var queue;

      var particles;
      var popups;
      var shake;
      var elapsed;

      var drag;
      var dragCd;

      var hudDirty;
      var statusDirty;

      var bgGrad;
      var auraGrad;

      /* ---------- 方块与棋盘 ---------- */

      function makeTile(r, c, v) {
        return {
          v: v,
          r: r,
          c: c,
          x: cellX(c),
          y: cellY(r),
          fx: 0,
          fy: 0,
          tx: 0,
          ty: 0,
          t: 1,
          spawn: 0,
          pop: 0,
          pendingV: 0,
          dead: false,
          dstR: r,
          dstC: c
        };
      }

      function spawnRandom(withAnim) {
        var empties = [];
        var i;
        for (i = 0; i < 16; i++) {
          if (!grid[i]) empties.push(i);
        }
        if (!empties.length) return null;
        var pick = empties[rt.randInt(0, empties.length - 1)];
        var v = rt.rand(0, 1) < 0.9 ? 2 : 4;
        var tile = makeTile(Math.floor(pick / 4), pick % 4, v);
        if (withAnim) tile.spawn = SPAWN_DUR;
        grid[pick] = tile;
        tiles.push(tile);
        if (v > maxTile) maxTile = v;
        return tile;
      }

      function snapshotValues() {
        var arr = [];
        for (var i = 0; i < 16; i++) arr.push(grid[i] ? grid[i].v : 0);
        return arr;
      }

      function hasMoves() {
        var i;
        for (i = 0; i < 16; i++) {
          if (!grid[i]) return true;
        }
        for (var r = 0; r < N; r++) {
          for (var c = 0; c < N; c++) {
            var v = grid[r * 4 + c].v;
            if (c < N - 1 && grid[r * 4 + c + 1].v === v) return true;
            if (r < N - 1 && grid[(r + 1) * 4 + c].v === v) return true;
          }
        }
        return false;
      }

      /* ---------- 粒子 / 飘字 ---------- */

      function addBurst(px, py, color, count, power) {
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(30, 140) * (power || 1);
          particles.push({
            x: px,
            y: py,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 24,
            life: rt.rand(0.26, 0.62),
            max: 0.62,
            r: rt.rand(1.5, 3.6),
            color: color
          });
        }
        if (particles.length > MAX_PARTICLES) {
          particles.splice(0, particles.length - MAX_PARTICLES);
        }
      }

      function addPopup(px, py, text, color) {
        popups.push({
          x: px,
          y: py,
          text: text,
          color: color,
          life: 0.9,
          max: 0.9
        });
      }

      /* ---------- 核心：滑动与合并 ---------- */

      function doMove(dirIndex) {
        if (over || endCalled || animating) return;
        var spec = LINES[dirIndex];
        var newGrid = new Array(16);
        var i;
        for (i = 0; i < 16; i++) newGrid[i] = null;

        var movers = [];
        var dead = [];
        var mergers = [];
        var events = [];
        var moved = false;
        var gained = 0;

        for (var li = 0; li < N; li++) {
          var cells = spec.lines[li];
          var slot = 0;
          var prev = null;
          var prevSlot = -1;
          for (var s = 0; s < N; s++) {
            var r = cells[s][0];
            var c = cells[s][1];
            var tile = grid[r * 4 + c];
            if (!tile) continue;

            if (prev && !prev.merged && prev.tile.v === tile.v) {
              /* 合并：tile 滑向 prevSlot 后消失，prev.tile 数值翻倍 */
              prev.merged = true;
              var dst = cells[prevSlot];
              var val = tile.v * 2;
              tile.dead = true;
              tile.dstR = dst[0];
              tile.dstC = dst[1];
              movers.push(tile);
              dead.push(tile);
              prev.tile.pendingV = val;
              mergers.push(prev.tile);
              gained += val;
              events.push({ r: dst[0], c: dst[1], v: val });
              moved = true;
              continue;
            }

            var dest = cells[slot];
            prev = { tile: tile, merged: false };
            prevSlot = slot;
            newGrid[dest[0] * 4 + dest[1]] = tile;
            if (dest[0] !== r || dest[1] !== c) {
              tile.dstR = dest[0];
              tile.dstC = dest[1];
              movers.push(tile);
              moved = true;
            }
            slot++;
          }
        }

        if (!moved) {
          rt.audio.play('error', 0.18);
          return;
        }

        undoSnap = { values: snapshotValues(), score: score, steps: steps };

        grid = newGrid;
        score += gained;
        steps += 1;
        mergeCount += events.length;

        for (var m = 0; m < movers.length; m++) {
          var mv = movers[m];
          mv.fx = mv.x;
          mv.fy = mv.y;
          mv.tx = cellX(mv.dstC);
          mv.ty = cellY(mv.dstR);
          mv.r = mv.dstR;
          mv.c = mv.dstC;
          mv.t = 0;
        }

        animMovers = movers;
        animDead = dead;
        animMerges = mergers;
        animEvents = events;
        animating = true;
        animT = 0;

        rt.setScore(score);
        updateHud();

        if (events.length) {
          rt.audio.play('merge', 0.85);
          shake = Math.min(6, 2 + events.length * 1.2);
        } else {
          rt.audio.play('blip', 0.3);
        }

        if (queue.length > 2) queue.splice(0, queue.length - 2);
      }

      function finishMove() {
        animating = false;
        animT = 0;

        var i;
        for (i = 0; i < animMovers.length; i++) {
          var mv = animMovers[i];
          mv.x = mv.tx;
          mv.y = mv.ty;
          mv.t = 1;
        }

        for (i = 0; i < animDead.length; i++) {
          var dtile = animDead[i];
          var idx = tiles.indexOf(dtile);
          if (idx >= 0) tiles.splice(idx, 1);
        }

        for (i = 0; i < animMerges.length; i++) {
          var mg = animMerges[i];
          mg.v = mg.pendingV;
          mg.pendingV = 0;
          mg.pop = POP_DUR;
          if (mg.v > maxTile) maxTile = mg.v;
        }

        for (i = 0; i < animEvents.length; i++) {
          var ev = animEvents[i];
          var px = cellX(ev.c) + CELL / 2;
          var py = cellY(ev.r) + CELL / 2;
          var st = styleFor(ev.v);
          addBurst(px, py, st[3], ev.v >= 128 ? 16 : 11, ev.v >= 128 ? 1.3 : 1);
          addPopup(px, py - CELL * 0.52, '+' + ev.v, st[2]);
        }

        spawnRandom(true);

        animMovers = [];
        animDead = [];
        animMerges = [];
        animEvents = [];
        updateHud();

        if (!wonShown && maxTile >= 2048) {
          wonShown = true;
          winT = WIN_BANNER;
          rt.audio.play('win', 0.9);
          rt.setStatus('已达成 2048 · 继续挑战更高数字');
        }

        if (!hasMoves()) {
          over = true;
          overT = 0;
          shake = 8;
          rt.audio.play('lose', 0.7);
          rt.setStatus('');
        }
      }

      function undo() {
        if (!undoSnap || animating || over || endCalled) return;
        var values = undoSnap.values;
        score = undoSnap.score;
        steps = undoSnap.steps;
        undoSnap = null;

        grid = new Array(16);
        tiles = [];
        maxTile = 0;
        for (var i = 0; i < 16; i++) {
          grid[i] = null;
          var v = values[i];
          if (!v) continue;
          var tile = makeTile(Math.floor(i / 4), i % 4, v);
          grid[i] = tile;
          tiles.push(tile);
          if (v > maxTile) maxTile = v;
        }

        animating = false;
        animMovers = [];
        animDead = [];
        animMerges = [];
        animEvents = [];
        particles = [];
        popups = [];
        queue = [];
        shake = 0;

        rt.setScore(score);
        updateHud();
        rt.audio.play('flip', 0.8);
        rt.setStatus('已撤销一步');
      }

      function updateHud() {
        rt.setHud({ '步数': steps });
      }

      function finishGame() {
        rt.end({
          score: score,
          message: '棋盘满了，没有可以合并的方块了',
          stats: [
            { label: '最大方块', value: maxTile },
            { label: '步数', value: steps },
            { label: '合并次数', value: mergeCount },
            { label: '用时', value: elapsed.toFixed(1) + 's' }
          ]
        });
      }

      function reset() {
        grid = new Array(16);
        for (var i = 0; i < 16; i++) grid[i] = null;
        tiles = [];
        score = 0;
        steps = 0;
        mergeCount = 0;
        maxTile = 0;

        animating = false;
        animT = 0;
        animMovers = [];
        animDead = [];
        animMerges = [];
        animEvents = [];

        undoSnap = null;
        wonShown = false;
        winT = 0;
        over = false;
        overT = 0;
        endCalled = false;
        queue = [];

        particles = [];
        popups = [];
        shake = 0;
        elapsed = 0;

        drag = null;
        dragCd = 0;

        hudDirty = true;
        statusDirty = true;

        spawnRandom(false);
        spawnRandom(false);

        rt.setScore(0);
      }

      /* ---------- 绘制 ---------- */

      function drawBackground(t) {
        if (!bgGrad) {
          bgGrad = ctx.createLinearGradient(0, 0, 600, 640);
          bgGrad.addColorStop(0, '#0a0d1a');
          bgGrad.addColorStop(0.45, '#101426');
          bgGrad.addColorStop(1, '#1b1226');
          auraGrad = ctx.createRadialGradient(300, 356, 24, 300, 356, 400);
          auraGrad.addColorStop(0, 'rgba(251, 191, 36, 0.15)');
          auraGrad.addColorStop(0.55, 'rgba(249, 115, 22, 0.055)');
          auraGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-20, -20, 640, 680);
        ctx.fillStyle = auraGrad;
        ctx.fillRect(-20, -20, 640, 680);

        ctx.strokeStyle = 'rgba(120, 140, 220, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var gx = 0; gx <= 600; gx += 40) {
          ctx.moveTo(gx + 0.5, -20);
          ctx.lineTo(gx + 0.5, 660);
        }
        for (var gy = 0; gy <= 640; gy += 40) {
          ctx.moveTo(-20, gy + 0.5);
          ctx.lineTo(620, gy + 0.5);
        }
        ctx.stroke();

        var scan = (t * 0.05) % 1;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.028)';
        ctx.fillRect(-20, scan * 700 - 70, 640, 90);
      }

      function drawChip(x, y, w, h, label, value) {
        ctx.fillStyle = 'rgba(18, 24, 44, 0.85)';
        roundRect(ctx, x, y, w, h, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
        ctx.lineWidth = 1;
        roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 12);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(160, 170, 200, 0.85)';
        ctx.font = '700 10px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(label, x + w / 2, y + 16);
        ctx.fillStyle = '#fde68a';
        ctx.font = '900 20px "Consolas", monospace';
        ctx.fillText(String(value), x + w / 2, y + 34);
      }

      function drawHeader(t) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.save();
        ctx.shadowColor = 'rgba(251, 191, 36, 0.75)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 38px "Consolas", monospace';
        ctx.fillText('2048', MX, 52);
        ctx.restore();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.font = '700 11px "Consolas", monospace';
        ctx.fillText('NEON MERGE · 4 × 4', MX + 1, 70);

        drawChip(340, 16, 106, 48, '最大', maxTile);
        drawChip(458, 16, 106, 48, '合并', mergeCount);
      }

      function drawBoard() {
        ctx.save();
        ctx.shadowColor = 'rgba(251, 191, 36, 0.26)';
        ctx.shadowBlur = 26;
        ctx.fillStyle = 'rgba(18, 23, 43, 0.94)';
        roundRect(ctx, MX, MY, SIDE, SIDE, 20);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.20)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, MX + 0.75, MY + 0.75, SIDE - 1.5, SIDE - 1.5, 19);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        for (var r = 0; r < N; r++) {
          for (var c = 0; c < N; c++) {
            roundRect(ctx, cellX(c), cellY(r), CELL, CELL, 12);
            ctx.fill();
          }
        }
      }

      function drawTile(tile, t) {
        var st = styleFor(tile.v);
        var scale = 1;
        if (tile.spawn > 0) {
          var sp = 1 - tile.spawn / SPAWN_DUR;
          scale *= 0.35 + 0.65 * easeOutBack(sp);
        }
        if (tile.pop > 0) {
          var q = 1 - tile.pop / POP_DUR;
          scale *= 1 + Math.sin(Math.PI * q) * 0.17;
        }

        var cx = tile.x + CELL / 2;
        var cy = tile.y + CELL / 2;
        var glow = tile.v >= 128;

        ctx.save();
        ctx.translate(cx, cy);
        if (scale !== 1) ctx.scale(scale, scale);

        if (glow) {
          ctx.shadowColor = st[3];
          ctx.shadowBlur = 14 + Math.sin(t * 4 + tile.r * 1.7) * 4;
        }
        ctx.fillStyle = st[0];
        roundRect(ctx, -CELL / 2, -CELL / 2, CELL, CELL, 12);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = st[1];
        roundRect(ctx, -CELL / 2 + 5, -CELL / 2 + 5, CELL - 10, (CELL - 10) * 0.4, 8);
        ctx.fill();

        ctx.strokeStyle = st[3];
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.5;
        roundRect(ctx, -CELL / 2 + 1.5, -CELL / 2 + 1.5, CELL - 3, CELL - 3, 10.5);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = st[2];
        ctx.font = fontFor(tile.v);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (glow) {
          ctx.shadowColor = st[3];
          ctx.shadowBlur = 8;
        }
        ctx.fillText(String(tile.v), 0, 3);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      function drawTiles(t) {
        var i;
        for (i = 0; i < tiles.length; i++) {
          if (!tiles[i].dead) drawTile(tiles[i], t);
        }
        for (i = 0; i < tiles.length; i++) {
          if (tiles[i].dead) drawTile(tiles[i], t);
        }
      }

      function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.9;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function drawPopups() {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 18px "Consolas", monospace';
        for (var i = 0; i < popups.length; i++) {
          var p = popups[i];
          ctx.globalAlpha = Math.max(0, p.life / p.max);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;
      }

      function drawBanner(t) {
        if (winT <= 0) return;
        var appear = Math.min(1, (WIN_BANNER - winT) / 0.2);
        var fade = Math.min(1, winT / 0.5);
        var a = Math.min(appear, fade);
        var w = 400;
        var h = 120;
        var x = 300 - w / 2;
        var y = 350 - h / 2;

        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(12, 16, 32, 0.94)';
        ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
        ctx.shadowBlur = 28;
        roundRect(ctx, x, y, w, h, 18);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, w, h, 18);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fde68a';
        ctx.font = '900 30px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('已达成 2048！', 300, y + 46);
        ctx.fillStyle = 'rgba(200, 210, 240, 0.82)';
        ctx.font = '600 14px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('继续合并，冲击更高数字', 300, y + 84);
        ctx.restore();
      }

      function drawGameOver() {
        if (!over) return;
        var a = Math.min(0.72, overT * 1.3);
        ctx.fillStyle = 'rgba(6, 9, 20, ' + a.toFixed(3) + ')';
        roundRect(ctx, MX, MY, SIDE, SIDE, 20);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var pulse = 0.75 + Math.sin(rt.time * 6) * 0.25;
        ctx.save();
        ctx.shadowColor = 'rgba(244, 63, 94, 0.8)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = 'rgba(248, 113, 113, ' + pulse.toFixed(3) + ')';
        ctx.font = '900 34px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('无路可走', 300, 330);
        ctx.restore();
        ctx.fillStyle = 'rgba(210, 220, 245, 0.75)';
        ctx.font = '600 14px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('正在结算…', 300, 374);
      }

      function drawFooter() {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '600 12px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(160, 172, 205, 0.55)';
        ctx.fillText(
          wonShown ? '已达成 2048 · 继续冲击更高数字' : '目标：合成 2048 方块',
          300,
          634
        );
      }

      reset();

      return {
        update: function (dt) {
          elapsed += dt;
          if (hudDirty) {
            updateHud();
            hudDirty = false;
          }
          if (statusDirty) {
            rt.setStatus('方向键 / WASD / 滑动合并 · Z 撤销一步');
            statusDirty = false;
          }

          if (shake > 0) shake = Math.max(0, shake - dt * 55);
          if (winT > 0) winT = Math.max(0, winT - dt);
          if (dragCd > 0) dragCd = Math.max(0, dragCd - dt);

          var i;
          for (i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.93;
            p.vy *= 0.93;
            p.vy += 130 * dt;
            if (p.life <= 0) particles.splice(i, 1);
          }
          for (i = popups.length - 1; i >= 0; i--) {
            var pp = popups[i];
            pp.life -= dt;
            pp.y -= 38 * dt;
            if (pp.life <= 0) popups.splice(i, 1);
          }
          for (i = 0; i < tiles.length; i++) {
            var tl = tiles[i];
            if (tl.spawn > 0) tl.spawn = Math.max(0, tl.spawn - dt);
            if (tl.pop > 0) tl.pop = Math.max(0, tl.pop - dt);
          }

          if (animating) {
            animT += dt;
            var ratio = animT / MOVE_DUR;
            if (ratio > 1) ratio = 1;
            var e = easeOutCubic(ratio);
            for (i = 0; i < animMovers.length; i++) {
              var mv = animMovers[i];
              mv.x = mv.fx + (mv.tx - mv.fx) * e;
              mv.y = mv.fy + (mv.ty - mv.fy) * e;
              mv.t = ratio;
            }
            if (ratio >= 1) finishMove();
            return;
          }

          if (over) {
            overT += dt;
            if (!endCalled && overT > 0.85) {
              endCalled = true;
              finishGame();
            }
            return;
          }

          if (queue.length) {
            var dir = queue.shift();
            doMove(dir);
          }
        },

        render: function (c) {
          ctx = c;
          var t = rt.time;
          var sx = shake > 0 ? rt.rand(-shake, shake) : 0;
          var sy = shake > 0 ? rt.rand(-shake, shake) : 0;
          ctx.save();
          ctx.translate(sx, sy);
          drawBackground(t);
          drawHeader(t);
          drawBoard();
          drawTiles(t);
          drawParticles();
          drawPopups();
          drawBanner(t);
          drawGameOver();
          drawFooter();
          ctx.restore();
        },

        onKeyDown: function (code) {
          if (over || endCalled) return;
          if (code === 'KeyZ') {
            undo();
            return;
          }
          var d = KEY_DIR[code];
          if (d === undefined) return;
          if (animating) {
            if (queue.length < 2) queue.push(d);
            return;
          }
          doMove(d);
        },

        onPointerDown: function (x, y) {
          if (over || endCalled) return;
          drag = { x: x, y: y };
          dragCd = 0;
        },

        onPointerMove: function (x, y) {
          if (!drag || over || endCalled) return;
          if (dragCd > 0) return;
          var dx = x - drag.x;
          var dy = y - drag.y;
          var adx = Math.abs(dx);
          var ady = Math.abs(dy);
          if (adx < 22 && ady < 22) return;

          var d;
          if (adx > ady) d = dx > 0 ? 3 : 2;
          else d = dy > 0 ? 1 : 0;

          drag.x = x;
          drag.y = y;
          dragCd = 0.12;

          if (animating) {
            if (queue.length < 2) queue.push(d);
            return;
          }
          doMove(d);
        },

        onPointerUp: function () {
          drag = null;
        }
      };
    }
  });
})();
