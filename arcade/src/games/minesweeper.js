/* 游戏：扫雷 */
(function () {
  'use strict';

  var COLS = 9;
  var ROWS = 9;
  var MINES = 10;
  var CELLS = COLS * ROWS;
  var SAFE_TOTAL = CELLS - MINES;

  /* 数字 1-8 的霓虹配色 */
  var NUM_COLORS = [
    '#e8ecff',
    '#67e8f9',
    '#4ade80',
    '#fbbf24',
    '#fb923c',
    '#f87171',
    '#c084fc',
    '#f472b6',
    '#e2e8f0'
  ];

  var DIRS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1]
  ];

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

  function drawFlagShape(ctx, x, y, scale, glow) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (glow) {
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 12;
    }
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(3, -13);
    ctx.lineTo(3, 13);
    ctx.stroke();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(4, -12);
    ctx.lineTo(18, -6);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#be123c';
    roundRect(ctx, -8, 12, 22, 4, 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMineShape(ctx, x, y, r, hot, glow) {
    ctx.save();
    if (glow) {
      ctx.shadowColor = hot ? '#f43f5e' : '#94a3b8';
      ctx.shadowBlur = hot ? 20 : 10;
    }
    ctx.strokeStyle = hot ? '#fda4af' : '#94a3b8';
    ctx.lineWidth = Math.max(1.5, r * 0.2);
    var i, a;
    for (i = 0; i < 8; i++) {
      a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
      ctx.lineTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45);
      ctx.stroke();
    }
    ctx.fillStyle = hot ? '#fda4af' : '#334155';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawClockIcon(ctx, x, y, r, spin) {
    ctx.save();
    ctx.strokeStyle = 'rgba(163, 230, 53, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(226, 240, 200, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - r * 0.62);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(spin) * r * 0.5, y + Math.sin(spin) * r * 0.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(163, 230, 53, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFace(ctx, x, y, r, mood, hover, t) {
    var bob = Math.sin(t * 3) * 0.6;
    ctx.save();
    ctx.shadowColor = '#a3e635';
    ctx.shadowBlur = hover ? 20 : 10;
    ctx.beginPath();
    ctx.arc(x, y + bob, r, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.2, x, y, r);
    g.addColorStop(0, '#24391f');
    g.addColorStop(1, '#0d1a10');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = hover ? 'rgba(163,230,53,0.95)' : 'rgba(163,230,53,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    var cy = y + bob;
    ctx.save();
    ctx.strokeStyle = '#d9f99d';
    ctx.fillStyle = '#d9f99d';
    ctx.lineWidth = 2;
    if (mood === 'dead') {
      var d = r * 0.28;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.38 - d, cy - r * 0.28 - d);
      ctx.lineTo(x - r * 0.38 + d, cy - r * 0.28 + d);
      ctx.moveTo(x - r * 0.38 + d, cy - r * 0.28 - d);
      ctx.lineTo(x - r * 0.38 - d, cy - r * 0.28 + d);
      ctx.moveTo(x + r * 0.38 - d, cy - r * 0.28 - d);
      ctx.lineTo(x + r * 0.38 + d, cy - r * 0.28 + d);
      ctx.moveTo(x + r * 0.38 + d, cy - r * 0.28 - d);
      ctx.lineTo(x + r * 0.38 - d, cy - r * 0.28 + d);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, cy + r * 0.42, r * 0.34, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    } else if (mood === 'win') {
      ctx.beginPath();
      ctx.arc(x - r * 0.38, cy - r * 0.22, r * 0.14, 0, Math.PI * 2);
      ctx.arc(x + r * 0.38, cy - r * 0.22, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, cy + r * 0.12, r * 0.46, Math.PI * 0.18, Math.PI * 0.82);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x - r * 0.34, cy - r * 0.22, r * 0.12, 0, Math.PI * 2);
      ctx.arc(x + r * 0.34, cy - r * 0.22, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, cy + r * 0.08, r * 0.38, Math.PI * 0.16, Math.PI * 0.84);
      ctx.stroke();
    }
    ctx.restore();
  }

  Arcade.register({
    id: 'minesweeper',
    title: '扫雷',
    subtitle: '十颗雷，一命通关',
    description: '九乘九的雷区里藏着十颗地雷，第一次点击必定安全。翻开全部安全格即可通关，右键或长按可以插旗标记可疑位置。',
    icon: '💣',
    accent: '#a3e635',
    accent2: '#22c55e',
    tags: ['益智', '经典'],
    difficulty: '中等',
    width: 600,
    height: 640,
    order: 50,
    tips: '数字代表周围八格的雷数，从边角起手更安全。',
    controls: [
      { keys: '鼠标左键 / 点击', action: '翻开格子' },
      { keys: '鼠标右键 / 长按', action: '插旗标记' },
      { keys: 'R', action: '重新开始' }
    ],

    create: function (rt) {
      var W = rt.width;
      var H = rt.height;

      /* ---------- 布局（基于 rt.width / rt.height） ---------- */
      var CELL = Math.max(30, Math.min(
        Math.floor(W * 0.81 / COLS),
        Math.floor((H - 154) / ROWS)
      ));
      var BOARD = CELL * COLS;
      var OX = Math.round((W - BOARD) / 2);
      var OY = Math.min(Math.round(H * 0.153), H - BOARD - 56);
      var PAD = Math.max(2, Math.round(CELL * 0.06));
      var FACE_R = Math.max(16, Math.round(CELL * 0.36));

      var PANEL_W = W - 48;
      var PANEL_X = (W - PANEL_W) / 2;
      var PANEL_Y = 14;
      var PANEL_H = OY - 32;
      var PANEL_CY = PANEL_Y + PANEL_H / 2;
      var FACE_X = W / 2;

      /* ---------- 状态（全部在闭包内） ---------- */
      var board = [];
      var firstClick = false;
      var flags = 0;
      var revealedSafe = 0;
      var elapsed = 0;
      var timerRunning = false;
      var lost = false;
      var won = false;
      var ended = false;
      var endResult = null;
      var endTimer = 0;
      var shake = 0;
      var flash = 0;
      var flashColor = '244, 63, 94';
      var particles = [];
      var popups = [];
      var touch = null;
      var hoverR = -1;
      var hoverC = -1;
      var hudKey = '';
      var hudInited = false;
      var explosion = null;

      function idxOf(r, c) { return r * COLS + c; }

      function inBoard(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

      function cellCenter(r, c) {
        return { x: OX + c * CELL + CELL / 2, y: OY + r * CELL + CELL / 2 };
      }

      function fmtTime(sec) {
        var s = Math.floor(sec);
        var m = Math.floor(s / 60);
        var ss = s % 60;
        return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
      }

      function updateHud(force) {
        var remain = MINES - flags;
        var key = remain + '|' + Math.floor(elapsed) + '|' + (won ? 1 : 0) + '|' + (lost ? 1 : 0);
        if (force) hudKey = '';
        if (key !== hudKey) {
          hudKey = key;
          rt.setHud({ '剩余雷': remain, '用时': fmtTime(elapsed) });
        }
      }

      function computeAdj() {
        var r, c, d, n, rr, cc;
        for (r = 0; r < ROWS; r++) {
          for (c = 0; c < COLS; c++) {
            n = 0;
            for (d = 0; d < 8; d++) {
              rr = r + DIRS[d][0];
              cc = c + DIRS[d][1];
              if (inBoard(rr, cc) && board[idxOf(rr, cc)].mine) n++;
            }
            board[idxOf(r, c)].adj = n;
          }
        }
      }

      function shuffle(list) {
        for (var j = list.length - 1; j > 0; j--) {
          var k = rt.randInt(0, j);
          var tmp = list[j];
          list[j] = list[k];
          list[k] = tmp;
        }
      }

      /* 预布雷：首帧即是「已布雷」状态；首次点击时再保证 3×3 安全区无雷 */
      function placeMines(exclude) {
        var pool = [];
        var i;
        for (i = 0; i < CELLS; i++) pool.push(i);
        shuffle(pool);
        var placed = 0;
        for (var p = 0; p < pool.length && placed < MINES; p++) {
          var idx = pool[p];
          var r = Math.floor(idx / COLS);
          var c = idx % COLS;
          if (exclude && Math.abs(r - exclude.r) <= 1 && Math.abs(c - exclude.c) <= 1) continue;
          if (board[idx].flagged) continue;
          board[idx].mine = true;
          placed++;
        }
        computeAdj();
      }

      function relocateMines(pr, pc) {
        var removed = 0;
        var r, c;
        for (r = pr - 1; r <= pr + 1; r++) {
          for (c = pc - 1; c <= pc + 1; c++) {
            if (!inBoard(r, c)) continue;
            var idx = idxOf(r, c);
            if (board[idx].mine) {
              board[idx].mine = false;
              removed++;
            }
          }
        }
        if (!removed) return;
        var pool = [];
        for (r = 0; r < ROWS; r++) {
          for (c = 0; c < COLS; c++) {
            if (Math.abs(r - pr) <= 1 && Math.abs(c - pc) <= 1) continue;
            var i2 = idxOf(r, c);
            if (board[i2].mine || board[i2].flagged) continue;
            pool.push(i2);
          }
        }
        shuffle(pool);
        for (var m = 0; m < removed && m < pool.length; m++) board[pool[m]].mine = true;
        computeAdj();
      }

      function trimParticles() {
        if (particles.length > 160) particles.splice(0, particles.length - 160);
      }

      function spawnBurst(x, y, count, power) {
        var palette = ['#f43f5e', '#fb923c', '#fbbf24', '#fca5a5', '#f97316'];
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(60, 240) * (power || 1);
          particles.push({
            x: x,
            y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 30,
            life: rt.rand(0.4, 0.95),
            max: 0.95,
            r: rt.rand(1.6, 4.4),
            color: rt.pick(palette),
            g: 340
          });
        }
        trimParticles();
      }

      function spawnSparkles(count, colorA, colorB) {
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(20, 120);
          particles.push({
            x: rt.rand(OX, OX + BOARD),
            y: rt.rand(OY, OY + BOARD),
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 60,
            life: rt.rand(0.5, 1.2),
            max: 1.2,
            r: rt.rand(1.4, 3.2),
            color: rt.pick([colorA, colorB]),
            g: 60
          });
        }
        trimParticles();
      }

      function addPopup(x, y, text, color) {
        if (popups.length > 6) popups.shift();
        popups.push({ x: x, y: y, text: text, color: color, life: 0.8, max: 0.8 });
      }

      function resetBoard() {
        board = [];
        for (var i = 0; i < CELLS; i++) {
          board.push({ mine: false, revealed: false, flagged: false, adj: 0, revealAt: -1, flagAt: -1 });
        }
        placeMines(null);
        firstClick = false;
        flags = 0;
        revealedSafe = 0;
        elapsed = 0;
        timerRunning = false;
        lost = false;
        won = false;
        ended = false;
        endResult = null;
        endTimer = 0;
        shake = 0;
        flash = 0;
        flashColor = '244, 63, 94';
        particles = [];
        popups = [];
        touch = null;
        hoverR = -1;
        hoverC = -1;
        hudInited = false;
        hudKey = '';
        explosion = null;
        rt.setScore(0);
        rt.setHud({ '剩余雷': MINES, '用时': '00:00' });
        rt.setStatus('已布雷 · 点击任意格开始（首点必安全）');
      }

      function startTimer() {
        if (!timerRunning) timerRunning = true;
      }

      function cascade(sr, sc) {
        var stack = [idxOf(sr, sc)];
        var revealedNow = 0;
        while (stack.length) {
          var idx = stack.pop();
          var cell = board[idx];
          if (cell.revealed || cell.flagged || cell.mine) continue;
          cell.revealed = true;
          cell.revealAt = rt.time;
          revealedNow++;
          if (cell.adj === 0) {
            var r = Math.floor(idx / COLS);
            var c = idx % COLS;
            for (var d = 0; d < 8; d++) {
              var rr = r + DIRS[d][0];
              var cc = c + DIRS[d][1];
              if (!inBoard(rr, cc)) continue;
              var ni = idxOf(rr, cc);
              if (!board[ni].revealed && !board[ni].flagged) stack.push(ni);
            }
          }
        }
        if (revealedNow > 0) {
          revealedSafe += revealedNow;
          rt.setScore(revealedSafe * 10);
          Arcade.audio.play('flip', 0.32);
          var p = cellCenter(sr, sc);
          addPopup(p.x, p.y - CELL * 0.4, '+' + (revealedNow * 10), '#a3e635');
          if (revealedNow > 3) spawnSparkles(8, '#a3e635', '#22c55e');
        }
        updateHud(true);
      }

      function revealAt(r, c) {
        if (ended || lost || won) return;
        if (!inBoard(r, c)) return;
        var cell = board[idxOf(r, c)];
        if (cell.revealed || cell.flagged) return;
        if (!firstClick) {
          firstClick = true;
          relocateMines(r, c);
          startTimer();
          rt.setStatus('计时开始 · 首点必安全');
        }
        if (cell.mine) {
          explode(r, c);
          return;
        }
        cascade(r, c);
        checkWin();
      }

      function checkWin() {
        if (lost || won) return;
        if (revealedSafe < SAFE_TOTAL) return;
        won = true;
        timerRunning = false;
        endResult = { won: true };
        endTimer = 0.55;
        shake = 4;
        flash = 0.55;
        flashColor = '163, 230, 53';
        rt.setStatus('全部安全格已清理！');
        Arcade.audio.play('level', 0.7);
        spawnSparkles(90, '#a3e635', '#fbbf24');
        rt.setHud({ '剩余雷': 0, '用时': fmtTime(elapsed) });
      }

      function explode(r, c) {
        if (lost) return;
        lost = true;
        timerRunning = false;
        var idx = idxOf(r, c);
        board[idx].revealed = true;
        board[idx].revealAt = rt.time;
        var p = cellCenter(r, c);
        explosion = idx;
        shake = 16;
        flash = 1;
        flashColor = '244, 63, 94';
        Arcade.audio.play('explode');
        spawnBurst(p.x, p.y, 60, 1.5);
        rt.setStatus('踩到地雷了…');
        endResult = { won: false };
        endTimer = 0.7;
        updateHud(true);
      }

      function toggleFlag(r, c) {
        if (ended || lost || won) return;
        if (!inBoard(r, c)) return;
        var cell = board[idxOf(r, c)];
        if (cell.revealed) return;
        if (cell.flagged) {
          cell.flagged = false;
          cell.flagAt = rt.time;
          flags--;
          Arcade.audio.play('click', 0.4);
        } else {
          if (flags >= MINES) {
            Arcade.audio.play('error', 0.45);
            rt.setStatus('旗子用完了，先取消一个标记');
            return;
          }
          cell.flagged = true;
          cell.flagAt = rt.time;
          flags++;
          Arcade.audio.play('blip', 0.45);
          var p = cellCenter(r, c);
          spawnBurst(p.x, p.y, 5, 0.35);
        }
        updateHud(true);
        if (!firstClick) rt.setStatus('已布雷 · 点击任意格开始（首点必安全）');
      }

      function pointCell(x, y) {
        var c = Math.floor((x - OX) / CELL);
        var r = Math.floor((y - OY) / CELL);
        if (!inBoard(r, c)) return null;
        return { r: r, c: c };
      }

      function isTouchEvent(e) {
        return !!(e && (e.pointerType === 'touch' || e.pointerType === 'pen'));
      }

      /* ---------- 绘制 ---------- */
      function drawBackground(ctx) {
        var bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#070d12');
        bg.addColorStop(0.55, '#0a1518');
        bg.addColorStop(1, '#07120d');
        ctx.fillStyle = bg;
        ctx.fillRect(-30, -30, W + 60, H + 60);

        ctx.fillStyle = 'rgba(140, 230, 170, 0.07)';
        for (var gx = 12; gx < W; gx += 36) {
          for (var gy = 12; gy < H; gy += 36) {
            ctx.fillRect(gx, gy, 2, 2);
          }
        }
      }

      function drawHud(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(14, 24, 34, 0.94)';
        roundRect(ctx, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.22)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16);
        ctx.stroke();
        ctx.restore();

        var iconX = PANEL_X + 42;
        drawMineShape(ctx, iconX, PANEL_CY, CELL * 0.19, false, true);

        var countX = iconX + 26;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '700 11px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(163, 230, 53, 0.62)';
        ctx.fillText('剩余雷', countX, PANEL_CY - 12);
        ctx.font = '900 26px "Consolas", monospace';
        ctx.fillStyle = '#e8ffd6';
        ctx.fillText(String(MINES - flags), countX, PANEL_CY + 14);

        /* 右侧计时 */
        var timeX = PANEL_X + PANEL_W - 22;
        var clockX = timeX - 96;
        drawClockIcon(ctx, clockX, PANEL_CY, 10, (elapsed % 60) / 60 * Math.PI * 2 - Math.PI / 2);
        ctx.textAlign = 'right';
        ctx.font = '700 11px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(163, 230, 53, 0.62)';
        ctx.fillText('用时', timeX, PANEL_CY - 12);
        ctx.font = '900 24px "Consolas", monospace';
        ctx.fillStyle = timerRunning || lost || won ? '#e8ffd6' : 'rgba(232, 255, 214, 0.5)';
        ctx.fillText(fmtTime(elapsed), timeX, PANEL_CY + 13);

        /* 中间：重开笑脸按钮 */
        var px = rt.pointer.x;
        var py = rt.pointer.y;
        var hover = (px - FACE_X) * (px - FACE_X) + (py - PANEL_CY) * (py - PANEL_CY) < (FACE_R + 8) * (FACE_R + 8);
        var mood = lost ? 'dead' : won ? 'win' : 'smile';
        drawFace(ctx, FACE_X, PANEL_CY, FACE_R, mood, hover, rt.time);
        ctx.textAlign = 'center';
        ctx.font = '700 10px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(163, 230, 53, 0.5)';
        ctx.fillText('点我重开', FACE_X, PANEL_Y + PANEL_H - 4);
      }

      function drawBoard(ctx) {
        ctx.save();
        ctx.shadowColor = '#a3e635';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.5)';
        ctx.lineWidth = 2;
        roundRect(ctx, OX - 10, OY - 10, BOARD + 20, BOARD + 20, 16);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = 'rgba(6, 18, 14, 0.7)';
        roundRect(ctx, OX - 6, OY - 6, BOARD + 12, BOARD + 12, 13);
        ctx.fill();
      }

      function numberFont() {
        return '900 ' + Math.round(CELL * 0.5) + 'px "Consolas", monospace';
      }

      function drawCell(ctx, r, c, t) {
        var cell = board[idxOf(r, c)];
        var cx0 = OX + c * CELL;
        var cy0 = OY + r * CELL;
        var cx = cx0 + CELL / 2;
        var cy = cy0 + CELL / 2;
        var iw = CELL - PAD * 2;

        if (!cell.revealed) {
          ctx.fillStyle = '#1a2740';
          roundRect(ctx, cx0 + PAD, cy0 + PAD, iw, iw, Math.round(CELL * 0.14));
          ctx.fill();
          ctx.fillStyle = 'rgba(150, 205, 255, 0.16)';
          roundRect(ctx, cx0 + PAD, cy0 + PAD, iw, Math.max(2, Math.round(CELL * 0.07)), 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(2, 8, 18, 0.55)';
          roundRect(ctx, cx0 + PAD, cy0 + CELL - PAD - Math.max(2, Math.round(CELL * 0.1)), iw, Math.max(2, Math.round(CELL * 0.075)), 2);
          ctx.fill();

          if (lost && cell.mine) {
            drawMineShape(ctx, cx, cy, CELL * 0.19, board[idxOf(r, c)].revealed, false);
          }
          if (cell.flagged) {
            var fs = 1;
            if (cell.flagAt >= 0) {
              var fa = Math.min(1, (t - cell.flagAt) / 0.16);
              fs = 0.6 + 0.4 * fa;
            }
            drawFlagShape(ctx, cx, cy, fs * CELL / 54, true);
            if (lost && !cell.mine) {
              ctx.save();
              ctx.strokeStyle = 'rgba(248, 113, 113, 0.95)';
              ctx.lineWidth = 2.4;
              ctx.beginPath();
              ctx.moveTo(cx - CELL * 0.3, cy - CELL * 0.3);
              ctx.lineTo(cx + CELL * 0.3, cy + CELL * 0.3);
              ctx.moveTo(cx + CELL * 0.3, cy - CELL * 0.3);
              ctx.lineTo(cx - CELL * 0.3, cy + CELL * 0.3);
              ctx.stroke();
              ctx.restore();
            }
          } else if (won && cell.mine) {
            drawFlagShape(ctx, cx, cy, CELL / 54, true);
          } else if (!lost && r === hoverR && c === hoverC) {
            ctx.save();
            ctx.strokeStyle = 'rgba(163, 230, 53, 0.6)';
            ctx.lineWidth = 1.6;
            roundRect(ctx, cx0 + PAD + 1, cy0 + PAD + 1, iw - 2, iw - 2, Math.round(CELL * 0.14));
            ctx.stroke();
            ctx.restore();
          }
          return;
        }

        /* 已翻开：凹陷 */
        ctx.fillStyle = '#0a1420';
        roundRect(ctx, cx0 + PAD, cy0 + PAD, iw, iw, Math.round(CELL * 0.14));
        ctx.fill();
        ctx.strokeStyle = 'rgba(110, 190, 150, 0.1)';
        ctx.lineWidth = 1;
        roundRect(ctx, cx0 + PAD, cy0 + PAD, iw, iw, Math.round(CELL * 0.14));
        ctx.stroke();

        if (cell.mine) {
          var hot = explosion === idxOf(r, c);
          drawMineShape(ctx, cx, cy, CELL * 0.22, hot, hot);
          return;
        }
        if (cell.adj > 0) {
          var ra = 1;
          if (cell.revealAt >= 0) ra = Math.min(1, (t - cell.revealAt) / 0.16);
          ctx.save();
          if (ra < 1) {
            ctx.globalAlpha = ra;
            ctx.translate(cx, cy);
            ctx.scale(0.55 + 0.45 * ra, 0.55 + 0.45 * ra);
            ctx.translate(-cx, -cy);
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = numberFont();
          ctx.fillStyle = NUM_COLORS[Math.min(8, cell.adj)];
          if (cell.adj >= 5) {
            ctx.shadowColor = NUM_COLORS[cell.adj];
            ctx.shadowBlur = 10;
          }
          ctx.fillText(String(cell.adj), cx, cy + 1);
          ctx.restore();
        }
      }

      resetBoard();

      return {
        update: function (dt) {
          var i;
          if (!hudInited) {
            hudInited = true;
            updateHud(true);
            if (!firstClick) rt.setStatus('已布雷 · 点击任意格开始（首点必安全）');
          }
          if (timerRunning && !lost && !won) {
            elapsed += dt;
            updateHud(false);
          }

          /* 触屏长按插旗 */
          if (touch && !touch.fired && !touch.moved && rt.time - touch.start >= 0.35) {
            touch.fired = true;
            toggleFlag(touch.r, touch.c);
          }

          if (shake > 0) shake = Math.max(0, shake - dt * 46);
          if (flash > 0) flash = Math.max(0, flash - dt * 1.7);

          for (i = particles.length - 1; i >= 0; i--) {
            var pt = particles[i];
            pt.life -= dt;
            pt.vy += pt.g * dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vx *= 0.985;
            if (pt.life <= 0) particles.splice(i, 1);
          }
          for (i = popups.length - 1; i >= 0; i--) {
            var pp = popups[i];
            pp.life -= dt;
            pp.y -= 30 * dt;
            if (pp.life <= 0) popups.splice(i, 1);
          }

          if (endResult && !ended) {
            endTimer -= dt;
            if (endTimer <= 0) {
              ended = true;
              var winScore = 1000 + Math.max(0, 600 - Math.round(elapsed) * 8);
              var finalScore = won ? winScore : revealedSafe * 10;
              rt.setScore(finalScore);
              rt.end({
                score: finalScore,
                won: won,
                message: won
                  ? ('雷区已清空，用时 ' + fmtTime(elapsed))
                  : ('踩到地雷了… 只翻开了 ' + revealedSafe + ' 个安全格'),
                stats: [
                  { label: '翻开安全格', value: revealedSafe + ' / ' + SAFE_TOTAL },
                  { label: '用时', value: fmtTime(elapsed) },
                  { label: '插旗', value: flags + ' 面' },
                  { label: '雷区', value: ROWS + '×' + COLS + ' / ' + MINES + ' 雷' }
                ]
              });
            }
          }
        },

        render: function (ctx) {
          var t = rt.time;
          ctx.save();
          if (shake > 0) ctx.translate(rt.rand(-shake, shake), rt.rand(-shake, shake));

          drawBackground(ctx);

          drawBoard(ctx);
          var r, c;
          for (r = 0; r < ROWS; r++) {
            for (c = 0; c < COLS; c++) drawCell(ctx, r, c, t);
          }
          drawHud(ctx);

          /* 粒子 */
          var i;
          for (i = 0; i < particles.length; i++) {
            var pt = particles[i];
            ctx.globalAlpha = Math.max(0, pt.life / pt.max);
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          /* 飘字 */
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '900 16px "Consolas", monospace';
          for (i = 0; i < popups.length; i++) {
            var pp = popups[i];
            ctx.globalAlpha = Math.max(0, pp.life / pp.max);
            ctx.fillStyle = pp.color;
            ctx.fillText(pp.text, pp.x, pp.y);
          }
          ctx.globalAlpha = 1;

          /* 闪光 */
          if (flash > 0) {
            ctx.fillStyle = 'rgba(' + flashColor + ', ' + (flash * 0.4).toFixed(3) + ')';
            ctx.fillRect(-30, -30, W + 60, H + 60);
          }

          /* 底部提示 */
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '700 12px "PingFang SC", "Microsoft YaHei", sans-serif';
          var hintY = OY + BOARD + 26;
          var hintText;
          if (won) {
            hintText = '✦ 全部安全格已清理 · 用时 ' + fmtTime(elapsed) + ' ✦';
            ctx.fillStyle = 'rgba(163, 230, 53, 0.95)';
          } else if (lost) {
            hintText = '踩到地雷 · 已揭开 ' + revealedSafe + ' / ' + SAFE_TOTAL;
            ctx.fillStyle = 'rgba(248, 113, 113, 0.9)';
          } else if (!firstClick) {
            hintText = '已布雷 · ' + MINES + ' 颗雷 · 首点必安全';
            ctx.fillStyle = 'rgba(163, 230, 53, 0.62)';
          } else {
            hintText = '已揭开 ' + revealedSafe + ' / ' + SAFE_TOTAL + ' · 剩余雷 ' + (MINES - flags);
            ctx.fillStyle = 'rgba(163, 230, 53, 0.7)';
          }
          ctx.fillText(hintText, W / 2, hintY);
          ctx.font = '500 11px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillStyle = 'rgba(139, 149, 181, 0.8)';
          ctx.fillText('左键翻开 · 右键 / 长按插旗 · R 重开', W / 2, hintY + 20);

          ctx.restore();
        },

        onPointerDown: function (x, y, event) {
          if (ended) return;
          var ev = event || {};

          /* 笑脸重开按钮 */
          var dx = x - FACE_X;
          var dy = y - PANEL_CY;
          if (dx * dx + dy * dy < (FACE_R + 8) * (FACE_R + 8)) {
            resetBoard();
            Arcade.audio.play('click');
            return;
          }

          if (ev.button === 2) {
            var rc = pointCell(x, y);
            if (rc) toggleFlag(rc.r, rc.c);
            return;
          }

          var hit = pointCell(x, y);
          if (!hit) return;

          if (isTouchEvent(ev)) {
            touch = { r: hit.r, c: hit.c, start: rt.time, fired: false, moved: false, x: x, y: y };
            return;
          }
          revealAt(hit.r, hit.c);
        },

        onPointerMove: function (x, y) {
          var hit = pointCell(x, y);
          hoverR = hit ? hit.r : -1;
          hoverC = hit ? hit.c : -1;
          if (touch) {
            var dx = x - touch.x;
            var dy = y - touch.y;
            if (dx * dx + dy * dy > 196) touch.moved = true;
          }
        },

        onPointerUp: function (x, y) {
          if (!touch) return;
          var t = touch;
          touch = null;
          if (t.fired || t.moved) return;
          var hit = pointCell(x, y);
          if (hit && hit.r === t.r && hit.c === t.c) revealAt(t.r, t.c);
        }
      };
    }
  });
})();
