/* 游戏：五子棋（人机对弈） */
(function () {
  'use strict';

  var GRID = 15;
  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;
  var WIN_SCORE = 10000000;

  var DIRS4 = [[0, 1], [1, 0], [1, 1], [1, -1]];

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

  Arcade.register({
    id: 'gomoku',
    title: '五子棋',
    subtitle: '人机对弈，先连五者胜',
    description: '十五路棋盘，你执黑先行，AI 执白应战。点击交叉点落子，先连成五子者获胜。AI 会算攻防，也会做双三，别小看它。',
    icon: '⚫',
    accent: '#f59e0b',
    accent2: '#78350f',
    tags: ['益智', '对战'],
    difficulty: '中等',
    width: 600,
    height: 600,
    order: 80,
    tips: '进攻就是最好的防守，做出双三往往比单纯堵棋更有效。',
    controls: [
      { keys: '鼠标左键 / 点击', action: '落子' },
      { keys: 'Z', action: '悔棋' },
      { keys: 'R', action: '重新开始' }
    ],

    create: function (rt) {
      var W = rt.width;
      var H = rt.height;

      /* ---------- 布局（基于 rt.width / rt.height） ---------- */
      var CELL = Math.max(18, Math.floor(Math.min(W, H) / 18.75));
      var SPAN = (GRID - 1) * CELL;
      var BX = Math.round((W - SPAN) / 2);
      var BY = Math.round((H - SPAN) / 2 + 8);
      var PANEL_PAD = Math.round(CELL * 0.7);
      var PANEL_X = BX - PANEL_PAD;
      var PANEL_Y = BY - PANEL_PAD;
      var PANEL_W = SPAN + PANEL_PAD * 2;
      var PANEL_H = SPAN + PANEL_PAD * 2;
      var R = CELL * 0.42;
      var STAR = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];

      /* ---------- 状态（全部在闭包内） ---------- */
      var board = new Int8Array(GRID * GRID);
      var moves = [];
      var turn = BLACK;
      var blackCount = 0;
      var whiteCount = 0;
      var thinking = false;
      var aiTimer = 0;
      var gameOver = false;
      var pending = null;
      var endTimer = 0;
      var ended = false;
      var winLine = null;
      var lastMove = null;
      var hoverCell = null;
      var particles = [];
      var flash = 0;
      var playTime = 0;
      var hudKey = '';
      var hudInited = false;

      /* 木纹（创建时预计算，避免每帧三角函数） */
      var grain = [];
      (function buildGrain() {
        for (var gi = 0; gi < 20; gi++) {
          var y = PANEL_Y + 16 + gi * ((PANEL_H - 32) / 20);
          var pts = [];
          for (var gx = PANEL_X + 14; gx <= PANEL_X + PANEL_W - 14; gx += 34) {
            pts.push(gx, y + Math.sin(gx * 0.05 + gi * 1.7) * (1.2 + (gi % 3) * 0.9));
          }
          grain.push(pts);
        }
      })();

      var btnY = 16;
      var btnH = 30;
      var btnW = 62;
      var restartBtn = { x: PANEL_X + PANEL_W - btnW, y: btnY, w: btnW, h: btnH, label: '重开' };
      var undoBtn = { x: restartBtn.x - btnW - 8, y: btnY, w: btnW, h: btnH, label: '悔棋' };
      var buttons = [undoBtn, restartBtn];

      function inB(r, c) { return r >= 0 && r < GRID && c >= 0 && c < GRID; }

      function idxOf(r, c) { return r * GRID + c; }

      function refreshHud(force) {
        var label = gameOver ? (pending && pending.won ? '你赢' : pending && pending.draw ? '平局' : 'AI 胜')
          : thinking ? 'AI' : '你';
        var key = moves.length + '|' + label;
        if (force) hudKey = '';
        if (key === hudKey) return;
        hudKey = key;
        rt.setHud({ '手数': moves.length, '轮次': label });
      }

      function canUndo() {
        return !ended && !gameOver && moves.length > 0;
      }

      function resetGame() {
        board = new Int8Array(GRID * GRID);
        moves = [];
        turn = BLACK;
        blackCount = 0;
        whiteCount = 0;
        thinking = false;
        aiTimer = 0;
        gameOver = false;
        pending = null;
        endTimer = 0;
        ended = false;
        winLine = null;
        lastMove = null;
        hoverCell = null;
        particles = [];
        flash = 0;
        playTime = 0;
        hudInited = false;
        hudKey = '';
        rt.setScore(0);
        rt.setHud({ '手数': 0, '轮次': '你' });
        rt.setStatus('你执黑先行 · 点击交叉点落子 · Z 悔棋');
      }

      /* ---------- 棋盘 / 胜负 ---------- */
      function placeStone(r, c, player) {
        board[idxOf(r, c)] = player;
        moves.push({ r: r, c: c, player: player, t: rt.time });
        lastMove = moves[moves.length - 1];
        if (player === BLACK) blackCount++;
        else whiteCount++;
      }

      function findWin(r, c, player) {
        for (var d = 0; d < 4; d++) {
          var dr = DIRS4[d][0];
          var dc = DIRS4[d][1];
          var cells = [{ r: r, c: c }];
          var rr = r + dr;
          var cc = c + dc;
          while (inB(rr, cc) && board[idxOf(rr, cc)] === player) {
            cells.push({ r: rr, c: cc });
            rr += dr;
            cc += dc;
          }
          rr = r - dr;
          cc = c - dc;
          while (inB(rr, cc) && board[idxOf(rr, cc)] === player) {
            cells.unshift({ r: rr, c: cc });
            rr -= dr;
            cc -= dc;
          }
          if (cells.length >= 5) return cells;
        }
        return null;
      }

      function spawnWinParticles() {
        var source = winLine && winLine.length ? winLine : [{ r: 7, c: 7 }];
        for (var i = 0; i < 90; i++) {
          var cell = source[i % source.length];
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(30, 150);
          particles.push({
            x: BX + cell.c * CELL,
            y: BY + cell.r * CELL,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 70,
            life: rt.rand(0.5, 1.2),
            max: 1.2,
            r: rt.rand(1.4, 3.4),
            color: rt.pick(['#fbbf24', '#f59e0b', '#fde68a', '#4ade80']),
            g: 110
          });
        }
        if (particles.length > 200) particles.splice(0, particles.length - 200);
      }

      function finishGame(playerWon) {
        if (gameOver) return;
        gameOver = true;
        thinking = false;
        pending = { won: playerWon, draw: false };
        endTimer = 1.1;
        flash = 0.9;
        if (playerWon) {
          Arcade.audio.play('level', 0.75);
          spawnWinParticles();
          rt.setStatus('五连达成！');
        } else {
          Arcade.audio.play('hit', 0.8);
          rt.setStatus('AI 连成五子');
        }
        refreshHud(true);
      }

      function finishDraw() {
        if (gameOver) return;
        gameOver = true;
        thinking = false;
        winLine = null;
        pending = { won: false, draw: true };
        endTimer = 0.8;
        rt.setStatus('棋盘已满，平局');
        Arcade.audio.play('click');
        refreshHud(true);
      }

      function playerMove(r, c) {
        placeStone(r, c, BLACK);
        Arcade.audio.play('flip', 0.55);
        var line = findWin(r, c, BLACK);
        if (line) {
          winLine = line;
          finishGame(true);
          return;
        }
        if (moves.length >= GRID * GRID) {
          finishDraw();
          return;
        }
        thinking = true;
        turn = WHITE;
        aiTimer = 0.13 + rt.rand(0, 0.09); /* 130~220ms 思考延迟 */
        refreshHud(true);
        rt.setStatus('AI 正在思考…');
      }

      function doAiMove() {
        if (gameOver || ended) return;
        var mv = chooseAiMove();
        if (!mv) {
          finishDraw();
          return;
        }
        placeStone(mv.r, mv.c, WHITE);
        Arcade.audio.play('blip', 0.4);
        var line = findWin(mv.r, mv.c, WHITE);
        if (line) {
          winLine = line;
          finishGame(false);
          return;
        }
        if (moves.length >= GRID * GRID) {
          finishDraw();
          return;
        }
        turn = BLACK;
        refreshHud(true);
        rt.setStatus('轮到你落子 · Z 悔棋');
      }

      function undo() {
        if (ended || gameOver || !moves.length) {
          Arcade.audio.play('error', 0.35);
          return;
        }
        thinking = false;
        aiTimer = 0;
        var mv = moves.pop();
        board[idxOf(mv.r, mv.c)] = EMPTY;
        if (mv.player === BLACK) blackCount--;
        else whiteCount--;
        if (mv.player === WHITE && moves.length) {
          var mv2 = moves.pop();
          board[idxOf(mv2.r, mv2.c)] = EMPTY;
          if (mv2.player === BLACK) blackCount--;
          else whiteCount--;
        }
        turn = BLACK;
        winLine = null;
        pending = null;
        lastMove = moves.length ? moves[moves.length - 1] : null;
        refreshHud(true);
        rt.setStatus('已悔棋 · 轮到你落子');
        Arcade.audio.play('click', 0.5);
      }

      /* ---------- AI：攻防启发式 + 2 层搜索 ---------- */
      function runScore(cnt, open) {
        if (cnt >= 5) return WIN_SCORE;
        if (cnt === 4) return open >= 2 ? 120000 : open === 1 ? 15000 : 0;
        if (cnt === 3) return open >= 2 ? 9000 : open === 1 ? 900 : 0;
        if (cnt === 2) return open >= 2 ? 700 : open === 1 ? 70 : 0;
        if (cnt === 1) return open >= 2 ? 30 : open === 1 ? 6 : 0;
        return 0;
      }

      /* 假设 p 在 (r,c) 落子后，四个方向上的棋型总分 */
      function pointScore(r, c, p) {
        var idx = idxOf(r, c);
        board[idx] = p;
        var total = 0;
        for (var d = 0; d < 4; d++) {
          var dr = DIRS4[d][0];
          var dc = DIRS4[d][1];
          var cnt = 1;
          var open = 0;
          var rr = r + dr;
          var cc = c + dc;
          while (rr >= 0 && rr < GRID && cc >= 0 && cc < GRID && board[rr * GRID + cc] === p) {
            cnt++;
            rr += dr;
            cc += dc;
          }
          if (rr >= 0 && rr < GRID && cc >= 0 && cc < GRID && board[rr * GRID + cc] === EMPTY) open++;
          rr = r - dr;
          cc = c - dc;
          while (rr >= 0 && rr < GRID && cc >= 0 && cc < GRID && board[rr * GRID + cc] === p) {
            cnt++;
            rr -= dr;
            cc -= dc;
          }
          if (rr >= 0 && rr < GRID && cc >= 0 && cc < GRID && board[rr * GRID + cc] === EMPTY) open++;
          total += runScore(cnt, open);
        }
        board[idx] = EMPTY;
        return total;
      }

      function hasStoneNear(r, c) {
        var r0 = r - 2 < 0 ? 0 : r - 2;
        var r1 = r + 2 > GRID - 1 ? GRID - 1 : r + 2;
        var c0 = c - 2 < 0 ? 0 : c - 2;
        var c1 = c + 2 > GRID - 1 ? GRID - 1 : c + 2;
        for (var rr = r0; rr <= r1; rr++) {
          for (var cc = c0; cc <= c1; cc++) {
            if (board[rr * GRID + cc] !== EMPTY) return true;
          }
        }
        return false;
      }

      function collectCandidates() {
        var list = [];
        for (var r = 0; r < GRID; r++) {
          for (var c = 0; c < GRID; c++) {
            if (board[r * GRID + c] !== EMPTY) continue;
            if (hasStoneNear(r, c)) list.push({ r: r, c: c });
          }
        }
        if (!list.length) {
          var mid = (GRID - 1) / 2;
          if (board[idxOf(mid, mid)] === EMPTY) {
            list.push({ r: mid, c: mid });
          } else {
            for (var r2 = 0; r2 < GRID && !list.length; r2++) {
              for (var c2 = 0; c2 < GRID; c2++) {
                if (board[r2 * GRID + c2] === EMPTY) {
                  list.push({ r: r2, c: c2 });
                  break;
                }
              }
            }
          }
        }
        return list;
      }

      function chooseAiMove() {
        var cands = collectCandidates();
        if (!cands.length) return null;
        var i, j, c;

        /* 1) 自己能立刻五连 */
        for (i = 0; i < cands.length; i++) {
          c = cands[i];
          if (pointScore(c.r, c.c, WHITE) >= WIN_SCORE) return { r: c.r, c: c.c };
        }

        /* 2) 对手下一手能五连 —— 必须堵 */
        var blocks = [];
        for (i = 0; i < cands.length; i++) {
          c = cands[i];
          if (pointScore(c.r, c.c, BLACK) >= WIN_SCORE) blocks.push(c);
        }
        if (blocks.length) {
          var bestB = blocks[0];
          var bestBV = -1;
          for (i = 0; i < blocks.length; i++) {
            var bv = pointScore(blocks[i].r, blocks[i].c, WHITE);
            if (bv > bestBV) {
              bestBV = bv;
              bestB = blocks[i];
            }
          }
          return { r: bestB.r, c: bestB.c };
        }

        /* 3) 攻防综合排序 + 中心倾向 */
        var scored = [];
        for (i = 0; i < cands.length; i++) {
          c = cands[i];
          var atk = pointScore(c.r, c.c, WHITE);
          var def = pointScore(c.r, c.c, BLACK);
          var centerBias = (GRID - 1 - Math.abs(c.r - 7) - Math.abs(c.c - 7)) * 0.4;
          scored.push({ r: c.r, c: c.c, val: atk * 1.05 + def * 0.98 + centerBias });
        }
        scored.sort(function (a, b) { return b.val - a.val; });

        var top = scored.slice(0, scored.length < 6 ? scored.length : 6);
        var best = top[0];
        var bestEval = -Infinity;

        /* 4) 浅层 2 层搜索：模拟 AI 落子后，看对手最强回应 */
        for (i = 0; i < top.length; i++) {
          var t = top[i];
          board[idxOf(t.r, t.c)] = WHITE;
          var line = findWin(t.r, t.c, WHITE);
          if (line) {
            board[idxOf(t.r, t.c)] = EMPTY;
            return { r: t.r, c: t.c };
          }
          var replies = collectCandidates();
          var oppBest = 0;
          for (j = 0; j < replies.length; j++) {
            var danger = pointScore(replies[j].r, replies[j].c, BLACK);
            if (danger > oppBest) oppBest = danger;
          }
          board[idxOf(t.r, t.c)] = EMPTY;
          var evalScore = t.val - oppBest * 0.92 + rt.rand(0, 3);
          if (evalScore > bestEval) {
            bestEval = evalScore;
            best = t;
          }
        }
        return { r: best.r, c: best.c };
      }

      /* ---------- 绘制 ---------- */
      function drawStone(ctx, x, y, player, radius, glow, alpha) {
        ctx.save();
        if (alpha != null) ctx.globalAlpha = alpha;
        if (glow) {
          ctx.shadowColor = player === BLACK ? '#f59e0b' : '#fde68a';
          ctx.shadowBlur = glow;
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = player === BLACK ? '#151d30' : '#f6eedb';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1, radius * 0.09);
        ctx.strokeStyle = player === BLACK ? 'rgba(245, 158, 11, 0.78)' : 'rgba(190, 160, 110, 0.9)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - radius * 0.3, y - radius * 0.32, radius * 0.27, 0, Math.PI * 2);
        ctx.fillStyle = player === BLACK ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.9)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + radius * 0.2, y + radius * 0.22, radius * 0.42, Math.PI * 1.05, Math.PI * 1.7);
        ctx.strokeStyle = player === BLACK ? 'rgba(245, 158, 11, 0.2)' : 'rgba(120, 90, 50, 0.24)';
        ctx.lineWidth = Math.max(1, radius * 0.1);
        ctx.stroke();
        ctx.restore();
      }

      function drawTopBar(ctx, t) {
        var stoneX = PANEL_X + 16;
        var stoneY = 31;
        var iconPlayer = turn;
        if (pending) iconPlayer = pending.won ? BLACK : pending.draw ? BLACK : WHITE;
        drawStone(ctx, stoneX, stoneY, iconPlayer, 9.5, 10);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        var text;
        var color;
        if (gameOver) {
          if (pending && pending.won) {
            text = '五连！你赢了';
            color = '#86efac';
          } else if (pending && pending.draw) {
            text = '平局';
            color = '#fcd34d';
          } else {
            text = 'AI 连成五子';
            color = '#fca5a5';
          }
        } else if (thinking) {
          text = 'AI 思考中';
          var dots = Math.floor(t * 3) % 3 + 1;
          for (var d = 0; d < dots; d++) text += '·';
          color = 'rgba(252, 211, 77, 0.95)';
        } else {
          text = '你的回合';
          color = '#ffe9bf';
        }
        ctx.font = '700 17px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(text, PANEL_X + 32, stoneY);

        /* 按钮 */
        for (var i = 0; i < buttons.length; i++) {
          var b = buttons[i];
          var isUndo = b === undoBtn;
          var disabled = isUndo ? !canUndo() : false;
          var px = rt.pointer.x;
          var py = rt.pointer.y;
          var hover = !disabled && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
          ctx.save();
          ctx.fillStyle = disabled ? 'rgba(24, 18, 10, 0.5)'
            : hover ? 'rgba(70, 49, 18, 0.96)' : 'rgba(34, 24, 12, 0.92)';
          roundRect(ctx, b.x, b.y, b.w, b.h, 9);
          ctx.fill();
          ctx.strokeStyle = disabled ? 'rgba(140, 105, 60, 0.22)'
            : hover ? 'rgba(245, 158, 11, 0.9)' : 'rgba(245, 158, 11, 0.34)';
          ctx.lineWidth = 1.4;
          roundRect(ctx, b.x, b.y, b.w, b.h, 9);
          ctx.stroke();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '700 13px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillStyle = disabled ? 'rgba(180, 160, 130, 0.35)' : hover ? '#ffe9bf' : '#e9c98f';
          ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
          ctx.restore();
        }
      }

      function drawBoard(ctx, t) {
        /* 木质底板 */
        var bg = ctx.createLinearGradient(PANEL_X, PANEL_Y, PANEL_X + PANEL_W, PANEL_Y + PANEL_H);
        bg.addColorStop(0, '#2c1c0e');
        bg.addColorStop(0.45, '#201509');
        bg.addColorStop(1, '#160e06');
        ctx.save();
        ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = bg;
        roundRect(ctx, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = 'rgba(120, 78, 36, 0.22)';
        ctx.lineWidth = 1;
        for (var g = 0; g < grain.length; g++) {
          var pts = grain[g];
          ctx.beginPath();
          ctx.moveTo(pts[0], pts[1]);
          for (var k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
          ctx.stroke();
        }
        ctx.restore();

        /* 网格 */
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 226, 170, 0.22)';
        ctx.lineWidth = 1;
        var i;
        for (i = 0; i < GRID; i++) {
          ctx.beginPath();
          ctx.moveTo(BX + i * CELL, BY);
          ctx.lineTo(BX + i * CELL, BY + SPAN);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(BX, BY + i * CELL);
          ctx.lineTo(BX + SPAN, BY + i * CELL);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255, 226, 170, 0.5)';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(BX, BY, SPAN, SPAN);
        ctx.restore();

        /* 星位 */
        ctx.save();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        for (i = 0; i < STAR.length; i++) {
          var s = STAR[i];
          ctx.beginPath();
          ctx.arc(BX + s[1] * CELL, BY + s[0] * CELL, Math.max(2.4, CELL * 0.09), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        /* 五连高亮线（画在棋子下方） */
        if (winLine && winLine.length) {
          var a = winLine[0];
          var b = winLine[winLine.length - 1];
          ctx.save();
          ctx.strokeStyle = 'rgba(74, 222, 128, ' + (0.32 + 0.2 * Math.sin(t * 5)).toFixed(3) + ')';
          ctx.lineWidth = CELL * 0.52;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#4ade80';
          ctx.shadowBlur = 26;
          ctx.beginPath();
          ctx.moveTo(BX + a.c * CELL, BY + a.r * CELL);
          ctx.lineTo(BX + b.c * CELL, BY + b.r * CELL);
          ctx.stroke();
          ctx.restore();
        }
      }

      function drawPieces(ctx, t) {
        var r, c;
        if (!gameOver && !thinking && turn === BLACK && hoverCell) {
          if (board[idxOf(hoverCell.r, hoverCell.c)] === EMPTY) {
            drawStone(ctx, BX + hoverCell.c * CELL, BY + hoverCell.r * CELL, BLACK, R, 8, 0.22);
          }
        }
        for (r = 0; r < GRID; r++) {
          for (c = 0; c < GRID; c++) {
            var v = board[idxOf(r, c)];
            if (!v) continue;
            drawStone(ctx, BX + c * CELL, BY + r * CELL, v, R, 0);
          }
        }

        /* 最后一手标记 */
        if (lastMove) {
          var pulse = 0.6 + 0.4 * Math.sin(t * 7);
          var lx = BX + lastMove.c * CELL;
          var ly = BY + lastMove.r * CELL;
          ctx.save();
          ctx.strokeStyle = lastMove.player === BLACK ? '#fbbf24' : '#f87171';
          ctx.shadowColor = lastMove.player === BLACK ? '#fbbf24' : '#f87171';
          ctx.shadowBlur = 12;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(lx, ly, R * (0.34 + 0.14 * pulse), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        /* 获胜连珠脉冲环 */
        if (winLine && winLine.length) {
          for (var w = 0; w < winLine.length; w++) {
            var wc = winLine[w];
            var wx = BX + wc.c * CELL;
            var wy = BY + wc.r * CELL;
            var rad = R * (1.08 + 0.18 * Math.sin(t * 5 + w * 0.8));
            ctx.save();
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
            ctx.shadowColor = '#4ade80';
            ctx.shadowBlur = 16;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(wx, wy, rad, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      resetGame();

      return {
        update: function (dt) {
          var i;
          if (!hudInited) {
            hudInited = true;
            refreshHud(true);
            rt.setStatus('你执黑先行 · 点击交叉点落子 · Z 悔棋');
          }
          if (!gameOver) playTime += dt;

          if (thinking && !gameOver) {
            aiTimer -= dt;
            if (aiTimer <= 0) {
              thinking = false;
              doAiMove();
            }
          }

          if (pending && !ended) {
            endTimer -= dt;
            if (endTimer <= 0) {
              ended = true;
              var wonGame = pending.won;
              var drawGame = !!pending.draw;
              var score = wonGame
                ? 1200 + Math.max(0, 400 - moves.length * 4)
                : drawGame ? 500 : Math.max(80, 400 - moves.length * 3);
              rt.setScore(score);
              rt.end({
                score: score,
                won: wonGame,
                message: wonGame
                  ? ('五连达成！你用 ' + moves.length + ' 手击败了 AI')
                  : drawGame
                    ? '棋盘下满了，握手言和'
                    : ('AI 连成五子，你坚持了 ' + moves.length + ' 手'),
                stats: [
                  { label: '总手数', value: moves.length },
                  { label: '你的棋子', value: blackCount + ' 子' },
                  { label: 'AI 棋子', value: whiteCount + ' 子' },
                  { label: '用时', value: Math.max(1, Math.round(playTime)) + 's' }
                ]
              });
            }
          }

          if (flash > 0) flash = Math.max(0, flash - dt * 1.8);

          for (i = particles.length - 1; i >= 0; i--) {
            var pt = particles[i];
            pt.life -= dt;
            pt.vy += pt.g * dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vx *= 0.985;
            if (pt.life <= 0) particles.splice(i, 1);
          }
        },

        render: function (ctx) {
          var t = rt.time;
          ctx.save();

          /* 背景 */
          var bg = ctx.createLinearGradient(0, 0, W, H);
          bg.addColorStop(0, '#0b0a12');
          bg.addColorStop(0.5, '#100c08');
          bg.addColorStop(1, '#0a0f14');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, W, H);

          ctx.fillStyle = 'rgba(245, 190, 110, 0.06)';
          for (var gx = 10; gx < W; gx += 34) {
            for (var gy = 10; gy < H; gy += 34) {
              ctx.fillRect(gx, gy, 2, 2);
            }
          }

          drawBoard(ctx, t);
          drawPieces(ctx, t);
          drawTopBar(ctx, t);

          /* 粒子 */
          for (var i = 0; i < particles.length; i++) {
            var pt = particles[i];
            ctx.globalAlpha = Math.max(0, pt.life / pt.max);
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          /* 终局闪光 */
          if (flash > 0) {
            ctx.fillStyle = pending && pending.won
              ? 'rgba(74, 222, 128, ' + (flash * 0.22).toFixed(3) + ')'
              : 'rgba(245, 158, 11, ' + (flash * 0.2).toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
          }

          /* 终局横幅 */
          if (pending) {
            var alpha = Math.min(1, (1.1 - endTimer) * 2.2);
            if (alpha > 0) {
              ctx.save();
              ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.font = '900 42px "PingFang SC", "Microsoft YaHei", sans-serif';
              if (pending.won) {
                ctx.fillStyle = 'rgba(134, 239, 172, 0.95)';
                ctx.shadowColor = '#4ade80';
              } else if (pending.draw) {
                ctx.fillStyle = 'rgba(252, 211, 77, 0.95)';
                ctx.shadowColor = '#f59e0b';
              } else {
                ctx.fillStyle = 'rgba(252, 165, 165, 0.95)';
                ctx.shadowColor = '#f43f5e';
              }
              ctx.shadowBlur = 26;
              ctx.fillText(pending.won ? '五连！' : pending.draw ? '平局' : 'AI 获胜', W / 2, BY + SPAN / 2);
              ctx.restore();
            }
          }

          /* 底部提示 */
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '500 11px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillStyle = 'rgba(139, 149, 181, 0.8)';
          ctx.fillText('点击交叉点落子 · Z 悔棋 · R 重新开局', W / 2, H - 16);

          ctx.restore();
        },

        onPointerDown: function (x, y, event) {
          if (ended) return;
          var ev = event || {};
          if (ev.button === 2) return;

          for (var i = 0; i < buttons.length; i++) {
            var b = buttons[i];
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
              if (b === undoBtn) undo();
              else {
                resetGame();
                Arcade.audio.play('click');
              }
              return;
            }
          }

          if (gameOver || thinking || turn !== BLACK) return;
          var c = Math.round((x - BX) / CELL);
          var r = Math.round((y - BY) / CELL);
          if (!inB(r, c)) return;
          var dx = x - (BX + c * CELL);
          var dy = y - (BY + r * CELL);
          if (dx * dx + dy * dy > (CELL * 0.62) * (CELL * 0.62)) return;
          if (board[idxOf(r, c)] !== EMPTY) {
            Arcade.audio.play('error', 0.35);
            return;
          }
          playerMove(r, c);
        },

        onPointerMove: function (x, y) {
          var c = Math.round((x - BX) / CELL);
          var r = Math.round((y - BY) / CELL);
          if (!inB(r, c)) {
            hoverCell = null;
            return;
          }
          var dx = x - (BX + c * CELL);
          var dy = y - (BY + r * CELL);
          hoverCell = dx * dx + dy * dy > (CELL * 0.75) * (CELL * 0.75)
            ? null
            : { r: r, c: c };
        },

        onKeyDown: function (code) {
          if (code === 'KeyZ') undo();
        }
      };
    }
  });
})();
