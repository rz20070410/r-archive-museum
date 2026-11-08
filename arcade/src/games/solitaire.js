/* 游戏：纸牌接龙（Klondike，抽 1 张） */
(function () {
  'use strict';

  var SUITS = ['\u2660', '\u2665', '\u2666', '\u2663']; /* ♠ ♥ ♦ ♣ */
  var RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var RED = [false, true, true, false];
  var NEON = ['#60a5fa', '#fb7185', '#f472b6', '#93c5fd'];
  var INK = ['#1e293b', '#be123c', '#be123c', '#1e293b'];
  var FONT_CN = '"PingFang SC", "Microsoft YaHei", sans-serif';
  var FONT_MONO = '"Consolas", monospace';

  function roundRectPath(ctx, x, y, w, h, r) {
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

  function fmtTime(sec) {
    var s = Math.floor(sec);
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  Arcade.register({
    id: 'solitaire',
    title: '纸牌接龙',
    subtitle: '经典纸牌，闲来一局',
    description: '经典 Klondike 单人纸牌：把同花色从 A 到 K 收进四个目标堆。红黑交替、递减排列，抽 1 张模式，双击自动收牌。',
    icon: '🎴',
    accent: '#60a5fa',
    accent2: '#1d4ed8',
    tags: ['卡牌', '经典'],
    difficulty: '中等',
    width: 900,
    height: 700,
    order: 65,
    tips: '先把 A 收进目标堆，空列留给 K 能腾出大空间。',
    controls: [
      { keys: '鼠标左键 / 点击', action: '抽牌 / 选牌' },
      { keys: '拖拽', action: '拖动牌组' },
      { keys: '双击', action: '自动收牌' },
      { keys: 'Z', action: '撤销一步' }
    ],

    create: function (rt) {
      var W = rt.width;
      var H = rt.height;

      /* ---------- 布局（基于 rt.width / rt.height） ---------- */
      var MARGIN_X = Math.round(W * 0.04);
      var GAP = Math.round(W * 0.0133);
      var CARD_W = Math.floor((W - MARGIN_X * 2 - GAP * 6) / 7);
      var CARD_H = Math.round(CARD_W * 1.42);
      var X0 = Math.round((W - (CARD_W * 7 + GAP * 6)) / 2);
      var TOP_Y = Math.round(H * 0.04);
      var FOUND_X = W - MARGIN_X - (CARD_W * 4 + GAP * 3);
      var WASTE_X = X0 + CARD_W + GAP;
      var TABLEAU_Y = TOP_Y + CARD_H + Math.round(H * 0.045);
      var BOTTOM = H - 28;
      var UP_OFFSET = Math.round(CARD_H * 0.21);
      var DOWN_OFFSET = Math.round(CARD_H * 0.125);
      var DRAG_OFFSET = Math.round(CARD_H * 0.18);
      var WASTE_FAN = 8;
      var CARD_R = Math.round(CARD_W * 0.08);

      /* ---------- 状态（全部在 create 闭包内） ---------- */
      var tableau = [[], [], [], [], [], [], []];
      var foundations = [[], [], [], []];
      var stock = [];
      var waste = [];
      var moves = 0;
      var elapsed = 0;
      var lastSec = -1;
      var won = false;
      var ended = false;
      var endTimer = 0;
      var flash = 0;
      var selected = null;
      var drag = null;
      var history = [];
      var particles = [];
      var floats = [];
      var hover = null;
      var pointer = { x: -100, y: -100 };
      var pointerIsTouch = false;
      var downConsumed = false;
      var lastTapKey = '';
      var lastTapTime = -10;
      var hudKey = '';
      var hudInited = false;
      var lastScore = -1;
      var faceGrad = null;
      var backGrad = null;

      /* 每列纵向位置缓存，避免每帧新建数组 */
      var colPos = [[], [], [], [], [], [], []];

      var undoBtn = { id: 'undo', x: 288, y: 40, w: 100, h: 34, label: '撤销' };
      var newBtn = { id: 'new', x: 288, y: 82, w: 100, h: 34, label: '新局' };
      var buttons = [undoBtn, newBtn];
      var centerInfoX = Math.round((WASTE_X + CARD_W + WASTE_FAN * 2 + FOUND_X) / 2);

      function colX(c) { return X0 + c * (CARD_W + GAP); }
      function foundationX(i) { return FOUND_X + i * (CARD_W + GAP); }
      function wasteTopX() { return WASTE_X + Math.min(Math.max(waste.length - 1, 0), 2) * WASTE_FAN; }

      function layoutColumn(col) {
        var arr = tableau[col];
        var n = arr.length;
        var pos = colPos[col];
        pos.length = 0;
        var y = TABLEAU_Y;
        var i;
        for (i = 0; i < n; i++) {
          pos.push(y);
          y += arr[i].up ? UP_OFFSET : DOWN_OFFSET;
        }
        if (n > 0) {
          var last = pos[n - 1];
          var maxTop = BOTTOM - CARD_H;
          if (last > maxTop && last > TABLEAU_Y) {
            var k = (maxTop - TABLEAU_Y) / (last - TABLEAU_Y);
            if (k < 1) {
              var yy = TABLEAU_Y;
              for (i = 0; i < n; i++) {
                pos[i] = yy;
                if (i < n - 1) yy += (arr[i].up ? UP_OFFSET : DOWN_OFFSET) * k;
              }
            }
          }
        }
        return pos;
      }

      /* ---------- 牌组 / 新局 ---------- */
      function buildDeck() {
        var deck = [];
        var s, r, i;
        for (s = 0; s < 4; s++) {
          for (r = 1; r <= 13; r++) deck.push({ s: s, r: r, up: false });
        }
        for (i = deck.length - 1; i > 0; i--) {
          var j = rt.randInt(0, i);
          var tmp = deck[i];
          deck[i] = deck[j];
          deck[j] = tmp;
        }
        return deck;
      }

      function newGame() {
        tableau = [[], [], [], [], [], [], []];
        foundations = [[], [], [], []];
        stock = [];
        waste = [];
        var deck = buildDeck();
        var col, k, c;
        for (col = 0; col < 7; col++) {
          for (k = 0; k <= col; k++) {
            c = deck.pop();
            c.up = (k === col);
            tableau[col].push(c);
          }
        }
        while (deck.length) {
          c = deck.pop();
          c.up = false;
          stock.push(c);
        }
        moves = 0;
        elapsed = 0;
        lastSec = -1;
        won = false;
        ended = false;
        endTimer = 0;
        flash = 0;
        selected = null;
        drag = null;
        history = [];
        particles = [];
        floats = [];
        hover = null;
        pointerIsTouch = false;
        lastTapKey = '';
        lastTapTime = -10;
        hudKey = '';
        hudInited = false;
        lastScore = -1;
        rt.setScore(0);
        rt.setHud({ '步数': 0, '时间': '00:00' });
        rt.setStatus('点击牌库抽牌 · 拖拽或点选移动 · 双击自动收牌');
        refreshHud(true);
      }

      /* ---------- 规则 ---------- */
      function canPlaceOnTableau(card, col) {
        var arr = tableau[col];
        if (!arr.length) return card.r === 13;
        var top = arr[arr.length - 1];
        return top.up && RED[top.s] !== RED[card.s] && top.r === card.r + 1;
      }

      function canPlaceOnFoundation(card, idx) {
        if (card.s !== idx) return false;
        var arr = foundations[idx];
        if (!arr.length) return card.r === 1;
        return arr[arr.length - 1].r + 1 === card.r;
      }

      function validStackFrom(col, index) {
        var arr = tableau[col];
        if (index < 0 || index >= arr.length) return [];
        var out = [];
        for (var i = index; i < arr.length; i++) {
          if (!arr[i].up) return [];
          if (i > index) {
            var prev = arr[i - 1];
            var cur = arr[i];
            if (prev.r !== cur.r + 1 || RED[prev.s] === RED[cur.s]) return [];
          }
          out.push(arr[i]);
        }
        return out;
      }

      function foundationCount() {
        return foundations[0].length + foundations[1].length + foundations[2].length + foundations[3].length;
      }

      function computeScore(winBonus) {
        var s = 200 + foundationCount() * 20 - moves * 2 - Math.floor(elapsed / 10) * 5 + (winBonus ? 200 : 0);
        return Math.max(0, Math.round(s));
      }

      function refreshHud(force) {
        var sec = Math.floor(elapsed);
        var score = computeScore(false);
        var key = moves + '|' + sec + '|' + score + '|' + foundationCount();
        if (force) hudKey = '';
        if (key === hudKey) return;
        hudKey = key;
        rt.setHud({ '步数': moves, '时间': fmtTime(elapsed) });
        if (score !== lastScore) {
          lastScore = score;
          rt.setScore(score);
        }
      }

      function checkWin() {
        if (won || ended) return;
        if (foundationCount() !== 52) return;
        won = true;
        endTimer = 1.1;
        flash = 0.85;
        selected = null;
        drag = null;
        Arcade.audio.play('level', 0.85);
        spawnWinParticles();
        rt.setStatus('全部归位！');
        refreshHud(true);
      }

      /* ---------- 计分 / 提示 ---------- */
      function addFloat(x, y, text, color) {
        if (floats.length > 8) floats.shift();
        floats.push({ x: x, y: y, text: text, color: color, life: 0.8, max: 0.8 });
      }

      function spawnWinParticles() {
        var f, i;
        for (f = 0; f < 4; f++) {
          for (i = 0; i < 30; i++) {
            var a = rt.rand(0, Math.PI * 2);
            var sp = rt.rand(40, 190);
            particles.push({
              x: foundationX(f) + CARD_W / 2,
              y: TOP_Y + CARD_H / 2,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp - 90,
              life: rt.rand(0.5, 1.3),
              max: 1.3,
              r: rt.rand(1.6, 3.8),
              color: rt.pick(['#93c5fd', '#60a5fa', '#fbbf24', '#f472b6', '#e2e8f0']),
              g: 120
            });
          }
        }
        if (particles.length > 200) particles.splice(0, particles.length - 200);
      }

      function spawnMoveSparks(x, y) {
        for (var i = 0; i < 6; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(20, 90);
          particles.push({
            x: x, y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 40,
            life: rt.rand(0.3, 0.6),
            max: 0.6,
            r: rt.rand(1.2, 2.6),
            color: rt.pick(['#93c5fd', '#e2e8f0']),
            g: 160
          });
        }
        if (particles.length > 200) particles.splice(0, particles.length - 200);
      }

      /* ---------- 历史 / 撤销 ---------- */
      function sourceArrayFor(kind, idx) {
        if (kind === 'tableau') return tableau[idx];
        if (kind === 'waste') return waste;
        return foundations[idx];
      }

      function undo() {
        if (won || ended) return;
        if (!history.length) {
          Arcade.audio.play('error', 0.4);
          rt.setStatus('还没有可以撤销的操作');
          return;
        }
        var h = history.pop();
        var toArr, fromArr, i;
        if (h.type === 'move') {
          toArr = h.toKind === 'tableau' ? tableau[h.toIdx] : foundations[h.toIdx];
          fromArr = sourceArrayFor(h.fromKind, h.fromIdx);
          for (i = 0; i < h.count; i++) {
            if (toArr.length) fromArr.push(toArr.pop());
          }
          if (h.flipCol >= 0) {
            var colArr = tableau[h.flipCol];
            var backIdx = colArr.length - 1 - h.count;
            if (backIdx >= 0 && backIdx < colArr.length) colArr[backIdx].up = false;
          }
        } else if (h.type === 'draw') {
          if (waste.length) {
            var c1 = waste.pop();
            c1.up = false;
            stock.push(c1);
          }
        } else if (h.type === 'recycle') {
          for (i = 0; i < h.count; i++) {
            if (stock.length) {
              var c2 = stock.pop();
              c2.up = true;
              waste.push(c2);
            }
          }
        } else if (h.type === 'flip') {
          var colArr2 = tableau[h.col];
          if (colArr2.length && colArr2[colArr2.length - 1].up) {
            colArr2[colArr2.length - 1].up = false;
          }
        }
        moves = h.movesBefore;
        selected = null;
        drag = null;
        lastTapKey = '';
        lastTapTime = -10;
        refreshHud(true);
        rt.setStatus('已撤销一步');
        Arcade.audio.play('click', 0.5);
      }

      /* ---------- 动作 ---------- */
      function drawStock() {
        if (won || ended) return;
        if (stock.length) {
          var card = stock.pop();
          card.up = true;
          card.flipAt = rt.time;
          waste.push(card);
          moves++;
          history.push({ type: 'draw', movesBefore: moves - 1 });
          Arcade.audio.play('flip', 0.5);
          selected = null;
          refreshHud(true);
        } else if (waste.length) {
          var n = waste.length;
          for (var i = waste.length - 1; i >= 0; i--) {
            var c = waste[i];
            c.up = false;
            stock.push(c);
          }
          waste = [];
          moves++;
          history.push({ type: 'recycle', count: n, movesBefore: moves - 1 });
          Arcade.audio.play('flip', 0.55);
          rt.setStatus('弃牌已重新洗回牌库');
          selected = null;
          refreshHud(true);
        } else {
          Arcade.audio.play('error', 0.4);
        }
      }

      function flipTableauTop(col) {
        if (won || ended) return;
        var arr = tableau[col];
        if (!arr.length) return;
        var card = arr[arr.length - 1];
        if (card.up) return;
        card.up = true;
        card.flipAt = rt.time;
        moves++;
        history.push({ type: 'flip', col: col, movesBefore: moves - 1 });
        Arcade.audio.play('flip', 0.4);
        refreshHud(true);
      }

      function executeMove(fromKind, fromIdx, fromIndex, toKind, toIdx) {
        if (won || ended) return false;
        var srcArr = sourceArrayFor(fromKind, fromIdx);
        if (!srcArr) return false;
        var start = fromKind === 'tableau' ? fromIndex : srcArr.length - 1;
        if (start < 0 || start >= srcArr.length) return false;
        var count = srcArr.length - start;
        var dstArr = toKind === 'tableau' ? tableau[toIdx] : foundations[toIdx];
        var cards = srcArr.splice(start, count);
        var i;
        for (i = 0; i < cards.length; i++) {
          cards[i].up = true;
          dstArr.push(cards[i]);
        }
        var mb = moves;
        moves++;
        var flipCol = -1;
        if (fromKind === 'tableau') {
          var fromCol = tableau[fromIdx];
          if (fromCol.length && !fromCol[fromCol.length - 1].up) {
            fromCol[fromCol.length - 1].up = true;
            fromCol[fromCol.length - 1].flipAt = rt.time;
            flipCol = fromIdx;
            Arcade.audio.play('flip', 0.32);
          }
        }
        if (toKind === 'foundation') {
          Arcade.audio.play('score', 0.45);
          addFloat(foundationX(toIdx) + CARD_W / 2, TOP_Y + CARD_H * 0.35, '+20', '#93c5fd');
          spawnMoveSparks(foundationX(toIdx) + CARD_W / 2, TOP_Y + CARD_H / 2);
        } else {
          Arcade.audio.play('pop', 0.32);
        }
        history.push({
          type: 'move',
          fromKind: fromKind, fromIdx: fromIdx,
          toKind: toKind, toIdx: toIdx,
          count: count, flipCol: flipCol, movesBefore: mb
        });
        selected = null;
        refreshHud(true);
        checkWin();
        return true;
      }

      /* ---------- 点击 / 选框 ---------- */
      function selectedCards(src) {
        if (!src) return [];
        if (src.kind === 'tableau') return tableau[src.col].slice(src.index);
        if (src.kind === 'waste') return waste.length ? [waste[waste.length - 1]] : [];
        if (src.kind === 'foundation') {
          var arr = foundations[src.idx];
          return arr.length ? [arr[arr.length - 1]] : [];
        }
        return [];
      }

      function tryMoveSelectedTo(hit) {
        if (!selected) return false;
        var cards = selectedCards(selected);
        if (!cards.length) return false;
        var card = cards[0];
        if (hit.kind === 'foundation') {
          if (cards.length !== 1) return false;
          if (selected.kind === 'foundation' && selected.idx === hit.idx) return false;
          if (!canPlaceOnFoundation(card, hit.idx)) return false;
          if (selected.kind === 'tableau') return executeMove('tableau', selected.col, selected.index, 'foundation', hit.idx);
          if (selected.kind === 'waste') return executeMove('waste', -1, -1, 'foundation', hit.idx);
          return executeMove('foundation', selected.idx, -1, 'foundation', hit.idx);
        }
        if (hit.kind === 'tableau') {
          if (selected.kind === 'tableau' && selected.col === hit.col) return false;
          if (!canPlaceOnTableau(card, hit.col)) return false;
          if (selected.kind === 'tableau') return executeMove('tableau', selected.col, selected.index, 'tableau', hit.col);
          if (selected.kind === 'waste') return executeMove('waste', -1, -1, 'tableau', hit.col);
          return executeMove('foundation', selected.idx, -1, 'tableau', hit.col);
        }
        return false;
      }

      function tryAutoFoundation(kind, idx, cardIndex) {
        var card;
        if (kind === 'tableau') {
          var arr = tableau[idx];
          if (!arr.length || cardIndex !== arr.length - 1) return false;
          card = arr[arr.length - 1];
          if (!card.up) return false;
          if (!canPlaceOnFoundation(card, card.s)) return false;
          return executeMove('tableau', idx, cardIndex, 'foundation', card.s);
        }
        if (kind === 'waste') {
          if (!waste.length) return false;
          card = waste[waste.length - 1];
          if (!canPlaceOnFoundation(card, card.s)) return false;
          return executeMove('waste', -1, -1, 'foundation', card.s);
        }
        return false;
      }

      function selectFromHit(hit) {
        selected = null;
        if (!hit) return;
        if (hit.kind === 'tableau') {
          if (hit.cardIndex < 0) return;
          var arr = tableau[hit.col];
          var card = arr[hit.cardIndex];
          if (!card.up) {
            if (hit.cardIndex === arr.length - 1) flipTableauTop(hit.col);
            return;
          }
          selected = { kind: 'tableau', col: hit.col, index: hit.cardIndex };
          Arcade.audio.play('click', 0.3);
        } else if (hit.kind === 'waste' && waste.length) {
          selected = { kind: 'waste' };
          Arcade.audio.play('click', 0.3);
        } else if (hit.kind === 'foundation' && foundations[hit.idx].length) {
          selected = { kind: 'foundation', idx: hit.idx };
          Arcade.audio.play('click', 0.3);
        }
      }

      function tapKeyOf(hit) {
        if (hit.kind === 'stock') return 'stock';
        if (hit.kind === 'waste') return 'waste';
        if (hit.kind === 'foundation') return 'f' + hit.idx;
        return 't' + hit.col + ':' + hit.cardIndex;
      }

      function handleTap(x, y) {
        if (won || ended) return;
        var hit = hitTest(x, y);
        if (!hit) {
          selected = null;
          return;
        }
        if (hit.kind === 'stock') {
          drawStock();
          return;
        }
        var now = rt.time;
        var key = tapKeyOf(hit);
        var isDouble = key === lastTapKey && now - lastTapTime < 0.34;
        if (isDouble) {
          lastTapKey = '';
          lastTapTime = -10;
          if (hit.kind === 'tableau' && hit.cardIndex >= 0) {
            if (tryAutoFoundation('tableau', hit.col, hit.cardIndex)) return;
          } else if (hit.kind === 'waste') {
            if (tryAutoFoundation('waste', -1, -1)) return;
          }
        } else {
          lastTapKey = key;
          lastTapTime = now;
        }
        if (selected) {
          if (tryMoveSelectedTo(hit)) return;
        }
        selectFromHit(hit);
      }

      /* ---------- 命中测试 ---------- */
      function hitTest(x, y) {
        if (x >= X0 && x <= X0 + CARD_W && y >= TOP_Y && y <= TOP_Y + CARD_H) {
          return { kind: 'stock' };
        }
        var wx = waste.length ? wasteTopX() : WASTE_X;
        if (x >= wx && x <= wx + CARD_W && y >= TOP_Y && y <= TOP_Y + CARD_H) {
          return { kind: 'waste' };
        }
        var f;
        for (f = 0; f < 4; f++) {
          var fx = foundationX(f);
          if (x >= fx && x <= fx + CARD_W && y >= TOP_Y && y <= TOP_Y + CARD_H) {
            return { kind: 'foundation', idx: f };
          }
        }
        if (y >= TABLEAU_Y - 8 && y <= BOTTOM + 10) {
          var c;
          for (c = 0; c < 7; c++) {
            var cx = colX(c);
            if (x < cx || x > cx + CARD_W) continue;
            var arr = tableau[c];
            var pos = layoutColumn(c);
            if (!arr.length) return { kind: 'tableau', col: c, cardIndex: -1 };
            for (var i = arr.length - 1; i >= 0; i--) {
              var top = pos[i];
              var bottom = (i < arr.length - 1) ? pos[i + 1] : pos[i] + CARD_H;
              if (y >= top && y <= bottom) return { kind: 'tableau', col: c, cardIndex: i };
            }
            return { kind: 'tableau', col: c, cardIndex: -1 };
          }
        }
        return null;
      }

      function dragTargetAt(x, y) {
        var f;
        for (f = 0; f < 4; f++) {
          var fx = foundationX(f);
          if (x >= fx - 6 && x <= fx + CARD_W + 6 && y >= TOP_Y - 8 && y <= TOP_Y + CARD_H + 8) {
            return { kind: 'foundation', idx: f };
          }
        }
        if (y >= TABLEAU_Y - 14 && y <= BOTTOM + 12) {
          for (var c = 0; c < 7; c++) {
            var cx = colX(c);
            if (x >= cx - 6 && x <= cx + CARD_W + 6) return { kind: 'tableau', col: c };
          }
        }
        return null;
      }

      function dragTargetValid(d, target) {
        if (!target) return false;
        if (target.kind === 'foundation') {
          if (d.cards.length !== 1) return false;
          if (d.fromKind === 'foundation' && d.fromIdx === target.idx) return false;
          return canPlaceOnFoundation(d.cards[0], target.idx);
        }
        if (target.kind === 'tableau') {
          if (d.fromKind === 'tableau' && d.fromCol === target.col) return false;
          return canPlaceOnTableau(d.cards[0], target.col);
        }
        return false;
      }

      /* ---------- 绘制 ---------- */
      function ensureGrads(ctx) {
        if (faceGrad) return;
        faceGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
        faceGrad.addColorStop(0, '#fffdf6');
        faceGrad.addColorStop(0.55, '#f7f1e2');
        faceGrad.addColorStop(1, '#ece2cc');
        backGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
        backGrad.addColorStop(0, '#17264a');
        backGrad.addColorStop(0.55, '#0e1a33');
        backGrad.addColorStop(1, '#0a1224');
      }

      function drawCardBack(ctx, w, h, glow) {
        roundRectPath(ctx, 0, 0, w, h, CARD_R);
        ctx.fillStyle = backGrad;
        ctx.fill();
        var neon = 'rgba(96, 165, 250, 0.8)';
        ctx.save();
        if (glow) {
          ctx.shadowColor = glow;
          ctx.shadowBlur = 16;
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = glow || neon;
        roundRectPath(ctx, 1, 1, w - 2, h - 2, CARD_R);
        ctx.stroke();
        ctx.restore();
        var innerR = Math.round(w * 0.055);
        roundRectPath(ctx, w * 0.07, h * 0.07, w * 0.86, h * 0.86, innerR);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.save();
        roundRectPath(ctx, w * 0.07, h * 0.07, w * 0.86, h * 0.86, innerR);
        ctx.clip();
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.13)';
        ctx.lineWidth = 1;
        var i;
        for (i = -h; i < w; i += 11) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + h, h);
          ctx.stroke();
        }
        ctx.restore();
        var cx = w / 2;
        var cy = h / 2;
        var rad = w * 0.19;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-rad * 0.72, -rad * 0.72, rad * 1.44, rad * 1.44);
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
        ctx.strokeRect(-rad * 0.42, -rad * 0.42, rad * 0.84, rad * 0.84);
        ctx.restore();
        ctx.fillStyle = 'rgba(191, 219, 254, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 ' + Math.round(w * 0.2) + 'px ' + FONT_CN;
        ctx.fillText(SUITS[0], cx, cy + 1);
      }

      function drawCardFace(ctx, w, h, card, glow) {
        roundRectPath(ctx, 0, 0, w, h, CARD_R);
        ctx.fillStyle = faceGrad;
        ctx.fill();
        var neon = NEON[card.s];
        ctx.save();
        if (glow) {
          ctx.shadowColor = glow;
          ctx.shadowBlur = 24;
        }
        ctx.lineWidth = glow ? 3 : 2;
        ctx.strokeStyle = glow || neon;
        roundRectPath(ctx, 1, 1, w - 2, h - 2, CARD_R);
        ctx.stroke();
        ctx.restore();

        roundRectPath(ctx, w * 0.05, h * 0.035, w * 0.9, h * 0.93, Math.round(w * 0.045));
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        var ink = INK[card.s];
        var rankFs = Math.round(h * 0.145);
        var suitFs = Math.round(h * 0.105);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = ink;
        ctx.font = '900 ' + rankFs + 'px ' + FONT_MONO;
        ctx.fillText(RANKS[card.r], w * 0.19, h * 0.13);
        ctx.font = suitFs + 'px ' + FONT_CN;
        ctx.fillText(SUITS[card.s], w * 0.19, h * 0.265);

        ctx.save();
        ctx.translate(w, h);
        ctx.rotate(Math.PI);
        ctx.fillStyle = ink;
        ctx.font = '900 ' + rankFs + 'px ' + FONT_MONO;
        ctx.fillText(RANKS[card.r], w * 0.19, h * 0.13);
        ctx.font = suitFs + 'px ' + FONT_CN;
        ctx.fillText(SUITS[card.s], w * 0.19, h * 0.265);
        ctx.restore();

        if (card.r >= 11) {
          ctx.fillStyle = ink;
          ctx.font = '900 ' + Math.round(h * 0.24) + 'px ' + FONT_MONO;
          ctx.fillText(RANKS[card.r], w / 2, h * 0.44);
          ctx.fillStyle = neon;
          ctx.font = Math.round(h * 0.15) + 'px ' + FONT_CN;
          ctx.fillText(SUITS[card.s], w / 2, h * 0.66);
        } else {
          ctx.fillStyle = ink;
          ctx.globalAlpha = 0.9;
          ctx.font = Math.round(h * 0.3) + 'px ' + FONT_CN;
          ctx.fillText(SUITS[card.s], w / 2, h * 0.53);
          ctx.globalAlpha = 1;
        }
      }

      function drawCard(ctx, x, y, card, glow) {
        var sc = 1;
        if (card.flipAt !== undefined) {
          var p = (rt.time - card.flipAt) / 0.18;
          if (p < 1) sc = 0.82 + 0.18 * Math.max(0, p);
        }
        ctx.save();
        ctx.translate(x + CARD_W / 2, y + CARD_H / 2);
        if (sc !== 1) ctx.scale(sc, sc);
        ctx.translate(-CARD_W / 2, -CARD_H / 2);
        ctx.fillStyle = 'rgba(2, 6, 14, 0.32)';
        roundRectPath(ctx, 2, 3, CARD_W, CARD_H, CARD_R);
        ctx.fill();
        if (card.up) drawCardFace(ctx, CARD_W, CARD_H, card, glow);
        else drawCardBack(ctx, CARD_W, CARD_H, glow);
        ctx.restore();
      }

      function drawSlot(ctx, x, y, w, h) {
        ctx.save();
        ctx.setLineDash([7, 6]);
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.22)';
        ctx.lineWidth = 1.4;
        roundRectPath(ctx, x, y, w, h, CARD_R);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      function drawBackground(ctx) {
        var bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#060b16');
        bg.addColorStop(0.5, '#0a1224');
        bg.addColorStop(1, '#06101e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        var g1 = ctx.createRadialGradient(W * 0.12, H * 0.02, 20, W * 0.12, H * 0.02, W * 0.6);
        g1.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
        g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, W, H);

        var g2 = ctx.createRadialGradient(W * 0.9, H * 0.95, 20, W * 0.9, H * 0.95, W * 0.55);
        g2.addColorStop(0, 'rgba(14, 165, 233, 0.12)');
        g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = 'rgba(96, 165, 250, 0.08)';
        for (var gx = 14; gx < W; gx += 36) {
          for (var gy = 14; gy < H; gy += 36) {
            ctx.fillRect(gx, gy, 2, 2);
          }
        }

        /* 桌面暗纹：大花色水印，让下半张桌子不那么空 */
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#93c5fd';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 170px ' + FONT_CN;
        ctx.fillText(SUITS[0], W * 0.2, TABLEAU_Y + 260);
        ctx.fillText(SUITS[1], W * 0.42, TABLEAU_Y + 320);
        ctx.fillText(SUITS[2], W * 0.61, TABLEAU_Y + 255);
        ctx.fillText(SUITS[3], W * 0.83, TABLEAU_Y + 315);
        ctx.restore();
      }

      function drawTopRow(ctx, t) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '700 10px ' + FONT_CN;
        ctx.fillStyle = 'rgba(139, 149, 181, 0.85)';
        ctx.fillText('牌库', X0 + CARD_W / 2, TOP_Y - 9);
        ctx.fillText('弃牌', wasteTopX() - WASTE_FAN * Math.min(Math.max(waste.length - 1, 0), 2) / 2 + CARD_W / 2, TOP_Y - 9);
        ctx.fillText('回收区', FOUND_X + (CARD_W * 4 + GAP * 3) / 2, TOP_Y - 9);

        /* 牌库 */
        drawSlot(ctx, X0, TOP_Y, CARD_W, CARD_H);
        if (stock.length) {
          var layers = Math.min(3, stock.length);
          for (var i = layers - 1; i >= 0; i--) {
            ctx.save();
            ctx.translate(X0 + i * 2.5, TOP_Y + i * 2);
            ctx.globalAlpha = i === 0 ? 1 : 0.85;
            drawCardBack(ctx, CARD_W, CARD_H, null);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
          var badge = String(stock.length);
          ctx.fillStyle = 'rgba(8, 14, 28, 0.85)';
          roundRectPath(ctx, X0 + CARD_W - 30, TOP_Y + CARD_H - 24, 24, 17, 5);
          ctx.fill();
          ctx.fillStyle = '#bfdbfe';
          ctx.font = '700 11px ' + FONT_MONO;
          ctx.textAlign = 'center';
          ctx.fillText(badge, X0 + CARD_W - 18, TOP_Y + CARD_H - 11);
        } else if (waste.length) {
          var pulse = 0.65 + 0.35 * Math.sin(t * 5);
          ctx.save();
          ctx.strokeStyle = 'rgba(96, 165, 250, ' + (0.55 + 0.35 * pulse).toFixed(3) + ')';
          ctx.lineWidth = 2.2;
          ctx.shadowColor = '#60a5fa';
          ctx.shadowBlur = 14;
          var cx = X0 + CARD_W / 2;
          var cy = TOP_Y + CARD_H / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 17, -Math.PI * 0.35, Math.PI * 1.25);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx + 19, cy - 9);
          ctx.lineTo(cx + 8, cy - 10);
          ctx.lineTo(cx + 15, cy - 21);
          ctx.closePath();
          ctx.fillStyle = 'rgba(96, 165, 250, 0.85)';
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = 'rgba(191, 219, 254, 0.85)';
          ctx.font = '700 10px ' + FONT_CN;
          ctx.textAlign = 'center';
          ctx.fillText('点击重发', cx, TOP_Y + CARD_H * 0.82);
        } else {
          ctx.fillStyle = 'rgba(139, 149, 181, 0.4)';
          ctx.font = '700 10px ' + FONT_CN;
          ctx.textAlign = 'center';
          ctx.fillText('空', X0 + CARD_W / 2, TOP_Y + CARD_H / 2);
        }

        /* 弃牌堆 */
        drawSlot(ctx, WASTE_X, TOP_Y, CARD_W, CARD_H);
        if (waste.length) {
          var fanStart = Math.max(0, waste.length - 3);
          for (var w = fanStart; w < waste.length; w++) {
            var card = waste[w];
            if (drag && drag.active && drag.fromKind === 'waste' && card === drag.cards[0]) continue;
            var d = waste.length - 1 - w;
            var off = Math.min(d, 2) * WASTE_FAN;
            var glow = null;
            if (selected && selected.kind === 'waste' && w === waste.length - 1) glow = 'rgba(147, 197, 253, 0.95)';
            else if (hover && !pointerIsTouch && !drag && hover.kind === 'waste' && w === waste.length - 1) glow = 'rgba(96, 165, 250, 0.6)';
            drawCard(ctx, WASTE_X + off, TOP_Y, card, glow);
          }
        } else {
          ctx.fillStyle = 'rgba(139, 149, 181, 0.4)';
          ctx.font = '700 10px ' + FONT_CN;
          ctx.textAlign = 'center';
          ctx.fillText('空', WASTE_X + CARD_W / 2, TOP_Y + CARD_H / 2);
        }

        /* 目标堆 */
        var f, i;
        for (f = 0; f < 4; f++) {
          var fx = foundationX(f);
          drawSlot(ctx, fx, TOP_Y, CARD_W, CARD_H);
          var fArr = foundations[f];
          if (!fArr.length) {
            ctx.save();
            ctx.globalAlpha = 0.24;
            ctx.fillStyle = NEON[f];
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = Math.round(CARD_H * 0.26) + 'px ' + FONT_CN;
            ctx.fillText(SUITS[f], fx + CARD_W / 2, TOP_Y + CARD_H * 0.42);
            ctx.font = '700 ' + Math.round(CARD_H * 0.1) + 'px ' + FONT_MONO;
            ctx.fillText('A', fx + CARD_W / 2, TOP_Y + CARD_H * 0.68);
            ctx.restore();
          } else {
            var topCard = fArr[fArr.length - 1];
            if (drag && drag.active && drag.fromKind === 'foundation' && drag.cards[0] === topCard) {
              /* 拖动中：只显示槽位 */
            } else {
              var fglow = null;
              if (selected && selected.kind === 'foundation' && selected.idx === f) fglow = 'rgba(147, 197, 253, 0.95)';
              else if (hover && !pointerIsTouch && !drag && hover.kind === 'foundation' && hover.idx === f) fglow = 'rgba(96, 165, 250, 0.6)';
              drawCard(ctx, fx, TOP_Y, topCard, fglow);
            }
            ctx.fillStyle = 'rgba(191, 219, 254, 0.72)';
            ctx.font = '700 10px ' + FONT_MONO;
            ctx.textAlign = 'right';
            ctx.fillText(String(fArr.length), fx + CARD_W - 7, TOP_Y + 14);
          }
        }

        /* 中间信息 */
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 12px ' + FONT_CN;
        ctx.fillStyle = 'rgba(191, 219, 254, 0.85)';
        ctx.fillText('回收 ' + foundationCount() + ' / 52', centerInfoX, TOP_Y + 146);
        ctx.font = '500 10px ' + FONT_CN;
        ctx.fillStyle = 'rgba(139, 149, 181, 0.8)';
        ctx.fillText('抽 1 张', centerInfoX, TOP_Y + 166);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      function drawTableau(ctx) {
        for (var c = 0; c < 7; c++) {
          var arr = tableau[c];
          var cx = colX(c);
          var pos = layoutColumn(c);
          if (!arr.length) {
            drawSlot(ctx, cx, TABLEAU_Y, CARD_W, CARD_H);
            continue;
          }
          for (var i = 0; i < arr.length; i++) {
            var card = arr[i];
            if (drag && drag.active && drag.fromKind === 'tableau' && drag.fromCol === c && i >= drag.fromIndex) continue;
            var glow = null;
            if (selected && selected.kind === 'tableau' && selected.col === c && i >= selected.index) {
              glow = 'rgba(147, 197, 253, 0.95)';
            } else if (hover && !pointerIsTouch && !drag && hover.kind === 'tableau' && hover.col === c && hover.cardIndex === i) {
              glow = 'rgba(96, 165, 250, 0.55)';
            }
            drawCard(ctx, cx, pos[i], card, glow);
          }
        }
      }

      function targetGlow(ctx, target, valid, t) {
        var pulse = 0.6 + 0.4 * Math.sin(t * 5);
        var color = valid
          ? 'rgba(74, 222, 128, ' + (0.45 + 0.4 * pulse).toFixed(3) + ')'
          : 'rgba(244, 63, 94, 0.72)';
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.setLineDash(valid ? [] : [6, 5]);
        ctx.shadowColor = valid ? '#4ade80' : '#f43f5e';
        ctx.shadowBlur = 16;
        if (target.kind === 'foundation') {
          roundRectPath(ctx, foundationX(target.idx) - 3, TOP_Y - 3, CARD_W + 6, CARD_H + 6, CARD_R + 3);
          ctx.stroke();
        } else {
          var cx = colX(target.col);
          var arr = tableau[target.col];
          var pos = layoutColumn(target.col);
          var yy = arr.length ? pos[arr.length - 1] : TABLEAU_Y;
          roundRectPath(ctx, cx - 3, yy - 3, CARD_W + 6, CARD_H + 6, CARD_R + 3);
          ctx.stroke();
        }
        ctx.restore();
      }

      function drawHints(ctx, t) {
        if (won || ended) return;
        if (drag && drag.active) {
          var target = dragTargetAt(drag.x, drag.y);
          if (target) targetGlow(ctx, target, dragTargetValid(drag, target), t);
          return;
        }
        if (!selected) return;
        var cards = selectedCards(selected);
        if (!cards.length) return;
        var card = cards[0];
        var f, c;
        for (f = 0; f < 4; f++) {
          if (selected.kind === 'foundation' && selected.idx === f) continue;
          if (cards.length !== 1) continue;
          if (canPlaceOnFoundation(card, f)) targetGlow(ctx, { kind: 'foundation', idx: f }, true, t);
        }
        for (c = 0; c < 7; c++) {
          if (selected.kind === 'tableau' && selected.col === c) continue;
          if (canPlaceOnTableau(card, c)) targetGlow(ctx, { kind: 'tableau', col: c }, true, t);
        }
      }

      function drawDragStack(ctx) {
        var x = drag.x - drag.offsetX;
        var y = drag.y - drag.offsetY;
        var maxY = BOTTOM - CARD_H - (drag.cards.length - 1) * DRAG_OFFSET;
        if (x < 4) x = 4;
        if (x > W - CARD_W - 4) x = W - CARD_W - 4;
        if (y < 4) y = 4;
        if (y > maxY) y = maxY;
        for (var i = 0; i < drag.cards.length; i++) {
          ctx.save();
          ctx.shadowColor = 'rgba(96, 165, 250, 0.7)';
          ctx.shadowBlur = 18;
          drawCard(ctx, x, y + i * DRAG_OFFSET, drag.cards[i], 'rgba(96, 165, 250, 0.95)');
          ctx.restore();
        }
      }

      function drawButton(ctx, btn, enabled) {
        var pp = rt.pointer;
        var hoverBtn = enabled && pp.x >= btn.x && pp.x <= btn.x + btn.w && pp.y >= btn.y && pp.y <= btn.y + btn.h;
        ctx.save();
        ctx.fillStyle = !enabled ? 'rgba(16, 24, 42, 0.55)'
          : hoverBtn ? 'rgba(37, 99, 235, 0.9)' : 'rgba(23, 37, 66, 0.92)';
        roundRectPath(ctx, btn.x, btn.y, btn.w, btn.h, 9);
        ctx.fill();
        ctx.strokeStyle = !enabled ? 'rgba(96, 165, 250, 0.16)'
          : hoverBtn ? 'rgba(147, 197, 253, 0.95)' : 'rgba(96, 165, 250, 0.5)';
        ctx.lineWidth = 1.4;
        roundRectPath(ctx, btn.x, btn.y, btn.w, btn.h, 9);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 13px ' + FONT_CN;
        ctx.fillStyle = !enabled ? 'rgba(139, 149, 181, 0.4)' : hoverBtn ? '#f0f9ff' : '#bfdbfe';
        ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
        ctx.restore();
      }

      function drawEffects(ctx) {
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
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (i = 0; i < floats.length; i++) {
          var fl = floats[i];
          ctx.globalAlpha = Math.max(0, fl.life / fl.max);
          ctx.fillStyle = fl.color;
          ctx.font = '900 15px ' + FONT_MONO;
          ctx.fillText(fl.text, fl.x, fl.y);
        }
        ctx.globalAlpha = 1;
      }

      function drawFooter(ctx) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '500 12px ' + FONT_CN;
        ctx.fillStyle = 'rgba(160, 180, 215, 0.85)';
        ctx.fillText('点击牌库抽牌 · 拖拽 / 点选移动 · 双击自动收牌 · Z 撤销', W / 2, H - 12);
      }

      function drawWinBanner(ctx) {
        var a = Math.min(1, (1.1 - endTimer) * 2.4);
        if (a <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 44px ' + FONT_CN;
        ctx.fillStyle = 'rgba(191, 219, 254, 0.96)';
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 30;
        ctx.fillText('全部归位！', W / 2, TABLEAU_Y + 130);
        ctx.restore();
      }

      newGame();

      return {
        update: function (dt) {
          var i;
          if (!hudInited) {
            hudInited = true;
            refreshHud(true);
            rt.setStatus('点击牌库抽牌 · 拖拽或点选移动 · 双击自动收牌');
          }
          if (!won && !ended) {
            elapsed += dt;
            var sec = Math.floor(elapsed);
            if (sec !== lastSec) {
              lastSec = sec;
              refreshHud(false);
            }
          }
          if (won && !ended) {
            endTimer -= dt;
            if (endTimer <= 0) {
              ended = true;
              var finalScore = computeScore(true);
              rt.setScore(finalScore);
              rt.end({
                score: finalScore,
                won: true,
                message: '52 张牌全部归位，漂亮的一局！',
                stats: [
                  { label: '步数', value: moves },
                  { label: '用时', value: fmtTime(elapsed) },
                  { label: '回收牌数', value: '52 / 52' }
                ]
              });
            }
          }
          if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
          for (i = particles.length - 1; i >= 0; i--) {
            var pt = particles[i];
            pt.life -= dt;
            pt.vy += pt.g * dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vx *= 0.985;
            if (pt.life <= 0) particles.splice(i, 1);
          }
          for (i = floats.length - 1; i >= 0; i--) {
            var fl = floats[i];
            fl.life -= dt;
            fl.y -= 28 * dt;
            if (fl.life <= 0) floats.splice(i, 1);
          }
        },

        render: function (ctx) {
          var t = rt.time;
          ensureGrads(ctx);
          drawBackground(ctx);
          drawTopRow(ctx, t);
          drawTableau(ctx);
          drawHints(ctx, t);
          if (drag && drag.active) drawDragStack(ctx);
          drawButton(ctx, undoBtn, !won && !ended && history.length > 0);
          drawButton(ctx, newBtn, !won && !ended);
          drawEffects(ctx);
          drawFooter(ctx);
          if (flash > 0) {
            ctx.fillStyle = 'rgba(96, 165, 250, ' + (flash * 0.28).toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
          }
          if (won && !ended) drawWinBanner(ctx);
        },

        onPointerDown: function (x, y, event) {
          if (ended || won) return;
          var ev = event || {};
          pointerIsTouch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
          pointer.x = x;
          pointer.y = y;
          downConsumed = false;
          if (drag) return;

          var i;
          for (i = 0; i < buttons.length; i++) {
            var b = buttons[i];
            if (x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) {
              downConsumed = true;
              if (b.id === 'undo') undo();
              else {
                newGame();
                Arcade.audio.play('click', 0.5);
              }
              return;
            }
          }

          if (x >= X0 && x <= X0 + CARD_W && y >= TOP_Y && y <= TOP_Y + CARD_H) {
            drawStock();
            downConsumed = true;
            return;
          }

          var hit = hitTest(x, y);
          if (!hit) {
            selected = null;
            downConsumed = true;
            return;
          }

          if (hit.kind === 'tableau' && hit.cardIndex >= 0) {
            var arr = tableau[hit.col];
            var card = arr[hit.cardIndex];
            if (card.up) {
              var stack = validStackFrom(hit.col, hit.cardIndex);
              if (stack.length) {
                var pos = layoutColumn(hit.col);
                drag = {
                  cards: stack,
                  fromKind: 'tableau',
                  fromIdx: hit.col,
                  fromCol: hit.col,
                  fromIndex: hit.cardIndex,
                  startX: x,
                  startY: y,
                  offsetX: x - colX(hit.col),
                  offsetY: y - pos[hit.cardIndex],
                  x: x,
                  y: y,
                  active: false
                };
                return;
              }
            }
            return;
          }

          if (hit.kind === 'waste' && waste.length) {
            drag = {
              cards: [waste[waste.length - 1]],
              fromKind: 'waste',
              fromIndex: waste.length - 1,
              startX: x,
              startY: y,
              offsetX: x - wasteTopX(),
              offsetY: y - TOP_Y,
              x: x,
              y: y,
              active: false
            };
            return;
          }

          if (hit.kind === 'foundation' && foundations[hit.idx].length) {
            drag = {
              cards: [foundations[hit.idx][foundations[hit.idx].length - 1]],
              fromKind: 'foundation',
              fromIdx: hit.idx,
              startX: x,
              startY: y,
              offsetX: x - foundationX(hit.idx),
              offsetY: y - TOP_Y,
              x: x,
              y: y,
              active: false
            };
          }
        },

        onPointerMove: function (x, y) {
          pointer.x = x;
          pointer.y = y;
          if (drag) {
            drag.x = x;
            drag.y = y;
            var dx = x - drag.startX;
            var dy = y - drag.startY;
            if (!drag.active && dx * dx + dy * dy > 190) {
              drag.active = true;
              selected = null;
            }
          }
          hover = hitTest(x, y);
        },

        onPointerUp: function (x, y) {
          pointer.x = x;
          pointer.y = y;
          if (drag) {
            var d = drag;
            drag = null;
            if (d.active) {
              var target = dragTargetAt(x, y);
              var moved = false;
              if (target && dragTargetValid(d, target)) {
                if (target.kind === 'foundation') {
                  moved = executeMove(d.fromKind, d.fromIdx, d.fromIndex, 'foundation', target.idx);
                } else {
                  moved = executeMove(d.fromKind, d.fromIdx, d.fromIndex, 'tableau', target.col);
                }
              }
              if (!moved) Arcade.audio.play('error', 0.35);
            } else if (!downConsumed) {
              handleTap(x, y);
            }
            downConsumed = true;
            return;
          }
          if (!downConsumed) handleTap(x, y);
          downConsumed = true;
        },

        onKeyDown: function (code) {
          if (code === 'KeyZ') undo();
        }
      };
    }
  });
})();
