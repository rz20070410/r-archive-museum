/* 游戏：羊了个羊 —— 三张同牌，槽位别满 */
(function () {
  'use strict';

  var FONT_UI = '"PingFang SC", "Microsoft YaHei", sans-serif';
  var FONT_NUM = '"Consolas", monospace';
  var FONT_EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  var PATTERNS = [
    { e: '🍎', c: '#fb7185' },
    { e: '🍊', c: '#fb923c' },
    { e: '🍋', c: '#facc15' },
    { e: '🍇', c: '#a855f7' },
    { e: '🍉', c: '#22c55e' },
    { e: '🍓', c: '#f43f5e' },
    { e: '🥕', c: '#f97316' },
    { e: '🌽', c: '#fbbf24' },
    { e: '🍄', c: '#ef4444' },
    { e: '🐑', c: '#fde68a' }
  ];

  var LEVELS = [
    { layers: [12, 12], patterns: 4 },
    { layers: [12, 12, 12], patterns: 6 },
    { layers: [13, 13, 11, 11], patterns: 8 }
  ];

  var MAX_PARTICLES = 240;
  var SLOT_COUNT = 7;

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

  Arcade.register({
    id: 'sheep',
    title: '羊了个羊',
    subtitle: '三张同牌，槽位别满',
    description: '层层叠叠的卡牌堆成小山，只有露在最上面的牌能点。凑齐三张同图案就会消除，槽位塞满就输了。',
    icon: '🐑',
    accent: '#fbbf24',
    accent2: '#f97316',
    tags: ['益智', '休闲'],
    difficulty: '中等',
    width: 640,
    height: 820,
    order: 35,
    tips: '先点边缘的牌，把图案数量摸清再下手；槽位快满时用「撤销」或「洗牌」救急。',
    controls: [
      { keys: '鼠标 / 触摸', action: '点击卡牌' },
      { keys: '画布按钮', action: '撤销 / 洗牌' }
    ],

    create: function (rt) {
      var colors = rt.colors;

      /* ---------- 布局 ---------- */
      var W = rt.width;
      var H = rt.height;
      var CARD_W = 78;
      var CARD_H = 94;
      var GAP = 10;
      var LAYER_OX = 22;
      var LAYER_OY = 26;
      var PLAY_X = 24;
      var PLAY_W = W - 48;
      var PLAY_TOP = 82;
      var PLAY_BOTTOM = 500;
      var BTN_Y = 514;
      var BTN_H = 48;
      var SLOT_SIZE = 74;
      var SLOT_GAP = 8;
      var SLOT_Y = 592;
      var SLOT_LEFT = (W - (SLOT_COUNT * SLOT_SIZE + (SLOT_COUNT - 1) * SLOT_GAP)) / 2;

      /* ---------- 状态 ---------- */
      var ctx = null;
      var bgGrad = null;
      var cardGrad = null;
      var glowGrad = null;
      var slotGlow = null;

      var phase = 'play';
      var levelIndex = 0;
      var score = 0;
      var combo = 0;
      var maxCombo = 0;
      var comboT = 0;
      var lastClearT = -10;
      var clearedGroups = 0;
      var totalCards = 0;
      var removedCount = 0;
      var timeAlive = 0;
      var levelTimer = 0;
      var levelClearTimer = 0;
      var overTimer = 0;
      var winTimer = 0;
      var ended = false;
      var shake = 0;
      var flash = 0;
      var hudDirty = true;
      var statusText = '';
      var inputLock = 0;
      var banner = null;
      var undoLeft = 0;
      var shuffleLeft = 0;

      var cards = [];
      var slots = [];
      var moveStack = [];
      var particles = [];
      var popups = [];

      var pointerX = W / 2;
      var pointerY = H / 2;
      var hoverCard = null;

      var BTN_W = 200;
      var undoBtn = { x: W / 2 - BTN_W - 10, y: BTN_Y, w: BTN_W, h: BTN_H };
      var shuffleBtn = { x: W / 2 + 10, y: BTN_Y, w: BTN_W, h: BTN_H };

      /* ---------- 工具 ---------- */
      function setStatus(text) {
        if (text === statusText) return;
        statusText = text;
        rt.setStatus(text);
      }

      function remaining() {
        return totalCards - removedCount;
      }

      function updateHud() {
        var empty = 0;
        for (var i = 0; i < SLOT_COUNT; i++) if (!slots[i]) empty += 1;
        rt.setHud({
          关卡: (levelIndex + 1) + '/' + LEVELS.length,
          连击: combo > 1 ? 'x' + combo : '—',
          剩余: remaining(),
          槽位: (SLOT_COUNT - empty) + '/' + SLOT_COUNT
        });
      }

      function addParticles(x, y, color, count, power) {
        var room = MAX_PARTICLES - particles.length;
        if (room <= 0) return;
        if (count > room) count = room;
        for (var i = 0; i < count; i++) {
          var a = rt.rand(0, Math.PI * 2);
          var sp = rt.rand(50, 230) * (power || 1);
          particles.push({
            x: x, y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 40,
            life: rt.rand(0.28, 0.7),
            max: 0.7,
            size: rt.rand(2, 4.4),
            color: color,
            grav: 420
          });
        }
      }

      function addPopup(x, y, text, color) {
        if (popups.length > 18) popups.shift();
        popups.push({ x: x, y: y, vy: -46, text: text, color: color, life: 0.95, max: 0.95 });
      }

      function shuffleArr(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = arr[i];
          arr[i] = arr[j];
          arr[j] = t;
        }
      }

      /* ---------- 关卡构建 ---------- */
      function buildPositions(count, layer, baseY, layerCount) {
        var cols = 6;
        var rows = Math.ceil(count / cols);
        var list = [];
        var layerOffX = (layer - (layerCount - 1) / 2) * LAYER_OX;
        for (var i = 0; i < count; i++) {
          var col = i % cols;
          var row = Math.floor(i / cols);
          var rowCount = Math.min(cols, count - row * cols);
          var rowW = rowCount * CARD_W + (rowCount - 1) * GAP;
          var rowX = (W - rowW) / 2 + layerOffX;
          list.push({
            x: rowX + col * (CARD_W + GAP),
            y: baseY + layer * LAYER_OY + row * (CARD_H + GAP)
          });
        }
        return list;
      }

      function setupLevel(li) {
        levelIndex = li;
        var cfg = LEVELS[li];
        var pool = PATTERNS.slice(0, cfg.patterns);

        var deck = [];
        for (var p = 0; p < pool.length; p++) {
          for (var k = 0; k < 6; k++) deck.push(p);
        }
        shuffleArr(deck);

        // 卡阵在游戏区内垂直居中
        var rowsMax = 0;
        for (var lr = 0; lr < cfg.layers.length; lr++) {
          rowsMax = Math.max(rowsMax, Math.ceil(cfg.layers[lr] / 6));
        }
        var gridH = (cfg.layers.length - 1) * LAYER_OY + (rowsMax - 1) * (CARD_H + GAP) + CARD_H;
        var baseY = PLAY_TOP + (PLAY_BOTTOM - PLAY_TOP - gridH) / 2;

        cards = [];
        slots = [];
        for (var s = 0; s < SLOT_COUNT; s++) slots.push(null);
        moveStack = [];
        particles = [];
        popups = [];
        hoverCard = null;

        var idx = 0;
        for (var layer = 0; layer < cfg.layers.length; layer++) {
          var count = cfg.layers[layer];
          var positions = buildPositions(count, layer, baseY, cfg.layers.length);
          for (var i = 0; i < count; i++) {
            var pi = deck[idx++];
            cards.push({
              pi: pi,
              pattern: PATTERNS[pi].e,
              color: PATTERNS[pi].c,
              layer: layer,
              x: positions[i].x,
              y: positions[i].y,
              state: 'board',
              covered: false,
              slotIndex: -1,
              flyT: 0,
              flyX: positions[i].x,
              flyY: positions[i].y,
              flyToX: 0,
              flyToY: 0,
              clearT: 0,
              clearX: 0,
              clearY: 0,
              born: rt.time
            });
          }
        }
        totalCards = cards.length;
        removedCount = 0;
        undoLeft = 2;
        shuffleLeft = 2;
        inputLock = 0.35;
        levelTimer = 0;
        banner = {
          title: '第 ' + (li + 1) + ' 关',
          sub: '清空全部 ' + totalCards + ' 张卡牌',
          life: 1.7,
          max: 1.7,
          color: colors.accent
        };
        recomputeCover();
        hudDirty = true;
        rt.audio.play('level', 0.55);
      }

      /* ---------- 遮挡计算 ---------- */
      function recomputeCover() {
        var i, j;
        for (i = 0; i < cards.length; i++) cards[i].covered = false;
        for (i = 0; i < cards.length; i++) {
          var c = cards[i];
          if (c.state !== 'board') continue;
          for (j = 0; j < cards.length; j++) {
            var o = cards[j];
            if (o === c || o.state !== 'board') continue;
            if (o.layer <= c.layer) continue;
            var ox = Math.min(c.x + CARD_W, o.x + CARD_W) - Math.max(c.x, o.x);
            if (ox <= 0) continue;
            var oy = Math.min(c.y + CARD_H, o.y + CARD_H) - Math.max(c.y, o.y);
            if (oy <= 0) continue;
            if (ox * oy > CARD_W * CARD_H * 0.14) {
              c.covered = true;
              break;
            }
          }
        }
      }

      /* ---------- 槽位 ---------- */
      function slotCenter(i) {
        return {
          x: SLOT_LEFT + i * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2 - CARD_W / 2,
          y: SLOT_Y + SLOT_SIZE / 2 - CARD_H / 2
        };
      }

      function occupiedSlots() {
        var n = 0;
        for (var i = 0; i < SLOT_COUNT; i++) if (slots[i]) n += 1;
        return n;
      }

      function compactSlots() {
        var list = [];
        for (var i = 0; i < SLOT_COUNT; i++) {
          if (slots[i]) list.push(slots[i]);
        }
        for (var j = 0; j < SLOT_COUNT; j++) {
          var c = list[j] || null;
          slots[j] = c;
          if (c) c.slotIndex = j;
        }
      }

      function checkTriple() {
        var counts = {};
        var i;
        for (i = 0; i < SLOT_COUNT; i++) {
          var c = slots[i];
          if (!c || c.state !== 'slot') continue;
          counts[c.pi] = (counts[c.pi] || 0) + 1;
        }
        for (var key in counts) {
          if (!counts.hasOwnProperty(key)) continue;
          if (counts[key] >= 3) {
            doClear(parseInt(key, 10));
            return true;
          }
        }
        return false;
      }

      function doClear(pi) {
        var picked = [];
        for (var i = 0; i < SLOT_COUNT; i++) {
          var c = slots[i];
          if (c && c.pi === pi && c.state === 'slot' && picked.length < 3) {
            picked.push({ idx: i, card: c });
            slots[i] = null;
            c.state = 'clearing';
            c.clearT = 0;
            var sc = slotCenter(i);
            c.clearX = sc.x;
            c.clearY = sc.y;
          }
        }
        compactSlots();

        clearedGroups += 1;
        if (rt.time - lastClearT < 2.6) combo += 1;
        else combo = 1;
        lastClearT = rt.time;
        comboT = 1.6;
        if (combo > maxCombo) maxCombo = combo;
        var mult = 1 + Math.min(combo - 1, 8) * 0.25;
        var gained = Math.round(100 * mult);
        score += gained;
        rt.setScore(score);
        hudDirty = true;

        var color = PATTERNS[pi].c;
        for (var k = 0; k < picked.length; k++) {
          var pos = picked[k];
          addParticles(
            W / 2 + (pos.idx - 3) * (SLOT_SIZE + SLOT_GAP),
            SLOT_Y + SLOT_SIZE / 2,
            color, 12, 1.1
          );
        }
        addPopup(W / 2, SLOT_Y - 16, '+' + gained, color);
        if (combo >= 2) addPopup(W / 2, SLOT_Y - 42, '连击 x' + combo, colors.accent);
        shake = Math.max(shake, combo >= 3 ? 4 : 2);
        rt.audio.play(combo >= 3 ? 'power' : 'pop', 0.5);
      }

      /* ---------- 点击 / 操作 ---------- */
      function pickCard(c) {
        if (c.state !== 'board') return false;
        var empty = -1;
        for (var i = 0; i < SLOT_COUNT; i++) {
          if (!slots[i]) { empty = i; break; }
        }
        if (empty < 0) return false;

        // 同图案尽量挨着放，便于观察
        var pos = -1;
        for (var j = 0; j < SLOT_COUNT; j++) {
          if (slots[j] && slots[j].pi === c.pi) pos = j;
        }
        if (pos >= 0) {
          pos += 1;
        } else {
          pos = empty;
        }
        if (pos >= SLOT_COUNT) pos = empty;

        // 右移腾位置
        for (var k = SLOT_COUNT - 1; k > pos; k--) {
          slots[k] = slots[k - 1];
          if (slots[k]) slots[k].slotIndex = k;
        }
        slots[pos] = c;

        c.state = 'flying';
        c.flyT = 0;
        c.flyX = c.x;
        c.flyY = c.y;
        c.slotIndex = pos;
        moveStack.push(c);

        recomputeCover();
        addParticles(c.x + CARD_W / 2, c.y + CARD_H / 2, c.color, 6, 0.7);
        rt.audio.play('flip', 0.4);
        hudDirty = true;
        return true;
      }

      function doUndo() {
        if (phase !== 'play' || inputLock > 0 || undoLeft <= 0) return false;
        var target = null;
        for (var i = moveStack.length - 1; i >= 0; i--) {
          var c = moveStack[i];
          if (c.state === 'slot') { target = c; break; }
        }
        if (!target) {
          addPopup(W / 2, SLOT_Y - 20, '没有可撤销的牌', colors.muted);
          rt.audio.play('error', 0.4);
          return false;
        }
        for (var j = 0; j < moveStack.length; j++) {
          if (moveStack[j] === target) { moveStack.splice(j, 1); break; }
        }
        for (var k = 0; k < SLOT_COUNT; k++) {
          if (slots[k] === target) { slots[k] = null; break; }
        }
        compactSlots();
        target.state = 'board';
        target.slotIndex = -1;
        target.flyT = 0;
        undoLeft -= 1;
        recomputeCover();
        addParticles(target.x + CARD_W / 2, target.y + CARD_H / 2, target.color, 8, 0.8);
        addPopup(W / 2, SLOT_Y - 20, '撤销一步', colors.warn);
        rt.audio.play('toggle', 0.5);
        hudDirty = true;
        return true;
      }

      function doShuffle() {
        if (phase !== 'play' || inputLock > 0 || shuffleLeft <= 0) return false;
        var board = [];
        var i;
        for (i = 0; i < cards.length; i++) {
          if (cards[i].state === 'board') board.push(cards[i]);
        }
        if (board.length === 0) return false;
        var pats = [];
        for (i = 0; i < board.length; i++) pats.push(board[i].pi);
        shuffleArr(pats);
        for (i = 0; i < board.length; i++) {
          board[i].pi = pats[i];
          board[i].pattern = PATTERNS[pats[i]].e;
          board[i].color = PATTERNS[pats[i]].c;
          board[i].hitFlash = 1;
        }
        shuffleLeft -= 1;
        recomputeCover();
        for (i = 0; i < 16; i++) {
          addParticles(rt.rand(PLAY_X + 20, PLAY_X + PLAY_W - 20), rt.rand(PLAY_TOP + 20, PLAY_BOTTOM - 20), colors.warn, 1, 1.2);
        }
        addPopup(W / 2, PLAY_TOP + 40, '洗牌！', colors.warn);
        shake = 4;
        rt.audio.play('step', 0.6);
        rt.audio.play('pop', 0.4);
        hudDirty = true;
        return true;
      }

      function hitBtn(b, x, y) {
        return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      }

      function cardAt(x, y) {
        var best = null;
        for (var i = 0; i < cards.length; i++) {
          var c = cards[i];
          if (c.state !== 'board' || c.covered) continue;
          if (x >= c.x && x <= c.x + CARD_W && y >= c.y && y <= c.y + CARD_H) {
            if (!best || c.layer > best.layer) best = c;
          }
        }
        return best;
      }

      /* ---------- 结算 ---------- */
      function levelComplete() {
        if (phase !== 'play') return;
        phase = 'levelclear';
        levelClearTimer = 0;
        var bonus = 300 * (levelIndex + 1);
        score += bonus;
        rt.setScore(score);
        banner = {
          title: '第 ' + (levelIndex + 1) + ' 关 完成',
          sub: '关卡奖励 +' + bonus,
          life: 1.7,
          max: 1.7,
          color: colors.success
        };
        rt.audio.play('level', 0.8);
        for (var i = 0; i < 24; i++) {
          addParticles(rt.rand(W * 0.25, W * 0.75), rt.rand(H * 0.3, H * 0.6), rt.pick(['#fbbf24', '#f97316', '#ffffff']), 1, 1.4);
        }
        hudDirty = true;
      }

      function fail() {
        if (phase !== 'play') return;
        phase = 'over';
        overTimer = 0;
        shake = 12;
        flash = 0.5;
        rt.audio.play('lose', 0.6);
        addParticles(W / 2, SLOT_Y, colors.danger, 22, 1.5);
        hudDirty = true;
      }

      function win() {
        if (phase === 'win' || phase === 'over') return;
        phase = 'win';
        winTimer = 0;
        rt.audio.play('win', 0.9);
        hudDirty = true;
      }

      /* ---------- 更新 ---------- */
      function tickEffects(dt) {
        var i;
        for (i = particles.length - 1; i >= 0; i--) {
          var p = particles[i];
          p.life -= dt;
          if (p.life <= 0) { particles.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += p.grav * dt;
          p.vx *= 0.985;
          p.vy *= 0.985;
        }
        for (i = popups.length - 1; i >= 0; i--) {
          var pp = popups[i];
          pp.life -= dt;
          pp.y += pp.vy * dt;
          if (pp.life <= 0) popups.splice(i, 1);
        }
        if (shake > 0) shake = Math.max(0, shake - dt * 40);
        if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
        if (comboT > 0) {
          comboT -= dt;
          if (comboT <= 0 && combo > 0) {
            combo = 0;
            hudDirty = true;
          }
        }
        if (banner) {
          banner.life -= dt;
          if (banner.life <= 0) banner = null;
        }
        if (inputLock > 0) inputLock = Math.max(0, inputLock - dt);
      }

      function updateCards(dt) {
        var i;
        var removedNow = false;
        for (i = 0; i < cards.length; i++) {
          var c = cards[i];
          if (c.hitFlash > 0) c.hitFlash = Math.max(0, c.hitFlash - dt * 3);
          if (c.state === 'flying') {
            c.flyT += dt;
            var sc = slotCenter(c.slotIndex);
            c.flyToX = sc.x;
            c.flyToY = sc.y;
            var k = Math.min(1, c.flyT / 0.24);
            var e = k * k * (3 - 2 * k);
            c.flyX = c.x + (c.flyToX - c.x) * e;
            c.flyY = c.y + (c.flyToY - c.y) * e;
            if (k >= 1) {
              c.state = 'slot';
              c.flyX = c.flyToX;
              c.flyY = c.flyToY;
              rt.audio.play('click', 0.25);
              hudDirty = true;
              var cleared = checkTriple();
              if (!cleared && occupiedSlots() >= SLOT_COUNT) {
                fail();
                return;
              }
            }
          } else if (c.state === 'clearing') {
            c.clearT += dt;
            if (c.clearT >= 0.26) {
              c.state = 'removed';
              removedCount += 1;
              removedNow = true;
            }
          }
        }
        if (removedNow) hudDirty = true;

        // 通关检测
        if (phase === 'play' && removedCount >= totalCards) levelComplete();
      }

      function updateHover() {
        hoverCard = cardAt(pointerX, pointerY);
      }

      function statusNow() {
        if (phase === 'over') return '槽位满了，这局结束';
        if (phase === 'win') return '全部清空！';
        if (phase === 'levelclear') return '本关完成';
        if (inputLock > 0) return '准备中…';
        if (combo >= 2) return '连击 x' + combo + ' · 继续保持';
        return '点击未被遮挡的卡牌 · 三张同图案自动消除';
      }

      setupLevel(0);

      return {
        update: function (dt) {
          timeAlive += dt;
          tickEffects(dt);
          if (hudDirty) {
            hudDirty = false;
            updateHud();
          }
          setStatus(statusNow());
          updateHover();

          if (phase === 'over') {
            overTimer += dt;
            if (!ended && overTimer >= 1.1) {
              ended = true;
              rt.end({
                score: score,
                message: '槽位塞满了，第 ' + (levelIndex + 1) + ' 关差一点',
                stats: [
                  { label: '到达关卡', value: (levelIndex + 1) + ' / ' + LEVELS.length },
                  { label: '消除组数', value: clearedGroups },
                  { label: '最高连击', value: 'x' + Math.max(1, maxCombo) },
                  { label: '存活时间', value: timeAlive.toFixed(1) + 's' }
                ]
              });
            }
            return;
          }

          if (phase === 'win') {
            winTimer += dt;
            updateCards(dt);
            if (!ended && winTimer >= 1.3) {
              ended = true;
              rt.end({
                score: score,
                won: true,
                message: '三关全清，牌堆被你安排得明明白白',
                stats: [
                  { label: '通关关卡', value: LEVELS.length + ' / ' + LEVELS.length },
                  { label: '消除组数', value: clearedGroups },
                  { label: '最高连击', value: 'x' + Math.max(1, maxCombo) },
                  { label: '总用时', value: timeAlive.toFixed(1) + 's' }
                ]
              });
            }
            return;
          }

          if (phase === 'levelclear') {
            levelClearTimer += dt;
            updateCards(dt);
            if (levelClearTimer >= 1.8) {
              if (levelIndex + 1 >= LEVELS.length) {
                win();
              } else {
                phase = 'play';
                setupLevel(levelIndex + 1);
              }
            }
            return;
          }

          // phase === 'play'
          updateCards(dt);
        },

        render: function (c) {
          ctx = c;
          ensureGradients();
          var t = rt.time;

          var sx = shake > 1 ? rt.rand(-shake, shake) : 0;
          var sy = shake > 1 ? rt.rand(-shake, shake) : 0;

          ctx.save();
          ctx.translate(sx, sy);
          drawBackground(t);
          drawPlayPanel(t);
          drawBoardCards(t);
          drawSlots(t);
          drawButtons(t);
          drawBottomInfo(t);
          drawParticles();
          drawPopups();
          ctx.restore();

          drawHud(t);
          drawBanner();
          drawOverlays(t);
        },

        onPointerMove: function (x, y) {
          pointerX = x;
          pointerY = y;
        },

        onPointerDown: function (x, y) {
          pointerX = x;
          pointerY = y;
          if (phase !== 'play' || inputLock > 0) return;
          if (hitBtn(undoBtn, x, y)) { doUndo(); return; }
          if (hitBtn(shuffleBtn, x, y)) { doShuffle(); return; }
          var c = cardAt(x, y);
          if (c) pickCard(c);
        },

        destroy: function () {
          cards = [];
          slots = [];
          particles = [];
          popups = [];
        }
      };

      /* ================= 绘制 ================= */
      function ensureGradients() {
        if (bgGrad) return;
        bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0d0a14');
        bgGrad.addColorStop(0.45, '#140f18');
        bgGrad.addColorStop(1, '#0d0a0c');

        glowGrad = ctx.createRadialGradient(W / 2, H * 0.32, 20, W / 2, H * 0.32, W * 0.8);
        glowGrad.addColorStop(0, 'rgba(251,191,36,0.14)');
        glowGrad.addColorStop(0.6, 'rgba(249,115,22,0.06)');
        glowGrad.addColorStop(1, 'rgba(249,115,22,0)');

        slotGlow = ctx.createLinearGradient(0, SLOT_Y, 0, SLOT_Y + SLOT_SIZE);
        slotGlow.addColorStop(0, 'rgba(251,191,36,0.10)');
        slotGlow.addColorStop(1, 'rgba(249,115,22,0.04)');

        cardGrad = ctx.createLinearGradient(0, -CARD_H / 2, 0, CARD_H / 2);
        cardGrad.addColorStop(0, 'rgba(46,34,20,0.96)');
        cardGrad.addColorStop(0.5, 'rgba(30,22,14,0.97)');
        cardGrad.addColorStop(1, 'rgba(22,16,10,0.98)');
      }

      function drawBackground(t) {
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-30, -30, W + 60, H + 60);
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = 'rgba(251,191,36,0.06)';
        for (var gy = 28; gy < H; gy += 40) {
          for (var gx = 28; gx < W; gx += 40) {
            ctx.fillRect(gx, gy, 1.6, 1.6);
          }
        }

        // 背景小羊装饰
        ctx.globalAlpha = 0.05;
        ctx.font = '120px ' + FONT_EMOJI;
        ctx.textAlign = 'right';
        ctx.fillText('🐑', W - 6, 120);
        ctx.textAlign = 'left';
        ctx.fillText('🐑', 4, H - 30);
        ctx.globalAlpha = 1;
      }

      function drawPlayPanel(t) {
        ctx.fillStyle = 'rgba(18,12,20,0.6)';
        roundRect(ctx, PLAY_X, PLAY_TOP, PLAY_W, PLAY_BOTTOM - PLAY_TOP, 18);
        ctx.fill();

        ctx.save();
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = 'rgba(251,191,36,0.35)';
        ctx.lineWidth = 2;
        roundRect(ctx, PLAY_X, PLAY_TOP, PLAY_W, PLAY_BOTTOM - PLAY_TOP, 18);
        ctx.stroke();
        ctx.restore();

        ctx.textAlign = 'center';
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(251,191,36,0.4)';
        ctx.fillText('SHEEP STACK  ·  LAYER ' + LEVELS[levelIndex].layers.length, W / 2, PLAY_BOTTOM - 18);
        ctx.textAlign = 'left';
      }

      function drawCardFace(c, x, y, scale, alpha, highlight) {
        ctx.save();
        ctx.translate(x + CARD_W / 2, y + CARD_H / 2);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;

        // 卡片投影，强化叠放层次
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = '#000000';
        roundRect(ctx, -CARD_W / 2 + 1, -CARD_H / 2 + 4, CARD_W, CARD_H, 10);
        ctx.fill();

        ctx.globalAlpha = alpha;
        // 卡面
        roundRect(ctx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
        ctx.fillStyle = cardGrad;
        ctx.fill();

        // 边框
        ctx.strokeStyle = c.color;
        ctx.globalAlpha = alpha * (highlight ? 1 : 0.75);
        ctx.lineWidth = highlight ? 2.4 : 1.8;
        ctx.stroke();

        // 顶部高光条
        ctx.globalAlpha = alpha * 0.22;
        ctx.fillStyle = c.color;
        roundRect(ctx, -CARD_W / 2 + 6, -CARD_H / 2 + 5, CARD_W - 12, 4, 2);
        ctx.fill();

        // 图案
        ctx.globalAlpha = alpha;
        ctx.font = '36px ' + FONT_EMOJI;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(c.pattern, 0, 3);
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      function drawBoardCards(t) {
        var i;
        for (i = 0; i < cards.length; i++) {
          var c = cards[i];
          if (c.state !== 'board') continue;
          if (c.covered) {
            // 被压住：暗一些，右下角画锁扣
            drawCardFace(c, c.x, c.y, 1, 0.42, false);
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#000000';
            roundRect(ctx, c.x, c.y, CARD_W, CARD_H, 10);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(251,191,36,0.25)';
            ctx.beginPath();
            ctx.arc(c.x + CARD_W - 13, c.y + CARD_H - 13, 5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            var isHover = hoverCard === c;
            var pulse = isHover ? 1.02 : 1;
            drawCardFace(c, c.x - (pulse - 1) * CARD_W / 2, c.y - (pulse - 1) * CARD_H / 2, pulse, 1, true);
            if (isHover) {
              ctx.strokeStyle = 'rgba(255,255,255,0.55)';
              ctx.lineWidth = 1.4;
              roundRect(ctx, c.x - 2, c.y - 2, CARD_W + 4, CARD_H + 4, 12);
              ctx.stroke();
            }
          }
        }

        // 飞向槽位的牌
        for (i = 0; i < cards.length; i++) {
          var f = cards[i];
          if (f.state !== 'flying') continue;
          drawCardFace(f, f.flyX, f.flyY, 1 - 0.14 * Math.min(1, f.flyT / 0.24), 1, true);
        }
      }

      function drawSlots(t) {
        // 槽位底板
        ctx.fillStyle = 'rgba(16,12,20,0.85)';
        roundRect(ctx, PLAY_X, SLOT_Y - 18, PLAY_W, SLOT_SIZE + 36, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(251,191,36,0.28)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(251,191,36,0.55)';
        ctx.fillText('SLOT ' + occupiedSlots() + ' / ' + SLOT_COUNT, W / 2, SLOT_Y - 6);

        for (var i = 0; i < SLOT_COUNT; i++) {
          var x = SLOT_LEFT + i * (SLOT_SIZE + SLOT_GAP);
          ctx.fillStyle = slotGlow;
          roundRect(ctx, x, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 12);
          ctx.fill();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = 'rgba(251,191,36,0.24)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 槽位里的牌（尺寸略小）
        var scale = (SLOT_SIZE - 6) / CARD_H;
        for (var j = 0; j < SLOT_COUNT; j++) {
          var c = slots[j];
          if (!c || c.state !== 'slot') continue;
          var sc = slotCenter(j);
          drawCardFace(c, sc.x, sc.y, scale, 1, true);
        }

        // 消除动画
        for (var k = 0; k < cards.length; k++) {
          var cc = cards[k];
          if (cc.state !== 'clearing') continue;
          var kk = Math.min(1, cc.clearT / 0.26);
          drawCardFace(cc, cc.clearX, cc.clearY, scale * (1 + kk * 0.4), 1 - kk, true);
        }
      }

      function drawButtons(t) {
        drawBtn(undoBtn, '撤销', undoLeft, '↩');
        drawBtn(shuffleBtn, '洗牌', shuffleLeft, '⇄');
      }

      function drawBtn(b, label, left, icon) {
        var enabled = left > 0 && phase === 'play' && inputLock <= 0;
        ctx.globalAlpha = enabled ? 1 : 0.4;
        ctx.fillStyle = 'rgba(26,18,12,0.92)';
        roundRect(ctx, b.x, b.y, b.w, b.h, 12);
        ctx.fill();
        ctx.strokeStyle = enabled ? colors.accent : 'rgba(148,163,184,0.5)';
        ctx.lineWidth = enabled ? 1.8 : 1.2;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 15px ' + FONT_UI;
        ctx.fillStyle = enabled ? colors.text : colors.muted;
        var text = icon + ' ' + label + ' (' + left + ')';
        ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2 + 1);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }

      function drawBottomInfo(t) {
        // 进度条
        var prog = totalCards > 0 ? removedCount / totalCards : 0;
        var bx = 60;
        var bw = W - 120;
        var by = 700;
        ctx.textAlign = 'left';
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(148,163,184,0.8)';
        ctx.fillText('清除进度', bx, by - 6);
        ctx.textAlign = 'right';
        ctx.fillText(removedCount + ' / ' + totalCards, bx + bw, by - 6);
        ctx.textAlign = 'left';

        ctx.fillStyle = 'rgba(120,90,60,0.25)';
        roundRect(ctx, bx, by, bw, 8, 4);
        ctx.fill();
        ctx.fillStyle = colors.accent;
        roundRect(ctx, bx, by, Math.max(4, bw * prog), 8, 4);
        ctx.fill();

        // 本关图案剩余统计
        var pool = LEVELS[levelIndex].patterns;
        var counts = {};
        for (var i = 0; i < cards.length; i++) {
          if (cards[i].state === 'removed') continue;
          counts[cards[i].pi] = (counts[cards[i].pi] || 0) + 1;
        }
        var itemW = Math.min(52, bw / pool);
        var startX = W / 2 - (pool * itemW) / 2;
        for (var p = 0; p < pool; p++) {
          var cx = startX + itemW * (p + 0.5);
          var cy = 748;
          ctx.globalAlpha = counts[p] ? 1 : 0.25;
          ctx.font = '18px ' + FONT_EMOJI;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(PATTERNS[p].e, cx, cy - 4);
          ctx.font = '700 10px ' + FONT_NUM;
          ctx.fillStyle = PATTERNS[p].c;
          ctx.fillText('x' + (counts[p] || 0), cx, cy + 14);
          ctx.textBaseline = 'alphabetic';
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }

      function drawHud(t) {
        ctx.fillStyle = 'rgba(12,9,16,0.6)';
        ctx.fillRect(0, 0, W, 66);
        ctx.fillStyle = 'rgba(251,191,36,0.25)';
        ctx.fillRect(0, 66, W, 1);

        ctx.textAlign = 'left';
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillText('STAGE', 24, 20);
        ctx.font = '900 20px ' + FONT_NUM;
        ctx.fillStyle = colors.accent;
        ctx.fillText((levelIndex + 1) + ' / ' + LEVELS.length, 24, 44);

        ctx.textAlign = 'center';
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillText('SCORE', W / 2, 20);
        ctx.font = '900 24px ' + FONT_NUM;
        ctx.fillStyle = colors.text;
        ctx.fillText(String(score), W / 2, 46);

        ctx.textAlign = 'right';
        ctx.font = '700 10px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillText('BEST', W - 24, 20);
        ctx.font = '900 16px ' + FONT_NUM;
        ctx.fillStyle = 'rgba(232,236,255,0.9)';
        ctx.fillText(String(rt.best), W - 24, 40);
        ctx.font = '700 11px ' + FONT_UI;
        ctx.fillStyle = 'rgba(251,191,36,0.85)';
        ctx.fillText('剩余 ' + remaining() + ' 张', W - 24, 58);
        ctx.textAlign = 'left';
      }

      function drawBanner() {
        if (!banner) return;
        var age = banner.max - banner.life;
        var pop = Math.min(1, age / 0.2);
        var alpha = Math.min(1, banner.life / 0.3);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(W / 2, PLAY_TOP + (PLAY_BOTTOM - PLAY_TOP) * 0.42);
        ctx.scale(0.9 + pop * 0.1, 0.9 + pop * 0.1);
        ctx.fillStyle = 'rgba(8,8,18,0.72)';
        roundRect(ctx, -180, -46, 360, 92, 16);
        ctx.fill();
        ctx.strokeStyle = banner.color;
        ctx.globalAlpha = alpha * 0.7;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.font = '900 26px ' + FONT_UI;
        ctx.fillStyle = banner.color;
        ctx.fillText(banner.title, 0, 2);
        ctx.font = '700 14px ' + FONT_UI;
        ctx.fillStyle = 'rgba(232,236,255,0.85)';
        ctx.fillText(banner.sub, 0, 30);
        ctx.restore();
      }

      function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          var a = p.life / p.max;
          if (a <= 0) continue;
          ctx.globalAlpha = Math.min(1, a);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        }
        ctx.globalAlpha = 1;
      }

      function drawPopups() {
        ctx.textAlign = 'center';
        ctx.font = '900 18px ' + FONT_NUM;
        for (var i = 0; i < popups.length; i++) {
          var pp = popups[i];
          ctx.globalAlpha = Math.max(0, Math.min(1, pp.life / pp.max));
          ctx.fillStyle = pp.color;
          ctx.fillText(pp.text, pp.x, pp.y);
        }
        ctx.globalAlpha = 1;
      }

      function drawOverlays(t) {
        if (flash > 0) {
          ctx.fillStyle = 'rgba(249,115,22,' + Math.min(0.4, flash * 0.6).toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
        }
        if (phase === 'over') {
          var k = Math.min(1, overTimer / 0.9);
          ctx.fillStyle = 'rgba(8,6,10,' + (0.3 + k * 0.4).toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
          ctx.textAlign = 'center';
          ctx.font = '900 30px ' + FONT_UI;
          ctx.fillStyle = 'rgba(249,115,22,' + k.toFixed(3) + ')';
          ctx.fillText('槽位满了', W / 2, H / 2 - 24);
          ctx.font = '700 13px ' + FONT_NUM;
          ctx.fillStyle = 'rgba(232,236,255,' + (0.7 * k).toFixed(3) + ')';
          ctx.fillText('FINAL SCORE ' + score, W / 2, H / 2 + 14);
          ctx.textAlign = 'left';
        } else if (phase === 'win') {
          var w = Math.min(1, winTimer / 0.9);
          ctx.fillStyle = 'rgba(8,6,10,' + (0.25 + w * 0.35).toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
          ctx.textAlign = 'center';
          ctx.font = '900 32px ' + FONT_UI;
          ctx.fillStyle = 'rgba(251,191,36,' + w.toFixed(3) + ')';
          ctx.fillText('全部清空！', W / 2, H / 2 - 24);
          ctx.font = '700 13px ' + FONT_NUM;
          ctx.fillStyle = 'rgba(232,236,255,' + (0.75 * w).toFixed(3) + ')';
          ctx.fillText('FINAL SCORE ' + score, W / 2, H / 2 + 14);
          ctx.textAlign = 'left';
        }
      }
    }
  });
})();
