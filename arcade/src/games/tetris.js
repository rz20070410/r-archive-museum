/* 游戏：俄罗斯方块 —— 霓虹描边方块 / 落点影子 / 连击计分 */
(function () {
  'use strict';

  var COLS = 10;
  var ROWS = 20;
  var CELL = 30;
  var BW = COLS * CELL;          // 300
  var BH = ROWS * CELL;          // 600
  var BX = 32;
  var BY = 90;
  var PANEL_X = 356;
  var PANEL_W = 152;
  var CLEAR_TIME = 0.34;
  var LOCK_DELAY = 0.16;

  var TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  var SHAPE = {
    I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], base: '#22d3ee', light: '#a5f3fc', dark: '#0e7490' },
    O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], base: '#facc15', light: '#fef08a', dark: '#a16207' },
    T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], base: '#a855f7', light: '#e9d5ff', dark: '#7e22ce' },
    S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], base: '#34d399', light: '#a7f3d0', dark: '#047857' },
    Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], base: '#f43f5e', light: '#fecdd3', dark: '#be123c' },
    J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], base: '#3b82f6', light: '#bfdbfe', dark: '#1d4ed8' },
    L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], base: '#fb923c', light: '#fed7aa', dark: '#c2410c' }
  };

  var CLEAR_SCORE = [0, 100, 300, 500, 800];
  var KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [-2, -1], [2, -1]];

  /* 预计算 4 个旋转状态与初始包围盒（模块级常量，只读） */
  function rotateCells(cells, n) {
    var out = [];
    for (var i = 0; i < cells.length; i++) {
      out.push([n - 1 - cells[i][1], cells[i][0]]);
    }
    return out;
  }

  var ROT = {};
  var BBOX = {};

  (function buildShapes() {
    for (var t = 0; t < TYPES.length; t++) {
      var type = TYPES[t];
      var n = SHAPE[type].size;
      var list = [SHAPE[type].cells];
      for (var k = 1; k < 4; k++) list.push(rotateCells(list[k - 1], n));
      ROT[type] = list;

      var c0 = list[0];
      var minX = 99, maxX = -99, minY = 99, maxY = -99;
      for (var i = 0; i < c0.length; i++) {
        if (c0[i][0] < minX) minX = c0[i][0];
        if (c0[i][0] > maxX) maxX = c0[i][0];
        if (c0[i][1] < minY) minY = c0[i][1];
        if (c0[i][1] > maxY) maxY = c0[i][1];
      }
      BBOX[type] = { minX: minX, minY: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  })();

  function roundRect(c, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + radius, y);
    c.lineTo(x + w - radius, y);
    c.quadraticCurveTo(x + w, y, x + w, y + radius);
    c.lineTo(x + w, y + h - radius);
    c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    c.lineTo(x + radius, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - radius);
    c.lineTo(x, y + radius);
    c.quadraticCurveTo(x, y, x + radius, y);
    c.closePath();
  }

  function drawBlock(c, x, y, size, col) {
    c.fillStyle = col.dark;
    c.fillRect(x + 1, y + 1, size - 2, size - 2);
    c.fillStyle = col.base;
    c.fillRect(x + 2, y + 2, size - 4, size - 4);
    c.fillStyle = col.light;
    c.fillRect(x + 3, y + 3, size - 6, Math.max(2, Math.round(size * 0.17)));
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.fillRect(x + 3, y + 3, Math.max(2, Math.round(size * 0.12)), size - 6);
    c.fillStyle = 'rgba(0,0,0,0.30)';
    c.fillRect(x + 3, y + size - 3 - Math.max(2, Math.round(size * 0.14)), size - 6, Math.max(2, Math.round(size * 0.14)));
    c.strokeStyle = 'rgba(255,255,255,0.22)';
    c.lineWidth = 1;
    c.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
  }

  function drawMiniPiece(c, type, cx, cy, size) {
    var cells = ROT[type][0];
    var b = BBOX[type];
    var ox = cx - (b.w * size) / 2 - b.minX * size;
    var oy = cy - (b.h * size) / 2 - b.minY * size;
    var col = SHAPE[type];
    for (var i = 0; i < cells.length; i++) {
      drawBlock(c, ox + cells[i][0] * size, oy + cells[i][1] * size, size, col);
    }
  }

  Arcade.register({
    id: 'tetris',
    title: '俄罗斯方块',
    subtitle: '消行、加速、活下去',
    description: '七种霓虹方块从顶部落下，摆满一行即可消除。等级越高下落越快，连消越多分数越夸张，看看你能撑到第几级。',
    icon: '🧩',
    accent: '#22d3ee',
    accent2: '#3b82f6',
    tags: ['街机', '益智'],
    difficulty: '中等',
    width: 540,
    height: 720,
    order: 15,
    tips: '留一列空竖槽，等 I 型方块一次消四行；连击比单消更值钱。',
    controls: [
      { keys: '← → / A D', action: '左右移动' },
      { keys: '↑ / X 顺时针 · Z 逆时针', action: '旋转方块' },
      { keys: '↓ / 空格', action: '软降 / 硬降' },
      { keys: 'C / Shift', action: '暂存方块（每回合一次）' }
    ],

    create: function (rt) {
      var colors = rt.colors;

      var board = [];
      var bag = [];
      var queue = [];
      var current = null;
      var holdType = null;
      var holdUsed = false;

      var score = 0;
      var lines = 0;
      var level = 1;
      var combo = 0;
      var maxCombo = 0;
      var pieces = 0;

      var dropInterval = 0.85;
      var dropTimer = 0;
      var lockTimer = 0;
      var lockResets = 0;

      var clearing = false;
      var clearRows = [];
      var clearTimer = 0;

      var gameOver = false;
      var endTimer = 0;
      var ended = false;

      var shake = 0;
      var flash = 0;
      var levelFlash = 0;

      var particles = [];
      var popups = [];

      var timeAlive = 0;
      var pieceAge = 1;
      var stackTop = ROWS;
      var dasDir = 0;
      var dasTimer = 0;

      /* ---------- 数据 ---------- */
      function makeBoard() {
        var b = [];
        for (var r = 0; r < ROWS; r++) {
          var row = [];
          for (var c = 0; c < COLS; c++) row.push(null);
          b.push(row);
        }
        return b;
      }

      function refillQueue() {
        while (queue.length < 4) {
          if (!bag.length) {
            bag = TYPES.slice();
            for (var i = bag.length - 1; i > 0; i--) {
              var j = rt.randInt(0, i);
              var tmp = bag[i];
              bag[i] = bag[j];
              bag[j] = tmp;
            }
          }
          queue.push(bag.pop());
        }
      }

      function makePiece(type) {
        var b = BBOX[type];
        var x = Math.floor((COLS - b.w) / 2) - b.minX;
        var y = -b.minY;
        return { type: type, rot: 0, x: x, y: y };
      }

      function collidesAt(x, y, cells) {
        for (var i = 0; i < cells.length; i++) {
          var bx = x + cells[i][0];
          var by = y + cells[i][1];
          if (bx < 0 || bx >= COLS || by >= ROWS) return true;
          if (by >= 0 && board[by][bx]) return true;
        }
        return false;
      }

      function findFullRows() {
        var rows = [];
        for (var r = 0; r < ROWS; r++) {
          var full = true;
          for (var c = 0; c < COLS; c++) {
            if (!board[r][c]) { full = false; break; }
          }
          if (full) rows.push(r);
        }
        return rows;
      }

      function computeStackTop() {
        for (var r = 0; r < ROWS; r++) {
          for (var c = 0; c < COLS; c++) {
            if (board[r][c]) { stackTop = r; return; }
          }
        }
        stackTop = ROWS;
      }

      function ghostY(cells) {
        var y = current.y;
        while (!collidesAt(current.x, y + 1, cells)) y++;
        return y;
      }

      /* ---------- 反馈 ---------- */
      function addParticles(x, y, color, count, spread, up, size) {
        for (var i = 0; i < count; i++) {
          particles.push({
            x: x, y: y,
            vx: rt.rand(-spread, spread),
            vy: rt.rand(-up, -up * 0.25),
            g: 660,
            life: rt.rand(0.3, 0.75),
            max: 0.75,
            r: rt.rand(1.6, size || 4),
            color: color
          });
        }
        if (particles.length > 280) particles.splice(0, particles.length - 280);
      }

      function addPopup(x, y, text, color, size) {
        if (popups.length >= 10) popups.shift();
        popups.push({ x: x, y: y, text: text, color: color, size: size || 20, life: 0.95, max: 0.95 });
      }

      function syncHud() {
        rt.setHud({ 等级: level, 消行: lines, 连击: combo });
      }

      /* ---------- 流程 ---------- */
      function reset() {
        board = makeBoard();
        bag = [];
        queue = [];
        current = null;
        holdType = null;
        holdUsed = false;

        score = 0;
        lines = 0;
        level = 1;
        combo = 0;
        maxCombo = 0;
        pieces = 0;

        dropInterval = 0.85;
        dropTimer = 0;
        lockTimer = 0;
        lockResets = 0;

        clearing = false;
        clearRows = [];
        clearTimer = 0;

        gameOver = false;
        endTimer = 0;
        ended = false;

        shake = 0;
        flash = 0;
        levelFlash = 0;

        particles = [];
        popups = [];

        timeAlive = 0;
        pieceAge = 1;
        stackTop = ROWS;
        dasDir = 0;
        dasTimer = 0;

        rt.setScore(0);
        syncHud();
        rt.setStatus('← → 移动 · ↑ / X 旋转 · 空格 硬降 · C 暂存');
        spawn();
      }

      function spawn(type) {
        current = null;
        if (!type) {
          refillQueue();
          type = queue.shift();
        }
        refillQueue();
        current = makePiece(type);
        pieceAge = 0;
        lockTimer = 0;
        lockResets = 0;
        dropTimer = 0;
        dasDir = 0;
        dasTimer = 0;
        if (collidesAt(current.x, current.y, ROT[current.type][0])) {
          die();
          return;
        }
        pieces++;
      }

      function resetLock() {
        if (!current) return;
        /* 只有已经落地（lockTimer 有累计）才消耗“落地重置”次数，空中移动不浪费 */
        if (lockTimer > 0 && lockResets < 15) {
          lockTimer = 0;
          lockResets++;
        }
      }

      function die() {
        if (gameOver) return;
        gameOver = true;
        endTimer = 0;
        current = null;
        shake = 16;
        flash = 0.8;
        rt.audio.play('explode', 0.9);
        rt.setStatus('');
        for (var i = 0; i < 70; i++) {
          particles.push({
            x: BX + rt.rand(0, COLS) * CELL,
            y: BY + rt.rand(0, 6) * CELL,
            vx: rt.rand(-170, 170),
            vy: rt.rand(-300, -70),
            g: 720,
            life: rt.rand(0.4, 1.05),
            max: 1.05,
            r: rt.rand(1.8, 4.4),
            color: i % 3 === 0 ? '#fff5f5' : (i % 3 === 1 ? '#f43f5e' : '#fbbf24')
          });
        }
        if (particles.length > 280) particles.splice(0, particles.length - 280);
      }

      /* ---------- 动作 ---------- */
      function moveDx(dir) {
        if (!current) return false;
        var cells = ROT[current.type][current.rot];
        if (collidesAt(current.x + dir, current.y, cells)) return false;
        current.x += dir;
        resetLock();
        rt.audio.play('blip', 0.18);
        return true;
      }

      function rotate(dir) {
        if (!current) return false;
        var nr = (current.rot + (dir > 0 ? 1 : 3)) & 3;
        var cells = ROT[current.type][nr];
        for (var i = 0; i < KICKS.length; i++) {
          var nx = current.x + KICKS[i][0];
          var ny = current.y + KICKS[i][1];
          if (!collidesAt(nx, ny, cells)) {
            current.rot = nr;
            current.x = nx;
            current.y = ny;
            resetLock();
            rt.audio.play('flip', 0.45);
            return true;
          }
        }
        rt.audio.play('error', 0.2);
        return false;
      }

      function doHold() {
        if (!current) return;
        if (holdUsed) {
          rt.audio.play('error', 0.22);
          return;
        }
        var type = current.type;
        var swap = holdType;
        holdType = type;
        holdUsed = true;
        rt.audio.play('flip', 0.7);
        if (swap) {
          spawn(swap);
        } else {
          current = null;
          spawn();
        }
        holdUsed = true;
      }

      function hardDrop() {
        if (!current) return;
        var cells = ROT[current.type][current.rot];
        var col = SHAPE[current.type];
        var dist = 0;
        while (!collidesAt(current.x, current.y + 1, cells)) {
          current.y++;
          dist++;
        }
        if (dist > 0) {
          score += dist * 2;
          rt.setScore(score);
        }
        for (var i = 0; i < cells.length; i++) {
          var px = BX + (current.x + cells[i][0]) * CELL + CELL / 2;
          var py = BY + (current.y + cells[i][1]) * CELL + CELL;
          if (py <= BY + BH) addParticles(px, py, col.light, 2, 55, 130, 2.6);
        }
        shake = Math.min(9, 2.5 + dist * 0.45);
        rt.audio.play('hit', 0.35);
        lockPiece();
      }

      function lockPiece() {
        if (!current) return;
        var type = current.type;
        var cells = ROT[type][current.rot];
        var col = SHAPE[type];
        var topOut = false;

        for (var i = 0; i < cells.length; i++) {
          var bx = current.x + cells[i][0];
          var by = current.y + cells[i][1];
          if (by < 0) { topOut = true; continue; }
          if (by < ROWS && bx >= 0 && bx < COLS) board[by][bx] = type;
        }

        current = null;
        holdUsed = false;

        if (topOut) {
          die();
          return;
        }

        rt.audio.play('step', 0.55);

        var cleared = findFullRows();
        if (cleared.length) {
          beginClear(cleared, col);
          return;
        }
        combo = 0;
        computeStackTop();
        syncHud();
        spawn();
      }

      function beginClear(rows, col) {
        clearing = true;
        clearRows = rows;
        clearTimer = 0;

        var n = rows.length;
        combo++;
        if (combo > maxCombo) maxCombo = combo;

        var base = CLEAR_SCORE[n] * level;
        var bonus = combo > 1 ? 50 * (combo - 1) * level : 0;
        var gained = base + bonus;
        score += gained;
        lines += n;
        rt.setScore(score);

        for (var i = 0; i < rows.length; i++) {
          var ry = BY + rows[i] * CELL + CELL / 2;
          for (var k = 0; k < 12; k++) {
            particles.push({
              x: BX + rt.rand(0, COLS) * CELL,
              y: ry,
              vx: rt.rand(-175, 175),
              vy: rt.rand(-330, -60),
              g: 690,
              life: rt.rand(0.35, 0.85),
              max: 0.85,
              r: rt.rand(1.6, 4.2),
              color: k % 4 === 0 ? '#ffffff' : (k % 4 === 1 ? col.light : (k % 4 === 2 ? colors.accent : col.base))
            });
          }
        }
        if (particles.length > 280) particles.splice(0, particles.length - 280);

        if (n >= 4) rt.audio.play('explode', 0.75);
        else if (n >= 2) rt.audio.play('power', 0.6);
        else rt.audio.play('pop', 0.8);

        var midX = BX + BW / 2;
        var midY = BY + (rows[0] + rows[rows.length - 1]) * 0.5 * CELL;
        addPopup(midX, midY, '+' + gained, n >= 4 ? colors.warn : colors.accent, n >= 4 ? 30 : 22);
        if (combo > 1) addPopup(midX, midY - 32, 'COMBO ×' + combo, colors.accent2, 17);

        var newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
          level = newLevel;
          dropInterval = Math.max(0.075, 0.85 - (level - 1) * 0.072);
          levelFlash = 1;
          rt.audio.play('level', 0.75);
          addPopup(midX, BY + 74, 'LEVEL ' + level, colors.accent2, 24);
        }

        computeStackTop();
        syncHud();
      }

      function applyClear() {
        var rows = clearRows;
        var kept = [];
        for (var r = 0; r < ROWS; r++) {
          if (rows.indexOf(r) === -1) kept.push(board[r]);
        }
        while (kept.length < ROWS) {
          var row = [];
          for (var c = 0; c < COLS; c++) row.push(null);
          kept.unshift(row);
        }
        board = kept;
        clearing = false;
        clearRows = [];
        clearTimer = 0;
        computeStackTop();
        spawn();
      }

      function handleInput(dt) {
        if (rt.wasPressed('KeyC') || rt.wasPressed('ShiftLeft') || rt.wasPressed('ShiftRight')) {
          doHold();
          if (!current) return;
        }

        if (rt.wasPressed('ArrowUp') || rt.wasPressed('KeyX') || rt.wasPressed('KeyW')) {
          rotate(1);
        } else if (rt.wasPressed('KeyZ')) {
          rotate(-1);
        }
        if (!current) return;

        if (rt.wasPressed('Space')) {
          hardDrop();
          return;
        }

        dasTimer -= dt;
        var left = rt.keys.has('ArrowLeft') || rt.keys.has('KeyA');
        var right = rt.keys.has('ArrowRight') || rt.keys.has('KeyD');
        if (left && !right) {
          if (dasDir !== -1) {
            dasDir = -1;
            dasTimer = 0.15;
            moveDx(-1);
          } else if (dasTimer <= 0) {
            dasTimer = moveDx(-1) ? 0.042 : 0.025;
          }
        } else if (right && !left) {
          if (dasDir !== 1) {
            dasDir = 1;
            dasTimer = 0.15;
            moveDx(1);
          } else if (dasTimer <= 0) {
            dasTimer = moveDx(1) ? 0.042 : 0.025;
          }
        } else {
          dasDir = 0;
          dasTimer = 0;
        }
      }

      /* ---------- 初始化 ---------- */
      reset();

      return {
        update: function (dt) {
          /* 引擎在 create 之后会清空一次 status，这里在第一帧补上操作提示 */
          if (rt.frame <= 1) rt.setStatus('← → 移动 · ↑ / X 旋转 · 空格 硬降 · C 暂存');
          timeAlive += dt;
          if (shake > 0) shake = Math.max(0, shake - dt * 36);
          if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
          if (levelFlash > 0) levelFlash = Math.max(0, levelFlash - dt * 2);
          if (pieceAge < 1) pieceAge = Math.min(1, pieceAge + dt * 9);

          var i, p;
          for (i = particles.length - 1; i >= 0; i--) {
            p = particles[i];
            p.life -= dt;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            p.vy += p.g * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.99;
          }
          for (i = popups.length - 1; i >= 0; i--) {
            p = popups[i];
            p.life -= dt;
            p.y -= 30 * dt;
            if (p.life <= 0) popups.splice(i, 1);
          }

          if (gameOver) {
            endTimer += dt;
            if (endTimer > 0.95 && !ended) {
              ended = true;
              rt.end({
                score: score,
                message: '止步第 ' + level + ' 级，共消除 ' + lines + ' 行',
                stats: [
                  { label: '到达等级', value: level },
                  { label: '消除行数', value: lines },
                  { label: '最高连击', value: maxCombo },
                  { label: '放置方块', value: pieces },
                  { label: '本局用时', value: timeAlive.toFixed(1) + 's' },
                  { label: '历史最高', value: Math.max(rt.best, score) }
                ]
              });
            }
            return;
          }

          if (clearing) {
            clearTimer += dt;
            if (clearTimer >= CLEAR_TIME) applyClear();
            return;
          }

          if (!current) return;

          handleInput(dt);
          if (!current || gameOver || clearing) return;

          var cells = ROT[current.type][current.rot];
          var soft = rt.keys.has('ArrowDown') || rt.keys.has('KeyS');

          if (collidesAt(current.x, current.y + 1, cells)) {
            lockTimer += dt;
            if (lockTimer >= LOCK_DELAY) lockPiece();
            return;
          }

          lockTimer = 0;
          dropTimer += dt * (soft ? 12 : 1);
          var steps = 0;
          var guard = 0;
          while (dropTimer >= dropInterval && guard++ < 10) {
            dropTimer -= dropInterval;
            if (collidesAt(current.x, current.y + 1, cells)) {
              dropTimer = 0;
              break;
            }
            current.y++;
            steps++;
          }
          if (steps > 0 && soft) {
            score += steps;
            rt.setScore(score);
          }
        },

        render: function (c) {
          var t = rt.time;
          var sx = shake > 0 ? rt.rand(-shake, shake) : 0;
          var sy = shake > 0 ? rt.rand(-shake, shake) : 0;

          c.save();
          c.translate(sx, sy);

          /* 背景 */
          var bg = c.createLinearGradient(0, 0, 540, 720);
          bg.addColorStop(0, '#080d1c');
          bg.addColorStop(0.5, '#0a1226');
          bg.addColorStop(1, '#070a17');
          c.fillStyle = bg;
          c.fillRect(-30, -30, 600, 780);

          c.strokeStyle = 'rgba(70, 100, 170, 0.055)';
          c.lineWidth = 1;
          c.beginPath();
          for (var gx = 0; gx <= 540; gx += 40) {
            c.moveTo(gx + 0.5, -30);
            c.lineTo(gx + 0.5, 750);
          }
          for (var gy = 0; gy <= 720; gy += 40) {
            c.moveTo(-30, gy + 0.5);
            c.lineTo(570, gy + 0.5);
          }
          c.stroke();

          /* 顶部标题 */
          c.textAlign = 'left';
          c.font = '900 24px "Consolas", monospace';
          c.fillStyle = colors.accent;
          c.shadowColor = colors.accent;
          c.shadowBlur = 18;
          c.fillText('TETRIS', BX, 44);
          c.shadowBlur = 0;
          c.font = '600 12px "PingFang SC", "Microsoft YaHei", sans-serif';
          c.fillStyle = 'rgba(139, 149, 181, 0.92)';
          c.fillText('俄罗斯方块 · 10 × 20', BX + 1, 64);

          c.textAlign = 'right';
          c.font = '700 10px "Consolas", monospace';
          c.fillStyle = 'rgba(139, 149, 181, 0.85)';
          c.fillText('BEST', PANEL_X + PANEL_W, 32);
          c.font = '900 20px "Consolas", monospace';
          c.fillStyle = colors.warn;
          c.fillText(String(rt.best), PANEL_X + PANEL_W, 56);

          c.strokeStyle = 'rgba(34, 211, 238, 0.16)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(BX, 76);
          c.lineTo(PANEL_X + PANEL_W, 76);
          c.stroke();

          var danger = stackTop <= 5 && !clearing && !gameOver;

          /* 井背景 */
          c.fillStyle = 'rgba(5, 9, 20, 0.94)';
          roundRect(c, BX - 6, BY - 6, BW + 12, BH + 12, 12);
          c.fill();
          c.fillStyle = '#070b18';
          c.fillRect(BX, BY, BW, BH);

          c.strokeStyle = 'rgba(90, 120, 190, 0.10)';
          c.lineWidth = 1;
          c.beginPath();
          for (var gc = 1; gc < COLS; gc++) {
            c.moveTo(BX + gc * CELL + 0.5, BY);
            c.lineTo(BX + gc * CELL + 0.5, BY + BH);
          }
          for (var gr = 1; gr < ROWS; gr++) {
            c.moveTo(BX, BY + gr * CELL + 0.5);
            c.lineTo(BX + BW, BY + gr * CELL + 0.5);
          }
          c.stroke();

          if (danger) {
            c.fillStyle = 'rgba(244, 63, 94, ' + (0.05 + 0.035 * Math.sin(t * 7)).toFixed(3) + ')';
            c.fillRect(BX, BY, BW, 3 * CELL);
          }

          /* 井内内容（裁剪） */
          c.save();
          c.beginPath();
          c.rect(BX, BY, BW, BH);
          c.clip();

          for (var r = 0; r < ROWS; r++) {
            for (var cc = 0; cc < COLS; cc++) {
              var cellType = board[r][cc];
              if (cellType) drawBlock(c, BX + cc * CELL, BY + r * CELL, CELL, SHAPE[cellType]);
            }
          }

          if (clearing) {
            var prog = clearTimer / CLEAR_TIME;
            var alpha = Math.min(1, clearTimer * 10) * (1 - Math.max(0, (prog - 0.45)) / 0.55);
            if (alpha < 0) alpha = 0;
            for (var ci = 0; ci < clearRows.length; ci++) {
              var ry = BY + clearRows[ci] * CELL;
              c.globalAlpha = alpha * 0.9;
              c.fillStyle = '#ffffff';
              c.fillRect(BX, ry, BW, CELL);
              c.globalAlpha = alpha * 0.55;
              c.fillStyle = colors.accent;
              var inset = (1 - alpha) * BW * 0.28;
              c.fillRect(BX + inset, ry + 7, BW - inset * 2, CELL - 14);
            }
            c.globalAlpha = 1;
          }

          if (current) {
            var cells = ROT[current.type][current.rot];
            var col = SHAPE[current.type];

            var gy = ghostY(cells);
            if (gy !== current.y) {
              c.globalAlpha = 0.16 + 0.07 * Math.sin(t * 5);
              c.fillStyle = col.base;
              for (var gi = 0; gi < cells.length; gi++) {
                c.fillRect(BX + (current.x + cells[gi][0]) * CELL + 3, BY + (gy + cells[gi][1]) * CELL + 3, CELL - 6, CELL - 6);
              }
              c.globalAlpha = 0.5;
              c.strokeStyle = col.base;
              c.lineWidth = 1.6;
              for (var gj = 0; gj < cells.length; gj++) {
                c.strokeRect(BX + (current.x + cells[gj][0]) * CELL + 2.5, BY + (gy + cells[gj][1]) * CELL + 2.5, CELL - 5, CELL - 5);
              }
              c.globalAlpha = 1;
            }

            /* 下落拖尾 */
            for (var k = 1; k <= 3; k++) {
              c.globalAlpha = 0.13 / k;
              c.fillStyle = col.base;
              for (var ti = 0; ti < cells.length; ti++) {
                c.fillRect(BX + (current.x + cells[ti][0]) * CELL + 4, BY + (current.y + cells[ti][1]) * CELL - k * 9 + 4, CELL - 8, CELL - 8);
              }
            }
            c.globalAlpha = 1;

            var a = 0.35 + 0.65 * pieceAge;
            c.globalAlpha = a;
            c.shadowColor = col.base;
            c.shadowBlur = 14;
            for (var bi = 0; bi < cells.length; bi++) {
              drawBlock(c, BX + (current.x + cells[bi][0]) * CELL, BY + (current.y + cells[bi][1]) * CELL, CELL, col);
            }
            c.shadowBlur = 0;
            c.globalAlpha = 1;
          }

          c.restore();

          /* 井边框 */
          c.save();
          c.shadowColor = danger ? '#f43f5e' : colors.accent;
          c.shadowBlur = 18;
          c.strokeStyle = danger
            ? 'rgba(244, 63, 94, ' + (0.5 + 0.3 * Math.sin(t * 7)).toFixed(3) + ')'
            : (levelFlash > 0 ? 'rgba(59, 130, 246, ' + (0.55 + levelFlash * 0.4).toFixed(3) + ')' : 'rgba(34, 211, 238, 0.5)');
          c.lineWidth = 2;
          roundRect(c, BX - 6, BY - 6, BW + 12, BH + 12, 12);
          c.stroke();
          c.restore();

          /* 粒子 */
          for (var pi = 0; pi < particles.length; pi++) {
            var pt = particles[pi];
            c.globalAlpha = Math.max(0, pt.life / pt.max);
            c.fillStyle = pt.color;
            c.beginPath();
            c.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
            c.fill();
          }
          c.globalAlpha = 1;

          /* 右侧面板 */
          c.fillStyle = 'rgba(16, 22, 42, 0.78)';
          roundRect(c, PANEL_X, 88, PANEL_W, 86, 10);
          c.fill();
          c.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          c.lineWidth = 1;
          c.stroke();

          c.textAlign = 'left';
          c.font = '700 10px "Consolas", monospace';
          c.fillStyle = 'rgba(139, 149, 181, 0.9)';
          c.fillText('HOLD', PANEL_X + 12, 106);

          if (holdType) {
            c.globalAlpha = holdUsed ? 0.4 : 1;
            drawMiniPiece(c, holdType, PANEL_X + PANEL_W / 2, 138, 17);
            c.globalAlpha = 1;
          } else {
            c.textAlign = 'center';
            c.font = '600 11px "PingFang SC", "Microsoft YaHei", sans-serif';
            c.fillStyle = 'rgba(139, 149, 181, 0.45)';
            c.fillText('按 C 暂存', PANEL_X + PANEL_W / 2, 140);
          }

          c.textAlign = 'left';
          c.font = '700 10px "Consolas", monospace';
          c.fillStyle = 'rgba(139, 149, 181, 0.9)';
          c.fillText('NEXT', PANEL_X + 12, 196);

          c.fillStyle = 'rgba(16, 22, 42, 0.78)';
          roundRect(c, PANEL_X, 206, PANEL_W, 204, 10);
          c.fill();
          c.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          c.stroke();

          for (var ni = 0; ni < 3; ni++) {
            var nt = queue[ni];
            if (!nt) continue;
            var slotY = 240 + ni * 68;
            drawMiniPiece(c, nt, PANEL_X + PANEL_W / 2, slotY, 16);
            if (ni < 2) {
              c.strokeStyle = 'rgba(90, 120, 190, 0.12)';
              c.beginPath();
              c.moveTo(PANEL_X + 16, slotY + 34);
              c.lineTo(PANEL_X + PANEL_W - 16, slotY + 34);
              c.stroke();
            }
          }

          /* 数据 */
          c.fillStyle = 'rgba(16, 22, 42, 0.78)';
          roundRect(c, PANEL_X, 424, PANEL_W, 120, 10);
          c.fill();
          c.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          c.stroke();

          var statRows = [
            { label: 'LEVEL', value: String(level), color: colors.accent },
            { label: 'LINES', value: String(lines), color: colors.success },
            { label: 'COMBO', value: String(combo), color: colors.warn }
          ];
          for (var si = 0; si < statRows.length; si++) {
            var ry2 = 450 + si * 34;
            c.textAlign = 'left';
            c.font = '700 10px "Consolas", monospace';
            c.fillStyle = 'rgba(139, 149, 181, 0.9)';
            c.fillText(statRows[si].label, PANEL_X + 12, ry2);
            c.textAlign = 'right';
            c.font = '900 20px "Consolas", monospace';
            c.fillStyle = statRows[si].color;
            c.fillText(statRows[si].value, PANEL_X + PANEL_W - 12, ry2 + 2);
          }

          /* 操作提示 */
          var hints = ['← →  移动', '↑ / X 顺旋   Z 逆旋', '↓  软降   空格  硬降', 'C / Shift  暂存'];
          c.textAlign = 'left';
          c.font = '600 11px "PingFang SC", "Microsoft YaHei", sans-serif';
          c.fillStyle = 'rgba(139, 149, 181, 0.55)';
          for (var hi = 0; hi < hints.length; hi++) {
            c.fillText(hints[hi], PANEL_X, 578 + hi * 22);
          }

          /* 飘字 */
          c.textAlign = 'center';
          for (var qi = 0; qi < popups.length; qi++) {
            var pp = popups[qi];
            c.globalAlpha = Math.max(0, pp.life / pp.max);
            c.font = '900 ' + pp.size + 'px "Consolas", monospace';
            c.fillStyle = pp.color;
            c.fillText(pp.text, pp.x, pp.y);
          }
          c.globalAlpha = 1;

          /* 爆炸闪白 */
          if (flash > 0) {
            c.fillStyle = 'rgba(244, 63, 94, ' + (flash * 0.38).toFixed(3) + ')';
            c.fillRect(-30, -30, 600, 780);
          }

          /* Game Over 动画层 */
          if (gameOver) {
            var k = Math.min(1, endTimer / 0.5);
            c.fillStyle = 'rgba(5, 7, 15, ' + (0.38 * k).toFixed(3) + ')';
            c.fillRect(-30, -30, 600, 780);
            c.save();
            c.translate(270, 360);
            var sc = 1 + (1 - k) * 0.35;
            c.scale(sc, sc);
            c.textAlign = 'center';
            c.font = '900 34px "Consolas", monospace';
            c.fillStyle = '#f43f5e';
            c.shadowColor = '#f43f5e';
            c.shadowBlur = 26;
            c.fillText('GAME OVER', 0, 0);
            c.shadowBlur = 0;
            c.font = '600 15px "PingFang SC", "Microsoft YaHei", sans-serif';
            c.fillStyle = 'rgba(232, 236, 255, 0.85)';
            c.fillText('等级 ' + level + ' · 消除 ' + lines + ' 行', 0, 34);
            c.restore();
          }

          c.restore();
        }
      };
    }
  });
})();
